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
import { FiveStageFlow } from "@/components/five-stage-flow";
import { SimilarCases } from "@/components/similar-cases";
import { RecoveryStrategyPanel } from "@/components/recovery-strategy-panel";
import { RecoveryTimeline } from "@/components/recovery-timeline";
import { EvidenceAssurance } from "@/components/evidence-assurance";
import { AdvisoryAiInvestigation } from "@/components/advisory-ai-investigation";
import { loadCaseDetails, loadPolicy, loadRecoveryStrategies, loadRecoveryTimeline, loadEvidenceQuality, loadEvidenceReceipt } from "@/lib/api";
import { formatConfidence } from "@/lib/confidence";
import { getWhyThisAction } from "@/lib/utils";

export default async function CasePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [caseData, activePolicy, recoveryStrategies, recoveryTimeline, evidenceQuality, evidenceReceipt] = await Promise.all([
    loadCaseDetails(id),
    loadPolicy(),
    loadRecoveryStrategies(id),
    loadRecoveryTimeline(id),
    loadEvidenceQuality(id),
    loadEvidenceReceipt(id),
  ]);
  if (!caseData) notFound();

  const { event, pipeline_result: result, similar_cases } = caseData;
  const stopped = result.trust_gate.status === "suspicious";

  // Determine current active stage number (1 to 5) and plain sentence summary
  let currentStageNumber = 4;
  let stageSentence = "Reven evaluated safety rules and selected a bounded recovery action.";

  if (stopped) {
    currentStageNumber = 2;
    stageSentence = "Trust Gate stopped recovery because this payment attempt matched suspicious velocity patterns.";
  } else if (result.verified_recovered_amount > 0) {
    currentStageNumber = 5;
    stageSentence = `Recovery confirmed! ₹${result.verified_recovered_amount.toLocaleString("en-IN")} was verified via signed Razorpay webhook.`;
  } else if (result.razorpay_payment_link_id) {
    currentStageNumber = 5;
    stageSentence = "Payment link created in Razorpay Test Mode; awaiting webhook payment confirmation.";
  } else if (result.decision.action === "escalate_human") {
    currentStageNumber = 4;
    stageSentence = "Human review required because the case amount or uncertainty exceeds safety policy bounds.";
  }

  const recoveryState =
    result.verified_recovered_amount > 0
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
        <Link href="/evidence" className="backLink">
          <ArrowLeft size={15} /> Back to evidence ledger
        </Link>

        {/* Case Header */}
        <section className="caseHeader">
          <div>
            <div className="flex items-center gap-2">
              <span className="utilityLabel">CASE {result.event_id}</span>
              <span className="badgeLive"><span className="liveDot" /> RAZORPAY TEST MODE</span>
            </div>
            <h1>{result.customer_name}</h1>
            <p>
              {result.event_type.replaceAll("_", " ")} ·{" "}
              <span className="number fontBold text-primary">₹{result.amount.toLocaleString("en-IN")}</span>
            </p>
          </div>
          <div className="caseDecision">
            <span>RECOMMENDED ACTION</span>
            <StatusBadge value={result.decision.action} />
          </div>
        </section>

        {/* 5-Stage Flow Highlight with 1-Sentence Plain Explanation */}
        <section className="caseFlowHighlightCard">
          <div className="caseFlowTop">
            <span className="utilityLabel">CURRENT STAGE IN 5-STAGE PIPELINE</span>
            <div className="currentStageBanner">
              <span className="stageNumberPill">STAGE 0{currentStageNumber}</span>
              <strong>{stageSentence}</strong>
            </div>
          </div>
          <FiveStageFlow
            activeStage={currentStageNumber}
            isStopped={stopped}
            stopStage={2}
            compact
            title=""
            subtitle=""
          />
        </section>

        {/* Action Bars */}
        {!stopped && result.decision.action === "create_payment_link" && (
          <div className="actionBar">
            <div>
              <span className="utilityLabel">OPERATOR ACTION</span>
              <strong>Create a Razorpay test Payment Link</strong>
              <small className="block text-text-muted text-xs">Generates a test mode checkout link for this transaction.</small>
            </div>
            <PaymentLinkAction eventId={result.event_id} />
          </div>
        )}

        {!stopped && result.decision.action === "escalate_human" && !result.razorpay_payment_link_id && (
          <div className="actionBar approvalBar">
            <div>
              <span className="utilityLabel">HUMAN REVIEW REQUIRED</span>
              <strong>Review the evidence, then authorize one Razorpay test Payment Link</strong>
              <small className="block text-text-muted text-xs">The operator token is used once and is never stored in the browser.</small>
            </div>
            <OperatorApprovalAction eventId={result.event_id} />
          </div>
        )}

        {!stopped && result.razorpay_payment_link_id && result.verified_recovered_amount === 0 && (
          <div className="actionBar">
            <div>
              <span className="utilityLabel">PAYMENT LINK PREPARED</span>
              <strong>Verify the current paid status directly with Razorpay</strong>
              <small className="block text-text-muted text-xs">Use this if webhook delivery was delayed or interrupted.</small>
            </div>
            <RecoveryVerificationAction eventId={result.event_id} />
          </div>
        )}

        {result.verified_recovered_amount > 0 && (
          <div className="actionBar">
            <div>
              <span className="utilityLabel">VERIFIED RECOVERY</span>
              <strong className="text-primary">
                ₹{result.verified_recovered_amount.toLocaleString("en-IN")} received through attributed Razorpay Payment Link
              </strong>
            </div>
          </div>
        )}

        {/* Detailed Decision Trace */}
        <section className="decisionTraceIntro" aria-labelledby="decision-trace-title">
          <div>
            <span className="utilityLabel">AUDITABLE DECISION TRACE</span>
            <h2 id="decision-trace-title">Evidence behind the decision</h2>
          </div>
          <p>
            AI diagnoses ambiguity. Trust checks and policy rules decide whether an action is permitted.
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
                {step.number === "03" && result.diagnosis.tool_calls && result.diagnosis.tool_calls.length > 0 && (
                  <p className="toolTrace">Read-only AI tools: {result.diagnosis.tool_calls.join(" · ")}</p>
                )}
                {step.number === "03" && <span className="decisionBoundary">AI signal · never executes money action</span>}
                {step.number === "04" && <span className="decisionBoundary policyBoundary">Policy control · bounded action</span>}
              </div>
            </article>
          ))}
        </section>

        <section className="aiInvestigationPanel" aria-labelledby="ai-investigation-title">
          <div className="aiInvestigationHeader">
            <div>
              <span className="utilityLabel">STORED PIPELINE DIAGNOSIS</span>
              <h2 id="ai-investigation-title">What the pipeline used for this decision</h2>
              <p>Clear processor codes use deterministic rules. Ambiguous evidence may use Gemini with read-only tools. Neither path can create a link, contact a customer, or override policy.</p>
            </div>
            <span className="aiMethodPill">{result.diagnosis.method === "llm" ? "Gemini structured diagnosis" : "Deterministic rule diagnosis"}</span>
          </div>
          <div className="aiInvestigationGrid">
            <article><span>TOOLS / EVIDENCE READ</span><strong>{result.diagnosis.tool_calls?.length ? result.diagnosis.tool_calls.join(" · ") : "Processor evidence mapped by deterministic rules"}</strong></article>
            <article><span>STRUCTURED DIAGNOSIS</span><strong>{result.diagnosis.cause.replaceAll("_", " ")}</strong><small>{formatConfidence(result.diagnosis.confidence)} confidence</small></article>
            <article><span>POLICY RESULT</span><StatusBadge value={result.decision.action} /><small>{result.decision.reason}</small></article>
          </div>
          <div className="aiInvestigationBoundary">Decision boundary: investigation may explain ambiguity. Trust Gate, policy, and human approval control every recovery action.</div>
        </section>

        <AdvisoryAiInvestigation eventId={result.event_id} />

        {recoveryStrategies && <RecoveryStrategyPanel data={recoveryStrategies} />}

        {recoveryTimeline && <RecoveryTimeline data={recoveryTimeline} />}

        {evidenceQuality && <EvidenceAssurance quality={evidenceQuality} receipt={evidenceReceipt} />}

        <SimilarCases data={similar_cases} />

        {/* Operator Feedback / Human Review Side by Side */}
        <OperatorFeedback event={event} pipelineResult={result} />

        {/* Policy Replay / Test a Rule Safely */}
        <PolicyReplay eventId={result.event_id} initialPolicy={activePolicy} pipelineResult={result} />
      </main>
    </Shell>
  );
}
