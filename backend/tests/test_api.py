from fastapi.testclient import TestClient

from app.main import app, repository


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
