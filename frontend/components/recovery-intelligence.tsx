"use client";

import { useEffect, useState } from "react";
import {
  Activity,
  ChevronDown,
  ChevronUp,
  Clock,
  FileCheck,
  Percent,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
} from "lucide-react";

import { loadRecoveryIntelligence } from "@/lib/api";
import type { RecoveryIntelligenceResponse } from "@/lib/types";
import { StatusBadge } from "./status-badge";

const money = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 0,
});

export function RecoveryIntelligence() {
  const [data, setData] = useState<RecoveryIntelligenceResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    let active = true;
    loadRecoveryIntelligence()
      .then((res) => {
        if (active) setData(res);
      })
      .catch(() => {
        if (active) setData(null);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  if (loading) {
    return (
      <section className="recoveryIntelSection" aria-label="Recovery Intelligence Metrics">
        <div className="intelHeader">
          <div className="utilityLabel"><Sparkles size={14} /> RECOVERY INTELLIGENCE</div>
          <h2>What Reven is learning from real recovery evidence.</h2>
        </div>
        <div className="intelLoading">Loading recovery intelligence metrics...</div>
      </section>
    );
  }

  if (!data) {
    return (
      <section className="recoveryIntelSection" aria-label="Recovery Intelligence Metrics">
        <div className="intelHeader">
          <div className="utilityLabel"><Sparkles size={14} /> RECOVERY INTELLIGENCE</div>
          <h2>What Reven is learning from real recovery evidence.</h2>
        </div>
        <div className="intelEmpty">
          Backend API disconnected or no recovery intelligence metrics available yet.
        </div>
      </section>
    );
  }

  const { primary, by_cause, by_action, safety_and_learning } = data;

  const medianTimeFormatted =
    primary.median_time_to_recovery_minutes !== null
      ? primary.median_time_to_recovery_minutes < 1
        ? "< 1 min"
        : primary.median_time_to_recovery_minutes < 60
        ? `${primary.median_time_to_recovery_minutes} mins`
        : `${(primary.median_time_to_recovery_minutes / 60).toFixed(1)} hrs`
      : "Not enough data yet";

  return (
    <section className="recoveryIntelSection" aria-label="Recovery Intelligence Metrics">
      <div className="intelHeader">
        <div>
          <div className="eyebrow">
            <Sparkles size={14} />
            <span>RECOVERY INTELLIGENCE</span>
          </div>
          <h2>What Reven is learning from real recovery evidence.</h2>
        </div>
        <div className="testModeTag">
          <FileCheck size={13} />
          <span>RAZORPAY TEST MODE</span>
        </div>
      </div>

      {/* 5 Primary Metrics Grid */}
      <div className="intelPrimaryGrid">
        {/* 1. Verified Recovery Amount */}
        <div className="intelCard accentIntelCard">
          <div className="intelCardTop">
            <span className="intelCardLabel">VERIFIED RECOVERY AMOUNT</span>
            <Activity size={15} className="textRecovery" />
          </div>
          <strong className="intelCardValue textRecovery">
            {money.format(primary.verified_recovery_amount)}
          </strong>
          <small className="intelCardSubtext">Confirmed by Razorpay paid webhooks</small>
        </div>

        {/* 2. Payment-link Conversion Rate */}
        <div className="intelCard">
          <div className="intelCardTop">
            <span className="intelCardLabel">PAYMENT-LINK CONVERSION RATE</span>
            <Percent size={15} className="textMuted" />
          </div>
          <strong className="intelCardValue">
            {primary.payment_link_conversion_rate_pct !== null
              ? `${primary.payment_link_conversion_rate_pct}%`
              : "—"}
          </strong>
          <small className="intelCardSubtext">Paid links confirmed by Razorpay webhook</small>
        </div>

        {/* 3. Median Time to Recovery */}
        <div className="intelCard">
          <div className="intelCardTop">
            <span className="intelCardLabel">MEDIAN TIME TO RECOVERY</span>
            <Clock size={15} className="textMuted" />
          </div>
          <strong className="intelCardValue">{medianTimeFormatted}</strong>
          <small className="intelCardSubtext">From failure to paid webhook verification</small>
        </div>

        {/* 4. Human-Review Rate */}
        <div className="intelCard">
          <div className="intelCardTop">
            <span className="intelCardLabel">HUMAN-REVIEW RATE</span>
            <ShieldAlert size={15} className="textWarning" />
          </div>
          <strong className="intelCardValue textWarning">
            {primary.human_review_rate_pct !== null ? `${primary.human_review_rate_pct}%` : "—"}
          </strong>
          <small className="intelCardSubtext">Cases where automation stopped for review</small>
        </div>

        {/* 5. Policy-Block Count */}
        <div className="intelCard">
          <div className="intelCardTop">
            <span className="intelCardLabel">POLICY-BLOCK PREVENTION</span>
            <ShieldCheck size={15} className="textRisk" />
          </div>
          <strong className="intelCardValue textRisk">{primary.policy_block_count}</strong>
          <small className="intelCardSubtext">Retries or risky actions safely prevented</small>
        </div>
      </div>

      {/* Secondary Expandable Breakdown Toggle */}
      <div className="breakdownToggleWrap">
        <button
          type="button"
          onClick={() => setExpanded(!expanded)}
          className="breakdownToggleBtn"
          aria-expanded={expanded}
        >
          <span>Break down by cause and action</span>
          {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        </button>
      </div>

      {/* Expandable Breakdown Content */}
      {expanded && (
        <div className="intelBreakdownPanel">
          <div className="breakdownGrid">
            {/* A. Recovery by Failure Cause */}
            <div className="breakdownCol">
              <div className="breakdownHeading">
                <span className="utilityLabel">A. RECOVERY BY FAILURE CAUSE</span>
                <h3>Failure Causes ({by_cause.length})</h3>
              </div>
              <div className="breakdownTableWrap">
                <table>
                  <thead>
                    <tr>
                      <th>Cause</th>
                      <th>Cases</th>
                      <th>Recovered</th>
                      <th>Rate</th>
                    </tr>
                  </thead>
                  <tbody>
                    {by_cause.length === 0 ? (
                      <tr>
                        <td colSpan={4} className="emptyTable">
                          No diagnosed failure causes evaluated yet.
                        </td>
                      </tr>
                    ) : (
                      by_cause.map((item) => (
                        <tr key={item.cause}>
                          <td className="fontMono">{item.cause.replaceAll("_", " ")}</td>
                          <td>{item.total_cases}</td>
                          <td className="number">{money.format(item.verified_recovered_amount)}</td>
                          <td className="number">
                            {item.recovery_rate_pct !== null ? `${item.recovery_rate_pct}%` : "—"}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* B. Recovery by Action */}
            <div className="breakdownCol">
              <div className="breakdownHeading">
                <span className="utilityLabel">B. RECOVERY BY ACTION</span>
                <h3>Policy Actions ({by_action.length})</h3>
              </div>
              <div className="breakdownTableWrap">
                <table>
                  <thead>
                    <tr>
                      <th>Action</th>
                      <th>Cases</th>
                      <th>Verified Paid</th>
                      <th>Recovered</th>
                    </tr>
                  </thead>
                  <tbody>
                    {by_action.map((item) => (
                      <tr key={item.action}>
                        <td>
                          <StatusBadge value={item.action} />
                        </td>
                        <td>{item.cases}</td>
                        <td>{item.verified_recoveries}</td>
                        <td className="number">{money.format(item.verified_recovered_amount)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* C. Safety and Learning */}
            <div className="breakdownCol safetyCol">
              <div className="breakdownHeading">
                <span className="utilityLabel">C. SAFETY & LEARNING</span>
                <h3>Control Metrics</h3>
              </div>

              <div className="safetyCardsGrid">
                {/* Confidence Distribution */}
                <div className="safetyCard">
                  <span className="fieldLabel">Diagnosis Confidence Distribution</span>
                  <div className="safetyStatRow">
                    <div>
                      <span>High Confidence (≥ floor)</span>
                      <strong>{safety_and_learning.confidence_distribution.high_confidence_count}</strong>
                    </div>
                    <div>
                      <span>Low Confidence (&lt; floor)</span>
                      <strong>{safety_and_learning.confidence_distribution.low_confidence_count}</strong>
                    </div>
                  </div>
                </div>

                {/* Human Override Rate */}
                <div className="safetyCard">
                  <span className="fieldLabel">Human Override Rate</span>
                  <strong className="safetyMainStat">
                    {safety_and_learning.human_override.override_rate_pct !== null
                      ? `${safety_and_learning.human_override.override_rate_pct}%`
                      : "No reviewed cases yet"}
                  </strong>
                  <small className="fieldDescription">
                    {safety_and_learning.human_override.total_reviewed_cases > 0
                      ? `${safety_and_learning.human_override.override_count} of ${safety_and_learning.human_override.total_reviewed_cases} operator reviews modified outcome`
                      : "Operator feedback is tracked side-by-side to benchmark AI precision"}
                  </small>
                </div>

                {/* Webhook Integrity */}
                <div className="safetyCard">
                  <span className="fieldLabel">Webhook Evidence Integrity</span>
                  <div className="safetyStatRow">
                    <div>
                      <span>Processed</span>
                      <strong>{safety_and_learning.webhook_integrity.valid_webhooks_processed}</strong>
                    </div>
                    <div>
                      <span>Duplicate Ignored</span>
                      <strong>{safety_and_learning.webhook_integrity.duplicate_webhooks_ignored}</strong>
                    </div>
                    <div>
                      <span>Invalid Rejected</span>
                      <strong>{safety_and_learning.webhook_integrity.invalid_webhooks_rejected}</strong>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
