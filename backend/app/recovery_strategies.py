"""Generate bounded, explainable recovery options from a completed pipeline result.

This module deliberately has no Razorpay client, message sender, or mutation path. It
turns an already policy-evaluated decision into operator-readable next steps.
"""

from app.models import Action, PipelineResult, PolicySettings, RecoveryStrategiesResponse, RecoveryStrategy


def _strategy(
    strategy_id: str,
    title: str,
    description: str,
    status: str,
    rationale: str,
    next_step: str,
) -> RecoveryStrategy:
    return RecoveryStrategy(
        id=strategy_id,
        title=title,
        description=description,
        status=status,
        rationale=rationale,
        next_step=next_step,
    )


def build_recovery_strategies(
    result: PipelineResult,
    policy: PolicySettings,
) -> RecoveryStrategiesResponse:
    """Return only policy-bounded options for a completed case.

    An option is "allowed" only when it exactly matches the decision that the
    pipeline already made. Alternatives are explicitly review-only, so an LLM or
    UI cannot smuggle an action around the deterministic policy engine.
    """
    decision = result.decision.action
    cause = result.diagnosis.cause.replace("_", " ")

    if result.trust_gate.status == "suspicious":
        return RecoveryStrategiesResponse(
            event_id=result.event_id,
            strategies=[
                _strategy(
                    "stop-and-investigate",
                    "Stop recovery and investigate",
                    "Do not retry, contact the customer, or create a payment link for this case.",
                    "blocked",
                    f"Trust Gate blocked the case: {result.trust_gate.reason}",
                    "Review the suspicious pattern in the evidence ledger before any further operator action.",
                )
            ],
        )

    if decision == Action.RETRY_LATER:
        return RecoveryStrategiesResponse(
            event_id=result.event_id,
            strategies=[
                _strategy(
                    "bounded-retry",
                    "Retry after a bounded delay",
                    "A transient processor or funds issue may resolve without customer contact.",
                    "allowed",
                    f"Diagnosis: {cause}. {result.decision.reason}",
                    f"Schedule one retry while remaining below the {policy.max_retries_per_payment}-retry limit.",
                )
            ],
        )

    if decision == Action.UPDATE_PAYMENT_METHOD:
        return RecoveryStrategiesResponse(
            event_id=result.event_id,
            strategies=[
                _strategy(
                    "update-payment-method",
                    "Ask for an updated payment method",
                    "Use one bounded customer-contact attempt to request a valid payment method.",
                    "allowed",
                    f"Diagnosis: {cause}. {result.decision.reason}",
                    "Prepare the approved message; do not exceed the daily customer-contact limit.",
                )
            ],
        )

    if decision == Action.CREATE_PAYMENT_LINK:
        return RecoveryStrategiesResponse(
            event_id=result.event_id,
            strategies=[
                _strategy(
                    "operator-payment-link",
                    "Offer one payment link",
                    "Create one operator-reviewed Razorpay Payment Link for the outstanding amount.",
                    "allowed",
                    f"Diagnosis: {cause}. {result.decision.reason}",
                    "Create the link, then count revenue only if a signed Razorpay paid webhook arrives.",
                )
            ],
        )

    if decision == Action.ESCALATE_HUMAN:
        alternatives: list[RecoveryStrategy] = [
            _strategy(
                "human-review",
                "Request human review",
                "A reviewer must validate evidence before choosing any recovery action.",
                "requires_human_review",
                result.decision.reason,
                "Review the processor evidence, Trust Gate result, and diagnosis in the case timeline.",
            )
        ]
        if result.diagnosis.cause in {"unsupported_payment_method", "unsupported_card", "issuer_decline"}:
            alternatives.append(
                _strategy(
                    "offer-supported-method",
                    "Consider a supported payment method",
                    "A different payment method may help, but this case is not approved for outreach yet.",
                    "requires_human_review",
                    f"Diagnosis suggests {cause}; policy has not approved a customer action.",
                    "A reviewer can decide whether a single, policy-compliant alternative-method request is appropriate.",
                )
            )
        return RecoveryStrategiesResponse(event_id=result.event_id, strategies=alternatives)

    if decision == Action.STOP_LIMIT_REACHED:
        return RecoveryStrategiesResponse(
            event_id=result.event_id,
            strategies=[
                _strategy(
                    "respect-policy-limit",
                    "Respect the recovery limit",
                    "Further recovery attempts are disabled for this payment under the active policy.",
                    "blocked",
                    result.decision.reason,
                    "Wait for new, independently verified context or review the policy outside this customer flow.",
                )
            ],
        )

    return RecoveryStrategiesResponse(
        event_id=result.event_id,
        strategies=[
            _strategy(
                "no-action",
                "No recovery action",
                "This event is not eligible for a recovery action.",
                "blocked",
                result.decision.reason,
                "Keep the audit trail; do not create a payment or customer-contact workflow.",
            )
        ],
    )
