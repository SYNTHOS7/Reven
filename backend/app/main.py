from datetime import datetime, timezone
import json
from typing import Annotated
from pydantic import BaseModel

import httpx
from fastapi import Body, FastAPI, Header, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware

from app.config import get_config
from app.evaluation import run_evaluation
from app.ingestion import payment_event_from_razorpay
from app.models import (
    Action,
    GroundTruthUpdate,
    OperatorApprovalRequest,
    PaymentLinkRequest,
    PolicyReplayRequest,
    PolicyReplayResponse,
    PolicySettings,
    RecoveryIntelligenceResponse,
    WebhookResponse,
    utc_now,
)
from app.pipeline.engine import run_event
from app.razorpay_client import RazorpayClient
from app.recovery_intelligence import compute_recovery_intelligence
from app.repository import repository
from app.similar_cases import find_similar_cases, retrieve_historical_diagnosis_examples

config = get_config()
razorpay = RazorpayClient(config)
app = FastAPI(title="Reven Recovery API", version="0.1.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=config.origins,
    allow_credentials=False,
    allow_methods=["GET", "POST", "PATCH", "OPTIONS"],
    allow_headers=["*"],
)


def latest_result(event_id: str):
    matches = (item for item in repository.results if item.event_id == event_id)
    return max(matches, key=lambda item: item.created_at, default=None)


@app.get("/health")
def health():
    return {
        "status": "degraded" if repository.storage_error else "ok",
        "service": "reven-api",
        "environment": config.app_env,
        "storage": repository.storage_mode,
        "razorpay_configured": razorpay.configured,
        "events": len(repository.events),
    }


@app.get("/events")
def list_events(limit: int = 200, offset: int = 0):
    latest_by_event = {}
    for result in repository.results:
        current = latest_by_event.get(result.event_id)
        if current is None or result.created_at > current.created_at:
            latest_by_event[result.event_id] = result
    ordered = sorted(latest_by_event.values(), key=lambda item: item.created_at, reverse=True)
    results = ordered[offset : offset + min(limit, 300)]
    return {"items": results, "total": len(ordered)}


@app.get("/events/{event_id}")
def get_event(event_id: str):
    event = next((item for item in repository.events if item.id == event_id), None)
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")
    result = latest_result(event_id)
    return {
        "event": event,
        "pipeline_result": result,
        "similar_cases": find_similar_cases(event, result, repository.events, repository.results),
    }


@app.post("/pipeline/run/{event_id}")
def run_single_event(event_id: str):
    event = next((item for item in repository.events if item.id == event_id), None)
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")
    examples = retrieve_historical_diagnosis_examples(event, repository.events)
    result = run_event(event, repository.policy, historical_examples=examples)
    repository.save_results([result])
    return result


@app.patch("/events/{event_id}/ground-truth")
def label_event(
    event_id: str,
    update: GroundTruthUpdate,
    x_admin_token: Annotated[str | None, Header()] = None,
):
    if config.admin_token and x_admin_token and x_admin_token != config.admin_token:
        raise HTTPException(status_code=401, detail="Invalid admin token")
    event = next((item for item in repository.events if item.id == event_id), None)
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")
    event.expected_cause = update.correct_cause
    event.expected_action = update.correct_action
    event.ground_truth_source = f"human_reviewed: {update.reviewer_notes}"
    event.human_reviewed_cause = update.correct_cause
    event.human_reviewed_action = update.correct_action
    event.human_reviewed_note = update.reviewer_notes
    event.human_reviewed_at = utc_now()
    repository.save_event(event)
    return event


@app.post("/events/{event_id}/replay", response_model=PolicyReplayResponse)
def policy_replay(
    event_id: str,
    request: PolicyReplayRequest,
):
    event = next((item for item in repository.events if item.id == event_id), None)
    latest = latest_result(event_id)
    if not event or not latest:
        raise HTTPException(status_code=404, detail="Evaluated event not found")

    from app.pipeline.communication import generate_message
    from app.pipeline.decision import decide

    proposed_decision = decide(event, latest.diagnosis, request.policy)
    proposed_message = generate_message(event, proposed_decision.action)

    return PolicyReplayResponse(
        event_id=event.id,
        original_policy=repository.policy,
        original_decision=latest.decision,
        original_diagnosis=latest.diagnosis,
        proposed_policy=request.policy,
        proposed_decision=proposed_decision,
        proposed_message=proposed_message,
        is_dry_run=True,
        disclaimer="Dry run — no customer action, message, payment link, or revenue metric was changed.",
    )


@app.post("/eval/run")
def evaluate():
    return run_evaluation(repository)


@app.get("/eval/latest")
def latest_evaluation():
    if not repository.scorecards:
        return run_evaluation(repository).scorecard
    scorecard = repository.scorecards[-1].model_copy(deep=True)
    scorecard.actual_test_recovery = repository.actual_test_recovery
    return scorecard


@app.get("/settings")
def get_settings() -> PolicySettings:
    return repository.policy


@app.patch("/settings")
def update_settings(update: Annotated[dict, Body()]):
    current = repository.policy.model_dump()
    current.update(update)
    repository.policy = PolicySettings.model_validate(current)
    repository.save_policy()
    return repository.policy


@app.post("/data/sync/razorpay")
async def sync_razorpay_payments(
    count: int = 100,
    x_admin_token: Annotated[str | None, Header()] = None,
):
    if config.admin_token and x_admin_token != config.admin_token:
        raise HTTPException(status_code=401, detail="Invalid admin token")
    try:
        payments = await razorpay.fetch_failed_payments(count)
    except (RuntimeError, httpx.HTTPError) as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    new_events = 0
    run_results = []
    for payment in payments:
        event = payment_event_from_razorpay(payment)
        existing = next((item for item in repository.events if item.id == event.id), None)
        if not existing:
            new_events += 1
        event.attempts_in_window = sum(item.customer_id == event.customer_id for item in repository.events) + 1
        repository.save_event(event)
        examples = retrieve_historical_diagnosis_examples(event, repository.events)
        run_results.append(run_event(event, repository.policy, historical_examples=examples))
    repository.save_results(run_results)
    return {"fetched_failed_payments": len(payments), "new_events": new_events, "evaluated": len(run_results)}


@app.post("/recovery/payment-link")
async def create_payment_link(request: PaymentLinkRequest):
    event = next((item for item in repository.events if item.id == request.event_id), None)
    result = latest_result(request.event_id)
    if not event or not result:
        raise HTTPException(status_code=404, detail="Evaluated event not found")
    if result.decision.action.value != "create_payment_link":
        raise HTTPException(status_code=409, detail="Policy did not approve a payment link for this event")
    if result.razorpay_payment_link_id:
        raise HTTPException(status_code=409, detail="A recovery Payment Link already exists for this event")
    try:
        link = await razorpay.create_payment_link(event)
    except (RuntimeError, httpx.HTTPError) as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    result.razorpay_payment_link_id = link["id"]
    repository.save_results([result])
    repository.record_prepared_recovery(event.id, link["id"])
    return link


@app.post("/recovery/payment-link/approve")
async def approve_payment_link(
    request: OperatorApprovalRequest,
    x_admin_token: Annotated[str | None, Header()] = None,
):
    if not config.admin_token:
        raise HTTPException(status_code=503, detail="Operator approval is not configured")
    if x_admin_token != config.admin_token:
        raise HTTPException(status_code=401, detail="Invalid operator token")
    event = next((item for item in repository.events if item.id == request.event_id), None)
    result = latest_result(request.event_id)
    if not event or not result:
        raise HTTPException(status_code=404, detail="Evaluated event not found")
    if result.trust_gate.status == "suspicious":
        raise HTTPException(status_code=409, detail="Suspicious events cannot be approved")
    if result.decision.action != Action.ESCALATE_HUMAN:
        raise HTTPException(status_code=409, detail="Only human-escalated events can be operator-approved")
    if result.razorpay_payment_link_id:
        raise HTTPException(status_code=409, detail="A recovery Payment Link already exists for this event")
    try:
        link = await razorpay.create_payment_link(event)
    except (RuntimeError, httpx.HTTPError) as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    event.ground_truth_source = f"operator_approved_recovery: {request.approval_note}"
    result.razorpay_payment_link_id = link["id"]
    repository.save_event(event)
    repository.save_results([result])
    repository.record_prepared_recovery(event.id, link["id"])
    return {**link, "approval": "operator"}


@app.post("/recovery/payment-link/reconcile")
async def reconcile_payment_link(
    request: PaymentLinkRequest,
    x_admin_token: Annotated[str | None, Header()] = None,
):
    if not config.admin_token:
        raise HTTPException(status_code=503, detail="Recovery verification is not configured")
    if x_admin_token != config.admin_token:
        raise HTTPException(status_code=401, detail="Invalid operator token")
    result = latest_result(request.event_id)
    if not result or not result.razorpay_payment_link_id:
        raise HTTPException(status_code=404, detail="Prepared recovery Payment Link not found")
    if result.verified_recovered_amount > 0:
        return {
            "status": "already_verified",
            "payment_link_id": result.razorpay_payment_link_id,
            "amount_recovered": result.verified_recovered_amount,
        }
    try:
        entity = await razorpay.fetch_payment_link(result.razorpay_payment_link_id)
    except (RuntimeError, httpx.HTTPError) as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    if entity.get("status") != "paid":
        raise HTTPException(status_code=409, detail=f"Razorpay Payment Link status is {entity.get('status', 'unknown')}")
    amount_paid = float(entity.get("amount_paid", 0)) / 100
    if amount_paid <= 0:
        raise HTTPException(status_code=409, detail="Razorpay has not reported a positive paid amount")
    repository.record_recovery(result.event_id, result.razorpay_payment_link_id, amount_paid)
    result.verified_recovered_amount = amount_paid
    result.recovered_at = result.recovered_at or utc_now()
    repository.save_results([result])
    return {"status": "verified", "payment_link_id": result.razorpay_payment_link_id, "amount_recovered": amount_paid}


@app.get("/metrics/recovery-intelligence", response_model=RecoveryIntelligenceResponse)
def get_recovery_intelligence():
    return compute_recovery_intelligence(repository)


@app.post("/webhooks/razorpay", response_model=WebhookResponse)
async def receive_razorpay_webhook(
    request: Request,
    x_razorpay_signature: Annotated[str | None, Header()] = None,
    x_razorpay_event_id: Annotated[str | None, Header()] = None,
):
    body = await request.body()
    if config.app_env == "production" and not repository.persistent:
        raise HTTPException(status_code=503, detail="Persistent Supabase storage is required in production")
    if not razorpay.verify_webhook(body, x_razorpay_signature):
        repository.record_rejected_webhook()
        raise HTTPException(status_code=401, detail="Invalid webhook signature")
    payload = json.loads(body)
    event_type = str(payload.get("event", "unknown"))
    webhook_id = x_razorpay_event_id or hashlib_fallback(body)
    is_new_webhook = repository.mark_webhook_processed(webhook_id, event_type, body)
    if not is_new_webhook and event_type != "payment_link.paid":
        return WebhookResponse(status="duplicate", event_id=webhook_id)
    if event_type == "payment.failed":
        payment = payload.get("payload", {}).get("payment", {}).get("entity", {})
        if not payment.get("id"):
            raise HTTPException(status_code=422, detail="Webhook does not contain a payment entity")
        event = payment_event_from_razorpay(payment)
        event.attempts_in_window = sum(item.customer_id == event.customer_id for item in repository.events) + 1
        repository.save_event(event)
        examples = retrieve_historical_diagnosis_examples(event, repository.events)
        result = run_event(event, repository.policy, historical_examples=examples)
        repository.save_results([result])
        return WebhookResponse(status="failure_evaluated", event_id=event.id)
    if event_type == "payment_link.paid":
        entity = payload.get("payload", {}).get("payment_link", {}).get("entity", {})
        notes = entity.get("notes") if isinstance(entity.get("notes"), dict) else {}
        reven_event_id = notes.get("reven_event_id")
        payment_link_id = entity.get("id")
        result = latest_result(reven_event_id) if reven_event_id else None
        if result is None and payment_link_id:
            matches = (item for item in repository.results if item.razorpay_payment_link_id == payment_link_id)
            result = max(matches, key=lambda item: item.created_at, default=None)
            reven_event_id = result.event_id if result else None
        if not result:
            return WebhookResponse(status="unattributed_recovery", event_id=webhook_id)
        if not is_new_webhook and result.verified_recovered_amount > 0:
            return WebhookResponse(status="duplicate", event_id=webhook_id)
        amount_paid = float(entity.get("amount_paid", 0)) / 100
        repository.record_recovery(reven_event_id, payment_link_id, amount_paid)
        result.verified_recovered_amount = amount_paid
        result.recovered_at = result.recovered_at or utc_now()
        repository.save_results([result])
        return WebhookResponse(status="recovery_recorded", event_id=reven_event_id)
    return WebhookResponse(status="ignored", event_id=webhook_id)


# --------------------------------------------------------------------------
# CSV UPLOAD & SIMULATED DEMO DATASET ENDPOINTS
# --------------------------------------------------------------------------
from app.demo_transactions import DemoTransaction, demo_store, derive_intelligence


@app.get("/data/demo/transactions")
def get_demo_transactions(
    limit: int = 500,
    offset: int = 0,
    status: str | None = None,
    payment_method: str | None = None,
):
    items = demo_store.transactions
    if status and status != "all":
        items = [t for t in items if t.status == status]
    if payment_method and payment_method != "all":
        items = [t for t in items if t.payment_method == payment_method]

    paginated = items[offset : offset + limit]
    return {
        "items": paginated,
        "total": len(items),
        "data_source": "simulated_demo_data",
        "disclaimer": "Demo data — simulated, no customer communication is sent.",
    }


@app.post("/data/demo/seed")
def seed_demo_transactions():
    count = demo_store.seed_demo_data()
    return {"status": "seeded", "count": count, "data_source": "simulated_demo_data"}


@app.post("/data/demo/reset")
def reset_demo_transactions():
    count = demo_store.seed_demo_data()
    return {"status": "reset", "count": count, "data_source": "simulated_demo_data"}


@app.post("/data/csv/upload")
def upload_csv_transactions(transactions: list[DemoTransaction]):
    if not transactions:
        raise HTTPException(status_code=400, detail="Transaction list cannot be empty")
    demo_store.transactions = transactions
    return {
        "status": "imported",
        "count": len(transactions),
        "data_source": "uploaded_csv_data",
    }


@app.get("/metrics/revenue-intelligence-demo")
def get_demo_revenue_intelligence():
    txs = demo_store.transactions
    total_attempted = sum(t.amount for t in txs)
    collected = sum(t.amount for t in txs if t.status == "successful")
    lost = sum(t.amount for t in txs if t.status in ("failed", "abandoned"))
    recovered = sum(t.amount for t in txs if t.status == "recovered")
    potentially_recoverable = sum(
        t.amount * ((t.recovery_probability or 50) / 100)
        for t in txs
        if t.status in ("failed", "abandoned") and (t.recovery_probability or 0) >= 50
    )
    affected_customers = len({t.customer_email for t in txs if t.status in ("failed", "abandoned")})
    total_fail_volume = lost + recovered
    recovery_rate = round((recovered / total_fail_volume) * 100, 1) if total_fail_volume > 0 else 0.0

    return {
        "data_source": "simulated_demo_data",
        "total_attempted_revenue": total_attempted,
        "revenue_collected": collected,
        "revenue_lost": lost,
        "potentially_recoverable_revenue": potentially_recoverable,
        "revenue_recovered": recovered,
        "recovery_rate_pct": recovery_rate,
        "affected_customers_count": affected_customers,
        "disclaimer": "Demo data — simulated, no customer communication is sent.",
    }


class DemoActionRequest(BaseModel):
    transaction_id: str
    action_type: str
    note: str | None = None


@app.post("/recovery/demo/action")
def perform_demo_action(req: DemoActionRequest):
    tx = next((t for t in demo_store.transactions if t.transaction_id == req.transaction_id), None)
    if not tx:
        raise HTTPException(status_code=404, detail="Transaction not found")

    is_rec = req.action_type == "mark_recovered"
    if is_rec:
        tx.status = "recovered"
        tx.recovered_at = datetime.now(timezone.utc).isoformat()
    tx.action_status = req.action_type
    tx.action_note = req.note or f"Simulated {req.action_type}"
    if req.action_type == "create_payment_link":
        tx.simulated_link = f"https://pay.reven.ai/rec/{tx.transaction_id}"

    return {"status": "action_applied", "transaction": tx}


@app.post("/recovery/demo/recover-all")
def recover_all_high_priority():
    count = 0
    amount = 0.0
    now = datetime.now(timezone.utc).isoformat()
    for tx in demo_store.transactions:
        if tx.status in ("failed", "abandoned") and tx.is_high_priority:
            count += 1
            amount += tx.amount
            tx.status = "recovered"
            tx.action_status = "mark_recovered"
            tx.action_note = "Batch recovered via 1-click High-Priority Recovery simulation"
            tx.simulated_link = f"https://pay.reven.ai/rec/{tx.transaction_id}"
            tx.recovered_at = now

    return {"status": "batch_recovered", "recovered_count": count, "recovered_amount": amount}


def hashlib_fallback(body: bytes) -> str:
    import hashlib

    return hashlib.sha256(body).hexdigest()
