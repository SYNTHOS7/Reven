import Link from "next/link";
import {
  Activity,
  ArrowUpRight,
  BrainCircuit,
  CircleCheckBig,
  ShieldCheck,
  Webhook,
} from "lucide-react";

import type { PipelineResult, PolicySettings } from "@/lib/types";
import { formatConfidence } from "@/lib/confidence";
import { getWhyThisAction } from "@/lib/utils";
import { StatusBadge } from "./status-badge";

const money = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 });

export function RecoveryCommandDeck({
  results,
  policy,
  connected,
}: {
  results: PipelineResult[];
  policy: PolicySettings;
  connected: boolean;
}) {
  const recovered = results.filter((result) => result.verified_recovered_amount > 0);
  const paymentLinks = results.filter((result) => result.razorpay_payment_link_id);
  const attentionCases = results.filter((result) =>
    ["escalate_human", "refuse_suspicious", "stop_limit_reached"].includes(result.decision.action),
  );
  const queue = [...attentionCases, ...results.filter((result) => !attentionCases.includes(result))].slice(0, 3);

  return (
    <section className="commandDeck" aria-label="Recovery command deck">
      <div className="deckPulse">
        <div className="deckKicker"><Activity size={14} /> RECOVERY PULSE</div>
        <div className="pulseFigure" aria-label={`${recovered.length} verified recoveries`}>
          <span>{String(recovered.length).padStart(2, "0")}</span>
          <i />
          <small>verified recoveries</small>
        </div>
        <div className="pulseStats">
          <div><span>Attributed</span><strong>{money.format(recovered.reduce((sum, result) => sum + result.verified_recovered_amount, 0))}</strong></div>
          <div><span>Links created</span><strong>{String(paymentLinks.length).padStart(2, "0")}</strong></div>
        </div>
        <p>Only paid Razorpay Test Mode webhooks move a recovery into this count.</p>
      </div>

      <div className="deckQueue">
        <div className="deckHeader"><div><span className="utilityLabel">OPERATOR QUEUE</span><h2>Cases worth attention.</h2></div><span>{String(results.length).padStart(2, "0")} IN RUN</span></div>
        <div className="queueList">
          {queue.length === 0 && <div className="deckEmpty">No evaluated cases yet. Run the pipeline when webhook evidence is available.</div>}
          {queue.map((result, index) => (
            <Link className="queueRow" href={`/case/${result.event_id}`} key={result.event_id}>
              <span className="queueIndex">0{index + 1}</span>
              <div className="queueCase">
                <strong>{result.event_id}</strong>
                <small>{result.diagnosis.cause.replaceAll("_", " ")} · {formatConfidence(result.diagnosis.confidence)} confidence</small>
                <p className="whyActionSubtext">{getWhyThisAction(result, policy)}</p>
              </div>
              <StatusBadge value={result.decision.action} />
              <ArrowUpRight size={16} />
            </Link>
          ))}
        </div>
      </div>

      <div className="policyKernel">
        <div className="deckKicker"><BrainCircuit size={14} /> POLICY KERNEL</div>
        <div className="kernelLine"><span>confidence floor</span><strong>{formatConfidence(policy.diagnosis_confidence_escalation_threshold)}</strong></div>
        <div className="kernelLine"><span>approval above</span><strong>{money.format(policy.human_approval_amount_threshold)}</strong></div>
        <div className="kernelLine"><span>retry limit</span><strong>{policy.max_retries_per_payment} / payment</strong></div>
        <div className="integrityList" aria-label="System integrity status">
          <span><Webhook size={13} /> {connected ? "webhook evidence linked" : "webhook connection unavailable"}</span>
          <span><ShieldCheck size={13} /> policy snapshot attached</span>
          <span><CircleCheckBig size={13} /> human review remains available</span>
        </div>
      </div>
    </section>
  );
}
