"use client";

import React, { useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowUpRight,
  BrainCircuit,
  RefreshCcw,
  Search,
} from "lucide-react";
import { loadBatchDiagnosisReview, loadBatchSummary, loadVerifiedRecoverySummary, runBatchAiComparison, runEvaluation, saveDiagnosisLabel } from "@/lib/api";
import type { BatchAiComparisonResponse, BatchDiagnosisReviewItem, BatchSummary, DashboardData, VerifiedRecoverySummary } from "@/lib/types";
import { formatConfidence } from "@/lib/confidence";
import { getWhyThisAction } from "@/lib/utils";
import { StatusBadge } from "./status-badge";
import { FiveStageFlow } from "./five-stage-flow";
import { HelpTooltip } from "./help-tooltip";
import { EvidenceChain } from "./evidence-chain";

const money = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 0,
});

const MIN_LABELLED_CASES_FOR_ACCURACY = 10;

interface EvidenceViewProps {
  initialData: DashboardData;
  initialRecoverySummary: VerifiedRecoverySummary | null;
  batchId: string;
  initialBatchSummary: BatchSummary | null;
  initialDiagnosisReview: BatchDiagnosisReviewItem[];
}

const DIAGNOSIS_CAUSES = [
  "temporary_bank_failure",
  "temporary_funds_shortage",
  "customer_abandoned_payment",
  "unsupported_payment_method",
  "technical_error",
  "suspicious_activity",
  "unknown",
];

export function EvidenceView({ initialData, initialRecoverySummary, batchId, initialBatchSummary, initialDiagnosisReview }: EvidenceViewProps) {
  const [data, setData] = useState<DashboardData>(initialData);
  const [recoverySummary, setRecoverySummary] = useState<VerifiedRecoverySummary | null>(initialRecoverySummary);
  const [batchSummary, setBatchSummary] = useState<BatchSummary | null>(initialBatchSummary);
  const [diagnosisReview, setDiagnosisReview] = useState<BatchDiagnosisReviewItem[]>(initialDiagnosisReview);
  const [running, setRunning] = useState(false);
  const [runningComparison, setRunningComparison] = useState(false);
  const [aiComparison, setAiComparison] = useState<BatchAiComparisonResponse | null>(null);
  const [query, setQuery] = useState("");
  const [operatorToken, setOperatorToken] = useState("");
  const [labelDrafts, setLabelDrafts] = useState<Record<string, string>>({});
  const [savingLabel, setSavingLabel] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const filtered = useMemo(() => {
    const term = query.toLowerCase().trim();
    if (!term) return data.results;
    return data.results.filter((result) =>
      [result.event_id, result.customer_name, result.failure_code, result.decision.action]
        .join(" ")
        .toLowerCase()
        .includes(term)
    );
  }, [data.results, query]);

  async function handleRunEvaluation() {
    setRunning(true);
    setNotice(null);
    try {
      const res = await runEvaluation();
      setData(res);
      const [nextRecoverySummary, nextBatchSummary, nextDiagnosisReview] = await Promise.all([
        loadVerifiedRecoverySummary(),
        loadBatchSummary(batchId),
        loadBatchDiagnosisReview(batchId),
      ]);
      setRecoverySummary(nextRecoverySummary);
      setBatchSummary(nextBatchSummary);
      setDiagnosisReview(nextDiagnosisReview);
      setNotice({
        type: "success",
        text: "Evaluation completed. Stored Test Mode cases were re-evaluated with the current diagnosis and policy safeguards.",
      });
    } catch {
      setNotice({
        type: "error",
        text: "Evaluation run failed. Verify backend API connection and service health.",
      });
    } finally {
      setRunning(false);
    }
  }

  async function handleSaveDiagnosisLabel(item: BatchDiagnosisReviewItem) {
    const cause = labelDrafts[item.event_id];
    if (!cause || !operatorToken) {
      setNotice({ type: "error", text: "Choose the true failure cause and enter the operator token before saving." });
      return;
    }
    setSavingLabel(item.event_id);
    try {
      await saveDiagnosisLabel(item.event_id, cause, "Batch evidence review", operatorToken);
      const [nextBatchSummary, nextDiagnosisReview] = await Promise.all([
        loadBatchSummary(batchId),
        loadBatchDiagnosisReview(batchId),
      ]);
      setBatchSummary(nextBatchSummary);
      setDiagnosisReview(nextDiagnosisReview);
      setNotice({ type: "success", text: `Saved human diagnosis label for ${item.event_id}.` });
    } catch (error) {
      setNotice({ type: "error", text: error instanceof Error ? error.message : "Could not save the diagnosis label." });
    } finally {
      setSavingLabel(null);
    }
  }

  async function handleRunAiComparison() {
    setRunningComparison(true);
    setNotice(null);
    try {
      const comparison = await runBatchAiComparison(batchId);
      setAiComparison(comparison);
      setNotice({ type: "success", text: `Advisory AI comparison completed for ${comparison.model_calls_completed}/${comparison.eligible_human_reviewed_cases} reviewed Test Mode cases.` });
    } catch (error) {
      setNotice({ type: "error", text: error instanceof Error ? error.message : "AI comparison could not run." });
    } finally {
      setRunningComparison(false);
    }
  }

  const score = data.scorecard;
  const connected = data.source === "api";
  const escalatedCases = batchSummary?.total_cases ? batchSummary.human_review_escalations : data.results.filter((result) => result.decision.action === "escalate_human").length;
  const diagnosisLabelledCases = batchSummary?.total_cases
    ? batchSummary.diagnosis_labelled_cases
    : (score.diagnosis_labelled_cases ?? score.labeled_cases);
  const diagnosisAccuracy = batchSummary?.total_cases ? batchSummary.diagnosis_accuracy_pct : score.diagnosis_accuracy_pct;
  const diagnosisExcludedSafetyBlocks = batchSummary?.total_cases
    ? batchSummary.diagnosis_excluded_safety_blocks
    : (score.diagnosis_excluded_safety_blocks ?? 0);
  const hasEnoughLabelledData = diagnosisLabelledCases >= MIN_LABELLED_CASES_FOR_ACCURACY && diagnosisAccuracy !== null;
  const diagnosisCorrectCases = hasEnoughLabelledData && diagnosisAccuracy !== null
    ? Math.round((diagnosisAccuracy / 100) * diagnosisLabelledCases)
    : null;
  const trustGateBlocks = batchSummary?.total_cases ? batchSummary.trust_gate_blocks : score.suspicious_refusals;

  return (
    <main className="evidencePage">
      {/* Top Header */}
      <section className="pageIntro">
        <div className="eyebrow">
          <span>04</span> AUDIT &amp; PROOF OF ACTION
        </div>
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1>How Reven makes &amp; proves decisions</h1>
            <p>
              Inspect live Razorpay Test Mode cases, cryptographically signed webhook receipts, and auditable proof of recovery.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={handleRunEvaluation}
              disabled={running || !connected}
              className="button buttonPrimary buttonSmall"
            >
              <RefreshCcw size={14} className={running ? "spin" : ""} />
              <span>{running ? "Evaluating..." : "Run Test Evaluation"}</span>
            </button>
          </div>
        </div>
      </section>

      {/* Notice Banner */}
      {notice && (
        <div className={`notificationBanner notification-${notice.type}`} role="status">
          <div className="notificationContent">
            <span>{notice.text}</span>
            <button onClick={() => setNotice(null)} className="closeNotifBtn" aria-label="Dismiss">
              ×
            </button>
          </div>
        </div>
      )}

      {/* 4 Proof Metric Cards */}
      <section className="evidenceKpiGrid" aria-label="Evidence and verification metrics">
        {/* Verified Test Recovery */}
        <div className="kpiCard accentCard">
          <div className="kpiHeader">
            <span className="kpiLabel">ALL TEST MODE RECOVERY</span>
            <HelpTooltip topic="verified_recovery" />
          </div>
          <strong className="kpiValue recoveryText">{recoverySummary ? money.format(recoverySummary.verified_recovery_amount) : "—"}</strong>
          <div className="kpiFooter">
            <span className="recoveryText">{recoverySummary ? `${recoverySummary.verified_recovery_count} cumulative verified record${recoverySummary.verified_recovery_count === 1 ? "" : "s"} · separate from batch` : "Live recovery total unavailable"}</span>
          </div>
        </div>

        {/* Policy Compliance */}
        <div className="kpiCard">
          <div className="kpiHeader">
            <span className="kpiLabel">POLICY COMPLIANCE</span>
            <HelpTooltip topic="policy_engine" />
          </div>
          <strong className="kpiValue">{score.total_cases ? `${score.policy_compliance_pct}%` : "—"}</strong>
          <div className="kpiFooter">
            <span>{score.total_cases ? "Calculated from evaluated cases" : "No evaluated live cases yet"}</span>
          </div>
        </div>

        {/* Trust Gate Suspicious Refusals */}
        <div className="kpiCard">
          <div className="kpiHeader">
            <span className="kpiLabel">TRUST GATE BLOCKS</span>
            <HelpTooltip topic="trust_gate" />
          </div>
          <strong className="kpiValue riskText">{trustGateBlocks}</strong>
          <div className="kpiFooter">
            <span className="riskText">Actions safely blocked by Trust Gate</span>
          </div>
        </div>

        {/* Diagnosis agreement */}
        <div className="kpiCard">
          <div className="kpiHeader">
            <span className="kpiLabel">EARLY DIAGNOSIS AGREEMENT</span>
            <HelpTooltip topic="diagnosis_confidence" />
          </div>
          <strong className={hasEnoughLabelledData ? "kpiValue" : "kpiValue kpiValueMessage"}>
            {hasEnoughLabelledData
              ? `${diagnosisAccuracy}% · ${diagnosisCorrectCases}/${diagnosisLabelledCases}`
              : `Not enough labelled data yet (n=${diagnosisLabelledCases})`}
          </strong>
          <div className="kpiFooter">
            <span>{hasEnoughLabelledData ? `Early human-reviewed agreement, not production model accuracy · n=${diagnosisLabelledCases}${diagnosisExcludedSafetyBlocks ? ` · ${diagnosisExcludedSafetyBlocks} Trust Gate safety block${diagnosisExcludedSafetyBlocks === 1 ? "" : "s"} excluded` : ""}` : `Needs ${MIN_LABELLED_CASES_FOR_ACCURACY} human-reviewed causes before showing agreement`}</span>
          </div>
        </div>
      </section>

      <section className="evidenceBatchSummary" aria-label="Current Test Mode batch summary">
        <div>
          <span className="utilityLabel">BUILDATHON EVALUATION BATCH · {batchId.toUpperCase()}</span>
          <h2>{batchSummary?.total_cases ? "One fixed scope for judging." : "The real batch will appear after its first signed webhook."}</h2>
          <p>{batchSummary?.total_cases ? "These metrics include only this named Test Mode batch, not later cumulative history. Every number comes from stored Razorpay events, policy decisions, and signed paid-webhook confirmation." : "All-time verified recovery remains above. New signed Razorpay Test Mode events carrying this batch ID populate this section."}</p>
        </div>
        <dl>
          <div><dt>Cases received</dt><dd>{batchSummary?.total_cases ?? 0}</dd></div>
          <div><dt>Human escalations</dt><dd>{escalatedCases}</dd></div>
          <div><dt>Trust Gate stops</dt><dd>{trustGateBlocks}</dd></div>
          <div><dt>Verified recoveries</dt><dd>{batchSummary?.verified_recovery_count ?? 0}</dd></div>
          <div><dt>Verified Test ₹</dt><dd>{money.format(batchSummary?.verified_recovery_amount ?? 0)}</dd></div>
        </dl>
        <small>Submission scope: {batchId}. The cumulative all-Test-Mode total stays above; this batch does not claim production merchant performance.</small>
      </section>

      <section className="aiComparison" aria-labelledby="ai-comparison-title">
        <div className="aiComparisonHeader">
          <div>
            <span className="utilityLabel">EVALUATION · RULES VS ADVISORY AI</span>
            <h2 id="ai-comparison-title">Does the model add diagnostic signal?</h2>
            <p>Compare the stored diagnosis and a read-only Gemini investigation against the same human-reviewed Test Mode labels. This never changes a case or counts as production accuracy.</p>
          </div>
          <button type="button" className="button buttonPrimary buttonSmall" disabled={runningComparison || !connected} onClick={handleRunAiComparison}>
            <BrainCircuit size={14} /> {runningComparison ? "Comparing…" : "Run AI comparison"}
          </button>
        </div>
        {aiComparison && (
          <>
            <div className="aiComparisonMetrics">
              <div><span>Human-reviewed cases</span><strong>{aiComparison.eligible_human_reviewed_cases}</strong></div>
              <div><span>Stored-rule agreement</span><strong>{aiComparison.rule_agreement_pct === null ? "—" : `${aiComparison.rule_agreement_pct}%`}</strong></div>
              <div><span>Advisory-AI agreement</span><strong>{aiComparison.advisory_ai_agreement_pct === null ? "Unavailable" : `${aiComparison.advisory_ai_agreement_pct}%`}</strong></div>
              <div><span>Model calls completed</span><strong>{aiComparison.model_calls_completed}/{aiComparison.eligible_human_reviewed_cases}</strong></div>
            </div>
            <div className="tableWrap aiComparisonTable">
              <table>
                <thead><tr><th>Case</th><th>Human-reviewed cause</th><th>Stored rule</th><th>Advisory AI</th></tr></thead>
                <tbody>{aiComparison.comparisons.map((item) => (
                  <tr key={item.event_id}>
                    <td><Link href={`/case/${item.event_id}`} className="fontMono text-primary fontMedium">{item.event_id}</Link></td>
                    <td>{item.human_label.replaceAll("_", " ")}</td>
                    <td>{item.stored_diagnosis.cause.replaceAll("_", " ")}<small className="block text-text-muted text-[10px]">{item.stored_diagnosis.method}</small></td>
                    <td>{item.advisory_diagnosis ? <><span className="fontMedium">{item.advisory_diagnosis.cause.replaceAll("_", " ")}</span><small className="block text-text-muted text-[10px]">{formatConfidence(item.advisory_diagnosis.confidence)} · {item.advisory_diagnosis.tool_calls.join(" · ")}</small></> : <span className="warningText">Model unavailable</span>}</td>
                  </tr>
                ))}</tbody>
              </table>
            </div>
            <small className="aiComparisonDisclaimer">{aiComparison.disclaimer}</small>
          </>
        )}
      </section>

      {diagnosisReview.length > 0 && (
        <section className="eventsSection" aria-label="Human diagnosis review">
          <div className="eventsHeader">
            <div>
              <span className="utilityLabel">HUMAN LABEL REVIEW · {batchId.toUpperCase()}</span>
              <h2>Review AI-assigned failure causes</h2>
              <p className="sectionIntro">Label the true cause for at least 15–20 cases. Only these human labels affect Diagnosis Agreement; actions remain independently evaluated.</p>
            </div>
            <label className="searchBox">
              <span className="srOnly">Operator token</span>
              <input value={operatorToken} onChange={(event) => setOperatorToken(event.target.value)} type="password" autoComplete="off" placeholder="Operator token" />
            </label>
          </div>
          <div className="tableWrap">
            <table>
              <thead><tr><th>Case</th><th>Processor evidence</th><th>AI diagnosis</th><th>True cause</th><th>Label</th></tr></thead>
              <tbody>{diagnosisReview.map((item) => (
                <tr key={item.event_id}>
                  <td><Link href={`/case/${item.event_id}`} className="fontMono text-primary fontMedium">{item.event_id}</Link><small className="block text-text-muted text-[10px]">{money.format(item.amount)} · {item.failure_code}</small></td>
                  <td>{item.payment_method ?? "—"}<small className="block text-text-muted text-[10px]">{item.processor_description ?? "No processor description"}</small></td>
                  <td><span className="fontMedium">{item.ai_assigned_cause.replaceAll("_", " ")}</span><small className="block text-text-muted text-[10px]">{item.diagnosis_method} · {formatConfidence(item.confidence)}</small></td>
                  <td>{item.human_label ? <span className="recoveryText">{item.human_label.replaceAll("_", " ")}</span> : <select value={labelDrafts[item.event_id] ?? ""} onChange={(event) => setLabelDrafts((current) => ({ ...current, [item.event_id]: event.target.value }))}><option value="">Choose cause</option>{DIAGNOSIS_CAUSES.map((cause) => <option value={cause} key={cause}>{cause.replaceAll("_", " ")}</option>)}</select>}</td>
                  <td>{item.human_label ? "Reviewed" : <button type="button" className="button buttonSecondary buttonSmall" disabled={savingLabel === item.event_id} onClick={() => handleSaveDiagnosisLabel(item)}>{savingLabel === item.event_id ? "Saving..." : "Save label"}</button>}</td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        </section>
      )}

      {/* Reusable Five Stage Flow */}
      <FiveStageFlow
        title="5-Stage Recovery Architecture"
        subtitle="Every live test case follows this strict auditable lifecycle before any action or revenue claim is recorded."
      />

      {/* Evidence Chain Component */}
      <div className="my-6">
        <EvidenceChain />
      </div>

      {/* Razorpay Test Mode Verification Proof Ledger */}
      <section className="eventsSection" id="evidence-table">
        <div className="eventsHeader">
          <div>
            <span className="utilityLabel">VERIFIED EVIDENCE LEDGER</span>
            <h2>Razorpay Test Mode Cases ({filtered.length})</h2>
          </div>

          <label className="searchBox">
            <Search size={15} />
            <span className="srOnly">Search evidence cases</span>
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search case ID, customer, reason..."
            />
          </label>
        </div>

        <div className="tableWrap">
          <table>
            <thead>
              <tr>
                <th>Case ID</th>
                <th>Customer</th>
                <th>Amount</th>
                <th>Diagnosed Cause</th>
                <th>Decision &amp; Policy Rule</th>
                <th>Verified Recovery</th>
                <th>Inspect Case</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={7} className="emptyTable">
                    No cases match your search query. Connect the backend and trigger a test payment.
                  </td>
                </tr>
              )}
              {filtered.map((result, index) => (
                <tr key={result.event_id} style={{ "--row-index": index } as React.CSSProperties}>
                  <td>
                    <Link href={`/case/${result.event_id}`} className="fontMono text-primary fontMedium">
                      {result.event_id}
                    </Link>
                    <small className="block text-text-muted text-[10px]">
                      {result.event_type.replaceAll("_", " ")}
                    </small>
                  </td>

                  <td>{result.customer_name}</td>

                  <td className="number fontMedium">
                    {money.format(result.amount)}
                  </td>

                  <td>
                    <span className="fontMedium">{result.diagnosis.cause.replaceAll("_", " ")}</span>
                    <small className="block text-text-muted text-[10px]">
                      {result.diagnosis.method} · {formatConfidence(result.diagnosis.confidence)} confidence
                    </small>
                  </td>

                  <td>
                    <StatusBadge value={result.decision.action} />
                    <small className="tableWhyText">
                      {getWhyThisAction(result, score.policy_snapshot)}
                    </small>
                  </td>

                  <td className="number">
                    {result.verified_recovered_amount ? (
                      <span className="recoveryText fontMedium">
                        {money.format(result.verified_recovered_amount)}
                      </span>
                    ) : result.razorpay_payment_link_id ? (
                      <span className="warningText text-[11px]">Awaiting payment</span>
                    ) : (
                      <span className="text-text-muted text-[11px]">—</span>
                    )}
                  </td>

                  <td>
                    <Link
                      href={`/case/${result.event_id}`}
                      className="button buttonSecondary buttonSmall"
                      aria-label={`View details for ${result.event_id}`}
                    >
                      <span>View details</span>
                      <ArrowUpRight size={13} />
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Honest Exceptions: Where Reven Hesitated */}
      <section className="exceptionsSection">
        <div className="sectionHeading">
          <div>
            <span className="utilityLabel riskText">HONEST AUDIT TRAIL</span>
            <h2>Where Reven hesitated or escalated</h2>
          </div>
          <span className="exceptionCount">
            {(score.wrong_or_uncertain_cases?.length || 0).toString().padStart(2, "0")}
          </span>
        </div>
        <p className="sectionIntro">
          Uncertain, ambiguous, and escalated cases are visible evidence of safety bounds working as intended.
        </p>

        <div className="exceptionList">
          {(!score.wrong_or_uncertain_cases || score.wrong_or_uncertain_cases.length === 0) ? (
            <div className="emptyInline">All cases processed safely within expected bounds.</div>
          ) : (
            score.wrong_or_uncertain_cases.map((item) => (
              <Link href={`/case/${item.event_id}`} key={item.event_id} className="exceptionItem">
                <div>
                  <strong>{item.event_id}</strong>
                  <span>{item.reason}</span>
                </div>
                <ArrowUpRight size={16} />
              </Link>
            ))
          )}
        </div>
      </section>
    </main>
  );
}
