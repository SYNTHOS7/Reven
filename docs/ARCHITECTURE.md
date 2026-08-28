# Reven architecture

## Purpose

Reven is an evidence-first recovery-control layer for failed Razorpay payments.
It is built to answer one question safely: **what is the next allowed recovery
step for this failed payment, and can the final outcome be proved?**

## System boundary

```text
Razorpay Test Mode
  payment.failed / payment_link.paid
              |
              v
FastAPI recovery API (Render)
  signature validation + idempotency + redaction
              |
              +--> Supabase evidence store
              |
              +--> investigation / Trust Gate / policy engine
              |
              +--> operator-approved Test Mode Payment Link
              |
              v
Next.js operator console (Vercel)
  evidence, policy, recovery queue, and learning health
```

## Five-stage case lifecycle

| Stage | Owner | Result |
|---|---|---|
| Detect | Razorpay webhook ingestion | A signed failed-payment event becomes a recovery case. |
| Trust Gate | Deterministic safety rules | Repeated, suspicious, or over-limit activity is stopped before recovery. |
| Diagnose | Bounded AI or deterministic rules | A structured likely cause, confidence, and evidence trace. |
| Decide | Deterministic policy | An action is allowed, escalated for review, or blocked. |
| Recover and verify | Operator + Razorpay webhook | A recovery counts only after a signed `payment_link.paid` confirmation. |

## Four bounded intelligence layers

1. **AI Investigation** interprets ambiguous payment evidence with read-only
   processor, retry, and labelled-case context.
2. **Recovery Strategy** presents conservative options, which policy labels as
   allowed, review-required, or blocked.
3. **Learning and Evaluation** measures agreement only from explicit
   human-reviewed Razorpay Test Mode outcomes.
4. **Merchant Intelligence** produces an aggregate-only merchant briefing;
   it receives no individual payment IDs or customer data.

These layers cannot create a Payment Link, contact a customer, alter policy, or
count revenue. The money-moving boundary remains deterministic and
operator-controlled.

## Data and security choices

- Razorpay webhook signatures are validated before a case is processed.
- Webhook event identifiers are recorded for idempotency.
- Card numbers, CVVs, OTPs, bank credentials, and raw customer contact details
  are not stored.
- Secrets stay server-side in Render configuration.
- Policy edits, human labels, approvals, and reconciliation are protected by an
  operator token when configured.
- Evidence receipts fingerprint redacted case and decision records with SHA-256.

## AI design

Gemini is used only for structured diagnosis and aggregate merchant briefing.
For diagnosis, it can request three local read-only tools:

- `get_processor_context`
- `get_retry_and_trust_context`
- `get_labelled_similar_cases`

If AI is unavailable, malformed, or low-confidence, Reven fails closed to a
deterministic review path. Policy does not accept an AI action directly.

## Evidence model

Reven deliberately separates three concepts:

| Concept | Meaning |
|---|---|
| Recovery candidate | A failed payment that is being assessed. |
| Recovery attempt | An operator-approved Payment Link or permitted action. |
| Verified recovery | A positive amount attributed only after Razorpay confirms a paid link. |

Test Mode demonstrates the engineering loop. It is not production merchant
revenue or a production-scale recovery-rate claim.

## Current limitations

- Live evidence is Razorpay Test Mode only.
- Human-reviewed evaluation is early and should not be presented as stable model
  accuracy until the labelled batch grows.
- Reven is an operator prototype, not yet a multi-merchant authentication and
  onboarding product.

See [FAILURES.md](../FAILURES.md), [EVALUATION.md](EVALUATION.md), and
[THREAT-MODEL.md](THREAT-MODEL.md) for deliberate trade-offs and validation
limits.
