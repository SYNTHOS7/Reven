"use client";

import { useState } from "react";
import { CheckCircle2, MessageSquare, UserCheck } from "lucide-react";

import { submitOperatorFeedback } from "@/lib/api";
import type { Action, PaymentEventDetails, PipelineResult } from "@/lib/types";
import { formatConfidence } from "@/lib/confidence";
import { Button } from "./ui/button";
import { StatusBadge } from "./status-badge";

interface OperatorFeedbackProps {
  event: PaymentEventDetails;
  pipelineResult: PipelineResult;
}

const causeOptions = [
  { value: "temporary_funds_shortage", label: "Temporary Funds Shortage" },
  { value: "expired_payment_method", label: "Expired Payment Method" },
  { value: "lapsed_mandate", label: "Lapsed Mandate" },
  { value: "temporary_bank_failure", label: "Temporary Bank Failure" },
  { value: "customer_abandoned_payment", label: "Customer Abandoned Payment" },
  { value: "unknown", label: "Unknown / Unclear Evidence" },
];

const actionOptions: Array<{ value: Action; label: string }> = [
  { value: "retry_later", label: "Retry Later" },
  { value: "create_payment_link", label: "Create Payment Link" },
  { value: "update_payment_method", label: "Update Payment Method" },
  { value: "escalate_human", label: "Human Review Required" },
  { value: "stop_limit_reached", label: "Blocked by Policy" },
  { value: "no_action", label: "No Action" },
];

export function OperatorFeedback({ event, pipelineResult }: OperatorFeedbackProps) {
  const [selectedCause, setSelectedCause] = useState<string>(
    event.human_reviewed_cause || pipelineResult.diagnosis.cause || "temporary_funds_shortage",
  );
  const [selectedAction, setSelectedAction] = useState<Action>(
    event.human_reviewed_action || pipelineResult.decision.action || "escalate_human",
  );
  const [note, setNote] = useState<string>(event.human_reviewed_note || "");
  const [saving, setSaving] = useState(false);
  const [feedbackSaved, setFeedbackSaved] = useState<boolean>(Boolean(event.human_reviewed_cause));
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!note.trim()) {
      setErrorMsg("Please provide a short internal review note.");
      return;
    }
    setSaving(true);
    setErrorMsg(null);
    try {
      await submitOperatorFeedback(event.id, selectedCause, selectedAction, note.trim());
      setFeedbackSaved(true);
    } catch {
      setErrorMsg("Could not save operator feedback. Check backend connection.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="operatorFeedbackSection" aria-label="Operator feedback audit panel">
      <div className="feedbackHeader">
        <div className="utilityLabel"><UserCheck size={14} /> HUMAN AUDIT & REVIEW</div>
        <h2>AI Diagnosis vs Human Outcome</h2>
        <p>Operators can attach human review feedback to benchmark AI accuracy without altering original AI traces.</p>
      </div>

      <div className="comparisonGrid">
        {/* Left: Original AI Diagnosis */}
        <div className="auditCard aiTraceCard">
          <div className="auditCardHeader">
            <span className="utilityLabel">ORIGINAL AI SIGNAL</span>
            <span className="badgeMono">{pipelineResult.diagnosis.method.toUpperCase()}</span>
          </div>
          <div className="auditRow">
            <span className="fieldLabel">Diagnosed Cause</span>
            <strong className="fieldValueMono">{pipelineResult.diagnosis.cause.replaceAll("_", " ")}</strong>
          </div>
          <div className="auditRow">
            <span className="fieldLabel">Confidence</span>
            <strong className="fieldValueAccent">{formatConfidence(pipelineResult.diagnosis.confidence)}</strong>
          </div>
          <div className="auditRow">
            <span className="fieldLabel">Evaluated Action</span>
            <div><StatusBadge value={pipelineResult.decision.action} /></div>
          </div>
          <div className="auditRow">
            <span className="fieldLabel">Diagnostic Reason</span>
            <p className="fieldDescription">{pipelineResult.diagnosis.reason}</p>
          </div>
        </div>

        {/* Right: Human Reviewed Outcome */}
        <div className="auditCard humanReviewCard">
          <div className="auditCardHeader">
            <span className="utilityLabel">HUMAN-REVIEWED OUTCOME</span>
            {feedbackSaved ? (
              <span className="statusVerified"><CheckCircle2 size={13} /> AUDITED</span>
            ) : (
              <span className="statusPending"><MessageSquare size={13} /> UNREVIEWED</span>
            )}
          </div>

          <form onSubmit={handleSubmit} className="feedbackForm">
            <div className="formGroup">
              <label htmlFor="observed-cause-select" className="fieldLabel">Observed Cause</label>
              <select
                id="observed-cause-select"
                value={selectedCause}
                onChange={(e) => setSelectedCause(e.target.value)}
                className="selectInput"
              >
                {causeOptions.map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>

            <div className="formGroup">
              <label htmlFor="correct-action-select" className="fieldLabel">Chosen Recovery Action</label>
              <select
                id="correct-action-select"
                value={selectedAction}
                onChange={(e) => setSelectedAction(e.target.value as Action)}
                className="selectInput"
              >
                {actionOptions.map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>

            <div className="formGroup">
              <label htmlFor="internal-review-note" className="fieldLabel">Internal Review Note</label>
              <textarea
                id="internal-review-note"
                rows={2}
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Add audit rationale (e.g. Verified customer confirmed card renewal over call)"
                className="textAreaInput"
              />
            </div>

            <div className="formActions">
              <Button type="submit" disabled={saving}>
                {saving ? "Saving review..." : feedbackSaved ? "Update review note" : "Save operator review"}
              </Button>
            </div>
            {errorMsg && <div className="errorNotice" role="alert">{errorMsg}</div>}
          </form>
        </div>
      </div>
    </section>
  );
}
