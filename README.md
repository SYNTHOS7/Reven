# Reven

> **Razorpay moves the money. Reven helps merchants recover it responsibly.**

Reven is a policy-bounded AI recovery operator for failed payments, built for **Razorpay AI Buildathon — Track 03: AI Revenue Recovery**. It turns a failed payment into an explainable, safe recovery decision—not unchecked automation.

<p align="center">
  <a href="https://reven-nine.vercel.app/"><strong>Live dashboard</strong></a> ·
  <a href="https://reven-api.onrender.com/health"><strong>API health</strong></a> ·
  <a href="https://github.com/SYNTHOS7/Reven"><strong>Source</strong></a>
</p>

## Why this matters

A failure code does not tell a merchant whether to retry, request a new payment method, send a Payment Link, or stop because the activity looks risky. Revenue recovery needs judgement **and** guardrails.

Reven uses AI to interpret ambiguous failures. Deterministic trust and policy controls decide whether any action is permitted. Sensitive recoveries require a human operator.

## Proven end-to-end

| Evidence | What happened |
| --- | --- |
| Failure intake | Razorpay Test Mode `payment.failed` webhook was signed, ingested, and audited. |
| Safe decision | A low-confidence case escalated to a human instead of auto-contacting the customer. |
| Recovery | Operator approval created Razorpay Test Mode Payment Link `plink_TSA8NopVxnVR8c`. |
| Verification | Razorpay reported the link as paid; Reven attributed **₹100 verified test recovery**. |

> This is Razorpay **Test Mode** evidence—not production merchant revenue.

## How Reven thinks

```text
Razorpay payment.failed webhook
            │
            ▼
      Detect the case
            │
            ▼
 Trust gate ─── suspicious? ──► refuse safely
            │
            ▼
 AI diagnosis + confidence
            │
            ▼
 Policy controls ─── uncertain / sensitive? ──► human approval
            │
            ▼
 Razorpay Payment Link
            │
            ▼
 payment_link.paid webhook ──► verified recovery attribution
```

## Design principles

- **AI is a signal, not an authority.** The model diagnoses ambiguity; it never directly executes a money action.
- **Policy is enforceable.** Confidence floors, amount thresholds, retry limits, contact limits, and trust signals bound every action.
- **Uncertainty stays visible.** Low-confidence cases are escalated, not hidden.
- **Recovery is not claimed early.** A link being created is not revenue; only a Razorpay-confirmed payment is counted.
- **Every decision is auditable.** The case-level Decision Trace shows the event, trust result, diagnosis, policy decision, communication state, and outcome.

## Stack

| Layer | Technology |
| --- | --- |
| Operator dashboard | Next.js 16, TypeScript, CSS, Vercel |
| Recovery API | FastAPI, Python, Render |
| Payments | Razorpay Test Mode APIs + signed webhooks |
| Persistence | Supabase |
| AI diagnosis | Gemini structured diagnosis with deterministic policy fallback |

## Reliability work

The hard part was not drawing a dashboard—it was making payment evidence durable.

During development, a Razorpay Payment Link payload contained `notes: null`, which broke the attribution path. A separate re-evaluation could also hide an earlier Payment Link and verified recovery state. Reven now has null-safe webhook handling, Payment Link ID fallback attribution, duplicate-safe reconciliation, and recovery evidence that survives re-evaluation and restarts.

## Run locally

```bash
# Backend
cd backend
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000

# Frontend (new terminal)
cd frontend
copy .env.example .env.local
npm install
npm run dev
```

Open `http://localhost:3000`. API documentation is at `http://localhost:8000/docs`.

## Deploy

| Service | Root directory | Required configuration |
| --- | --- | --- |
| Vercel | `frontend` | `NEXT_PUBLIC_API_URL=https://your-api.onrender.com` |
| Render | `backend` | Razorpay Test Mode keys, webhook secret, Supabase URL/service role, Gemini key, admin token |

Detailed deployment instructions: [DEPLOYMENT.md](DEPLOYMENT.md). API contract: [docs/api-contract.md](docs/api-contract.md).

## Safety

- Razorpay Test Mode only
- No card data, OTPs, Razorpay keys, or Supabase service-role keys in the frontend
- Customer messages are prepared for review, never auto-sent
- Operator approval is required for sensitive Payment Link recovery
- Verified recovery requires Razorpay payment confirmation

---

Built to show that good payment recovery is not about more automation. It is about the right action, with the right evidence, at the right time.
