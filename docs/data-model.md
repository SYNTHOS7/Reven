# Data Model

## Entities

### Customer
- id: text — one-way hash derived from the Razorpay test customer identifier/contact
- name: text — optional name supplied in merchant-controlled Razorpay notes; otherwise a neutral label
- history_summary: jsonb — e.g. `{ successful_payments: 11, prior_failures: 1, tenure_days: 240 }`, used as diagnosis context

### Event
- id: uuid
- customer_id: uuid — FK → Customer
- type: text — one of `payment_failed`, `checkout_abandoned`, `subscription_renewal_failed`, `invoice_overdue`
- amount: numeric — in rupees
- failure_code: text — raw code, e.g. `insufficient_funds`, `card_expired`, `bank_error`, `mandate_lapsed`, `customer_cancelled`, `unknown`
- occurred_at: timestamp
- raw_payload: jsonb — redacted Razorpay-derived fields; raw email/contact are never stored
- is_flagged: boolean — output of Detection step
- flag_reason: text — nullable, why Detection flagged it

### AnswerKey
- event_id: uuid — FK → Event, 1:1
- correct_cause: text — hand-authored ground truth cause
- correct_action: text — hand-authored ground truth action (including `refuse_suspicious`)
- notes: text — why this is the correct answer, especially for tricky cases

### PipelineResult
- event_id: uuid — FK → Event
- trust_gate_verdict: text — `ok` | `suspicious`
- trust_gate_reason: text — nullable
- diagnosed_cause: text — system's diagnosis
- diagnosis_method: text — `rule` | `llm`, so it's provable which path was used
- diagnosis_confidence: float — 0-1, only meaningful when method = llm (rules are treated as confidence 1.0)
- chosen_action: text
- action_reason: text — which hard limit or rule triggered this action
- generated_message: text — nullable, only for actions that contact the customer
- verified_recovered_amount: numeric — non-zero only after a signed `payment_link.paid` webhook
- created_at: timestamp
- run_id: uuid — immutable evaluation run that produced this result
- razorpay_payment_link_id: text — nullable, test-mode link created after explicit operator approval

### RecoveryAttempt
- id: uuid
- event_id: uuid — FK → Event
- run_id: uuid — evaluation/policy context that approved the action
- action: text
- status: text — `prepared` | `completed` | `failed` | `refused`
- external_reference: text — nullable Razorpay test-mode entity id
- amount_recovered: numeric — actual test-mode amount, never mixed with estimated recovery
- created_at: timestamp

### WebhookEvent
- razorpay_event_id: text — unique idempotency key from `x-razorpay-event-id`
- event_type: text
- payload_hash: text
- processed_at: timestamp

### ScorecardRun
- id: uuid
- run_at: timestamp
- total_cases: int
- diagnosis_accuracy_pct: float
- action_accuracy_pct: float
- actual_test_recovery: numeric — sum of verified Razorpay test-mode paid-link outcomes
- wrong_or_uncertain_case_ids: jsonb — array of event ids + short reason, for the "honest list"
- policy_snapshot: jsonb
- pipeline_version: text
- model_version: text — nullable when no LLM path ran
- random_seed: int
- policy_compliance_pct: float
- actual_test_recovery: numeric — populated only from signed Razorpay test-mode paid-link webhooks

### Settings (hard limits — single row/table, not per-customer)
- max_retries_per_payment: int — default 3
- max_messages_per_customer_per_day: int — default 1
- human_approval_amount_threshold: numeric — e.g. 5000 (₹)
- diagnosis_confidence_escalation_threshold: float — e.g. 0.6
- trust_gate_attempts_window_hours: int — e.g. 24
- trust_gate_max_attempts_in_window: int — e.g. 5

## Relationships
- Customer has many Events.
- Event has one AnswerKey (1:1).
- Event has many immutable PipelineResults, partitioned by `run_id`.
- ScorecardRun aggregates across all Events' PipelineResults at a point in time.
- Settings is a single active config row read by Decision and Trust Gate at pipeline run time.

## Notes
- `raw_payload.retry_count_so_far` matters for the hard limit "never retry more than 3 times" — Decision must read this before choosing auto-retry.
- Keep `diagnosis_method` on every result — it's the concrete proof point for "rules where sufficient, LLM where judgment is needed."
- Evaluation fixtures and answer keys remain independent from pipeline output. A locked test split is never rewritten during an evaluation.
