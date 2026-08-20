from app.models import Action, DecisionResult, DiagnosisResult, PaymentEvent, PolicySettings


def decide(event: PaymentEvent, diagnosis: DiagnosisResult, policy: PolicySettings) -> DecisionResult:
    if event.amount >= policy.human_approval_amount_threshold:
        return DecisionResult(
            action=Action.ESCALATE_HUMAN,
            reason=f"₹{event.amount:,.0f} meets the ₹{policy.human_approval_amount_threshold:,.0f} approval threshold",
        )
    if diagnosis.confidence < policy.diagnosis_confidence_escalation_threshold:
        return DecisionResult(
            action=Action.ESCALATE_HUMAN,
            reason=f"Confidence {diagnosis.confidence:.2f} is below the {policy.diagnosis_confidence_escalation_threshold:.2f} floor",
        )
    if event.retry_count >= policy.max_retries_per_payment:
        return DecisionResult(action=Action.STOP_LIMIT_REACHED, reason="Maximum retry count reached")

    if diagnosis.cause in {"temporary_funds_shortage", "temporary_bank_failure"}:
        return DecisionResult(action=Action.RETRY_LATER, reason="Transient cause; retry within policy")
    if diagnosis.cause in {"expired_payment_method", "lapsed_mandate"}:
        if event.messages_sent_today >= policy.max_messages_per_customer_per_day:
            return DecisionResult(action=Action.STOP_LIMIT_REACHED, reason="Daily customer-contact limit reached")
        return DecisionResult(
            action=Action.UPDATE_PAYMENT_METHOD,
            reason="Customer must update the payment method before recovery",
            requires_customer_contact=True,
        )
    if diagnosis.cause in {"overdue_receivable", "customer_abandoned_payment"}:
        if event.messages_sent_today >= policy.max_messages_per_customer_per_day:
            return DecisionResult(action=Action.STOP_LIMIT_REACHED, reason="Daily customer-contact limit reached")
        return DecisionResult(
            action=Action.CREATE_PAYMENT_LINK,
            reason="A bounded payment link is the least risky recovery path",
            requires_customer_contact=True,
        )
    return DecisionResult(action=Action.ESCALATE_HUMAN, reason="No safe automated action matched")
