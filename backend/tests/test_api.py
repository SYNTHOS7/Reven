from fastapi.testclient import TestClient
from unittest.mock import AsyncMock

from app.main import app, config, razorpay, repository
from app.models import CustomerHistory, DiagnosisResult, EventType, PaymentEvent
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


def test_payment_link_requires_real_test_credentials(monkeypatch) -> None:
    # Local developer .env files may contain Test Mode credentials. Force the
    # unavailable-credentials path so this test can never create an external link.
    monkeypatch.setattr(config, "razorpay_key_id", None)
    monkeypatch.setattr(config, "razorpay_key_secret", None)
    with TestClient(app) as client:
        response = client.post("/recovery/payment-link", json={"event_id": "rzp_pay_api_test"})
        assert response.status_code in {409, 503}


def test_operator_token_protects_policy_and_human_labels(monkeypatch) -> None:
    repository.events.clear()
    original_policy = repository.policy.model_copy(deep=True)
    event = PaymentEvent(
        id="rzp_operator_boundary",
        customer_id="customer_operator_boundary",
        customer_name="Test customer",
        type=EventType.PAYMENT_FAILED,
        amount=100,
        failure_code="customer_cancelled",
    )
    repository.events.append(event)
    monkeypatch.setattr(config, "admin_token", "operator-secret")

    with TestClient(app) as client:
        assert client.patch("/settings", json={"max_retries_per_payment": 2}).status_code == 401
        assert client.patch(
            "/settings", json={"max_retries_per_payment": 2}, headers={"X-Admin-Token": "operator-secret"}
        ).status_code == 200
        assert client.patch(
            f"/events/{event.id}/ground-truth",
            json={"correct_cause": "customer_abandoned_payment", "correct_action": "create_payment_link", "reviewer_notes": "Clear cancellation"},
        ).status_code == 401
    repository.policy = original_policy


def test_batch_diagnosis_review_and_cause_only_label(monkeypatch) -> None:
    repository.events.clear()
    repository.results.clear()
    repository.completed_recoveries.clear()
    event = PaymentEvent(
        id="rzp_batch_label", customer_id="batch-label", customer_name="Batch label",
        type=EventType.PAYMENT_FAILED, amount=101, failure_code="incorrect_otp", batch_id="buildathon-01",
    )
    repository.events.append(event)
    repository.results.append(run_event(event, repository.policy))
    monkeypatch.setattr(config, "admin_token", "operator-secret")

    with TestClient(app) as client:
        assert client.get("/batches/buildathon-01/summary").json()["total_cases"] == 1
        review = client.get("/batches/buildathon-01/diagnosis-review").json()
        assert review[0]["event_id"] == event.id
        assert client.patch(
            f"/events/{event.id}/diagnosis-label",
            headers={"X-Admin-Token": "operator-secret"},
            json={"correct_cause": "customer_abandoned_payment", "reviewer_notes": "Verified against Test Mode failure evidence"},
        ).status_code == 200
        summary = client.get("/batches/buildathon-01/summary").json()
        assert summary["diagnosis_labelled_cases"] == 1

    monkeypatch.setattr(config, "admin_token", None)


def test_strategy_endpoint_is_read_only_and_returns_policy_bounded_options() -> None:
    repository.events.clear()
    repository.results.clear()
    event = PaymentEvent(
        id="rzp_strategy_endpoint",
        customer_id="customer_strategy_endpoint",
        customer_name="Strategy endpoint test",
        type=EventType.PAYMENT_FAILED,
        amount=100,
        failure_code="customer_cancelled",
    )
    result = run_event(event, repository.policy)
    repository.events.append(event)
    repository.results.append(result)

    with TestClient(app) as client:
        response = client.get(f"/events/{event.id}/strategies")

    assert response.status_code == 200
    payload = response.json()
    assert payload["strategies"][0]["id"] == "operator-payment-link"
    assert payload["strategies"][0]["status"] == "allowed"
    assert "cannot send a message" in payload["disclaimer"]


def test_advisory_ai_investigation_never_mutates_pipeline_state(monkeypatch) -> None:
    repository.events.clear()
    repository.results.clear()
    event = PaymentEvent(
        id="rzp_advisory_investigation", customer_id="advisory-customer", customer_name="Advisory customer",
        type=EventType.PAYMENT_FAILED, amount=100, failure_code="payment_failed",
    )
    stored = run_event(event, repository.policy)
    repository.events.append(event)
    repository.results.append(stored)

    monkeypatch.setattr(
        "app.main.run_advisory_investigation",
        lambda *_args, **_kwargs: DiagnosisResult(
            cause="technical_error", method="llm", confidence=0.71,
            reason="Read-only evidence indicates a technical processor failure.",
            tool_calls=["Read processor context"],
        ),
    )
    with TestClient(app) as client:
        response = client.post(f"/events/{event.id}/ai-investigation")

    assert response.status_code == 200
    payload = response.json()
    assert payload["mode"] == "advisory_only"
    assert payload["financial_authority"] is False
    assert payload["diagnosis"]["method"] == "llm"
    assert repository.results[0].diagnosis.method == stored.diagnosis.method
    assert repository.results[0].decision == stored.decision


def test_batch_ai_comparison_is_advisory_and_reports_completed_calls(monkeypatch) -> None:
    repository.events.clear()
    repository.results.clear()
    for index, expected in enumerate(["customer_abandoned_payment", "temporary_bank_failure"], start=1):
        event = PaymentEvent(
            id=f"rzp_batch_ai_{index}", customer_id=f"batch-ai-{index}", customer_name="Batch AI",
            type=EventType.PAYMENT_FAILED, amount=100, failure_code="customer_cancelled", batch_id="buildathon-01",
            expected_cause=expected,
        )
        repository.events.append(event)
        repository.results.append(run_event(event, repository.policy))

    monkeypatch.setattr(
        "app.main.run_advisory_investigation",
        lambda event, *_args, **_kwargs: DiagnosisResult(
            cause=event.expected_cause or "unknown", method="llm", confidence=0.7,
            reason="Advisory only", tool_calls=["Read processor context"],
        ),
    )
    with TestClient(app) as client:
        response = client.post("/batches/buildathon-01/ai-comparison")

    assert response.status_code == 200
    payload = response.json()
    assert payload["eligible_human_reviewed_cases"] == 2
    assert payload["model_calls_completed"] == 2
    assert payload["advisory_ai_agreement_pct"] == 100
    assert all(item["status"] == "completed" for item in payload["comparisons"])
    assert repository.results[0].diagnosis.method == "rule"


def test_policy_impact_endpoint_is_a_non_mutating_dry_run() -> None:
    repository.events.clear()
    repository.results.clear()
    event = PaymentEvent(
        id="rzp_policy_impact_endpoint",
        customer_id="customer_policy_impact_endpoint",
        customer_name="Policy impact endpoint test",
        type=EventType.PAYMENT_FAILED,
        amount=100,
        failure_code="customer_cancelled",
    )
    result = run_event(event, repository.policy)
    repository.events.append(event)
    repository.results.append(result)

    with TestClient(app) as client:
        response = client.post("/policy/impact", json={**repository.policy.model_dump(), "human_approval_amount_threshold": 50})

    assert response.status_code == 200
    assert response.json()["action_changed_cases"] == 1
    assert repository.results[0].decision.action.value == "create_payment_link"


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
