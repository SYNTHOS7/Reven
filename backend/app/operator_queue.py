"""Deterministic operator queue for real Test Mode evidence only."""

from app.models import Action, PaymentEvent, PipelineResult, RecoveryQueueItem, RecoveryQueueResponse


def build_operator_queue(events: list[PaymentEvent], results: list[PipelineResult]) -> RecoveryQueueResponse:
    latest: dict[str, PipelineResult] = {}
    for result in results:
        if result.source != "razorpay_test":
            continue
        previous = latest.get(result.event_id)
        if previous is None or result.created_at > previous.created_at:
            latest[result.event_id] = result

    items: list[RecoveryQueueItem] = []
    excluded_suspicious = 0
    for event in events:
        if event.source != "razorpay_test" or event.id not in latest:
            continue
        result = latest[event.id]
        if result.verified_recovered_amount > 0 or result.razorpay_payment_link_id:
            continue
        if result.trust_gate.status == "suspicious":
            excluded_suspicious += 1
            continue
        action = result.decision.action
        if action in {Action.NO_ACTION, Action.STOP_LIMIT_REACHED, Action.REFUSE_SUSPICIOUS}:
            continue

        action_weight = {
            Action.ESCALATE_HUMAN: 45,
            Action.CREATE_PAYMENT_LINK: 40,
            Action.UPDATE_PAYMENT_METHOD: 35,
            Action.RETRY_LATER: 25,
        }.get(action, 0)
        amount_weight = min(35, int(event.amount / 500))
        confidence_weight = int(result.diagnosis.confidence * 20)
        score = min(100, action_weight + amount_weight + confidence_weight)
        priority = "high" if score >= 70 else "medium" if score >= 45 else "normal"
        reason = f"{result.decision.reason}. Diagnosis confidence: {result.diagnosis.confidence:.0%}."
        items.append(
            RecoveryQueueItem(
                event_id=event.id,
                amount=event.amount,
                failure_code=event.failure_code,
                decision_action=action,
                priority_score=score,
                priority=priority,
                reason=reason,
                requires_human_review=action == Action.ESCALATE_HUMAN,
            )
        )

    items.sort(key=lambda item: (-item.priority_score, -item.amount, item.event_id))
    return RecoveryQueueResponse(
        source_scope="Saved Razorpay Test Mode cases only",
        items=items,
        total_open_cases=len(items),
        excluded_suspicious_cases=excluded_suspicious,
    )
