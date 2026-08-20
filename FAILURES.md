# Failure log

Keep this file honest. Each entry should record the symptom, root cause, fix, regression check, and metric impact.

## Duplicate webhook delivery inflated recovery

- **Symptom:** replaying the same `payment_link.paid` event could count recovered revenue twice.
- **Root cause:** the first prototype treated webhook delivery as exactly-once.
- **Fix:** Reven records `x-razorpay-event-id` before processing and returns `duplicate` for a repeated ID.
- **Regression check:** `test_duplicate_webhook_is_idempotent` posts the same event twice and verifies one recovery update.
- **Why it matters:** recovery totals are financial claims; duplicated events must not inflate them.

## Ambiguous model output bypassed escalation

- **Symptom:** an unstructured model answer could not be interpreted reliably.
- **Root cause:** the fallback originally trusted free-form text.
- **Fix:** the pipeline treats missing/invalid structured output as low confidence and escalates to a human.
- **Regression check:** ambiguous cases below the configured threshold always choose `escalate_human`.
