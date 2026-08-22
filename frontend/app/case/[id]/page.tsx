import Link from "next/link";
import { ArrowLeft, Check, OctagonX } from "lucide-react";
import { notFound } from "next/navigation";

import { Shell } from "@/components/shell";
import { StatusBadge } from "@/components/status-badge";
import { PaymentLinkAction } from "@/components/payment-link-action";
import { OperatorApprovalAction } from "@/components/operator-approval-action";
import { RecoveryVerificationAction } from "@/components/recovery-verification-action";
import { OperatorFeedback } from "@/components/operator-feedback";
import { PolicyReplay } from "@/components/policy-replay";
import { loadCaseDetails, loadPolicy } from "@/lib/api";
import { formatConfidence } from "@/lib/confidence";
import { getWhyThisAction } from "@/lib/utils";

export default async function CasePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const caseData = await loadCaseDetails(id);
  const activePolicy = await loadPolicy();
  if (!caseData) notFound();

  const { event, pipeline_result: result } = caseData;
  const stopped = result.trust_gate.status === "suspicious";

  const recoveryState = result.verified_recovered_amount > 0
    ? `₹${result.verified_recovered_amount.toLocaleString("en-IN")} verified recovered`
    : result.razorpay_payment_link_id
      ? "Recovery link awaiting payment confirmation"
      : "No recovery money action has run";

  const steps = [
    {
      number: "01",
      title: "Raw event",
      status: "received",
      body: `${result.event_type.replaceAll("_", " ")} · ${result.failure_code.replaceAll("_", " ")}`,
      reason: `Received ${new Date(result.occurred_at).toLocaleString("en-IN")}`,
    },
    {
      number: "02",
      title: "Trust gate",
      status: result.trust_gate.status,
      body: result.trust_gate.reason,
      reason: stopped ? "Recovery stopped here" : "Allowed to continue",
    },
    {
      number: "03",
      title: "Diagnosis",
      status: stopped ? "not executed" : result.diagnosis.method,
      body: result.diagnosis.cause.replaceAll("_", " "),
      reason: `${result.diagnosis.reason} · ${formatConfidence(result.diagnosis.confidence)} confidence`,
    },
    {
      number: "04",
      title: "Bounded decision",
      status: result.decision.action,
      body: result.decision.reason,
      reason: getWhyThisAction(result, activePolicy),
    },
    {
      number: "05",
      title: "Communication",
      status: result.generated_message ? "prepared" : "not required",
      body: result.generated_message ?? "No customer communication was generated for this action.",
      reason: "Messages are displayed only; nothing was sent",
    },
    {
      number: "06",
      title: "Recovery outcome",
      status:
        result.verified_recovered_amount > 0
          ? "verified"
          : result.razorpay_payment_link_id
          ? "awaiting payment"
          : "not initiated",
      body: recoveryState,
      reason:
        result.verified_recovered_amount > 0
          ? "Attributed from a Razorpay Payment Link payment event"
          : "Revenue is counted only after Razorpay confirms payment",
    },
  ];

  return (
    <Shell>
      <main className="innerPage casePage">
        <Link href="/" className="backLink">
          <ArrowLeft size={15} /> Back to recovery ledger
        </Link>
        <section className="caseHeader">
          <div>
            <span className="utilityLabel">CASE {result.event_id}</span>
            <h1>{result.customer_name}</h1>
            <p>
              {result.event_type.replaceAll("_", " ")} ·{" "}
              <span className="number">₹{result.amount.toLocaleString("en-IN")}</span> ·{" "}
              <span className="badgeMono">Razorpay Test Mode</span>
            </p>
          </div>
          <div className="caseDecision">
            <span>FINAL DECISION</span>
            <StatusBadge value={result.decision.action} />
          </div>
        </section>

        <section className="decisionTraceIntro" aria-labelledby="decision-trace-title">
          <div>
            <span className="utilityLabel">DECISION TRACE</span>
            <h2 id="decision-trace-title">Evidence before action.</h2>
          </div>
          <p>
            <strong>AI diagnoses ambiguity.</strong> Trust and policy rules decide whether an action is permitted.
            No customer contact or revenue claim is made without an auditable record.
          </p>
        </section>

        <section className="auditTrail" aria-label="Recovery decision trace">
          {steps.map((step, index) => (
            <article className={stopped && index > 1 ? "auditStep mutedStep" : "auditStep"} key={step.number}>
              <div className="stepIndex">
                <span>{step.number}</span>
                {stopped && index === 1 ? <OctagonX size={18} /> : <Check size={16} />}
              </div>
              <div className="stepTitle">
                <span>{step.title}</span>
                <StatusBadge value={step.status} />
              </div>
              <div className="stepEvidence">
                <strong>{step.body}</strong>
                <p>{step.reason}</p>
                {step.number === "03" && <span className="decisionBoundary">AI signal · never executes a money action</span>}
                {step.number === "04" && <span className="decisionBoundary policyBoundary">Policy control · bounded action only</span>}
              </div>
            </article>
          ))}
        </section>

        {!stopped && result.decision.action === "create_payment_link" && (
          <div className="actionBar">
            <div>
              <span className="utilityLabel">OPERATOR ACTION</span>
              <strong>Create a Razorpay test Payment Link</strong>
            </div>
            <PaymentLinkAction eventId={result.event_id} />
          </div>
        )}
        {!stopped && result.decision.action === "escalate_human" && !result.razorpay_payment_link_id && (
          <div className="actionBar approvalBar">
            <div>
              <span className="utilityLabel">HUMAN REVIEW REQUIRED</span>
              <strong>Review the evidence, then authorize one Razorpay test Payment Link</strong>
              <small>The operator token is used once and is never stored in the browser.</small>
            </div>
            <OperatorApprovalAction eventId={result.event_id} />
          </div>
        )}
        {!stopped && result.razorpay_payment_link_id && result.verified_recovered_amount === 0 && (
          <div className="actionBar">
            <div>
              <span className="utilityLabel">PAYMENT LINK PREPARED</span>
              <strong>Verify the current paid status directly with Razorpay</strong>
              <small>Use this if webhook delivery was delayed or interrupted.</small>
            </div>
            <RecoveryVerificationAction eventId={result.event_id} />
          </div>
        )}
        {result.verified_recovered_amount > 0 && (
          <div className="actionBar">
            <div>
              <span className="utilityLabel">VERIFIED RECOVERY</span>
              <strong>₹{result.verified_recovered_amount.toLocaleString("en-IN")} received through the attributed Razorpay Payment Link</strong>
            </div>
          </div>
        )}

        {/* Operator Feedback / Human Review Side by Side */}
        <OperatorFeedback event={event} pipelineResult={result} />

        {/* Policy Replay / Dry Run */}
        <PolicyReplay eventId={result.event_id} initialPolicy={activePolicy} pipelineResult={result} />
      </main>
    </Shell>
  );
}
