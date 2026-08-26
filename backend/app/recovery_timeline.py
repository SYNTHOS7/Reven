"""Read-only recovery timeline and retry eligibility planning.

There is intentionally no background worker here. A failed payment cannot be charged by
the processor API, so a "retry" must remain a future, operator-controlled customer flow.
"""

from datetime import timedelta

from app.models import Action, PaymentEvent, PipelineResult, RecoveryTimelineItem, RecoveryTimelineResponse

RETRY_DELAY_HOURS = 6


def build_recovery_timeline(event: PaymentEvent, result: PipelineResult) -> RecoveryTimelineResponse:
    items = [
        RecoveryTimelineItem(
            stage="detected",
            title="Failure event recorded",
            status="completed",
            occurred_at=result.occurred_at,
            detail=f"{event.type.value.replace('_', ' ')} received with failure code {event.failure_code}.",
        ),
        RecoveryTimelineItem(
            stage="trust_gate",
            title="Trust Gate checked",
            status="completed" if result.trust_gate.status == "clear" else "blocked",
            occurred_at=result.created_at,
            detail=result.trust_gate.reason,
        ),
        RecoveryTimelineItem(
            stage="diagnosis",
            title="Cause diagnosed",
            status="completed" if result.trust_gate.status == "clear" else "blocked",
            occurred_at=result.created_at,
            detail=f"{result.diagnosis.cause.replace('_', ' ')} · {result.diagnosis.confidence:.0%} confidence.",
        ),
    ]

    if result.trust_gate.status == "suspicious":
        items.append(
            RecoveryTimelineItem(
                stage="recovery",
                title="Recovery blocked",
                status="blocked",
                detail="No recovery workflow is eligible until an operator investigates the suspicious pattern.",
            )
        )
        return RecoveryTimelineResponse(event_id=event.id, items=items)

    if result.verified_recovered_amount > 0:
        items.append(
            RecoveryTimelineItem(
                stage="outcome",
                title="Recovery verified",
                status="completed",
                occurred_at=result.recovered_at,
                detail=f"₹{result.verified_recovered_amount:,.0f} counted only after Razorpay payment confirmation.",
            )
        )
        return RecoveryTimelineResponse(event_id=event.id, items=items)

    if result.decision.action == Action.RETRY_LATER:
        eligible_at = result.created_at + timedelta(hours=RETRY_DELAY_HOURS)
        items.append(
            RecoveryTimelineItem(
                stage="retry_window",
                title="Bounded retry window",
                status="waiting",
                detail=f"Eligible after a {RETRY_DELAY_HOURS}-hour cooling-off period; no retry has been performed.",
            )
        )
        return RecoveryTimelineResponse(
            event_id=event.id,
            items=items,
            next_eligible_at=eligible_at,
            next_eligibility_note="An operator must still confirm the retry path. The timeline never triggers a payment attempt.",
        )

    if result.decision.action == Action.ESCALATE_HUMAN:
        detail = "An operator must review the evidence before any recovery action is considered."
    elif result.decision.action == Action.STOP_LIMIT_REACHED:
        detail = "The active retry or customer-contact limit prevents any new recovery attempt."
    elif result.decision.action == Action.CREATE_PAYMENT_LINK:
        detail = "One operator-controlled Razorpay Payment Link may be prepared; payment must later be verified by webhook."
    elif result.decision.action == Action.UPDATE_PAYMENT_METHOD:
        detail = "A policy-compliant update-payment-method request may be prepared; it is not sent automatically."
    else:
        detail = "No recovery workflow is currently eligible under policy."

    status = "ready_for_operator" if result.decision.action in {
        Action.ESCALATE_HUMAN,
        Action.CREATE_PAYMENT_LINK,
        Action.UPDATE_PAYMENT_METHOD,
    } else "blocked"
    items.append(
        RecoveryTimelineItem(
            stage="next_action",
            title="Next bounded step",
            status=status,
            detail=detail,
        )
    )
    return RecoveryTimelineResponse(event_id=event.id, items=items)
