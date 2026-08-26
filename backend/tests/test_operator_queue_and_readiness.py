from fastapi.testclient import TestClient

from app.main import app
from app.models import CustomerHistory, EventType, PaymentEvent, PolicySettings
from app.operator_queue import build_operator_queue
from app.pipeline.engine import run_event
from app.readiness import build_readiness
from app.config import AppConfig


def event(event_id: str, **overrides) -> PaymentEvent:
    values = {
        "id": event_id,
        "customer_id": event_id,
        "customer_name": "Queue test",
        "type": EventType.PAYMENT_FAILED,
        "amount": 1200,
        "failure_code": "customer_cancelled",
        "history": CustomerHistory(successful_payments=3, tenure_days=30),
        "source": "razorpay_test",
    }
    values.update(overrides)
    return PaymentEvent(**values)


def test_operator_queue_excludes_suspicious_and_orders_open_cases() -> None:
    open_case = event("open")
    suspicious = event("suspicious", amount=9, attempts_in_window=7)
    recovered = event("recovered")
    recovered_result = run_event(recovered, PolicySettings())
    recovered_result.verified_recovered_amount = 100
    queue = build_operator_queue(
        [open_case, suspicious, recovered],
        [run_event(open_case, PolicySettings()), run_event(suspicious, PolicySettings()), recovered_result],
    )

    assert queue.total_open_cases == 1
    assert queue.items[0].event_id == "open"
    assert queue.excluded_suspicious_cases == 1


def test_readiness_does_not_return_secret_values() -> None:
    report = build_readiness(AppConfig(razorpay_key_id="id", razorpay_key_secret="SHOULD_NOT_LEAK_KEY", razorpay_webhook_secret="SHOULD_NOT_LEAK_WEBHOOK"), "memory")
    assert report.status == "ready_for_test_mode"
    assert "SHOULD_NOT_LEAK_WEBHOOK" not in str(report.model_dump())


def test_request_safety_headers_are_returned() -> None:
    with TestClient(app) as client:
        response = client.get("/health")
    assert response.headers["x-content-type-options"] == "nosniff"
    assert response.headers["x-frame-options"] == "DENY"


def test_request_safety_rejects_declared_oversized_payload() -> None:
    with TestClient(app) as client:
        response = client.post("/eval/run", content=b"{}", headers={"Content-Length": "1000001"})
    assert response.status_code == 413
