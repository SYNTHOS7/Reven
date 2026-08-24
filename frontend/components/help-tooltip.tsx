"use client";

import React, { useState, useRef, useEffect } from "react";
import { HelpCircle, Info, Shield, CheckCircle2, AlertTriangle, Sparkles, UserCheck, Zap, Radio } from "lucide-react";

export type HelpTopic =
  | "revenue_at_risk"
  | "recoverable_opportunity"
  | "trust_gate"
  | "diagnosis_confidence"
  | "human_review"
  | "verified_recovery"
  | "demo_scenario"
  | "live_test_mode"
  | "policy_engine"
  | "smart_retry"
  | "alternative_method";

export interface HelpDefinition {
  title: string;
  icon: React.ElementType;
  description: string;
  detail?: string;
}

export const HELP_DEFINITIONS: Record<HelpTopic, HelpDefinition> = {
  revenue_at_risk: {
    title: "Revenue at Risk",
    icon: AlertTriangle,
    description: "Money from failed or abandoned checkout attempts that has not been successfully collected yet.",
    detail: "Calculated across all payment drops including bank declines, insufficient funds, and OTP timeouts.",
  },
  recoverable_opportunity: {
    title: "Recoverable Opportunity",
    icon: Zap,
    description: "The estimated value of payments that may be safely recovered through policy-compliant actions.",
    detail: "Filtered for high and medium confidence failure patterns like soft card declines and transient UPI drops.",
  },
  trust_gate: {
    title: "Trust Gate",
    icon: Shield,
    description: "A safety check that stops risky, repeated, or excessive recovery attempts before any outreach occurs.",
    detail: "Protects customer trust and gateway reputation by refusing card-testing bursts and rapid-fire retries.",
  },
  diagnosis_confidence: {
    title: "Diagnosis Confidence",
    icon: Info,
    description: "How certain Reven is about the likely reason for payment failure based on processor error codes.",
    detail: "When confidence falls below your configured threshold (e.g. 60%), Reven mandates human review.",
  },
  human_review: {
    title: "Human Review",
    icon: UserCheck,
    description: "A person needs to approve the next step because the amount is high, evidence is unclear, or risk is present.",
    detail: "Safeguards large transactions (e.g. ≥ ₹5,000) so automated agents never act blindly.",
  },
  verified_recovery: {
    title: "Verified Recovery",
    icon: CheckCircle2,
    description: "Revenue counted only after Razorpay confirms that the recovery payment was completed.",
    detail: "Reven never counts generated links as recovered until a signed paid webhook or direct API receipt confirms the funds.",
  },
  demo_scenario: {
    title: "Demo Scenario",
    icon: Sparkles,
    description: "A fictional 500-transaction merchant dataset used to demonstrate business-scale recovery intelligence.",
    detail: "Completely safe sandbox. No actual customers are contacted and no real payment charges occur.",
  },
  live_test_mode: {
    title: "Live Test Mode",
    icon: Radio,
    description: "Real Razorpay Test Mode webhook evidence ledger. Proves live gateway integration without moving real money.",
    detail: "Every failure event is verified using Razorpay cryptographic webhook signatures.",
  },
  policy_engine: {
    title: "Safety Rules & Policy",
    icon: Shield,
    description: "Strict deterministic rules that govern when Reven can automate and when a human must intervene.",
    detail: "Hard limits for max retries, contact limits, amount caps, and confidence floors are strictly code-enforced.",
  },
  smart_retry: {
    title: "Smart Retry",
    icon: Zap,
    description: "A timed reattempt scheduled for transient failures like temporary bank downtime or insufficient balance.",
    detail: "Scheduled for optimal recovery windows (e.g. T+2 hours) within maximum retry limits.",
  },
  alternative_method: {
    title: "Alternative Payment Recommendation",
    icon: Sparkles,
    description: "Recommending an alternative payment option (e.g. 1-click UPI Intent) when a card payment repeatedly fails.",
    detail: "Recovers up to 78% of card decline drop-offs by providing an immediate, friction-free alternative payment link.",
  },
};

export function HelpTooltip({
  topic,
  customText,
  className = "",
}: {
  topic: HelpTopic;
  customText?: string;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const info = HELP_DEFINITIONS[topic];
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

  if (!info) return null;
  const Icon = info.icon;

  return (
    <div className={`helpTooltipWrapper ${className}`} ref={ref}>
      <button
        type="button"
        className="helpTooltipTrigger"
        onClick={(e) => {
          e.stopPropagation();
          setOpen(!open);
        }}
        aria-label={`Explain ${info.title}`}
        title={`What is ${info.title}?`}
      >
        <HelpCircle size={13} className="helpTooltipIcon" />
      </button>

      {open && (
        <div className="helpTooltipPopover" onClick={(e) => e.stopPropagation()} role="tooltip">
          <div className="helpTooltipHeader">
            <Icon size={14} className="helpHeaderIcon" />
            <strong className="helpTooltipTitle">{info.title}</strong>
          </div>
          <p className="helpTooltipDesc">{customText || info.description}</p>
          {info.detail && <p className="helpTooltipDetail">{info.detail}</p>}
        </div>
      )}
    </div>
  );
}

export function FeatureExplanationBanner({
  topic,
  titleOverride,
  descOverride,
}: {
  topic: HelpTopic;
  titleOverride?: string;
  descOverride?: string;
}) {
  const info = HELP_DEFINITIONS[topic];
  if (!info) return null;
  const Icon = info.icon;

  return (
    <div className="featureExplanationCard">
      <div className="featureExplanationIcon">
        <Icon size={18} />
      </div>
      <div className="featureExplanationContent">
        <strong>{titleOverride || info.title}</strong>
        <p>{descOverride || info.description}</p>
      </div>
    </div>
  );
}
