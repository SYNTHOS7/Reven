from app.models import Action, DiagnosisResult, DecisionResult, EventType, PaymentEvent, PipelineResult, StageResult
from app.similar_cases import find_similar_cases


def event(event_id: str, **overrides) -> PaymentEvent:
    values = {
        "id": event_id,
        "customer_id": f"customer-{event_id}",
        "customer_name": "Test customer",
        "type": EventType.PAYMENT_FAILED,
        "amount": 324,
        "failure_code": "card_not_supported",
        "payment_method": "card",
        "source": "razorpay_test",
    }
    values.update(overrides)
    return PaymentEvent(**values)


def result(item: PaymentEvent, recovered: float = 0) -> PipelineResult:
    return PipelineResult(
        run_id=f"run-{item.id}", event_id=item.id, customer_id=item.customer_id, customer_name=item.customer_name,
        event_type=item.type, amount=item.amount, failure_code=item.failure_code, occurred_at=item.occurred_at,
        detection=StageResult(status="detected", reason="test"), trust_gate=StageResult(status="clear", reason="test"),
        diagnosis=DiagnosisResult(cause="unsupported_card", method="rule", confidence=1, reason="test"),
        decision=DecisionResult(action=Action.ESCALATE_HUMAN, reason="test"), verified_recovered_amount=recovered,
    )


def test_similar_cases_returns_same_source_matches_and_not_current_case() -> None:
    current = event("current")
    match = event("match")
    different_source = event("demo", source="demo")
    output = find_similar_cases(current, result(current), [current, match, different_source], [result(current), result(match, 100), result(different_source, 500)])

    assert output["scope"] == "Razorpay Test Mode history"
    assert output["comparable_case_count"] == 1
    assert output["cases"][0]["event_id"] == "match"
    assert output["verified_recovery_count"] == 1
    assert output["verified_recovered_amount"] == 100


def test_similar_cases_empty_state_does_not_invent_evidence() -> None:
    current = event("current")
    output = find_similar_cases(current, result(current), [current], [result(current)])
    assert output["cases"] == []
    assert output["comparable_case_count"] == 0
    assert output["verified_recovered_amount"] == 0
