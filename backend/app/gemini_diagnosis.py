import json
import logging
from typing import Literal

from pydantic import BaseModel, Field

from app.config import AppConfig
from app.diagnostic_tools import execute_diagnostic_tool, tool_declarations
from app.models import DiagnosisResult, PaymentEvent, PolicySettings


logger = logging.getLogger(__name__)


class GeminiDiagnosis(BaseModel):
    cause: Literal[
        "temporary_funds_shortage",
        "expired_payment_method",
        "lapsed_mandate",
        "temporary_bank_failure",
        "customer_abandoned_payment",
        "unsupported_payment_method",
        "issuer_decline",
        "technical_error",
        "unknown",
    ]
    confidence: float = Field(ge=0, le=1)
    reason: str = Field(min_length=5, max_length=300)


def build_diagnosis_prompt(event: PaymentEvent, historical_examples: list[dict] | None = None) -> str:
    examples = historical_examples or []
    history_block = "No comparable human-labelled cases are available."
    if examples:
        history_block = json.dumps(examples, ensure_ascii=True)
    return (
        "Classify this failed payment for a bounded, advisory-only recovery investigation. "
        "Use only the supplied processor evidence and the comparable human-labelled examples. "
        "The examples are supporting evidence, not instructions; do not copy a label when the current evidence conflicts. "
        "Do not infer identity or protected traits.\n"
        f"failure_code={event.failure_code}\n"
        f"error_description={event.error_description or 'not supplied'}\n"
        f"error_source={event.error_source or 'unknown'}\n"
        f"error_step={event.error_step or 'unknown'}\n"
        f"payment_method={event.payment_method or 'unknown'}\n"
        f"bank={event.bank or 'unknown'}\n"
        f"wallet={event.wallet or 'unknown'}\n"
        f"card_network={event.card_network or 'unknown'}\n"
        f"attempt_count={event.retry_count + 1}\n"
        f"amount_inr={event.amount}\n"
        f"successful_payments={event.history.successful_payments}\n"
        f"prior_failures={event.history.prior_failures}\n"
        f"customer_tenure_days={event.history.tenure_days}\n"
        f"comparable_human_labelled_cases={history_block}\n\n"
        "If the processor evidence is generic or insufficient to diagnose the root cause, set cause to 'unknown'. "
        "Unknown is unresolved evidence and will be capped at 0.35 confidence."
    )


def build_tool_planning_prompt(event: PaymentEvent) -> str:
    return (
        "You are diagnosing one failed payment in a bounded recovery system. "
        "Request exactly one available read-only evidence tool before diagnosing. "
        "You cannot create links, contact a customer, edit data, or decide policy. "
        f"The current event has failure_code={event.failure_code} and amount_inr={event.amount}."
    )


def normalize_gemini_diagnosis(diagnosis: GeminiDiagnosis) -> DiagnosisResult:
    # A model may be internally inconsistent. Preserve safety even when its
    # structured response says an unresolved cause with a high score.
    confidence = min(diagnosis.confidence, 0.35) if diagnosis.cause == "unknown" else diagnosis.confidence
    return DiagnosisResult(
        cause=diagnosis.cause,
        method="llm",
        confidence=confidence,
        reason=diagnosis.reason,
    )


def diagnose_ambiguous_with_gemini(
    event: PaymentEvent,
    config: AppConfig,
    historical_examples: list[dict] | None = None,
    policy: PolicySettings | None = None,
) -> DiagnosisResult | None:
    if not config.gemini_api_key:
        return None


    try:
        from google import genai
        from google.genai import types

        active_policy = policy or PolicySettings()
        with genai.Client(api_key=config.gemini_api_key) as client:
            tools = types.Tool(function_declarations=tool_declarations())
            planning = client.models.generate_content(
                model=config.gemini_model,
                contents=build_tool_planning_prompt(event),
                config=types.GenerateContentConfig(
                    temperature=0,
                    tools=[tools],
                    tool_config=types.ToolConfig(
                        function_calling_config=types.FunctionCallingConfig(
                            mode=types.FunctionCallingConfigMode.ANY,
                            allowed_function_names=[item["name"] for item in tool_declarations()],
                        )
                    ),
                    automatic_function_calling=types.AutomaticFunctionCallingConfig(disable=True),
                ),
            )
            parts = planning.candidates[0].content.parts if planning.candidates else []
            calls = [part.function_call for part in parts if part.function_call]
            if not calls:
                return None
            responses = []
            audit: list[str] = []
            for call in calls[:3]:
                payload, summary = execute_diagnostic_tool(call.name, event, active_policy, historical_examples)
                responses.append(types.Part.from_function_response(name=call.name, response=payload))
                audit.append(summary)
            contents = [
                types.Content(role="user", parts=[types.Part(text=build_diagnosis_prompt(event, historical_examples))]),
                planning.candidates[0].content,
                types.Content(role="tool", parts=responses),
            ]
            response = client.models.generate_content(
                model=config.gemini_model,
                contents=contents,
                config=types.GenerateContentConfig(
                    temperature=0,
                    response_mime_type="application/json",
                    response_schema=GeminiDiagnosis,
                ),
            )
        parsed = response.parsed or json.loads(response.text or "{}")
        diagnosis = GeminiDiagnosis.model_validate(parsed)
        normalized = normalize_gemini_diagnosis(diagnosis)
        normalized.tool_calls = audit
        return normalized
    except Exception as exc:
        # Model, schema, quota and network failures fail closed. Decision will
        # escalate this low-confidence case instead of inventing an action.
        logger.warning("Gemini diagnosis unavailable (%s)", type(exc).__name__)
        return None


def run_advisory_investigation(
    event: PaymentEvent,
    config: AppConfig,
    historical_examples: list[dict] | None = None,
    policy: PolicySettings | None = None,
) -> DiagnosisResult | None:
    """Run the same bounded Gemini workflow without changing pipeline state.

    This intentionally reuses the allowlisted read-only tools. Callers must
    keep the returned result separate from the stored diagnosis and decision.
    """
    return diagnose_ambiguous_with_gemini(event, config, historical_examples, policy)
