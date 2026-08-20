# CLAUDE.md — Rules for AI coding sessions

## Project
Reven: an agent that detects failed payments/checkouts/subscriptions/invoices, diagnoses the cause, takes a bounded recovery action, and proves results on a synthetic labeled batch. See `docs/prd.md` for full scope.

## Conventions
- Backend: Python, snake_case, type-hinted functions, Pydantic models for all pipeline data shapes (mirror `docs/data-model.md`).
- Frontend: TypeScript, PascalCase components, camelCase variables, Next.js App Router conventions.
- File structure: pipeline stages live as separate files under `backend/app/pipeline/` (`detection.py`, `trust_gate.py`, `diagnosis.py`, `decision.py`, `communication.py`) — never merge stages into one file, the separation is the point of the architecture.
- Formatting: `black` for Python, default Next.js/Prettier setup for TypeScript.

## Always
- Keep `detection.py` and the hard-limit checks in `decision.py` pure rule-based Python — no LLM calls, ever, in those files.
- Route every diagnosis through `diagnosis.py`'s rule-check first; only call Gemini when no rule matches (ambiguous case). Log which path was used (`diagnosis_method: rule|llm`) on every result.
- Read hard limits (max retries, max messages/day, ₹ threshold, confidence threshold, trust-gate window/count) from the `Settings` table/config at runtime — never hardcode a limit inline in `decision.py` or `trust_gate.py`.
- Run the trust gate before diagnosis/decision on every event — suspicious events must never reach the recovery-action logic.
- When writing the synthetic data generator, aim for a realistic distribution (insufficient funds and expired cards/mandates most common) and include at least a few deliberately ambiguous and deliberately abuse-pattern cases.
- After any change to pipeline logic, re-run `/eval/run` (or the equivalent script) and check the scorecard didn't regress before considering a task done.

## Never
- Never call the Gemini API from `detection.py`, `trust_gate.py`, or the hard-limit-checking part of `decision.py`.
- Never call the Gemini API from the frontend — all LLM calls happen backend-side only.
- Never let `chosen_action` bypass a hard limit from Settings (e.g. never allow a 4th retry, never allow auto-action above the ₹ threshold without escalation).
- Never actually send a real message or trigger a real retry against a live payment gateway — this is a simulated system; `communication.py` generates text, it does not deliver it.
- Never overwrite the hand-authored AnswerKey with pipeline output — they must stay independent for the accuracy comparison to mean anything.

## Preferred Libraries
- Backend: fastapi, uvicorn, pydantic, httpx, supabase-py, google-genai, pydantic-settings.
- Frontend: @supabase/supabase-js, swr, recharts (only if a chart is actually used), Tailwind.

## Current Milestone
See `docs/milestones.md` — continue with M5, M7 and M9.5–M9.7. The deployable scaffold and deterministic MVP already exist.
