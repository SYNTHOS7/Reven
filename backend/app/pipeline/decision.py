from app.models import Action, DecisionResult, DiagnosisResult, PaymentEvent, PolicySettings


def decide(event: PaymentEvent, diagnosis: DiagnosisResult, policy: PolicySettings) -> DecisionResult:
    # 1. Amount threshold check
    if event.amount >= policy.human_approval_amount_threshold:
        return DecisionResult(
            action=Action.ESCALATE_HUMAN,
            reason=f"Amount exceeds ₹{policy.human_approval_amount_threshold:,.0f} policy boundary",
        )

    # Format threshold percentage safely
    threshold_val = policy.diagnosis_confidence_escalation_threshold
    threshold_pct = int(threshold_val * 100) if threshold_val <= 1 else int(threshold_val)

    # 2. Confidence floor check
    if diagnosis.confidence < policy.diagnosis_confidence_escalation_threshold:
        return DecisionResult(
            action=Action.ESCALATE_HUMAN,
            reason=f"Diagnosis confidence is below {threshold_pct}%",
        )

    # 3. Retry limit check
    if event.retry_count >= policy.max_retries_per_payment:
        return DecisionResult(action=Action.STOP_LIMIT_REACHED, reason="Maximum retry count reached")

    # 4. Action matching rules
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

    # 5. Default fallback for unmatched/uncertain action
    return DecisionResult(action=Action.ESCALATE_HUMAN, reason="No safe automated action matched")
