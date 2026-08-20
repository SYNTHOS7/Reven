# Reven

Reven is a policy-bounded AI revenue recovery agent built for Razorpay's AI Buildathon, Track 03 — AI Revenue Recovery.

It detects failed payments and renewals, checks for suspicious behaviour, diagnoses the likely cause, chooses a bounded recovery action, and keeps an auditable record of what happened.

## Deployable architecture

- `frontend/` — Next.js dashboard, deploy to Vercel.
- `backend/` — FastAPI recovery engine, deploy to Railway or Render.
- The browser only receives `NEXT_PUBLIC_API_URL`. Razorpay, Gemini, webhook and database secrets stay on the backend.

## Run locally

Backend:

```bash
cd backend
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

Frontend:

```bash
cd frontend
copy .env.example .env.local
npm install
npm run dev
```

Open `http://localhost:3000`. API documentation is available at `http://localhost:8000/docs`. With no API or signed Razorpay events, the dashboard deliberately shows a disconnected/empty state; it never substitutes sample revenue numbers.

## Deployment

### Vercel

Set the root directory to `frontend` and configure:

```text
NEXT_PUBLIC_API_URL=https://your-reven-api.onrender.com
```

### Render

Create a Blueprint from `render.yaml`, or create a Python web service rooted at `backend`.

### Railway

Create a service rooted at `backend`; Railway reads `backend/railway.toml`. Add the same backend environment variables shown in `backend/.env.example`.

Complete hosted setup and upload-bundle instructions are in [DEPLOYMENT.md](DEPLOYMENT.md). The evidence collection protocol is in [docs/real-data-evidence.md](docs/real-data-evidence.md).

## Safety

Reven uses Razorpay test mode only. It does not automatically send customer messages or charge payment instruments. Payment Links are created only when an operator explicitly invokes the recovery action. Test-mode results are labelled as verified test recovery, never real merchant revenue.
