# Evaluation protocol

Reven separates **live Test Mode proof** from its **simulated merchant scenario**. This document describes how diagnosis quality is measured without treating simulated results as production performance.

## What is measured

The evaluation endpoint compares a pipeline result with an event that has both:

- `expected_cause`: the independently recorded failure cause; and
- `expected_action`: the expected policy-bounded action.

It reports diagnosis accuracy, action accuracy, policy compliance, uncertainty/escalation, and the individual mismatches. Unlabelled events are excluded from accuracy denominators.

## Labelling protocol

1. Select a diverse, fixed sample from the 500-transaction **simulated** dataset: payment method, failure code, amount band, and retry pattern.
2. Before inspecting the model output, record the expected cause and safe policy action from the fixture’s known scenario specification.
3. Add the labels through operator review; record a short note explaining the evidence used.
4. Run evaluation once against the locked sample. Do not alter labels after seeing the score.
5. Review each mismatch and publish the count of labelled cases with the result.

## Guardrails

- Simulated accuracy is a lab result, not a claim about production merchant performance.
- Razorpay Test Mode cases are only labelled when an operator can explain the processor evidence.
- An unresolved cause is `unknown`, capped at 35% confidence, and escalated for human review.
- Similar-case retrieval uses only human-labelled, same-source cases. It is supporting evidence for diagnosis; policy makes the decision independently.

## Current status

The repository publishes the method before publishing a score. Add a measured result only after a fixed labelled sample has been completed; do not substitute generated data or an estimated percentage.
