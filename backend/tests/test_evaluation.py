from app.evaluation import run_evaluation
from app.models import Action, EventType, PaymentEvent
from app.pipeline.engine import run_event
from app.repository import Repository


def test_empty_repository_does_not_fabricate_metrics() -> None:
    repo = Repository()
    response = run_evaluation(repo)
    assert response.scorecard.total_cases == 0
    assert response.scorecard.labeled_cases == 0
    assert response.scorecard.diagnosis_accuracy_pct == 0
    assert response.results == []


def test_diagnosis_accuracy_uses_cause_only_labels_without_requiring_action_labels() -> None:
    repo = Repository()
    first = PaymentEvent(
        id="labelled-correct",
        customer_id="customer-one",
        customer_name="Customer One",
        type=EventType.PAYMENT_FAILED,
        amount=100,
        failure_code="incorrect_otp",
    )
    second = PaymentEvent(
        id="labelled-incorrect",
        customer_id="customer-two",
        customer_name="Customer Two",
        type=EventType.PAYMENT_FAILED,
        amount=100,
        failure_code="incorrect_otp",
    )
    expected = run_event(first, repo.policy)
    first.expected_cause = expected.diagnosis.cause
    second.expected_cause = "intentionally_incorrect_label"
    second.expected_action = Action.ESCALATE_HUMAN
    repo.events = [first, second]

    response = run_evaluation(repo)

    assert response.scorecard.labeled_cases == 2
    assert response.scorecard.diagnosis_labelled_cases == 2
    assert response.scorecard.action_labelled_cases == 1
    assert response.scorecard.diagnosis_accuracy_pct == 50.0


def test_diagnosis_accuracy_excludes_human_labelled_trust_gate_blocks() -> None:
    repo = Repository()
    blocked = PaymentEvent(
        id="labelled-safety-block",
        customer_id="repeat-customer",
        customer_name="Repeat customer",
        type=EventType.PAYMENT_FAILED,
        amount=20,
        failure_code="payment_failed",
        attempts_in_window=6,
        expected_cause="temporary_bank_failure",
    )
    repo.events = [blocked]

    response = run_evaluation(repo)

    assert response.scorecard.diagnosis_labelled_cases == 0
    assert response.scorecard.diagnosis_excluded_safety_blocks == 1
    assert response.scorecard.diagnosis_accuracy_pct == 0
