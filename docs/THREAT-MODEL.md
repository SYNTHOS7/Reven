# Reven v1 threat model

## Scope

Reven is a controlled operator prototype for Razorpay **Test Mode**. It is not a multi-merchant production service and does not claim to provide merchant onboarding, user accounts, RBAC, or tenant isolation.

## Current controls

| Risk | Current control |
|---|---|
| Forged payment outcome | Razorpay webhook signature verification and webhook idempotency |
| Unauthorized policy or label change | Operator token required when `ADMIN_TOKEN` is configured |
| Unsafe AI action | AI tools are read-only; deterministic policy and optional operator approval control money actions |
| Secret exposure | Razorpay, Gemini, Supabase and operator secrets are server environment variables only |
| Oversized or browser-embedded request | Backend rejects declared bodies larger than 1 MB and returns protective browser headers |
| Inflated recovery claims | Recovery is recorded only from a Razorpay paid event or reconciliation result |

## Deliberate v1 limits

- Test Mode evidence only; no production merchant funds.
- The operator token is a prototype control, not a replacement for user authentication.
- No customer credentials, OTPs, card data, or bank credentials are stored.

## Production path

Before onboarding merchants, Reven would add Supabase Auth, role-based permissions, tenant-scoped database policies, immutable operator audit logs, secret rotation, rate limiting, and an approval workflow bound to the authenticated operator identity.
