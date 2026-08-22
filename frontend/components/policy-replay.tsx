"use client";

import { useState } from "react";
import { AlertTriangle, Play, RefreshCw, Scale } from "lucide-react";

import { runPolicyReplay } from "@/lib/api";
import type { PipelineResult, PolicyReplayResponse, PolicySettings } from "@/lib/types";
import { formatConfidence } from "@/lib/confidence";
import { getWhyThisAction } from "@/lib/utils";
import { Button } from "./ui/button";
import { StatusBadge } from "./status-badge";

interface PolicyReplayProps {
  eventId: string;
  initialPolicy: PolicySettings;
  pipelineResult: PipelineResult;
}

const money = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 0,
});

export function PolicyReplay({ eventId, initialPolicy, pipelineResult }: PolicyReplayProps) {
  const [replayPolicy, setReplayPolicy] = useState<PolicySettings>({ ...initialPolicy });
  const [running, setRunning] = useState(false);
  const [replayResult, setReplayResult] = useState<PolicyReplayResponse | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  async function handleReplay() {
    setRunning(true);
    setErrorMsg(null);
    try {
      const res = await runPolicyReplay(eventId, replayPolicy);
      setReplayResult(res);
    } catch {
      setErrorMsg("Policy replay failed. Verify backend API connection.");
    } finally {
      setRunning(false);
    }
  }

  function handleReset() {
    setReplayPolicy({ ...initialPolicy });
    setReplayResult(null);
    setErrorMsg(null);
  }

  return (
    <section className="policyReplaySection" aria-label="Policy dry run and replay tool">
      <div className="replayHeader">
        <div className="utilityLabel"><Scale size={14} /> POLICY REPLAY & DRY RUN</div>
        <h2>Test policy changes safely.</h2>
        <p>Replay this real Razorpay Test Mode case under candidate policy rules. Measure decisions without affecting real recovery links, customer messages, or revenue metrics.</p>
      </div>

      <div className="replayGrid">
        {/* Policy Controls Form */}
        <div className="replayControlsCard">
          <span className="utilityLabel">REPLAY POLICY PARAMETERS</span>
          <div className="controlsGrid">
            <label htmlFor="replay-confidence-slider" className="controlField">
              <span>Confidence Threshold ({formatConfidence(replayPolicy.diagnosis_confidence_escalation_threshold)})</span>
              <input
                id="replay-confidence-slider"
                type="range"
                min="0.1"
                max="0.9"
                step="0.05"
                value={replayPolicy.diagnosis_confidence_escalation_threshold}
                onChange={(e) =>
                  setReplayPolicy({
                    ...replayPolicy,
                    diagnosis_confidence_escalation_threshold: parseFloat(e.target.value),
                  })
                }
              />
              <small>Lower threshold allows more automated retries/links.</small>
            </label>

            <label htmlFor="replay-amount-slider" className="controlField">
              <span>Approval Amount Threshold ({money.format(replayPolicy.human_approval_amount_threshold)})</span>
              <input
                id="replay-amount-slider"
                type="range"
                min="1000"
                max="25000"
                step="1000"
                value={replayPolicy.human_approval_amount_threshold}
                onChange={(e) =>
                  setReplayPolicy({
                    ...replayPolicy,
                    human_approval_amount_threshold: parseInt(e.target.value, 10),
                  })
                }
              />
              <small>Amounts at or above this value trigger human review.</small>
            </label>

            <label htmlFor="replay-retries-input" className="controlField">
              <span>Max Retries Per Payment</span>
              <input
                id="replay-retries-input"
                type="number"
                min="0"
                max="10"
                value={replayPolicy.max_retries_per_payment}
                onChange={(e) =>
                  setReplayPolicy({
                    ...replayPolicy,
                    max_retries_per_payment: parseInt(e.target.value, 10) || 0,
                  })
                }
              />
            </label>

            <label htmlFor="replay-messages-input" className="controlField">
              <span>Max Customer Messages / Day</span>
              <input
                id="replay-messages-input"
                type="number"
                min="0"
                max="5"
                value={replayPolicy.max_messages_per_customer_per_day}
                onChange={(e) =>
                  setReplayPolicy({
                    ...replayPolicy,
                    max_messages_per_customer_per_day: parseInt(e.target.value, 10) || 0,
                  })
                }
              />
            </label>
          </div>

          <div className="replayActions">
            <Button onClick={handleReplay} disabled={running}>
              <Play size={14} className={running ? "spin" : ""} />
              {running ? "Calculating replay..." : "Execute policy dry run"}
            </Button>
            <button type="button" onClick={handleReset} className="resetBtn">
              <RefreshCw size={13} /> Reset
            </button>
          </div>
          {errorMsg && <div className="errorNotice" role="alert">{errorMsg}</div>}
        </div>

        {/* Side by Side Replay Comparison */}
        <div className="replayResultsCard">
          <div className="disclaimerBanner">
            <AlertTriangle size={15} />
            <span>Dry run — no customer action, message, payment link, or revenue metric was changed.</span>
          </div>

          <div className="beforeAfterGrid">
            {/* Original Decision */}
            <div className="pathCol originalPath">
              <span className="utilityLabel">ACTIVE PRODUCTION POLICY</span>
              <div className="pathMetric">
                <span className="fieldLabel">Confidence Floor</span>
                <strong>{formatConfidence(initialPolicy.diagnosis_confidence_escalation_threshold)}</strong>
              </div>
              <div className="pathMetric">
                <span className="fieldLabel">Human Review From</span>
                <strong>{money.format(initialPolicy.human_approval_amount_threshold)}</strong>
              </div>
              <div className="pathDecision">
                <span className="fieldLabel">Decision Outcome</span>
                <div><StatusBadge value={pipelineResult.decision.action} /></div>
              </div>
              <p className="pathReason">{getWhyThisAction(pipelineResult, initialPolicy)}</p>
            </div>

            {/* Proposed Replay Decision */}
            <div className="pathCol proposedPath">
              <span className="utilityLabel">PROPOSED REPLAY POLICY</span>
              <div className="pathMetric">
                <span className="fieldLabel">Confidence Floor</span>
                <strong>{formatConfidence(replayPolicy.diagnosis_confidence_escalation_threshold)}</strong>
              </div>
              <div className="pathMetric">
                <span className="fieldLabel">Human Review From</span>
                <strong>{money.format(replayPolicy.human_approval_amount_threshold)}</strong>
              </div>
              <div className="pathDecision">
                <span className="fieldLabel">Proposed Decision</span>
                <div>
                  <StatusBadge
                    value={replayResult ? replayResult.proposed_decision.action : pipelineResult.decision.action}
                  />
                </div>
              </div>
              <p className="pathReason">
                {replayResult
                  ? replayResult.proposed_decision.reason
                  : "Click 'Execute policy dry run' to simulate."}
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
