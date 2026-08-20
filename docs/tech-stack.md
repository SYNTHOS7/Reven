# Tech Stack & Architecture

## Stack
- **Frontend**: Next.js (App Router) + TypeScript + Tailwind, deployed on Vercel. Reads pipeline results either directly from Supabase (via `@supabase/supabase-js`, read-only anon key) or via the backend API — use the backend API for anything that triggers a pipeline run, and direct Supabase reads for dashboard display/refresh.
- **Backend**: Python + FastAPI, deployed on Railway or Render. Owns the actual pipeline (detection → trust gate → diagnosis → decision → communication) and the batch-eval runner. This is where Gemini calls happen — never call Gemini from the frontend.
- **Database**: Supabase (Postgres). Stores redacted Razorpay test events, human review labels, immutable pipeline outputs, webhook idempotency keys, recovery attempts and scorecards. Only the backend service-role client accesses it.
- **LLM**: Google Gemini API through the current `google-genai` SDK. The model name is configured by `GEMINI_MODEL`. Gemini is used only for ambiguous-case diagnosis and customer-message drafting; invalid output or API failure must become a low-confidence human escalation.
- **Hosting/deploy**: Vercel serves only `/frontend`; Railway or Render serves only `/backend`. The frontend receives `NEXT_PUBLIC_API_URL`; Razorpay, Gemini, Supabase and webhook secrets exist only on the backend service.
- **Auth**: None in v1 (single demo workspace). If needed later, gate the dashboard behind a single shared password via a simple env-var check — not full auth.

## Folder Structure
```
/reven
  /backend
    /app
      main.py              # FastAPI app, routes
      /pipeline
        detection.py        # Part 1: rule-based event filtering
        trust_gate.py        # abuse/fraud pattern check, runs before diagnosis
        diagnosis.py          # Part 2: rules + Gemini fallback for ambiguous cases
        decision.py            # Part 3: action selection against hard limits
        communication.py        # Part 4: Gemini message generation
        settings.py               # hard limits config (single source of truth)
      ingestion.py                 # Razorpay payload mapping and PII redaction
      /eval
        run_batch.py               # runs pipeline over batch, compares to answer key, writes scorecard
      /db
        supabase_client.py         # supabase-py client setup
        models.py                   # pydantic models mirroring DB tables
    requirements.txt
    Procfile / render.yaml
  /frontend
    /app
      page.tsx                    # dashboard home: event stream + scorecard
      /case/[id]/page.tsx          # per-case drill-down
      /settings/page.tsx            # hard limits display (read-only or editable)
    /lib
      supabaseClient.ts
    package.json
  /docs                             # this planning doc set
```

## Key Libraries
- **fastapi**, **uvicorn** — API server.
- **pydantic** — request/response and internal data models, since case data has a clear shape (event → diagnosis → action → message).
- **httpx** — backend access to Supabase REST and Razorpay test APIs.
- **google-genai** — optional backend-only Gemini adapter for diagnosis and messaging.
- **httpx** — Razorpay test-mode Payment Link calls and resilient external HTTP requests.
- **python-dotenv** — local env var loading.
- Frontend: **@supabase/supabase-js**, **swr** (or plain fetch) for polling scorecard/event data, **recharts** for the scorecard chart if a visual is wanted.

## Explicitly Avoid
- No Redux/heavy state libraries on the frontend — Supabase reads + local component state is enough for a dashboard this size.
- No ORM (SQLAlchemy etc.) on the backend — Supabase's Postgres tables are simple enough for supabase-py's query builder or raw SQL.
- No background job queue (Celery, etc.) — the batch eval runs synchronously as a script/endpoint; there's no real-time retry execution to schedule against a real PSP.
- No calling Gemini from detection or the hard-limit checks — those must stay deterministic and explainable.
- No Razorpay secret, Gemini key, Supabase service key or webhook secret in a `NEXT_PUBLIC_` variable.

## Auth Approach
None for v1. If demo needs light protection, use a single shared `NEXT_PUBLIC_DEMO_PASSWORD`-style gate on the frontend, not a real auth system.
