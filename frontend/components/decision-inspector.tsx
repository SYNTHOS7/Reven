"use client";

import { useState } from "react";
import Link from "next/link";
import {
  ArrowUpRight,
  BrainCircuit,
  CheckCircle2,
  FileCheck,
  Scale,
  Search,
  ShieldAlert,
  ShieldCheck,
} from "lucide-react";

import type { PipelineResult, PolicySettings } from "@/lib/types";
import { formatConfidence } from "@/lib/confidence";
import { getWhyThisAction } from "@/lib/utils";
import { StatusBadge } from "./status-badge";

const money = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 0,
});

interface DecisionInspectorProps {
  results: PipelineResult[];
  policy: PolicySettings;
}

export function DecisionInspector({ results, policy }: DecisionInspectorProps) {
  const cases = results.slice(0, 5);
  const [selectedIndex, setSelectedIndex] = useState(0);

  const activeIndex = Math.min(selectedIndex, Math.max(0, cases.length - 1));
  const selected = cases[activeIndex];
  const hasResults = cases.length > 0;

  const isHumanReviewRequired = selected && selected.decision.action === "escalate_human";

  return (
    <section className="inspectorSection" aria-label="Explainable recovery decision inspector">
      <div className="inspectorHeader">
        <div className="inspectorIntro">
          <div className="eyebrow">
            <span>EXPLAINABLE RECOVERY</span>
          </div>
          <h2>How Reven decided.</h2>
          <p>Choose a real case. Every stage exposes its evidence, limits, and outcome.</p>
        </div>
        {selected && (
          <Link href={`/case/${selected.event_id}`} className="inspectorCaseLink">
            <span>Open full case</span>
            <ArrowUpRight size={15} />
          </Link>
        )}
      </div>

      {hasResults ? (
        <>
          <div className="inspectorSelectorWrap" role="tablist" aria-label="Select real case to inspect">
            {cases.map((item, index) => {
              const isSelected = index === activeIndex;
              return (
                <button
                  key={item.event_id}
                  type="button"
                  role="tab"
                  id={`case-tab-${item.event_id}`}
                  aria-selected={isSelected}
                  aria-controls={`stage-details-${item.event_id}`}
                  onClick={() => setSelectedIndex(index)}
                  className={`inspectorSelectorBtn ${isSelected ? "selected" : ""}`}
                >
                  <div className="selectorMeta">
                    <span className="selectorId">{item.event_id}</span>
                    <span className="selectorAmount">{money.format(item.amount)}</span>
                  </div>
                  <StatusBadge value={item.decision.action} />
                </button>
              );
            })}
          </div>

          <div
            className="inspectorStageGrid"
            id={`stage-details-${selected.event_id}`}
            role="tabpanel"
            aria-labelledby={`case-tab-${selected.event_id}`}
          >
            {/* 01 Detection */}
            <div className="inspectorStageCol">
              <div className="inspectorStageTop">
                <span className="stageNumber">01</span>
                <Search size={14} className="stageIcon" />
              </div>
              <h3 className="stageHeading">Detection</h3>
              <div className="stageBody">
                <div className="fieldGroup">
                  <span className="fieldLabel">Event Type</span>
                  <strong className="fieldValueMono">{selected.event_type.replaceAll("_", " ")}</strong>
                </div>

                <div className="fieldGroup">
                  <span className="fieldLabel">Failure Code</span>
                  <strong className="fieldValueMono">{selected.failure_code}</strong>
                </div>

                <div className="fieldGroup">
                  <span className="fieldLabel">Amount</span>
                  <strong className="fieldValue">{money.format(selected.amount)}</strong>
                </div>

                <div className="fieldGroup">
                  <span className="fieldLabel">Detection Status</span>
                  <div>
                    <StatusBadge value={selected.detection.status} />
                  </div>
                </div>

                <div className="fieldGroup">
                  <span className="fieldLabel">Reason</span>
                  <p className="fieldDescription">{selected.detection.reason}</p>
                </div>
              </div>
            </div>

            {/* 02 Trust Gate */}
            <div className="inspectorStageCol">
              <div className="inspectorStageTop">
                <span className="stageNumber">02</span>
                <ShieldAlert size={14} className="stageIcon" />
              </div>
              <h3 className="stageHeading">Trust Gate</h3>
              <div className="stageBody">
                <div className="fieldGroup">
                  <span className="fieldLabel">Trust Gate Status</span>
                  <div>
                    <StatusBadge value={selected.trust_gate.status} />
                  </div>
                </div>

                <div className="fieldGroup">
                  <span className="fieldLabel">Reason</span>
                  <p className="fieldDescription">{selected.trust_gate.reason}</p>
                </div>

                <div className="policyBox">
                  <span className="policyBoxTitle">Policy Safeguards</span>
                  <dl className="policyLimitsList">
                    <div>
                      <dt>Max retries per payment</dt>
                      <dd>{policy.max_retries_per_payment}</dd>
                    </div>
                    <div>
                      <dt>Max msgs / customer / day</dt>
                      <dd>{policy.max_messages_per_customer_per_day}</dd>
                    </div>
                    <div>
                      <dt>Trust gate window</dt>
                      <dd>{policy.trust_gate_attempts_window_hours}h</dd>
                    </div>
                  </dl>
                </div>
              </div>
            </div>

            {/* 03 Diagnosis */}
            <div className="inspectorStageCol">
              <div className="inspectorStageTop">
                <span className="stageNumber">03</span>
                <BrainCircuit size={14} className="stageIcon" />
              </div>
              <h3 className="stageHeading">Diagnosis</h3>
              <div className="stageBody">
                <div className="fieldGroup">
                  <span className="fieldLabel">Cause</span>
                  <strong className="fieldValueMono">{selected.diagnosis.cause.replaceAll("_", " ")}</strong>
                </div>

                <div className="fieldGroup">
                  <span className="fieldLabel">Method</span>
                  <strong className="fieldValueMono">{selected.diagnosis.method}</strong>
                </div>

                <div className="fieldGroup">
                  <span className="fieldLabel">Confidence</span>
                  <strong className="fieldValueAccent">
                    {formatConfidence(selected.diagnosis.confidence)}
                  </strong>
                </div>

                <div className="fieldGroup">
                  <span className="fieldLabel">Reason</span>
                  <p className="fieldDescription">{selected.diagnosis.reason}</p>
                </div>

                {selected.diagnosis.evidence_used && selected.diagnosis.evidence_used.length > 0 && (
                  <div className="fieldGroup">
                    <span className="fieldLabel">Evidence Trace</span>
                    <div className="evidenceTraceList">
                      {selected.diagnosis.evidence_used.map((ev, i) => (
                        <span key={i} className="evidenceChip">{ev}</span>
                      ))}
                    </div>
                  </div>
                )}

                <div className="policyBox">
                  <span className="policyBoxTitle">Policy Limit</span>
                  <div className="policyLimitLine">
                    <dt>Escalation threshold</dt>
                    <dd>{formatConfidence(policy.diagnosis_confidence_escalation_threshold)}</dd>
                  </div>
                </div>
              </div>
            </div>

            {/* 04 Decision */}
            <div className="inspectorStageCol">
              <div className="inspectorStageTop">
                <span className="stageNumber">04</span>
                <Scale size={14} className="stageIcon" />
              </div>
              <h3 className="stageHeading">Decision</h3>
              <div className="stageBody">
                <div className="fieldGroup">
                  <span className="fieldLabel">Decision Action</span>
                  <div>
                    <StatusBadge value={selected.decision.action} />
                  </div>
                </div>

                <div className="fieldGroup">
                  <span className="fieldLabel">Reason</span>
                  <p className="fieldDescription">{selected.decision.reason}</p>
                </div>

                <div className="fieldGroup">
                  <span className="fieldLabel">Why This Action?</span>
                  <p className="fieldDescription whyActionText">{getWhyThisAction(selected, policy)}</p>
                </div>

                <div className="policyBox">
                  <span className="policyBoxTitle">Policy Rules</span>
                  <dl className="policyLimitsList">
                    <div>
                      <dt>Exceeds threshold ({money.format(policy.human_approval_amount_threshold)})</dt>
                      <dd>{selected.amount >= policy.human_approval_amount_threshold ? "Yes" : "No"}</dd>
                    </div>
                    <div>
                      <dt>Requires customer contact</dt>
                      <dd>{selected.decision.requires_customer_contact ? "Yes" : "No"}</dd>
                    </div>
                    <div className="highlightRule">
                      <dt>Human review required</dt>
                      <dd className={isHumanReviewRequired ? "textWarning" : "textMuted"}>
                        {isHumanReviewRequired ? "Yes" : "No"}
                      </dd>
                    </div>
                  </dl>
                </div>
              </div>
            </div>

            {/* 05 Recovery */}
            <div className="inspectorStageCol recoveryStageCol">
              <div className="inspectorStageTop">
                <span className="stageNumber">05</span>
                <CheckCircle2 size={14} className="stageIcon" />
              </div>
              <h3 className="stageHeading">Recovery</h3>
              <div className="stageBody">
                {selected.verified_recovered_amount > 0 ? (
                  <div className="recoveryCard verified">
                    <span className="utilityLabel textRecovery">VERIFIED RECOVERY</span>
                    <strong className="recoveryHeading">
                      ₹{selected.verified_recovered_amount.toLocaleString("en-IN")} verified recovered
                    </strong>
                    <p className="fieldDescription">A Razorpay paid webhook confirmed recovery.</p>
                  </div>
                ) : selected.razorpay_payment_link_id ? (
                  <div className="recoveryCard awaiting">
                    <span className="utilityLabel textWarning">PAYMENT LINK</span>
                    <strong className="recoveryHeading">Link ID: {selected.razorpay_payment_link_id}</strong>
                    <p className="fieldDescription">Awaiting paid webhook</p>
                  </div>
                ) : (
                  <div className="recoveryCard none">
                    <span className="utilityLabel textMuted">NO ACTION</span>
                    <strong className="recoveryHeading">No recovery action</strong>
                    <p className="fieldDescription">
                      Recovery is never claimed without signed Razorpay payment evidence.
                    </p>
                  </div>
                )}

                <div className="testModeTag">
                  <FileCheck size={13} />
                  <span>Razorpay Test Mode</span>
                </div>
              </div>
            </div>
          </div>
        </>
      ) : (
        <div className="inspectorEmptyState">
          Run an evaluation after receiving a Razorpay Test Mode webhook to inspect the full decision path.
        </div>
      )}

      <div className="inspectorProofBar">
        <ShieldCheck size={15} />
        <span>
          Financial action stays policy-bounded. Recovery is counted only after verified Razorpay payment evidence.
        </span>
      </div>
    </section>
  );
}
