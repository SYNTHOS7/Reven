# Real data and evidence plan

Reven does not ship fabricated dashboard rows. Production data enters through Razorpay test-mode APIs and signed Razorpay webhooks, then persists in Supabase.

## What is genuinely proven

- A `payment.failed` event came from Razorpay's test environment.
- Reven verified the webhook signature before accepting it.
- The event retained its Razorpay payment id as `source_event_id` while customer contact data was hashed.
- The deterministic trust, diagnosis and decision pipeline processed that event.
- An operator-approved Razorpay test Payment Link was created through the real API.
- A signed `payment_link.paid` webhook closed the loop and recorded Razorpay-verified test recovery.

Test mode does not move real money. The UI therefore calls this **verified test recovery**, never actual merchant revenue.

## Collect the evidence set

1. Enable Razorpay Test Mode and configure the Render webhook URL:
   `https://YOUR-RENDER-SERVICE.onrender.com/webhooks/razorpay`
2. Subscribe to `payment.failed` and `payment_link.paid`.
3. Produce failures using several official test paths:
   - UPI: `failure@razorpay`.
   - Card: use Razorpay's published error-scenario test cards.
   - Netbanking/wallet: choose **Failure** on the test bank page.
4. Vary amounts and repeat selected customer identities to exercise amount and attempt limits.
5. Use the sync endpoint once to capture existing failed payments that predate webhook setup:

```bash
curl -X POST "https://YOUR-RENDER-SERVICE.onrender.com/data/sync/razorpay?count=100" \
  -H "x-admin-token: YOUR_ADMIN_TOKEN"
```

6. Human-review a subset before reporting accuracy:

```bash
curl -X PATCH "https://YOUR-RENDER-SERVICE.onrender.com/events/rzp_pay_xxx/ground-truth" \
  -H "content-type: application/json" \
  -H "x-admin-token: YOUR_ADMIN_TOKEN" \
  -d '{"correct_cause":"customer_abandoned_payment","correct_action":"create_payment_link","reviewer_notes":"incorrect OTP in signed Razorpay event"}'
```

7. Run `/eval/run`. Diagnosis and action accuracy use only human-labelled cases; unlabelled cases cannot inflate accuracy.

## Authoritative sources

- Razorpay Payments webhooks: https://razorpay.com/docs/webhooks/payments/
- Razorpay test cards: https://razorpay.com/docs/payments/payments/test-card-details/
- Razorpay payment listing API: https://razorpay.com/docs/api/payments/fetch-all-payments/
- Razorpay Payment Link webhooks: https://razorpay.com/docs/webhooks/payment-links/
- Razorpay webhook validation: https://razorpay.com/docs/webhooks/validate-test/
