"use client";

import { CheckCircle2, ChevronRight, Shield, AlertTriangle, Send, Eye, Zap, Radio } from "lucide-react";

const CHAIN_STEPS = [
  { key: "webhook", icon: Radio, label: "Razorpay failure webhook", sublabel: "Signed event received" },
  { key: "detect", icon: Eye, label: "Reven detection", sublabel: "Event parsed & validated" },
  { key: "trust", icon: Shield, label: "Trust Gate", sublabel: "Rate-limit & fraud check" },
  { key: "diagnose", icon: Zap, label: "Diagnosis", sublabel: "Root-cause classification" },
  { key: "policy", icon: AlertTriangle, label: "Policy decision", sublabel: "Bounded action selection" },
  { key: "action", icon: Send, label: "Recovery action", sublabel: "Link / escalation / retry" },
  { key: "verify", icon: CheckCircle2, label: "Paid webhook verification", sublabel: "Signed Razorpay confirmation" },
] as const;

export function EvidenceChain() {
  return (
    <section className="evidenceChainSection" aria-label="Evidence chain pipeline">
      <div className="evidenceChainHeader">
        <span className="utilityLabel">EVIDENCE CHAIN</span>
        <h3>How every live recovery is verified</h3>
      </div>
      <div className="evidenceChainTrack">
        {CHAIN_STEPS.map((step, i) => {
          const Icon = step.icon;
          return (
            <div key={step.key} className="evidenceChainNode" style={{ "--node-i": i } as React.CSSProperties}>
              <div className="chainNodeIcon">
                <Icon size={16} />
              </div>
              <span className="chainNodeLabel">{step.label}</span>
              <small className="chainNodeSub">{step.sublabel}</small>
              {i < CHAIN_STEPS.length - 1 && (
                <ChevronRight size={14} className="chainArrow" aria-hidden />
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
