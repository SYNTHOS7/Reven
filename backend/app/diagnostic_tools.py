"""Read-only evidence tools available to the diagnosis model."""

from typing import Any

from app.models import PaymentEvent, PolicySettings

ALLOWED_DIAGNOSTIC_TOOLS = {
    "get_processor_context",
    "get_retry_and_trust_context",
    "get_labelled_similar_cases",
}


def tool_declarations() -> list[dict[str, Any]]:
    """A zero-argument allowlist: the model cannot choose another case or customer."""
    return [
        {
            "name": "get_processor_context",
            "description": "Returns redacted processor failure context for the current payment only.",
            "parameters": {"type": "object", "properties": {}},
        },
        {
            "name": "get_retry_and_trust_context",
            "description": "Returns retry counts and Trust Gate thresholds for the current payment only.",
            "parameters": {"type": "object", "properties": {}},
        },
        {
            "name": "get_labelled_similar_cases",
            "description": "Returns up to three same-source, human-labelled comparable cases. These are supporting evidence only.",
            "parameters": {"type": "object", "properties": {}},
        },
    ]


def execute_diagnostic_tool(
    name: str,
    event: PaymentEvent,
    policy: PolicySettings,
    historical_examples: list[dict] | None,
) -> tuple[dict[str, Any], str]:
    """Execute a permitted read-only tool and return a compact audit summary."""
    if name not in ALLOWED_DIAGNOSTIC_TOOLS:
        raise ValueError("Diagnostic tool is not permitted")

    if name == "get_processor_context":
        context = {
            "failure_code": event.failure_code,
            "error_description": event.error_description or "not supplied",
            "error_source": event.error_source or "not supplied",
            "error_step": event.error_step or "not supplied",
            "payment_method": event.payment_method or "not supplied",
            "bank": event.bank or "not supplied",
            "card_network": event.card_network or "not supplied",
            "amount_inr": event.amount,
        }
        return context, "Read redacted processor failure context"

    if name == "get_retry_and_trust_context":
        context = {
            "recorded_retry_count": event.retry_count,
            "attempts_in_window": event.attempts_in_window,
            "trust_gate_window_hours": policy.trust_gate_attempts_window_hours,
            "trust_gate_max_attempts": policy.trust_gate_max_attempts_in_window,
            "daily_contact_count": event.messages_sent_today,
            "daily_contact_cap": policy.max_messages_per_customer_per_day,
        }
        return context, "Read retry and Trust Gate context"

    examples = historical_examples or []
    return {"examples": examples, "count": len(examples)}, f"Read {len(examples)} human-labelled comparable case(s)"
