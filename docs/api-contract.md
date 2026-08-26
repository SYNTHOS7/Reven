# API Contract

Base URL: the Railway/Render backend URL. All responses JSON. No auth in v1.

## Events

### GET /events
Query params: `flagged=true|false` (optional), `limit`, `offset`
Response: `{ id, customer_id, type, amount, failure_code, occurred_at, is_flagged, flag_reason }[]`

### GET /events/:id
Response: single Event, joined with its Customer, AnswerKey, and latest PipelineResult:
`{ event, customer, answer_key, pipeline_result }`

## Pipeline

### POST /pipeline/run
Runs the full pipeline (detection → trust gate → diagnosis → decision → communication) over all events currently in the DB that don't yet have a PipelineResult (or all events, if `force=true` is passed in body).
Request: `{ force?: boolean }`
Response: `{ processed_count, results: PipelineResult[] }`

### POST /pipeline/run/:event_id
Runs the pipeline for a single event — used for the live "show it breaking" demo case.
Response: single `PipelineResult`, plus intermediate step outputs for display:
`{ trust_gate, diagnosis, decision, communication }`

## Razorpay evidence ingestion

### POST /data/sync/razorpay
Fetches up to 100 existing Razorpay test payments, keeps failed payments, redacts customer contact data, persists new events and evaluates them. Requires `x-admin-token` when configured.

### POST /webhooks/razorpay
Accepts signed `payment.failed` and `payment_link.paid` events. Uses `x-razorpay-event-id` for idempotency.

### PATCH /events/:id/ground-truth
Attaches an independent human review label. Only labelled cases contribute to diagnosis/action accuracy.

## Eval / Scorecard

### POST /eval/run
Runs `/pipeline/run` (force=true) over the full batch, compares every PipelineResult to its AnswerKey, and writes a new ScorecardRun.
Response: full `ScorecardRun` object. Accuracy denominators include only human-reviewed cases; money recovered includes only verified paid-link webhooks.

### GET /eval/latest
Response: most recent `ScorecardRun`.

## Settings

### GET /settings
Response: current `Settings` row (the hard limits list).

### PATCH /settings
Request: partial `Settings` fields to update.
Response: updated `Settings` row.
Used so the dashboard can display AND (for demo purposes) let a judge tweak a limit and re-run to see behavior change.

## Recovery

### `POST /recovery/payment-link/approve`

Creates one Razorpay test Payment Link for a case whose current decision is
`escalate_human`. Requires the Render-generated `X-Admin-Token` header and a
5-500 character `approval_note`. Suspicious cases and duplicate links fail
closed with `409`.

```json
{
  "event_id": "rzp_pay_...",
  "approval_note": "Processor evidence reviewed by operator"
}
```

### `POST /recovery/payment-link/reconcile`

Requires `X-Admin-Token`. Fetches the prepared Payment Link from Razorpay and
records recovery only when Razorpay reports `status=paid` and a positive
`amount_paid`. This is the safe fallback for delayed or failed webhook delivery.

### POST /recovery/payment-link
Creates a Razorpay Payment Link in test mode only. The referenced event must already have a `create_payment_link` decision under the stored policy snapshot.
Request: `{ event_id: string }`
Response: `{ id, short_url, mode: "test"|"demo" }`

### POST /webhooks/razorpay
Validates `x-razorpay-signature`, deduplicates using `x-razorpay-event-id`, and records completed test recovery. Duplicate delivery returns `{ status: "duplicate" }` without changing totals.

## Case intelligence (read-only)

### GET /events/:id/strategies
Returns policy-bounded recovery options for the latest evaluated case. Each option is
explicitly `allowed`, `requires_human_review`, or `blocked`; this endpoint cannot
dispatch a message, retry a payment, or create a link.

### GET /events/:id/timeline
Returns the recorded case lifecycle and, for a transient failure, a future
retry-eligibility time. It is a plan only—there is no background payment retry.

### GET /events/:id/evidence-quality
Returns the configured evidence checklist, missing processor context, a 0–100
completeness score, and the policy boundary appropriate for the evidence.

### GET /events/:id/evidence-receipt
Returns a SHA-256 fingerprint of a redacted event and its stored pipeline decision
record. The fingerprint is a comparison aid, not a payment confirmation.

### GET /learning/health
Reports label coverage, operator agreement, overrides, and diagnosis methods for
saved Razorpay Test Mode cases only. Simulated merchant data is excluded.

### GET /queue/operator
Returns a deterministic, prioritized operator queue from saved Razorpay Test Mode
evidence. Suspicious, completed, and already-prepared cases are excluded.

### POST /policy/impact
Accepts a complete candidate `PolicySettings` object and reports its portfolio-wide
decision impact using stored diagnoses. It changes neither the active policy nor any
case record, and it does not call AI.

### GET /health/readiness
Reports the presence (never the value) of Razorpay Test Mode credentials, webhook
verification, persistence, Gemini, and operator-token configuration.

## Conventions
- Errors: `{ error: string, detail?: string }` with appropriate 4xx/5xx status.
- Internal money fields are numeric rupees. Razorpay API boundaries convert rupees to integer paise and back explicitly.
- Recovered money is recorded only after a verified Razorpay test-mode paid-link webhook.
- No pagination cursor complexity — simple `limit`/`offset` is enough at 150-300 rows.
- Requests declaring a body over 1 MB are rejected before processing. API responses include `X-Content-Type-Options`, `X-Frame-Options`, and `Referrer-Policy` headers.
