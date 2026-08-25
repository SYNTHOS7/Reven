# Contributing to Reven

Thanks for improving Reven. This project is deliberately safety-first: a new feature must not make an autonomous financial claim, contact a customer, or report recovered revenue without Razorpay confirmation.

## Before opening a pull request

1. Keep Razorpay examples in Test Mode only. Never commit keys, OTPs, card data, phone numbers, or webhook secrets.
2. Add or update tests when changing diagnosis, Trust Gate, policy, recovery attribution, or webhook handling.
3. Run the checks locally:

```text
cd backend && pytest -q
cd frontend && npm run lint && npm run build
```

## Design rules

- AI may interpret ambiguous processor evidence; deterministic policy owns the final action.
- `unknown` means unresolved evidence and must remain low confidence.
- Historical examples used by AI must be human-labelled, source-scoped, and treated as supporting evidence only.
- A created Payment Link is not recovered revenue. Only a signed Razorpay paid webhook can verify recovery.

## Reporting an issue

For a bug report, include the non-sensitive event shape, expected safety behaviour, actual behaviour, and steps to reproduce. Do not attach payment credentials or personal data.
