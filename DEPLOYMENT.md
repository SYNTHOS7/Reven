# Deploy Reven

Use one GitHub repository. Vercel deploys only `frontend/`; Render deploys only `backend/`; Supabase stores evidence.

## 1. Supabase

1. Create a Supabase project.
2. Open SQL Editor and run `supabase/schema.sql`.
3. Copy the Project URL and `service_role` key. The service key goes only to Render.

## 2. Render backend

Recommended: create a **Blueprint** from the repository root. Render reads `render.yaml` and sets the backend root to `backend`.

Set these environment variables:

```text
APP_ENV=production
ALLOWED_ORIGINS=https://YOUR-VERCEL-DOMAIN.vercel.app
RAZORPAY_KEY_ID=rzp_test_...
RAZORPAY_KEY_SECRET=...
RAZORPAY_WEBHOOK_SECRET=...
SUPABASE_URL=https://YOUR-PROJECT.supabase.co
SUPABASE_SERVICE_ROLE_KEY=...
ADMIN_TOKEN=a-long-random-secret
GEMINI_API_KEY=...
GEMINI_MODEL=gemini-2.5-flash
```

Verify:

```text
GET https://YOUR-RENDER-SERVICE.onrender.com/health
```

The response should show `storage: supabase` and `razorpay_configured: true`.

## 3. Razorpay test-mode webhook

In Razorpay Dashboard → Test Mode → Account & Settings → Webhooks:

- URL: `https://YOUR-RENDER-SERVICE.onrender.com/webhooks/razorpay`
- Secret: the same value as `RAZORPAY_WEBHOOK_SECRET`
- Events: `payment.failed`, `payment_link.paid`

## 4. Vercel frontend

Import the same repository and set **Root Directory** to `frontend`.

Set:

```text
NEXT_PUBLIC_API_URL=https://YOUR-RENDER-SERVICE.onrender.com
```

No Razorpay, Supabase, Gemini or admin secret belongs in Vercel.

## 5. Evidence collection

Follow `docs/real-data-evidence.md`. Until signed events arrive, the dashboard intentionally shows an empty state instead of sample metrics.

## Upload bundles

If deploying without GitHub:

- Vercel upload: `deploy/reven-vercel-frontend.zip`
- Render upload/source bundle: `deploy/reven-render-backend.zip`
- Supabase SQL: `deploy/reven-supabase-schema.sql`

Environment files are intentionally excluded from all bundles.
