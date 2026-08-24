"use client";

import React from "react";
import { Eye, Shield, Zap, Scale, CheckCircle2, ChevronRight } from "lucide-react";
import { HelpTooltip } from "./help-tooltip";

export interface StageInfo {
  step: number;
  key: string;
  name: string;
  shortDesc: string;
  plainDesc: string;
  icon: React.ElementType;
}

export const FIVE_STAGES: StageInfo[] = [
  {
    step: 1,
    key: "detect",
    name: "1. Detect",
    shortDesc: "Payment failed and entered Reven",
    plainDesc: "Payment failure event received via webhook or batch ingestion and parsed into the ledger.",
    icon: Eye,
  },
  {
    step: 2,
    key: "trust",
    name: "2. Trust Gate",
    shortDesc: "Check whether recovery is safe",
    plainDesc: "Evaluates repeated attempts, card-testing patterns, and rate limits to block risky activity.",
    icon: Shield,
  },
  {
    step: 3,
    key: "diagnose",
    name: "3. Diagnose",
    shortDesc: "Understand the likely failure cause",
    plainDesc: "Categorizes the failure reason (e.g. soft decline, insufficient funds, OTP drop) with a confidence score.",
    icon: Zap,
  },
  {
    step: 4,
    key: "decide",
    name: "4. Decide",
    shortDesc: "Apply rules and choose an allowed action",
    plainDesc: "Strict policy rules select a safe recovery action or escalate to human review if uncertain or high-value.",
    icon: Scale,
  },
  {
    step: 5,
    key: "recover",
    name: "5. Recover & Verify",
    shortDesc: "Recover safely and verify payment through Razorpay",
    plainDesc: "Executes the chosen recovery action and counts recovered revenue only after signed Razorpay confirmation.",
    icon: CheckCircle2,
  },
];

interface FiveStageFlowProps {
  activeStage?: number | string; // 1 to 5, or 'detect' | 'trust' | 'diagnose' | 'decide' | 'recover'
  isStopped?: boolean;
  stopStage?: number;
  highlightOnly?: boolean;
  compact?: boolean;
  className?: string;
  title?: string;
  subtitle?: string;
}

export function FiveStageFlow({
  activeStage,
  isStopped = false,
  stopStage = 2,
  compact = false,
  className = "",
  title = "The 5-Stage Recovery Process",
  subtitle = "How Reven diagnoses payment drops, applies safety rules, and proves recovery.",
}: FiveStageFlowProps) {
  // Map string stage to step number if needed
  let activeStepNumber: number | undefined;
  if (typeof activeStage === "number") {
    activeStepNumber = activeStage;
  } else if (typeof activeStage === "string") {
    const stageMap: Record<string, number> = {
      detect: 1,
      received: 1,
      trust: 2,
      trust_gate: 2,
      diagnose: 3,
      diagnosis: 3,
      decide: 4,
      decision: 4,
      recover: 5,
      recovery: 5,
      verify: 5,
    };
    activeStepNumber = stageMap[activeStage.toLowerCase()] || undefined;
  }

  return (
    <section className={`fiveStageFlowCard ${compact ? "compactFlow" : ""} ${className}`} aria-label="Five-stage recovery flow">
      <div className="flowHeader">
        <div className="flex items-center gap-2">
          <span className="utilityLabel">SAFETY &amp; AUTOMATION ARCHITECTURE</span>
          <HelpTooltip topic="trust_gate" customText="Reven enforces strict stage separation: detection -> trust check -> diagnosis -> policy decision -> verified recovery." />
        </div>
        <h3>{title}</h3>
        {subtitle && <p className="flowSubtitle">{subtitle}</p>}
      </div>

      <div className="fiveStageTrack">
        {FIVE_STAGES.map((stage, idx) => {
          const Icon = stage.icon;
          const isCurrent = activeStepNumber === stage.step;
          const isPast = activeStepNumber ? stage.step < activeStepNumber : false;
          const isStoppedHere = isStopped && stopStage === stage.step;
          const isBlocked = isStopped && stage.step > stopStage;

          let statusClass = "stagePending";
          if (isStoppedHere) statusClass = "stageStopped";
          else if (isBlocked) statusClass = "stageBlocked";
          else if (isCurrent) statusClass = "stageCurrent";
          else if (isPast) statusClass = "stageCompleted";

          return (
            <React.Fragment key={stage.key}>
              <div className={`stageCard ${statusClass}`}>
                <div className="stageCardHeader">
                  <div className="stageIconWrap">
                    <Icon size={16} />
                  </div>
                  <span className="stageStepNumber">0{stage.step}</span>
                </div>
                <h4 className="stageName">{stage.name}</h4>
                <p className="stageShortDesc">{stage.shortDesc}</p>
                {!compact && <p className="stagePlainDesc">{stage.plainDesc}</p>}
                {isCurrent && (
                  <span className="stageActiveTag">
                    {isStoppedHere ? "Blocked by safety rule" : "Active stage"}
                  </span>
                )}
              </div>
              {idx < FIVE_STAGES.length - 1 && (
                <div className="stageArrow" aria-hidden="true">
                  <ChevronRight size={16} />
                </div>
              )}
            </React.Fragment>
          );
        })}
      </div>
    </section>
  );
}
