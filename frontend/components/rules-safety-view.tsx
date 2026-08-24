"use client";

import React, { useState } from "react";
import {
  ShieldCheck,
  Percent,
  Sliders,
  Play,
  RotateCcw,
  Info,
  CheckCircle2,
  AlertTriangle,
  Lock,
  Edit3,
  X,
  Scale,
} from "lucide-react";
import { savePolicy, runPolicyReplay } from "@/lib/api";
import type { PolicySettings, PolicyReplayResponse, PipelineResult } from "@/lib/types";
import { formatConfidence } from "@/lib/confidence";
import { HelpTooltip } from "./help-tooltip";
import { StatusBadge } from "./status-badge";

const money = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 0,
});

interface RulesSafetyViewProps {
  initialPolicy: PolicySettings;
  sampleEventId?: string;
  sampleResult?: PipelineResult;
}

export function RulesSafetyView({
  initialPolicy,
  sampleEventId = "evt_rzp_fail_card_limit_001",
  sampleResult,
}: RulesSafetyViewProps) {
  const [policy, setPolicy] = useState<PolicySettings>(initialPolicy);
  const [saving, setSaving] = useState(false);
  const [saveNotice, setSaveNotice] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Advanced Drawer state
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [editingPolicy, setEditingPolicy] = useState<PolicySettings>({ ...initialPolicy });

  // Test a Rule Safely (Dry Run) State
  const [testPolicy, setTestPolicy] = useState<PolicySettings>({ ...initialPolicy });
  const [testing, setTesting] = useState(false);
  const [replayResult, setReplayResult] = useState<PolicyReplayResponse | null>(null);

  async function handleSaveActivePolicy(policyToSave: PolicySettings) {
    setSaving(true);
    setSaveNotice(null);
    try {
      const saved = await savePolicy(policyToSave);
      setPolicy(saved);
      setEditingPolicy(saved);
      setIsDrawerOpen(false);
      setSaveNotice({
        type: "success",
        text: "Safety rules saved successfully. All future pipeline evaluations will use these bounds.",
      });
    } catch {
      setSaveNotice({
        type: "error",
        text: "Could not save safety rules. Verify backend connection and try again.",
      });
    } finally {
      setSaving(false);
    }
  }

  async function handleRunDryRun() {
    setTesting(true);
    try {
      const res = await runPolicyReplay(sampleEventId, testPolicy);
      setReplayResult(res);
    } catch {
      // If backend replay endpoint is unavailable or sample event doesn't exist, calculate local simulated dry run
      setReplayResult(generateSimulatedDryRun(sampleEventId, testPolicy, sampleResult));
    } finally {
      setTesting(false);
    }
  }

  function handleResetTestPolicy() {
    setTestPolicy({ ...policy });
    setReplayResult(null);
  }

  return (
    <main className="rulesSafetyPage">
      {/* Top Header */}
      <section className="pageIntro">
        <div className="eyebrow">
          <span>05</span> BOUNDED SAFETY ENGINE
        </div>
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1>How Reven stays safe</h1>
            <p>
              These rules decide when Reven can suggest recovery and when a human must review it.
            </p>
          </div>
          <button
            type="button"
            onClick={() => {
              setEditingPolicy({ ...policy });
              setIsDrawerOpen(true);
            }}
            className="button buttonPrimary buttonSmall"
          >
            <Sliders size={14} />
            <span>Advanced Settings</span>
          </button>
        </div>
      </section>

      {/* Global Notification Banner */}
      {saveNotice && (
        <div className={`notificationBanner notification-${saveNotice.type}`} role="status">
          <div className="notificationContent">
            <span>{saveNotice.text}</span>
            <button
              onClick={() => setSaveNotice(null)}
              className="closeNotifBtn"
              aria-label="Dismiss notice"
            >
              <X size={14} />
            </button>
          </div>
        </div>
      )}

      <section className="policyBoundaryGuide" aria-labelledby="policy-boundary-guide-title">
        <div className="policyBoundaryGuideIntro">
          <span className="utilityLabel">DECISION BOUNDARIES</span>
          <h2 id="policy-boundary-guide-title">What each rule protects — and the exact boundary</h2>
          <p>
            These rules are deterministic and tested at their edge values. AI can provide a diagnosis, but it cannot override a boundary or execute a money action.
          </p>
        </div>
        <div className="policyBoundaryTable" role="table" aria-label="Policy decision boundaries">
          <div className="policyBoundaryRow policyBoundaryHead" role="row">
            <span role="columnheader">Rule</span><span role="columnheader">Boundary</span><span role="columnheader">When it triggers</span>
          </div>
          <div className="policyBoundaryRow" role="row">
            <strong role="cell">Confidence floor</strong><span role="cell">Below {formatConfidence(policy.diagnosis_confidence_escalation_threshold)}</span><span role="cell">Escalate to human review</span>
          </div>
          <div className="policyBoundaryRow" role="row">
            <strong role="cell">High-value approval</strong><span role="cell">At or above {money.format(policy.human_approval_amount_threshold)}</span><span role="cell">Escalate before any recovery link</span>
          </div>
          <div className="policyBoundaryRow" role="row">
            <strong role="cell">Retry cap</strong><span role="cell">At {policy.max_retries_per_payment} recorded retries</span><span role="cell">Stop further recovery attempts</span>
          </div>
          <div className="policyBoundaryRow" role="row">
            <strong role="cell">Contact cap</strong><span role="cell">At {policy.max_messages_per_customer_per_day} contact/day</span><span role="cell">Stop customer outreach</span>
          </div>
          <div className="policyBoundaryRow" role="row">
            <strong role="cell">Trust Gate</strong><span role="cell">More than {policy.trust_gate_max_attempts_in_window} attempts / {policy.trust_gate_attempts_window_hours}h</span><span role="cell">Refuse suspicious activity upstream</span>
          </div>
        </div>
      </section>

      {/* Five Clear Rule Cards */}
      <section className="ruleCardsSection" aria-label="Safety Rules">
        <div className="ruleCardsGrid">
          {/* 1. Confidence Rule */}
          <div className="ruleCard">
            <div className="ruleCardTop">
              <div className="ruleIconWrap iconEmerald">
                <Percent size={18} />
              </div>
              <span className="ruleNumber">RULE 01</span>
            </div>
            <h3 className="ruleTitle">Confidence rule</h3>
            <div className="ruleSettingPill">
              <span className="ruleSettingLabel">Current setting:</span>
              <strong>Require review below {formatConfidence(policy.diagnosis_confidence_escalation_threshold)} confidence</strong>
            </div>
            <p className="ruleMeaning">
              <strong>Meaning:</strong> If Reven is not sufficiently sure about the failure cause, it asks a human instead of acting automatically.
            </p>
            <div className="ruleImpactBox">
              <div className="impactTitle">
                <Info size={13} />
                <span>What happens if I change this?</span>
              </div>
              <p>
                Lowering this threshold allows more automated retries and links. Raising it sends more ambiguous cases to your team.
              </p>
            </div>
            <div className="ruleCardFooter">
              <button
                type="button"
                onClick={() => {
                  setEditingPolicy({ ...policy });
                  setIsDrawerOpen(true);
                }}
                className="button buttonSecondary buttonSmall w-full"
              >
                <Edit3 size={13} /> Edit setting
              </button>
            </div>
          </div>

          {/* 2. High-Value Rule */}
          <div className="ruleCard">
            <div className="ruleCardTop">
              <div className="ruleIconWrap iconAmber">
                <ShieldCheck size={18} />
              </div>
              <span className="ruleNumber">RULE 02</span>
            </div>
            <h3 className="ruleTitle">High-value rule</h3>
            <div className="ruleSettingPill">
              <span className="ruleSettingLabel">Current setting:</span>
              <strong>Require approval above {money.format(policy.human_approval_amount_threshold)}</strong>
            </div>
            <p className="ruleMeaning">
              <strong>Meaning:</strong> Higher-value recoveries need a person to approve them before any payment link or reminder is issued.
            </p>
            <div className="ruleImpactBox">
              <div className="impactTitle">
                <Info size={13} />
                <span>What happens if I change this?</span>
              </div>
              <p>
                Lowering this amount protects smaller transactions. Raising it reduces manual approval queues for larger sales.
              </p>
            </div>
            <div className="ruleCardFooter">
              <button
                type="button"
                onClick={() => {
                  setEditingPolicy({ ...policy });
                  setIsDrawerOpen(true);
                }}
                className="button buttonSecondary buttonSmall w-full"
              >
                <Edit3 size={13} /> Edit setting
              </button>
            </div>
          </div>

          {/* 3. Retry Limit */}
          <div className="ruleCard">
            <div className="ruleCardTop">
              <div className="ruleIconWrap iconBlue">
                <RotateCcw size={18} />
              </div>
              <span className="ruleNumber">RULE 03</span>
            </div>
            <h3 className="ruleTitle">Retry limit</h3>
            <div className="ruleSettingPill">
              <span className="ruleSettingLabel">Current setting:</span>
              <strong>Maximum {policy.max_retries_per_payment} retries</strong>
            </div>
            <p className="ruleMeaning">
              <strong>Meaning:</strong> Reven stops repeated payment attempts to avoid bothering customers or triggering bank fraud blocks.
            </p>
            <div className="ruleImpactBox">
              <div className="impactTitle">
                <Info size={13} />
                <span>What happens if I change this?</span>
              </div>
              <p>
                Lowering stops retries sooner. Raising gives more chances to recover transient failures, but risks customer frustration.
              </p>
            </div>
            <div className="ruleCardFooter">
              <button
                type="button"
                onClick={() => {
                  setEditingPolicy({ ...policy });
                  setIsDrawerOpen(true);
                }}
                className="button buttonSecondary buttonSmall w-full"
              >
                <Edit3 size={13} /> Edit setting
              </button>
            </div>
          </div>

          {/* 4. Contact Limit */}
          <div className="ruleCard">
            <div className="ruleCardTop">
              <div className="ruleIconWrap iconViolet">
                <Lock size={18} />
              </div>
              <span className="ruleNumber">RULE 04</span>
            </div>
            <h3 className="ruleTitle">Contact limit</h3>
            <div className="ruleSettingPill">
              <span className="ruleSettingLabel">Current setting:</span>
              <strong>Maximum {policy.max_messages_per_customer_per_day} contact per customer per day</strong>
            </div>
            <p className="ruleMeaning">
              <strong>Meaning:</strong> Reven prevents reminder spam by enforcing a strict daily outreach cap across all communication channels.
            </p>
            <div className="ruleImpactBox">
              <div className="impactTitle">
                <Info size={13} />
                <span>What happens if I change this?</span>
              </div>
              <p>
                Strict limits protect customer brand goodwill. Higher limits allow multiple multi-channel touches in a single day.
              </p>
            </div>
            <div className="ruleCardFooter">
              <button
                type="button"
                onClick={() => {
                  setEditingPolicy({ ...policy });
                  setIsDrawerOpen(true);
                }}
                className="button buttonSecondary buttonSmall w-full"
              >
                <Edit3 size={13} /> Edit setting
              </button>
            </div>
          </div>

          {/* 5. Trust Gate */}
          <div className="ruleCard">
            <div className="ruleCardTop">
              <div className="ruleIconWrap iconRed">
                <AlertTriangle size={18} />
              </div>
              <span className="ruleNumber">RULE 05</span>
            </div>
            <h3 className="ruleTitle">Trust Gate</h3>
            <div className="ruleSettingPill">
              <span className="ruleSettingLabel">Current setting:</span>
              <strong>Stop suspicious activity ({policy.trust_gate_max_attempts_in_window} attempts in {policy.trust_gate_attempts_window_hours}h)</strong>
            </div>
            <p className="ruleMeaning">
              <strong>Meaning:</strong> Reven blocks recovery actions whenever payment behaviour looks risky, rapid-fire, or resembles card testing.
            </p>
            <div className="ruleImpactBox">
              <div className="impactTitle">
                <Info size={13} />
                <span>What happens if I change this?</span>
              </div>
              <p>
                Tighter windows catch velocity attacks immediately. Looser windows allow legitimate buyers with multiple attempts.
              </p>
            </div>
            <div className="ruleCardFooter">
              <button
                type="button"
                onClick={() => {
                  setEditingPolicy({ ...policy });
                  setIsDrawerOpen(true);
                }}
                className="button buttonSecondary buttonSmall w-full"
              >
                <Edit3 size={13} /> Edit setting
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* Test a Rule Safely (Dry Run Simulation) */}
      <section className="dryRunSimulatorSection" aria-label="Test a rule safely">
        <div className="simulatorHeader">
          <div>
            <div className="flex items-center gap-2">
              <span className="utilityLabel">SAFETY SIMULATION</span>
              <HelpTooltip
                topic="policy_engine"
                customText="Test how altering rules changes recovery decisions on a real transaction case without dispatching any real actions."
              />
            </div>
            <h2>Test a rule safely</h2>
            <p className="simulatorDesc">
              This is a simulation. It shows how a different rule would change the recommendation. It never sends a message, creates a payment link, or changes real data.
            </p>
          </div>
          <span className="badgeLive">
            <span className="liveDot" /> SAFE SIMULATION MODE
          </span>
        </div>

        <div className="simulatorGrid">
          {/* Controls */}
          <div className="simulatorControlsCard">
            <span className="utilityLabel">TEST CANDIDATE SETTINGS</span>
            <div className="simulatorForm">
              <label className="simField">
                <div className="flex justify-between">
                  <span>Confidence Floor:</span>
                  <strong>{formatConfidence(testPolicy.diagnosis_confidence_escalation_threshold)}</strong>
                </div>
                <input
                  type="range"
                  min="0.2"
                  max="0.95"
                  step="0.05"
                  value={testPolicy.diagnosis_confidence_escalation_threshold}
                  onChange={(e) =>
                    setTestPolicy({
                      ...testPolicy,
                      diagnosis_confidence_escalation_threshold: parseFloat(e.target.value),
                    })
                  }
                />
                <small>Cases with lower confidence require human review.</small>
              </label>

              <label className="simField">
                <div className="flex justify-between">
                  <span>Human Approval Threshold:</span>
                  <strong>{money.format(testPolicy.human_approval_amount_threshold)}</strong>
                </div>
                <input
                  type="range"
                  min="1000"
                  max="20000"
                  step="1000"
                  value={testPolicy.human_approval_amount_threshold}
                  onChange={(e) =>
                    setTestPolicy({
                      ...testPolicy,
                      human_approval_amount_threshold: parseInt(e.target.value, 10),
                    })
                  }
                />
                <small>Cases at or above this amount require human approval.</small>
              </label>

              <label className="simField">
                <div className="flex justify-between">
                  <span>Maximum Retries Allowed:</span>
                  <strong>{testPolicy.max_retries_per_payment}</strong>
                </div>
                <input
                  type="number"
                  min="1"
                  max="10"
                  value={testPolicy.max_retries_per_payment}
                  onChange={(e) =>
                    setTestPolicy({
                      ...testPolicy,
                      max_retries_per_payment: parseInt(e.target.value, 10) || 1,
                    })
                  }
                  className="filterSelect"
                />
              </label>

              <div className="simulatorActionButtons">
                <button
                  type="button"
                  onClick={handleRunDryRun}
                  disabled={testing}
                  className="button buttonPrimary buttonSmall"
                >
                  <Play size={14} className={testing ? "spin" : ""} />
                  <span>{testing ? "Simulating..." : "Test rule candidate"}</span>
                </button>
                <button
                  type="button"
                  onClick={handleResetTestPolicy}
                  className="button buttonSecondary buttonSmall"
                >
                  <RotateCcw size={13} /> Reset
                </button>
              </div>
            </div>
          </div>

          {/* Comparison Output */}
          <div className="simulatorResultsCard">
            <span className="utilityLabel">DECISION COMPARISON</span>
            <div className="comparisonGrid">
              {/* Active Policy Outcome */}
              <div className="comparisonCol activePolicyCol">
                <div className="colHeader">
                  <span className="colTitle">ACTIVE PRODUCTION RULE</span>
                  <CheckCircle2 size={15} className="text-primary" />
                </div>
                <div className="policyParamSummary">
                  <div>Floor: <strong>{formatConfidence(policy.diagnosis_confidence_escalation_threshold)}</strong></div>
                  <div>Approval: <strong>{money.format(policy.human_approval_amount_threshold)}</strong></div>
                </div>
                <div className="outcomeResultBox">
                  <span className="outcomeLabel">Resulting Action:</span>
                  <StatusBadge value={sampleResult?.decision.action || "create_payment_link"} />
                  <p className="outcomeRationale">
                    {sampleResult?.decision.reason || "Recommend 1-Click UPI Payment link because confidence is 92% and amount is ₹4,999."}
                  </p>
                </div>
              </div>

              {/* Proposed Test Policy Outcome */}
              <div className="comparisonCol proposedPolicyCol">
                <div className="colHeader">
                  <span className="colTitle">PROPOSED CANDIDATE RULE</span>
                  <Scale size={15} className="text-status-amber" />
                </div>
                <div className="policyParamSummary">
                  <div>Floor: <strong>{formatConfidence(testPolicy.diagnosis_confidence_escalation_threshold)}</strong></div>
                  <div>Approval: <strong>{money.format(testPolicy.human_approval_amount_threshold)}</strong></div>
                </div>
                <div className="outcomeResultBox">
                  <span className="outcomeLabel">Proposed Resulting Action:</span>
                  <StatusBadge
                    value={
                      replayResult
                        ? replayResult.proposed_decision.action
                        : sampleResult?.decision.action || "create_payment_link"
                    }
                  />
                  <p className="outcomeRationale">
                    {replayResult
                      ? replayResult.proposed_decision.reason
                      : "Click 'Test rule candidate' to see how the decision changes under these candidate settings."}
                  </p>
                </div>
              </div>
            </div>

            <div className="dryRunDisclaimer">
              <ShieldCheck size={14} className="text-primary" />
              <span>Simulated dry run only. No real data or active settings are altered.</span>
            </div>
          </div>
        </div>
      </section>

      {/* Advanced Settings Drawer */}
      {isDrawerOpen && (
        <div className="modalOverlay" onClick={() => setIsDrawerOpen(false)}>
          <div className="advancedSettingsDrawer" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
            <div className="drawerHeader">
              <div>
                <span className="utilityLabel">CONFIGURATION</span>
                <h3>Advanced Safety Settings</h3>
              </div>
              <button
                type="button"
                onClick={() => setIsDrawerOpen(false)}
                className="modalCloseBtn"
                aria-label="Close settings drawer"
              >
                <X size={18} />
              </button>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleSaveActivePolicy(editingPolicy);
              }}
              className="drawerBody"
            >
              <div className="drawerFieldsGrid">
                <label className="drawerField">
                  <span>Confidence escalation threshold ({formatConfidence(editingPolicy.diagnosis_confidence_escalation_threshold)})</span>
                  <input
                    type="number"
                    min="0"
                    max="1"
                    step="0.05"
                    value={editingPolicy.diagnosis_confidence_escalation_threshold}
                    onChange={(e) =>
                      setEditingPolicy({
                        ...editingPolicy,
                        diagnosis_confidence_escalation_threshold: parseFloat(e.target.value) || 0.6,
                      })
                    }
                  />
                  <small>Diagnoses with confidence below this value trigger human review.</small>
                </label>

                <label className="drawerField">
                  <span>Human approval amount threshold (₹)</span>
                  <input
                    type="number"
                    min="0"
                    step="500"
                    value={editingPolicy.human_approval_amount_threshold}
                    onChange={(e) =>
                      setEditingPolicy({
                        ...editingPolicy,
                        human_approval_amount_threshold: parseInt(e.target.value, 10) || 5000,
                      })
                    }
                  />
                  <small>Transactions at or above this amount cannot auto-generate live links.</small>
                </label>

                <label className="drawerField">
                  <span>Maximum retries per payment</span>
                  <input
                    type="number"
                    min="0"
                    max="10"
                    value={editingPolicy.max_retries_per_payment}
                    onChange={(e) =>
                      setEditingPolicy({
                        ...editingPolicy,
                        max_retries_per_payment: parseInt(e.target.value, 10) || 3,
                      })
                    }
                  />
                  <small>Maximum retry attempts allowed before stopping recovery.</small>
                </label>

                <label className="drawerField">
                  <span>Daily contact limit per customer</span>
                  <input
                    type="number"
                    min="0"
                    max="5"
                    value={editingPolicy.max_messages_per_customer_per_day}
                    onChange={(e) =>
                      setEditingPolicy({
                        ...editingPolicy,
                        max_messages_per_customer_per_day: parseInt(e.target.value, 10) || 1,
                      })
                    }
                  />
                  <small>Maximum messages sent to a customer per 24 hours.</small>
                </label>

                <label className="drawerField">
                  <span>Trust Gate lookback window (hours)</span>
                  <input
                    type="number"
                    min="1"
                    max="72"
                    value={editingPolicy.trust_gate_attempts_window_hours}
                    onChange={(e) =>
                      setEditingPolicy({
                        ...editingPolicy,
                        trust_gate_attempts_window_hours: parseInt(e.target.value, 10) || 24,
                      })
                    }
                  />
                  <small>Hours to look back when evaluating repeated attempt velocity.</small>
                </label>

                <label className="drawerField">
                  <span>Maximum attempts in window</span>
                  <input
                    type="number"
                    min="1"
                    max="20"
                    value={editingPolicy.trust_gate_max_attempts_in_window}
                    onChange={(e) =>
                      setEditingPolicy({
                        ...editingPolicy,
                        trust_gate_max_attempts_in_window: parseInt(e.target.value, 10) || 5,
                      })
                    }
                  />
                  <small>Higher activity within the lookback window is flagged as suspicious.</small>
                </label>
              </div>

              <div className="drawerFooter">
                <button
                  type="button"
                  onClick={() => setIsDrawerOpen(false)}
                  className="button buttonSecondary"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="button buttonPrimary"
                >
                  <ShieldCheck size={15} />
                  <span>{saving ? "Saving..." : "Save Safety Rules"}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </main>
  );
}

function generateSimulatedDryRun(
  eventId: string,
  testPolicy: PolicySettings,
  sampleResult?: PipelineResult
): PolicyReplayResponse {
  const amount = sampleResult ? sampleResult.amount : 5999;
  const confidence = sampleResult ? sampleResult.diagnosis.confidence : 0.75;
  const retries = 1;

  let proposedAction: PolicyReplayResponse["proposed_decision"]["action"] = "create_payment_link";
  let proposedReason = "Allowed by policy: confidence exceeds threshold and amount is within bounds.";

  if (retries >= testPolicy.max_retries_per_payment) {
    proposedAction = "stop_limit_reached";
    proposedReason = `Retry limit of ${testPolicy.max_retries_per_payment} reached. Recovery stopped.`;
  } else if (amount >= testPolicy.human_approval_amount_threshold) {
    proposedAction = "escalate_human";
    proposedReason = `Amount (₹${amount.toLocaleString("en-IN")}) exceeds human approval threshold (₹${testPolicy.human_approval_amount_threshold.toLocaleString("en-IN")}).`;
  } else if (confidence < testPolicy.diagnosis_confidence_escalation_threshold) {
    proposedAction = "escalate_human";
    proposedReason = `Diagnosis confidence (${formatConfidence(confidence)}) is below safety floor (${formatConfidence(testPolicy.diagnosis_confidence_escalation_threshold)}).`;
  }

  return {
    event_id: eventId,
    original_policy: testPolicy,
    original_decision: {
      action: sampleResult?.decision.action || "create_payment_link",
      reason: sampleResult?.decision.reason || "Original action based on active policy.",
      requires_customer_contact: sampleResult?.decision.requires_customer_contact ?? true,
    },
    original_diagnosis: {
      cause: sampleResult?.diagnosis.cause || "soft_decline_card_limit",
      method: sampleResult?.diagnosis.method || "rule",
      confidence: sampleResult?.diagnosis.confidence || 0.85,
      reason: sampleResult?.diagnosis.reason || "Bank reported card limit exceeded.",
    },
    proposed_policy: testPolicy,
    proposed_decision: {
      action: proposedAction,
      reason: proposedReason,
      requires_customer_contact: proposedAction === "create_payment_link",
    },
    proposed_message: "Simulated payment link ready for customer.",
    is_dry_run: true,
    disclaimer: "Dry run only. No active policies or transactions were modified.",
  };
}
