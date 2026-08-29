from app.repository import InMemoryRepository
from app.models import CustomerHistory, EventType, PaymentEvent
from app.pipeline.engine import run_event


def test_duplicate_webhook_is_idempotent() -> None:
    repo = InMemoryRepository()
    assert repo.mark_webhook_processed("hook_1") is True
    assert repo.mark_webhook_processed("hook_1") is False


def test_re_evaluation_preserves_prepared_and_verified_recovery() -> None:
    repo = InMemoryRepository()
    event = PaymentEvent(
        id="rzp_pay_preserved_recovery",
        customer_id="customer_preserved_recovery",
        customer_name="Test customer",
        type=EventType.PAYMENT_FAILED,
        amount=100,
        failure_code="unknown_processor_failure",
        history=CustomerHistory(),
    )
    recovered = run_event(event, repo.policy)
    recovered.razorpay_payment_link_id = "plink_preserved"
    recovered.verified_recovered_amount = 100
    repo.save_results([recovered])

    re_evaluated = run_event(event, repo.policy)
    repo.save_results([re_evaluated])

    assert re_evaluated.razorpay_payment_link_id == "plink_preserved"
    assert re_evaluated.verified_recovered_amount == 100


def test_batch_summary_scopes_new_evidence_without_hiding_legacy_recovery() -> None:
    repo = InMemoryRepository()
    legacy = PaymentEvent(
        id="legacy-case", customer_id="legacy", customer_name="Legacy", type=EventType.PAYMENT_FAILED,
        amount=100, failure_code="incorrect_otp",
    )
    blocked = PaymentEvent(
        id="batch-blocked", customer_id="batch-repeat", customer_name="Batch", type=EventType.PAYMENT_FAILED,
        amount=20, failure_code="incorrect_otp", attempts_in_window=6, batch_id="buildathon-01",
    )
    escalated = PaymentEvent(
        id="batch-escalated", customer_id="batch-high", customer_name="Batch", type=EventType.PAYMENT_FAILED,
        amount=7500, failure_code="payment_failed", batch_id="buildathon-01",
    )
    recovered = PaymentEvent(
        id="batch-recovered", customer_id="batch-recovered", customer_name="Batch", type=EventType.PAYMENT_FAILED,
        amount=101, failure_code="incorrect_otp", batch_id="buildathon-01",
    )
    recovered.expected_cause = run_event(recovered, repo.policy).diagnosis.cause
    repo.events = [legacy, blocked, escalated, recovered]
    repo.save_results([run_event(event, repo.policy) for event in repo.events])
    repo.record_recovery("legacy-case", "plink-legacy", 100)
    repo.record_recovery("batch-recovered", "plink-batch", 101)

    summary = repo.batch_summary("buildathon-01")

    assert summary.total_cases == 3
    assert summary.trust_gate_blocks == 1
    assert summary.human_review_escalations == 1
    assert summary.verified_recovery_count == 1
    assert summary.verified_recovery_amount == 101
    assert summary.diagnosis_labelled_cases == 1
    assert summary.diagnosis_accuracy_pct == 100
    assert repo.verified_recovery_summary() == (201, 2)
    assert repo.batch_summary("missing").total_cases == 0
