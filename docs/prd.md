# PRD: Reven — AI Agent for Safe, Provable Revenue Recovery

## Problem
Payments fail for boring, recoverable reasons (insufficient funds, expired cards, lapsed mandates, glitches) far more often than for dramatic ones. Most of that money is recoverable if someone chases it correctly and at the right time — but the chasing is repetitive, low-glamour, and easy to do sloppily or not at all. Reven does the chasing: detect the loss, diagnose the real cause, decide the safest action within hard limits, and prove with real numbers how much it recovered.

## Users
- **Demo/judge-facing**: a payments-company evaluator watching signed Razorpay test-mode failures enter the pipeline and reading a human-reviewed scorecard.
- **Conceptual end user**: a merchant/finance ops team who would otherwise manually track failed payments and follow up one by one.

## Core Flows (v1)
- As the system, I can ingest a stream of payment/checkout/subscription/invoice events and flag only the ones that matter (failed payment, abandoned checkout, failed renewal, overdue invoice), using cheap rule-based filtering — no LLM in this step.
- As the system, I can diagnose the root cause of each flagged event, using deterministic rules for clear-cut failure codes and an LLM call (with customer history as context) only for ambiguous cases.
- As the system, I can run every case through a trust gate first — patterns that look like abuse/card-testing (many attempts in a short window, tiny test amounts, odd timing) get flagged as suspicious and excluded from recovery action, not chased.
- As the system, I can choose one bounded action per case (auto-retry now, smart-scheduled retry, ask-customer-to-act, escalate-to-human, refuse/flag-suspicious), governed by a small, explicit, editable settings list of hard limits (max retries, max messages/day, rupee threshold requiring human approval, confidence threshold for escalation).
- As the system, I can generate a warm, context-aware customer message (optionally Hinglish) for actions that involve contacting the customer, using an LLM only for this step.
- As a judge, I can run the pipeline against captured Razorpay test-mode failures and see diagnosis/action accuracy only for cases a human has reviewed, verified test recovery from paid-link webhooks, and an honest list of uncertain cases.
- As a judge, I can see one deliberately tricky/ambiguous case handled live — either escalated correctly, or shown as a "we got this wrong before, here's the fix" example.
- As a judge, I can view a small dashboard (Next.js on Vercel) showing the event stream, per-case diagnosis/action/message, the settings list of hard limits, and the scorecard.

## Out of Scope (v1)
- No Razorpay live-mode transactions. The product integrates only with Razorpay test-mode Payment Links and test webhooks.
- No actually sending SMS/WhatsApp/email — messages are generated and displayed, not delivered.
- No multi-tenant auth/login system — single demo workspace, no user accounts.
- No autonomous retry against a bank/PSP. A recovery action may create a Razorpay test-mode Payment Link only after policy approval and an explicit operator action.
- No human-escalation ticketing/inbox UI beyond a flagged list — no full case-management system.
- No mobile app — desktop-oriented web dashboard only.
- No persistent multi-tenant billing, invoicing, or PDF generation.

## Success Criteria
- Can run captured Razorpay test failures end-to-end through Detection → Trust Gate → Diagnosis → Decision → Communication and produce a per-case audit log.
- Scorecard reports diagnosis/action accuracy only over human-reviewed labels, verified test recovery only after signed paid webhooks, and a list of wrong/uncertain cases.
- Hard limits (max retries=3, max 1 message/customer/day, ₹ threshold for human approval, confidence threshold for escalation) are visible as actual config values in the dashboard, not just claimed in prose.
- At least one deliberately ambiguous case is shown being escalated (not guessed) during the demo, and at least one "earlier version got this wrong, here's what changed" narrative is prepared.
- Dashboard deployed on Vercel, API deployed on Railway/Render, data readable from Supabase — a judge can open a URL and see it live, not just a local script.
- One approved case can create a Razorpay test-mode Payment Link, receive an idempotent test webhook, and record actual test recovery separately from estimated batch recovery.
- Each evaluation stores a run id, policy snapshot, pipeline version, model version (when used), and random seed so the scorecard is reproducible.
