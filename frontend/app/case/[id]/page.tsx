import Link from "next/link";
import { ArrowLeft, Check, OctagonX } from "lucide-react";
import { notFound } from "next/navigation";

import { Shell } from "@/components/shell";
import { StatusBadge } from "@/components/status-badge";
import { PaymentLinkAction } from "@/components/payment-link-action";
import { OperatorApprovalAction } from "@/components/operator-approval-action";
import { RecoveryVerificationAction } from "@/components/recovery-verification-action";
import { loadCase } from "@/lib/api";

export default async function CasePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const result = await loadCase(id);
  if (!result) notFound();
  const stopped = result.trust_gate.status === "suspicious";
  const steps = [
    { number: "01", title: "Raw event", status: "received", body: `${result.event_type.replaceAll("_", " ")} · ${result.failure_code.replaceAll("_", " ")}`, reason: `Received ${new Date(result.occurred_at).toLocaleString("en-IN")}` },
    { number: "02", title: "Trust gate", status: result.trust_gate.status, body: result.trust_gate.reason, reason: stopped ? "Recovery stopped here" : "Allowed to continue" },
    { number: "03", title: "Diagnosis", status: stopped ? "not executed" : result.diagnosis.method, body: result.diagnosis.cause.replaceAll("_", " "), reason: `${result.diagnosis.reason} · ${(result.diagnosis.confidence * 100).toFixed(0)}% confidence` },
    { number: "04", title: "Bounded decision", status: result.decision.action, body: result.decision.reason, reason: stopped ? "No money action permitted" : "Evaluated against the active policy snapshot" },
    { number: "05", title: "Communication", status: result.generated_message ? "prepared" : "not required", body: result.generated_message ?? "No customer communication was generated for this action.", reason: "Messages are displayed only; nothing was sent" },
  ];

  return (
    <Shell>
      <main className="innerPage casePage">
        <Link href="/" className="backLink"><ArrowLeft size={15} /> Back to recovery ledger</Link>
        <section className="caseHeader">
          <div>
            <span className="utilityLabel">CASE {result.event_id}</span>
            <h1>{result.customer_name}</h1>
            <p>{result.event_type.replaceAll("_", " ")} · <span className="number">₹{result.amount.toLocaleString("en-IN")}</span></p>
          </div>
          <div className="caseDecision"><span>FINAL DECISION</span><StatusBadge value={result.decision.action} /></div>
        </section>
        <section className="auditTrail">
          {steps.map((step, index) => (
            <article className={stopped && index > 1 ? "auditStep mutedStep" : "auditStep"} key={step.number}>
              <div className="stepIndex"><span>{step.number}</span>{stopped && index === 1 ? <OctagonX size={18} /> : <Check size={16} />}</div>
              <div className="stepTitle"><span>{step.title}</span><StatusBadge value={step.status} /></div>
              <div className="stepEvidence"><strong>{step.body}</strong><p>{step.reason}</p></div>
            </article>
          ))}
        </section>
        {!stopped && result.decision.action === "create_payment_link" && (
          <div className="actionBar"><div><span className="utilityLabel">OPERATOR ACTION</span><strong>Create a Razorpay test Payment Link</strong></div><PaymentLinkAction eventId={result.event_id} /></div>
        )}
        {!stopped && result.decision.action === "escalate_human" && !result.razorpay_payment_link_id && (
          <div className="actionBar approvalBar"><div><span className="utilityLabel">HUMAN APPROVAL REQUIRED</span><strong>Review the evidence, then authorize one Razorpay test Payment Link</strong><small>The operator token is used once and is never stored in the browser.</small></div><OperatorApprovalAction eventId={result.event_id} /></div>
        )}
        {!stopped && result.razorpay_payment_link_id && result.verified_recovered_amount === 0 && (
          <div className="actionBar"><div><span className="utilityLabel">PAYMENT LINK PREPARED</span><strong>Verify the current paid status directly with Razorpay</strong><small>Use this if webhook delivery was delayed or interrupted.</small></div><RecoveryVerificationAction eventId={result.event_id} /></div>
        )}
        {result.verified_recovered_amount > 0 && (
          <div className="actionBar"><div><span className="utilityLabel">VERIFIED RECOVERY</span><strong>₹{result.verified_recovered_amount.toLocaleString("en-IN")} received through the attributed Razorpay Payment Link</strong></div></div>
        )}
      </main>
    </Shell>
  );
}
