import pytest
from fastapi.testclient import TestClient

from app.main import app, repository
from app.models import Action, CustomerHistory, EventType, PaymentEvent, PolicySettings
from app.pipeline.decision import decide
from app.pipeline.diagnosis import diagnose
from app.pipeline.engine import run_event


def make_event(**overrides) -> PaymentEvent:
    data = {
        "id": "rzp_test_event_123",
        "customer_id": "cus_judge_test",
        "customer_name": "Rohan Sharma",
        "type": EventType.PAYMENT_FAILED,
        "amount": 1499,
        "failure_code": "insufficient_funds",
        "history": CustomerHistory(successful_payments=5, prior_failures=1, tenure_days=120),
    }
    data.update(overrides)
    return PaymentEvent(**data)


def test_low_confidence_case_triggers_human_review() -> None:
    event = make_event(failure_code="unknown_processor_failure")
    policy = PolicySettings(diagnosis_confidence_escalation_threshold=0.6)
    result = run_event(event, policy)

    assert result.diagnosis.confidence < 0.6
    assert result.decision.action == Action.ESCALATE_HUMAN
    assert "confidence" in result.decision.reason.lower() or "below" in result.decision.reason.lower()


def test_amount_above_threshold_triggers_human_review() -> None:
    event = make_event(amount=10000, failure_code="insufficient_funds")
    policy = PolicySettings(human_approval_amount_threshold=5000)
    result = run_event(event, policy)

    assert result.decision.action == Action.ESCALATE_HUMAN
    assert "amount" in result.decision.reason.lower() or "exceeds" in result.decision.reason.lower()
    assert "₹5,000" in result.decision.reason or "5000" in result.decision.reason


def test_generic_unknown_evidence_does_not_trigger_unsafe_action() -> None:
    event = make_event(
        failure_code="generic_error",
        error_description=None,
        payment_method=None,
        history=CustomerHistory(successful_payments=0, prior_failures=0),
    )
    policy = PolicySettings()
    diagnosis = diagnose(event)
    decision = decide(event, diagnosis, policy)

    assert diagnosis.cause == "unknown"
    assert diagnosis.reason == "Unknown from available processor evidence"
    assert decision.action == Action.ESCALATE_HUMAN


def test_payment_link_creation_is_not_treated_as_recovered() -> None:
    event = make_event(amount=2500, failure_code="customer_cancelled")
    policy = PolicySettings(human_approval_amount_threshold=5000)
    result = run_event(event, policy)

    assert result.decision.action == Action.CREATE_PAYMENT_LINK
    assert result.verified_recovered_amount == 0
    assert result.razorpay_payment_link_id is None


def test_verified_razorpay_paid_webhook_is_treated_as_recovered() -> None:
    repository.events.clear()
    repository.results.clear()
    repository.processed_webhook_ids.clear()

    event = make_event(id="rzp_pay_webhook_test", amount=1500, failure_code="customer_cancelled")
    result = run_event(event, PolicySettings())
    result.razorpay_payment_link_id = "plink_test_123"
    repository.events.append(event)
    repository.results.append(result)

    payload = {
        "event": "payment_link.paid",
        "payload": {
            "payment_link": {
                "entity": {
                    "id": "plink_test_123",
                    "notes": {"reven_event_id": "rzp_pay_webhook_test"},
                    "amount_paid": 150000,
                }
            }
        },
    }

    with TestClient(app) as client:
        response = client.post(
            "/webhooks/razorpay",
            headers={"x-razorpay-event-id": "hook_test_123"},
            json=payload,
        )
        assert response.status_code == 200
        assert response.json()["status"] == "recovery_recorded"
        assert repository.results[-1].verified_recovered_amount == 1500


def test_policy_replay_does_not_create_real_link_or_alter_recovery_metrics() -> None:
    repository.events.clear()
    repository.results.clear()

    event = make_event(id="rzp_replay_test", amount=4000, failure_code="customer_cancelled")
    result = run_event(event, PolicySettings(human_approval_amount_threshold=3000))
    # Original policy threshold 3000 -> amount 4000 causes ESCALATE_HUMAN
    assert result.decision.action == Action.ESCALATE_HUMAN

    repository.events.append(event)
    repository.results.append(result)

    with TestClient(app) as client:
        # Replay with higher threshold (5000)
        replay_payload = {
            "event_id": event.id,
            "policy": {
                "max_retries_per_payment": 3,
                "max_messages_per_customer_per_day": 1,
                "human_approval_amount_threshold": 5000,
                "diagnosis_confidence_escalation_threshold": 0.6,
                "trust_gate_attempts_window_hours": 24,
                "trust_gate_max_attempts_in_window": 5,
                "tiny_amount_threshold": 20,
            },
        }
        res = client.post(f"/events/{event.id}/replay", json=replay_payload)
        assert res.status_code == 200
        body = res.json()

        assert body["is_dry_run"] is True
        assert "Dry run" in body["disclaimer"]
        assert body["original_decision"]["action"] == "escalate_human"
        assert body["proposed_decision"]["action"] == "create_payment_link"

        # Verify state was NOT modified
        assert repository.results[-1].decision.action == Action.ESCALATE_HUMAN
        assert repository.results[-1].verified_recovered_amount == 0
        assert repository.results[-1].razorpay_payment_link_id is None
