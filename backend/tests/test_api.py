from fastapi.testclient import TestClient
from unittest.mock import AsyncMock

from app.main import app, config, razorpay, repository
from app.models import CustomerHistory, EventType, PaymentEvent
from app.pipeline.engine import run_event


def test_signed_event_path_ingests_and_evaluates_payment_failure() -> None:
    repository.events.clear()
    repository.results.clear()
    repository.scorecards.clear()
    payload = {
        "event": "payment.failed",
        "payload": {
            "payment": {
                "entity": {
                    "id": "pay_api_test",
                    "amount": 249900,
                    "status": "failed",
                    "method": "upi",
                    "contact": "+919876543210",
                    "error_reason": "incorrect_otp",
                    "error_description": "Incorrect OTP",
                    "created_at": 1787260800,
                    "notes": {},
                }
            }
        },
    }
    with TestClient(app) as client:
        response = client.post(
            "/webhooks/razorpay",
            headers={"x-razorpay-event-id": "hook_api_test"},
            json=payload,
        )
        assert response.status_code == 200
        assert response.json()["status"] == "failure_evaluated"
        events = client.get("/events").json()
        assert events["total"] == 1
        assert events["items"][0]["source"] == "razorpay_test"


def test_payment_link_requires_real_test_credentials() -> None:
    with TestClient(app) as client:
        response = client.post("/recovery/payment-link", json={"event_id": "rzp_pay_api_test"})
        assert response.status_code in {409, 503}


def test_human_escalation_requires_operator_token_and_creates_one_link(monkeypatch) -> None:
    repository.events.clear()
    repository.results.clear()
    event = PaymentEvent(
        id="rzp_pay_human_review",
        customer_id="customer_human_review",
        customer_name="Test customer",
        type=EventType.PAYMENT_FAILED,
        amount=100,
        failure_code="unknown_processor_failure",
        history=CustomerHistory(),
    )
    result = run_event(event, repository.policy)
    assert result.decision.action.value == "escalate_human"
    repository.events.append(event)
    repository.results.append(result)
    monkeypatch.setattr(config, "admin_token", "operator-secret")
    monkeypatch.setattr(
        razorpay,
        "create_payment_link",
        AsyncMock(return_value={"id": "plink_test", "short_url": "https://rzp.io/test", "mode": "test"}),
    )

    with TestClient(app) as client:
        denied = client.post(
            "/recovery/payment-link/approve",
            json={"event_id": event.id, "approval_note": "Reviewed evidence"},
        )
        assert denied.status_code == 401

        approved = client.post(
            "/recovery/payment-link/approve",
            headers={"x-admin-token": "operator-secret"},
            json={"event_id": event.id, "approval_note": "Reviewed evidence"},
        )
        assert approved.status_code == 200
        assert approved.json()["approval"] == "operator"
        assert repository.results[-1].razorpay_payment_link_id == "plink_test"

        duplicate = client.post(
            "/recovery/payment-link/approve",
            headers={"x-admin-token": "operator-secret"},
            json={"event_id": event.id, "approval_note": "Reviewed evidence"},
        )
        assert duplicate.status_code == 409

        monkeypatch.setattr(
            razorpay,
            "fetch_payment_link",
            AsyncMock(return_value={"id": "plink_test", "status": "paid", "amount_paid": 10000}),
        )
        reconciled = client.post(
            "/recovery/payment-link/reconcile",
            headers={"x-admin-token": "operator-secret"},
            json={"event_id": event.id},
        )
        assert reconciled.status_code == 200
        assert reconciled.json()["amount_recovered"] == 100
        assert repository.results[-1].verified_recovered_amount == 100


def test_paid_webhook_falls_back_to_payment_link_id_when_notes_are_null() -> None:
    repository.events.clear()
    repository.results.clear()
    repository.processed_webhook_ids.clear()
    event = PaymentEvent(
        id="rzp_pay_null_notes",
        customer_id="customer_null_notes",
        customer_name="Test customer",
        type=EventType.PAYMENT_FAILED,
        amount=100,
        failure_code="unknown_processor_failure",
    )
    result = run_event(event, repository.policy)
    result.razorpay_payment_link_id = "plink_null_notes"
    repository.events.append(event)
    repository.results.append(result)
    payload = {
        "event": "payment_link.paid",
        "payload": {
            "payment_link": {
                "entity": {
                    "id": "plink_null_notes",
                    "notes": None,
                    "amount_paid": 10000,
                }
            }
        },
    }

    with TestClient(app) as client:
        response = client.post(
            "/webhooks/razorpay",
            headers={"x-razorpay-event-id": "hook_null_notes"},
            json=payload,
        )
        assert response.status_code == 200
        assert response.json()["status"] == "recovery_recorded"
        assert repository.results[-1].verified_recovered_amount == 100
