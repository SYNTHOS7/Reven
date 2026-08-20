# UI Reference

## Key Screens

- **Dashboard (Home)** — top: scorecard summary (human-labelled diagnosis/action accuracy, policy compliance, verified Razorpay test recovery), big and legible for screen-sharing. Missing backend/data states must stay visibly empty rather than substituting sample numbers.
- **Case Detail** (`/case/[id]`) — shows one event's full trail: raw event → trust gate verdict → diagnosis (+ method: rule/LLM, + confidence) → decision (+ which hard limit/rule fired) → generated customer message (if any). This is the "show your work" screen — used both for browsing and for the live "show it breaking" demo moment.
- **Settings** — the hard limits list rendered as an actual small settings panel (max retries, max messages/day, ₹ threshold, confidence threshold, trust-gate attempt window/count), matching Settings in the data model. Editable inline, with a "Save & re-run eval" action so a judge can see behavior change live.

## Visual Direction
- Clean, data-dense, "internal ops tool" feel rather than consumer-app polish — think a fraud/ops dashboard (Stripe Radar, internal admin panels), not a marketing site.
- Favor tables and clear numeric callouts over illustration/decoration — the numbers are the pitch.
- Use color sparingly but meaningfully: green for recovered/correct, amber for escalated/uncertain, red for suspicious/refused — this mapping should be consistent everywhere (table rows, case detail, scorecard).
- Monospace or tabular-number font for money and percentages so the scorecard reads cleanly at a glance.
- Use the Shresth Blogs reference as visual inspiration: carbon background, faint engineering grid, monospace display figures, thin instrument-panel borders, uppercase utility labels, and restrained motion. Do not copy its content structure or branding.
- Reserve green for recovered/safe, amber for escalated/uncertain, and red exclusively for suspicious/refused. Decorative red would weaken the product semantics.
- The signature interaction is a five-stage recovery rail. During a run, a single pulse crosses Detection → Trust Gate → Diagnosis → Decision → Recovery; suspicious cases visibly stop at stage two.

## Layout Notes
- Top nav: simple — Dashboard | Settings. No sidebar needed at this size.
- Dashboard: scorecard as one continuous four-cell financial ledger rather than floating cards; honest-failures list directly below; full event table below that.
- Case detail: vertical timeline/stepper layout (Event → Trust Gate → Diagnosis → Decision → Communication), each step as a labeled card so the pipeline stages are visually obvious — this doubles as an explainer of the architecture itself during the demo.
- Mobile not a priority (demo will be on a laptop/projector), but keep it reasonably responsive by default since Tailwind makes this close to free.
