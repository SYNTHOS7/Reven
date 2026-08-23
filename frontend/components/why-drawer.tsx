"use client";

import { X, ShieldCheck, Zap, TrendingUp, AlertTriangle, Info } from "lucide-react";
import type { Transaction } from "@/lib/types";
import { maskEmail, maskPhone } from "@/lib/utils";
import { deriveTransactionIntelligence } from "@/lib/recovery-logic";

const money = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 });

interface WhyDrawerProps {
  tx: Transaction;
  onClose: () => void;
}

export function WhyDrawer({ tx, onClose }: WhyDrawerProps) {
  const intel = deriveTransactionIntelligence(tx);
  const prob = tx.recovery_probability ?? intel.recovery_probability;

  const policyThresholds = [
    { label: "High-value escalation", threshold: "≥ ₹4,000", met: tx.amount >= 4000 },
    { label: "Multi-attempt cap", threshold: "≥ 3 retries", met: tx.retry_count >= 3 },
    { label: "Recovery probability", threshold: "≥ 78%", met: prob >= 78 },
    { label: "High-priority flag", threshold: "Amount ≥ 4k OR prob ≥ 78%", met: !!tx.is_high_priority },
  ];

  return (
    <div className="whyDrawerOverlay" onClick={onClose}>
      <aside className="whyDrawer" onClick={(e) => e.stopPropagation()}>
        <div className="whyDrawerHeader">
          <div>
            <span className="utilityLabel">WHY THIS RECOMMENDATION</span>
            <h3>{tx.transaction_id}</h3>
          </div>
          <button onClick={onClose} className="modalCloseBtn" aria-label="Close">
            <X size={18} />
          </button>
        </div>

        <div className="whyDrawerBody">
          {/* Customer summary — masked */}
          <div className="whySection">
            <span className="whySectionTitle"><Info size={14} /> Customer</span>
            <dl className="whyDl">
              <div><dt>Name</dt><dd>{tx.customer_name}</dd></div>
              <div><dt>Email</dt><dd>{maskEmail(tx.customer_email)}</dd></div>
              <div><dt>Phone</dt><dd>{maskPhone(tx.customer_phone)}</dd></div>
              <div><dt>Amount</dt><dd className="fontMedium">{money.format(tx.amount)}</dd></div>
            </dl>
          </div>

          {/* Diagnosis */}
          <div className="whySection">
            <span className="whySectionTitle"><Zap size={14} /> Diagnosis</span>
            <dl className="whyDl">
              <div><dt>Root Cause</dt><dd>{tx.likely_root_cause || intel.likely_root_cause}</dd></div>
              <div><dt>Payment Method</dt><dd>{tx.payment_method}</dd></div>
              <div><dt>Failure Reason</dt><dd>{tx.failure_reason.replaceAll("_", " ")}</dd></div>
              <div><dt>Retry Count</dt><dd>{tx.retry_count}</dd></div>
            </dl>
          </div>

          {/* Recovery signal */}
          <div className="whySection">
            <span className="whySectionTitle"><TrendingUp size={14} /> Recovery Signal</span>
            <div className="whyProbBar">
              <div
                className={`whyProbFill ${prob >= 75 ? "barHighProb" : prob >= 50 ? "barMedProb" : "barLowProb"}`}
                style={{ width: `${prob}%` }}
              />
              <span>{prob}% recovery probability</span>
            </div>
            <p className="whyExplain">
              This score is derived from the failure pattern ({tx.failure_reason.replaceAll("_", " ")}),
              the payment method ({tx.payment_method}), and the retry count ({tx.retry_count}).
              {prob >= 78
                ? " High probability — transient failures on this rail have strong historical recovery."
                : prob >= 50
                  ? " Moderate probability — customer may respond to an alternative payment method."
                  : " Lower probability — repeated failures or systemic declines reduce expected recovery."}
            </p>
          </div>

          {/* Recommended action */}
          <div className="whySection">
            <span className="whySectionTitle"><ShieldCheck size={14} /> Recommended Action</span>
            <div className="whyActionCard">
              <strong>{tx.recommended_action || intel.recommended_action}</strong>
            </div>
          </div>

          {/* Policy thresholds */}
          <div className="whySection">
            <span className="whySectionTitle"><AlertTriangle size={14} /> Policy Thresholds</span>
            <div className="whyThresholdGrid">
              {policyThresholds.map((pt) => (
                <div key={pt.label} className={`whyThresholdRow ${pt.met ? "thresholdMet" : "thresholdUnmet"}`}>
                  <span className="thresholdDot" />
                  <span className="thresholdLabel">{pt.label}</span>
                  <span className="thresholdValue">{pt.threshold}</span>
                  <span className="thresholdStatus">{pt.met ? "Met" : "Not met"}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </aside>
    </div>
  );
}
