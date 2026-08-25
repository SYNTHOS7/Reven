from uuid import uuid4

from app.models import (
    Action,
    DiagnosisResult,
    PaymentEvent,
    PipelineResult,
    PolicySettings,
)
from app.pipeline.communication import generate_message
from app.pipeline.decision import decide
from app.pipeline.detection import detect
from app.pipeline.diagnosis import diagnose
from app.pipeline.trust_gate import check_trust


def run_event(
    event: PaymentEvent,
    policy: PolicySettings,
    run_id: str | None = None,
    historical_examples: list[dict] | None = None,
) -> PipelineResult:
    current_run_id = run_id or str(uuid4())
    detection = detect(event)

    if detection.status == "ignored":
        diagnosis = DiagnosisResult(cause="not_applicable", method="rule", confidence=1, reason=detection.reason)
        from app.models import DecisionResult

        decision = DecisionResult(action=Action.NO_ACTION, reason="Detection did not flag this event")
        trust = check_trust(event, policy)
    else:
        trust = check_trust(event, policy)
        if trust.status == "suspicious":
            diagnosis = DiagnosisResult(
                cause="suspicious_activity",
                method="trust_gate",
                confidence=1,
                reason=trust.reason,
            )
            from app.models import DecisionResult

            decision = DecisionResult(action=Action.REFUSE_SUSPICIOUS, reason="Trust gate stopped recovery")
        else:
            diagnosis = diagnose(event, historical_examples, policy)
            decision = decide(event, diagnosis, policy)

    return PipelineResult(
        run_id=current_run_id,
        event_id=event.id,
        customer_id=event.customer_id,
        customer_name=event.customer_name,
        event_type=event.type,
        amount=event.amount,
        failure_code=event.failure_code,
        occurred_at=event.occurred_at,
        detection=detection,
        trust_gate=trust,
        diagnosis=diagnosis,
        decision=decision,
        generated_message=generate_message(event, decision.action),
        verified_recovered_amount=0,
        source=event.source,
        source_event_id=event.source_event_id,
    )
