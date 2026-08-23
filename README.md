# Reven

> **Revenue recovery, under control.**

Reven is a policy-bounded AI revenue recovery control room, built for **Razorpay AI Buildathon — Track 03: AI Revenue Recovery**. It helps merchants understand failed payments, choose a safe recovery path, and count recovery only after payment evidence confirms it.

<p align="center">
  <a href="https://reven-nine.vercel.app/"><strong>Live application</strong></a> ·
  <a href="https://reven-api.onrender.com/health"><strong>API health</strong></a> ·
  <a href="https://github.com/SYNTHOS7/Reven"><strong>Source</strong></a>
</p>

## The idea

A payment failure is not one problem. A bank decline, unsupported card, low balance, technical error, or abandoned checkout needs a different response. Blindly retrying every payment can create more risk and reduce customer trust.

Reven runs an evidence-first recovery loop:

```text
Detect → Trust Gate → Diagnose → Decide → Recover & Verify
```

- **Detect:** receive Razorpay Test Mode failure events.
- **Trust Gate:** stop risky or excessive retries before action.
- **Diagnose:** use processor evidence and AI to identify the likely cause.
- **Decide:** apply hard policy limits, confidence floors, and human-review rules.
- **Recover & Verify:** create a recovery path only when permitted; count money only after a paid webhook confirms it.

> **AI diagnoses the situation. Deterministic policy controls the action.**

## What is proven end to end

| Evidence | What Reven does |
| --- | --- |
| Failure intake | Verifies, ingests, and audits Razorpay Test Mode `payment.failed` webhooks. |
| Safe judgement | Escalates low-confidence or sensitive cases instead of auto-contacting customers. |
| Recovery | Lets an operator approve a Razorpay Test Mode Payment Link when policy permits it. |
| Verification | Attributes recovered value only after Razorpay confirms `payment_link.paid`. |

The project contains a **₹100 verified test recovery**. It is Razorpay Test Mode evidence, not production merchant revenue.

## Product surfaces

| Area | Purpose |
| --- | --- |
| **Overview** | Live recovery control room with current cases, outcome metrics, evidence chain, and policy context. |
| **Intelligence** | Revenue-leakage analysis: attempted, collected, lost, recoverable, and recovered revenue. |
| **Recovery Queue** | Prioritised cases with filters, recommendations, safe demo actions, and a clear “why this recommendation?” explanation. |
| **Transaction Data** | CSV validation, raw-data inspection, failure classification, policy evaluation, and queue generation. |
| **Live Evidence** | Case-level Razorpay Test Mode facts, diagnosis, trust result, policy decision, and recovery outcome. |
| **Policy & Rules** | Confidence thresholds, retry/contact limits, human-approval rules, and dry-run policy replay. |

## Two data sources, never mixed

### Live Razorpay Test Mode evidence

Signed Razorpay webhook data is used to prove the closed loop: failure received → policy decision → operator-approved Payment Link → paid-webhook verification. No full card data, CVVs, OTPs, bank credentials, API keys, or Supabase secrets are exposed in the frontend.

### Simulated merchant scenario

Reven also includes a clearly labelled 500-transaction online-course merchant scenario. It is used to demonstrate business-scale revenue analysis, recovery opportunity ranking, and safe simulated actions.

> **Simulation only.** No customer message, WhatsApp, email, or payment request is sent from demo data.

## Why it is different

- **Evidence before action:** payment context and processor signals are visible before a recommendation.
- **AI is bounded:** AI may diagnose ambiguity, but it cannot bypass policy.
- **Uncertainty is honest:** low confidence, high-value, and risky cases go to human review.
- **Recovery means verified:** generating a link is not revenue; a paid Razorpay webhook is required.
- **Every decision is auditable:** case details preserve evidence, policy rationale, action state, and outcome.

## Technology

| Layer | Technology |
| --- | --- |
| Merchant application | Next.js 16, TypeScript, CSS, Vercel |
| Recovery API | FastAPI, Python, Render |
| Payments | Razorpay Test Mode APIs and signed webhooks |
| Persistence | Supabase |
| AI diagnosis | Gemini structured diagnosis with deterministic fallback |

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

Set `NEXT_PUBLIC_API_URL=http://localhost:8000` in `frontend/.env.local`, then open `http://localhost:3000`.

## Deploy

| Service | Root directory | Required configuration |
| --- | --- | --- |
| Vercel | `frontend` | `NEXT_PUBLIC_API_URL=https://your-api.onrender.com` |
| Render | `backend` | Razorpay Test Mode keys, webhook secret, Supabase URL/service role, Gemini key, admin token |

Deployment details: [DEPLOYMENT.md](DEPLOYMENT.md). API contract: [docs/api-contract.md](docs/api-contract.md). Real evidence plan: [docs/real-data-evidence.md](docs/real-data-evidence.md).

## Safety commitments

- Razorpay Test Mode only for live payment evidence.
- No card numbers, CVVs, OTPs, or bank credentials are stored by Reven.
- Customer communication is previewed or simulated; it is never automatically sent.
- High-risk and uncertain recoveries require operator approval.
- Policy replay is a dry run and never creates a payment link or changes metrics.
- A recovery is counted only after verified Razorpay payment evidence.

---

Built to show that payment recovery is not more automation. It is the right action, backed by the right evidence, at the right time.
