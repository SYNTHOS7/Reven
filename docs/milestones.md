# Milestones

Each milestone should be completable in one focused session and leave the system runnable end-to-end at a (growing) level of completeness.

- [x] M1: Deployable scaffold — independent FastAPI `/backend` and Next.js `/frontend`, with Render, Railway and Vercel configuration.
- [x] M2: Razorpay test-payment sync and signed webhook ingestion with redacted customer identity.
- [x] M3: Deterministic detection stage with tests.
- [x] M4: Trust gate for repeated/tiny-amount abuse patterns, executed before diagnosis.
- [x] M5: Rule-first diagnosis plus a structured Gemini adapter for ambiguous cases; model/schema/network failures safely degrade to low-confidence escalation.
- [x] M6: Policy-driven decision engine covers retry, payment link, payment-method update, escalation, stopping and refusal.
- [ ] M7: Safe deterministic messages are implemented; add Gemini drafting plus Hinglish and schema validation.
- [x] M8: Batch evaluation reports diagnosis match, action match, policy compliance, estimated recovery and honest exceptions.
- [x] M9: Dashboard, case audit trail and editable policy UI are implemented with honest disconnected and empty states.
- [x] M9.5: Add Supabase persistence and immutable evidence/run tables; hosted project configuration remains.
- [ ] M9.6: Configure Razorpay test credentials, public webhook URL and one end-to-end test payment.
- [ ] M9.7: Deploy frontend to Vercel and backend to Railway/Render; verify CORS and environment variables.
- [ ] M10: Demo polish — pick/confirm the one deliberately tricky case to show live, prepare the "earlier version got this wrong" narrative, do a full dry run of the eval + dashboard walkthrough.

Keep each milestone bounded enough that "what am I building today" is never ambiguous.
