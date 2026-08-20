import json
from typing import Literal

from pydantic import BaseModel, Field

from app.config import AppConfig
from app.models import DiagnosisResult, PaymentEvent


class GeminiDiagnosis(BaseModel):
    cause: Literal[
        "temporary_funds_shortage",
        "expired_payment_method",
        "lapsed_mandate",
        "temporary_bank_failure",
        "customer_abandoned_payment",
        "unknown",
    ]
    confidence: float = Field(ge=0, le=1)
    reason: str = Field(min_length=5, max_length=300)


def diagnose_ambiguous_with_gemini(event: PaymentEvent, config: AppConfig) -> DiagnosisResult | None:
    if not config.gemini_api_key:
        return None
    try:
        from google import genai
        from google.genai import types

        prompt = (
            "Classify this ambiguous failed payment for a bounded recovery workflow. "
            "Use only the supplied processor evidence. Do not infer identity or protected traits.\n"
            f"failure_code={event.failure_code}\n"
            f"error_description={event.error_description or 'not supplied'}\n"
            f"payment_method={event.payment_method or 'unknown'}\n"
            f"amount_inr={event.amount}\n"
            f"successful_payments={event.history.successful_payments}\n"
            f"prior_failures={event.history.prior_failures}\n"
            f"customer_tenure_days={event.history.tenure_days}"
        )
        with genai.Client(api_key=config.gemini_api_key) as client:
            response = client.models.generate_content(
                model=config.gemini_model,
                contents=prompt,
                config=types.GenerateContentConfig(
                    temperature=0,
                    response_mime_type="application/json",
                    response_schema=GeminiDiagnosis,
                ),
            )
        parsed = response.parsed or json.loads(response.text or "{}")
        diagnosis = GeminiDiagnosis.model_validate(parsed)
        return DiagnosisResult(
            cause=diagnosis.cause,
            method="llm",
            confidence=diagnosis.confidence,
            reason=diagnosis.reason,
        )
    except Exception:
        # Model, schema, quota and network failures fail closed. Decision will
        # escalate this low-confidence case instead of inventing an action.
        return None
