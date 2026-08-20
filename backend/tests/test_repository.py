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
