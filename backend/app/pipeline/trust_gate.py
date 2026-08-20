from app.models import PaymentEvent, PolicySettings, StageResult


def check_trust(event: PaymentEvent, policy: PolicySettings) -> StageResult:
    if event.attempts_in_window > policy.trust_gate_max_attempts_in_window:
        return StageResult(
            status="suspicious",
            reason=(
                f"{event.attempts_in_window} attempts exceed the "
                f"{policy.trust_gate_max_attempts_in_window}-attempt policy window"
            ),
        )
    if event.amount <= policy.tiny_amount_threshold and event.attempts_in_window >= 3:
        return StageResult(status="suspicious", reason="Repeated tiny-amount attempts resemble card testing")
    return StageResult(status="clear", reason="No configured abuse pattern matched")
