"use client";

import React, { useMemo, useRef, useState } from "react";
import {
  AlertCircle,
  ArrowDownToLine,
  BarChart3,
  CheckCircle2,
  ChevronRight,
  FileCheck,
  Info,
  Layers,
  RefreshCw,
  Search,
  Shield,
  Sparkles,
  Upload,
  Zap,
} from "lucide-react";
import { useTransactions } from "@/lib/transaction-context";
import { maskEmail } from "@/lib/utils";
import { categorizeFailureReasonKey } from "@/lib/recovery-logic";
import type { CSVValidationError, Transaction } from "@/lib/types";

const money = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 0,
});

/* ── Analysis Workbench Step Definitions ── */
type WorkbenchStep = "raw" | "validate" | "classify" | "evaluate" | "queue";

const STEPS: { key: WorkbenchStep; label: string; icon: React.ElementType; desc: string }[] = [
  { key: "raw", label: "Raw Data", icon: Layers, desc: "Ingested transaction rows before processing" },
  { key: "validate", label: "Validation", icon: FileCheck, desc: "Schema & field-level quality checks" },
  { key: "classify", label: "Classification", icon: Zap, desc: "Root-cause tagging & failure bucketing" },
  { key: "evaluate", label: "Policy Evaluation", icon: Shield, desc: "Recovery probability & action scoring" },
  { key: "queue", label: "Queue", icon: BarChart3, desc: "Prioritised recovery worklist output" },
];

export function TransactionDataView() {
  const {
    transactions,
    loadDemoDataset,
    resetDemo,
    uploadCsvText,
    downloadSampleCsv,
  } = useTransactions();

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [dragActive, setDragActive] = useState(false);
  const [validationErrors, setValidationErrors] = useState<CSVValidationError[]>([]);
  const [uploadSuccess, setUploadSuccess] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [page, setPage] = useState(1);
  const pageSize = 15;

  /* workbench state */
  const [activeStep, setActiveStep] = useState<WorkbenchStep>("raw");
  const [showHowToRead, setShowHowToRead] = useState(false);

  function handleFile(file: File) {
    setValidationErrors([]);
    setUploadSuccess(null);

    if (!file.name.endsWith(".csv")) {
      setValidationErrors([
        {
          row: 0,
          message: "Please select a valid .csv file.",
        },
      ]);
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const content = e.target?.result as string;
      if (!content) {
        setValidationErrors([{ row: 0, message: "File is empty or could not be read." }]);
        return;
      }

      const res = uploadCsvText(content);
      if (res.valid) {
        setUploadSuccess(
          `Successfully processed and imported ${res.validRows} transactions from '${file.name}'.`
        );
        setPage(1);
      } else {
        setValidationErrors(res.errors);
      }
    };
    reader.onerror = () => {
      setValidationErrors([{ row: 0, message: "Failed to read file from disk." }]);
    };
    reader.readAsText(file);
  }

  function handleDrag(e: React.DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFile(e.dataTransfer.files[0]);
    }
  }

  // Filter and search transactions
  const filtered = transactions.filter((t) => {
    if (statusFilter !== "all" && t.status !== statusFilter) return false;
    if (!query) return true;
    const q = query.toLowerCase();
    return (
      t.transaction_id.toLowerCase().includes(q) ||
      t.customer_name.toLowerCase().includes(q) ||
      t.failure_reason.toLowerCase().includes(q) ||
      t.payment_method.toLowerCase().includes(q)
    );
  });

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const paginated = filtered.slice((page - 1) * pageSize, page * pageSize);

  // Quick stats
  const totalCount = transactions.length;
  const lostSum = transactions
    .filter((t) => t.status === "failed" || t.status === "abandoned")
    .reduce((acc, t) => acc + t.amount, 0);
  const recoveredSum = transactions
    .filter((t) => t.status === "recovered")
    .reduce((acc, t) => acc + t.amount, 0);
  const cardFailuresCount = transactions.filter(
    (t) => (t.status === "failed" || t.status === "abandoned") && t.payment_method === "card"
  ).length;
  const totalFailuresCount = transactions.filter(
    (t) => t.status === "failed" || t.status === "abandoned"
  ).length;
  const cardFailurePct =
    totalFailuresCount > 0 ? Math.round((cardFailuresCount / totalFailuresCount) * 100) : 0;

  /* ── Data Quality Stats (for workbench validation step) ── */
  const dataQuality = useMemo(() => {
    const ids = new Set<string>();
    let duplicates = 0;
    let missingFields = 0;
    let invalidAmounts = 0;
    let validRows = 0;

    for (const tx of transactions) {
      let rowValid = true;
      if (ids.has(tx.transaction_id)) { duplicates++; rowValid = false; }
      ids.add(tx.transaction_id);
      if (!tx.customer_name || !tx.transaction_id) { missingFields++; rowValid = false; }
      if (typeof tx.amount !== "number" || tx.amount <= 0) { invalidAmounts++; rowValid = false; }
      if (rowValid) validRows++;
    }

    return {
      total: transactions.length,
      valid: validRows,
      invalid: transactions.length - validRows,
      duplicates,
      missingFields,
      invalidAmounts,
    };
  }, [transactions]);

  /* ── Classification Breakdown ── */
  const classificationBreakdown = useMemo(() => {
    const buckets: Record<string, { count: number; amount: number }> = {};
    for (const tx of transactions) {
      if (tx.status === "successful") continue;
      const key = categorizeFailureReasonKey(tx.failure_reason, tx.retry_count, tx.status);
      if (!buckets[key]) buckets[key] = { count: 0, amount: 0 };
      buckets[key].count++;
      buckets[key].amount += tx.amount;
    }
    return Object.entries(buckets)
      .map(([key, val]) => ({ key, ...val }))
      .sort((a, b) => b.amount - a.amount);
  }, [transactions]);

  /* ── Policy Evaluation Summary ── */
  const policySummary = useMemo(() => {
    const highProb = transactions.filter((t) => (t.recovery_probability ?? 0) >= 75 && t.status !== "successful" && t.status !== "recovered").length;
    const medProb = transactions.filter((t) => { const p = t.recovery_probability ?? 0; return p >= 40 && p < 75 && t.status !== "successful" && t.status !== "recovered"; }).length;
    const lowProb = transactions.filter((t) => (t.recovery_probability ?? 0) < 40 && t.status !== "successful" && t.status !== "recovered").length;
    const highPriority = transactions.filter((t) => t.is_high_priority).length;
    return { highProb, medProb, lowProb, highPriority };
  }, [transactions]);

  /* ── Queue Preview ── */
  const queuePreview = useMemo(() => {
    return transactions
      .filter((t) => t.is_high_priority && t.status !== "recovered" && t.status !== "successful")
      .sort((a, b) => (b.recovery_probability ?? 0) - (a.recovery_probability ?? 0))
      .slice(0, 8);
  }, [transactions]);

  return (
    <main className="transactionDataPage">
      {/* Simulation Banner */}
      <div className="demoSimulationBanner">
        <div className="demoSimulationContent">
          <Sparkles size={16} className="sparkleIcon" />
          <div>
            <strong>SIMULATED MERCHANT SCENARIO — No customer communication is sent.</strong>
            <span>
              Transactions uploaded or seeded here are isolated to the revenue intelligence &amp;
              recovery sandbox. Real payment credentials (card numbers, CVVs, OTPs) are never stored.
            </span>
          </div>
        </div>
      </div>

      <section className="pageIntro">
        <div className="eyebrow">
          <span>01</span> DATA &amp; CSV INGESTION
        </div>
        <h1>
          Transaction Data &amp; <em>CSV Pipeline</em>
        </h1>
        <p>
          Upload your payment failure logs or explore the 500-transaction seeded online-course
          dataset. Discover failure patterns, simulate recovery triggers, and analyze revenue leakage.
        </p>
      </section>

      {/* Dataset Summary Cards */}
      <div className="statsSummaryGrid">
        <div className="summaryCard">
          <span className="summaryLabel">TOTAL TRANSACTIONS</span>
          <strong className="summaryValue">{totalCount.toLocaleString("en-IN")}</strong>
          <small>Across active dataset</small>
        </div>
        <div className="summaryCard">
          <span className="summaryLabel">LOST REVENUE</span>
          <strong className="summaryValue riskText">{money.format(lostSum)}</strong>
          <small>{totalFailuresCount} failed or abandoned</small>
        </div>
        <div className="summaryCard accentSummary">
          <span className="summaryLabel">SIMULATED RECOVERED</span>
          <strong className="summaryValue recoveryText">{money.format(recoveredSum)}</strong>
          <small>Recovered through safe actions</small>
        </div>
        <div className="summaryCard">
          <span className="summaryLabel">CARD FAILURE PATTERN</span>
          <strong className="summaryValue warningText">{cardFailurePct}%</strong>
          <small>{cardFailuresCount} card payment drops</small>
        </div>
      </div>

      {/* CSV Upload & Controls Deck */}
      <section className="csvControlDeck">
        <div className="csvDropzoneContainer">
          <div
            className={`csvDropzone ${dragActive ? "dropzoneActive" : ""}`}
            onDragEnter={handleDrag}
            onDragOver={handleDrag}
            onDragLeave={handleDrag}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv"
              style={{ display: "none" }}
              onChange={(e) => {
                if (e.target.files && e.target.files[0]) {
                  handleFile(e.target.files[0]);
                }
              }}
            />
            <div className="dropzoneIcon">
              <Upload size={28} />
            </div>
            <h3>Drop your transaction CSV here or click to browse</h3>
            <p>
              Expected fields: <code>transaction_id, customer_name, customer_email, customer_phone, amount, currency, status, payment_method, failure_reason, attempted_at, retry_count</code>
            </p>
            <span className="fileTypesBadge">Supported format: .csv · Max 10MB</span>
          </div>

          {/* Validation Feedback */}
          {validationErrors.length > 0 && (
            <div className="csvErrorCallout" role="alert">
              <div className="errorCalloutTitle">
                <AlertCircle size={16} />
                <span>CSV Validation Issues Detected ({validationErrors.length})</span>
              </div>
              <ul className="errorList">
                {validationErrors.slice(0, 6).map((err, idx) => (
                  <li key={idx}>
                    {err.row > 0 ? <strong>Row {err.row}: </strong> : null}
                    {err.message}
                    {err.field ? <small> (field: {err.field})</small> : null}
                  </li>
                ))}
                {validationErrors.length > 6 && (
                  <li className="moreErrorsNote">
                    ...and {validationErrors.length - 6} more errors in file.
                  </li>
                )}
              </ul>
            </div>
          )}

          {uploadSuccess && (
            <div className="csvSuccessCallout" role="status">
              <CheckCircle2 size={16} />
              <span>{uploadSuccess}</span>
            </div>
          )}
        </div>

        {/* Action Buttons Sidebar */}
        <div className="csvActionsSidebar">
          <div className="sidebarBlock">
            <span className="utilityLabel">DEMO CONTROLS</span>
            <h4>Seeded Datasets &amp; Templates</h4>
            <p>
              Pre-loaded with 500 realistic fictional course transactions with ~₹1.40L lost revenue, card drop patterns, and UPI alternatives.
            </p>
          </div>

          <div className="sidebarButtonStack">
            <button
              type="button"
              onClick={downloadSampleCsv}
              className="button buttonOutline fullWidthBtn"
            >
              <ArrowDownToLine size={15} />
              Download Sample CSV
            </button>

            <button
              type="button"
              onClick={loadDemoDataset}
              className="button buttonPrimary fullWidthBtn"
            >
              <Sparkles size={15} />
              Load Demo Dataset (500)
            </button>

            <button
              type="button"
              onClick={resetDemo}
              className="button buttonGhost fullWidthBtn resetBtn"
            >
              <RefreshCw size={14} />
              Reset Demo Dataset
            </button>
          </div>

          <div className="schemaHintCard">
            <div className="schemaHintHeader">
              <Info size={14} />
              <span>Accepted Statuses</span>
            </div>
            <div className="statusPillList">
              <span className="statusPill statusPill-successful">successful</span>
              <span className="statusPill statusPill-failed">failed</span>
              <span className="statusPill statusPill-abandoned">abandoned</span>
              <span className="statusPill statusPill-recovered">recovered</span>
            </div>
          </div>
        </div>
      </section>

      {/* ═══════════════════════════ ANALYSIS WORKBENCH ═══════════════════════════ */}
      {transactions.length > 0 && (
        <section className="analysisWorkbenchSection" aria-label="Analysis Workbench">
          <div className="workbenchHeader">
            <div>
              <span className="utilityLabel">ANALYSIS WORKBENCH</span>
              <h2>Step-by-step data pipeline</h2>
            </div>
            <button
              type="button"
              className="button buttonOutline buttonSmall"
              onClick={() => setShowHowToRead((v) => !v)}
            >
              <Info size={14} />
              {showHowToRead ? "Hide Guide" : "How to read this"}
            </button>
          </div>

          {/* "How to read this" panel */}
          {showHowToRead && (
            <div className="howToReadPanel" role="note">
              <h4>How to read the Analysis Workbench</h4>
              <p>
                Each step transforms the raw dataset progressively. Click a step to see its output:
              </p>
              <ol>
                <li><strong>Raw Data</strong> — All ingested rows as received, before any processing.</li>
                <li><strong>Validation</strong> — Schema checks: duplicates, missing fields, invalid amounts. Only valid rows proceed.</li>
                <li><strong>Classification</strong> — Each failure is bucketed by root cause using deterministic pattern matching on the failure reason, method, and retry count.</li>
                <li><strong>Policy Evaluation</strong> — Recovery probability is scored and high-value thresholds are checked. This produces the priority flag.</li>
                <li><strong>Queue</strong> — The final prioritised worklist: items sorted by recovery probability, ready for action in the Recovery Queue page.</li>
              </ol>
              <p className="howToReadDisclaimer">
                <strong>Methodology note:</strong> All classification is deterministic (rule-based pattern matching, not ML). Recovery probabilities are
                heuristic scores based on failure type, method, and retry count — not trained predictions.
                This ensures full explainability and auditability.
              </p>
            </div>
          )}

          {/* Step Tabs */}
          <div className="workbenchStepTabs" role="tablist">
            {STEPS.map((step, i) => (
              <button
                key={step.key}
                role="tab"
                aria-selected={activeStep === step.key}
                className={`workbenchTab ${activeStep === step.key ? "activeTab" : ""}`}
                onClick={() => setActiveStep(step.key)}
              >
                <span className="tabStepNum">{String(i + 1).padStart(2, "0")}</span>
                <step.icon size={16} />
                <span>{step.label}</span>
                {i < STEPS.length - 1 && <ChevronRight size={12} className="tabArrow" />}
              </button>
            ))}
          </div>

          {/* Step Content */}
          <div className="workbenchContent">
            {activeStep === "raw" && <RawDataPanel transactions={transactions} totalCount={totalCount} />}
            {activeStep === "validate" && <ValidationPanel quality={dataQuality} />}
            {activeStep === "classify" && <ClassificationPanel breakdown={classificationBreakdown} totalFailures={totalFailuresCount} />}
            {activeStep === "evaluate" && <EvaluationPanel summary={policySummary} />}
            {activeStep === "queue" && <QueuePreviewPanel items={queuePreview} />}
          </div>
        </section>
      )}

      {/* Transaction Data Table */}
      <section className="eventsSection" id="transactions-ledger">
        <div className="eventsHeader">
          <div>
            <span className="utilityLabel">TRANSACTION LEDGER</span>
            <h2>Loaded Records ({filtered.length})</h2>
          </div>

          <div className="tableControlsGroup">
            {/* Status Filter Buttons */}
            <div className="filterPillGroup" role="group" aria-label="Status filter">
              {["all", "failed", "abandoned", "recovered", "successful"].map((st) => (
                <button
                  key={st}
                  type="button"
                  onClick={() => {
                    setStatusFilter(st);
                    setPage(1);
                  }}
                  className={`filterPill ${statusFilter === st ? "activePill" : ""}`}
                >
                  {st.toUpperCase()}
                </button>
              ))}
            </div>

            {/* Search Box */}
            <label className="searchBox">
              <Search size={15} />
              <input
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  setPage(1);
                }}
                placeholder="Search by ID, name, reason..."
              />
            </label>
          </div>
        </div>

        <div className="tableWrap">
          <table>
            <thead>
              <tr>
                <th>Transaction ID</th>
                <th>Customer</th>
                <th>Amount</th>
                <th>Status</th>
                <th>Method</th>
                <th>Failure Reason</th>
                <th>Likely Root Cause</th>
                <th>Attempted At</th>
                <th>Retries</th>
              </tr>
            </thead>
            <tbody>
              {paginated.length === 0 && (
                <tr>
                  <td colSpan={9} className="emptyTable">
                    No transactions match your search or filter. Try loading the demo dataset or clearing filters.
                  </td>
                </tr>
              )}
              {paginated.map((tx, idx) => (
                <tr key={tx.transaction_id} style={{ "--row-index": idx } as React.CSSProperties}>
                  <td className="monoCode">{tx.transaction_id}</td>
                  <td>
                    <strong>{tx.customer_name}</strong>
                    <small className="tableSubText">{maskEmail(tx.customer_email)}</small>
                  </td>
                  <td className="number fontMedium">{money.format(tx.amount)}</td>
                  <td>
                    <span className={`statusPill statusPill-${tx.status}`}>{tx.status}</span>
                  </td>
                  <td>
                    <span className="methodBadge">{tx.payment_method}</span>
                  </td>
                  <td>
                    <span className="failureReasonTag">
                      {tx.failure_reason === "none" ? "—" : tx.failure_reason.replaceAll("_", " ")}
                    </span>
                  </td>
                  <td className="causeCell">
                    {tx.likely_root_cause ? (
                      <span>{tx.likely_root_cause}</span>
                    ) : (
                      <span className="mutedText">—</span>
                    )}
                  </td>
                  <td className="dateCell">
                    {tx.attempted_at ? new Date(tx.attempted_at).toLocaleDateString("en-IN", {
                      month: "short",
                      day: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    }) : "—"}
                  </td>
                  <td className="number">{tx.retry_count}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="tablePagination">
            <span className="pageInfo">
              Showing {(page - 1) * pageSize + 1}–
              {Math.min(page * pageSize, filtered.length)} of {filtered.length}
            </span>
            <div className="pageButtons">
              <button
                type="button"
                disabled={page <= 1}
                onClick={() => setPage((p) => p - 1)}
                className="button buttonSmall buttonOutline"
              >
                Previous
              </button>
              <span className="pageCurrent">
                Page {page} of {totalPages}
              </span>
              <button
                type="button"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => p + 1)}
                className="button buttonSmall buttonOutline"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </section>
    </main>
  );
}

/* ═══════════════════════════ WORKBENCH SUB-PANELS ═══════════════════════════ */

function RawDataPanel({ transactions, totalCount }: { transactions: Transaction[]; totalCount: number }) {
  const statusCounts = useMemo(() => {
    const m: Record<string, number> = {};
    for (const tx of transactions) { m[tx.status] = (m[tx.status] || 0) + 1; }
    return m;
  }, [transactions]);

  return (
    <div className="workbenchPanel">
      <h4>Raw Ingested Data</h4>
      <p className="workbenchPanelDesc">
        {totalCount} rows loaded into the pipeline. No transformations applied at this stage.
      </p>
      <div className="dqCardGrid">
        <DQCard label="Total Rows" value={totalCount.toString()} />
        {Object.entries(statusCounts).map(([s, c]) => (
          <DQCard key={s} label={s.charAt(0).toUpperCase() + s.slice(1)} value={c.toString()} subtle />
        ))}
      </div>
    </div>
  );
}

function ValidationPanel({ quality }: { quality: { total: number; valid: number; invalid: number; duplicates: number; missingFields: number; invalidAmounts: number } }) {
  return (
    <div className="workbenchPanel">
      <h4>Data Quality Report</h4>
      <p className="workbenchPanelDesc">
        Schema validation checks: duplicates, missing required fields, and invalid amounts.
      </p>
      <div className="dqCardGrid">
        <DQCard label="Total Rows" value={quality.total.toString()} />
        <DQCard label="Valid Rows" value={quality.valid.toString()} accent="green" />
        <DQCard label="Invalid Rows" value={quality.invalid.toString()} accent={quality.invalid > 0 ? "red" : undefined} />
        <DQCard label="Duplicate IDs" value={quality.duplicates.toString()} accent={quality.duplicates > 0 ? "amber" : undefined} />
        <DQCard label="Missing Fields" value={quality.missingFields.toString()} accent={quality.missingFields > 0 ? "amber" : undefined} />
        <DQCard label="Invalid Amounts" value={quality.invalidAmounts.toString()} accent={quality.invalidAmounts > 0 ? "red" : undefined} />
      </div>
    </div>
  );
}

function ClassificationPanel({ breakdown, totalFailures }: { breakdown: { key: string; count: number; amount: number }[]; totalFailures: number }) {
  return (
    <div className="workbenchPanel">
      <h4>Failure Classification Buckets</h4>
      <p className="workbenchPanelDesc">
        {totalFailures} non-successful transactions classified by root-cause pattern.
      </p>
      {breakdown.length === 0 ? (
        <p className="mutedText">No failures to classify. Load data to see classification output.</p>
      ) : (
        <div className="classificationTable">
          <div className="classRow classRowHeader">
            <span>Bucket</span><span>Count</span><span>Lost Revenue</span><span>Share</span>
          </div>
          {breakdown.map((b) => (
            <div key={b.key} className="classRow">
              <span className="classBucket">{b.key.replaceAll("_", " ")}</span>
              <span>{b.count}</span>
              <span className="riskText">{money.format(b.amount)}</span>
              <span>{totalFailures > 0 ? Math.round((b.count / totalFailures) * 100) : 0}%</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function EvaluationPanel({ summary }: { summary: { highProb: number; medProb: number; lowProb: number; highPriority: number } }) {
  return (
    <div className="workbenchPanel">
      <h4>Policy Evaluation Results</h4>
      <p className="workbenchPanelDesc">
        Recovery probability scores and priority flags applied by the deterministic policy engine.
      </p>
      <div className="dqCardGrid">
        <DQCard label="High Probability (≥75%)" value={summary.highProb.toString()} accent="green" />
        <DQCard label="Medium (40–75%)" value={summary.medProb.toString()} accent="amber" />
        <DQCard label="Low (<40%)" value={summary.lowProb.toString()} accent="red" />
        <DQCard label="High Priority Flagged" value={summary.highPriority.toString()} accent="green" />
      </div>
    </div>
  );
}

function QueuePreviewPanel({ items }: { items: Transaction[] }) {
  return (
    <div className="workbenchPanel">
      <h4>Recovery Queue Preview (Top 8)</h4>
      <p className="workbenchPanelDesc">
        Highest-priority items ready for the Recovery Queue page.
      </p>
      {items.length === 0 ? (
        <p className="mutedText">No high-priority items. Load data to populate the queue.</p>
      ) : (
        <div className="queuePreviewList">
          {items.map((tx) => (
            <div key={tx.transaction_id} className="queuePreviewItem">
              <div className="queuePreviewLeft">
                <strong>{tx.customer_name}</strong>
                <small>{maskEmail(tx.customer_email)}</small>
              </div>
              <span className="riskText fontMedium">{money.format(tx.amount)}</span>
              <span className={`probBadge ${(tx.recovery_probability ?? 0) >= 75 ? "probHigh" : "probMed"}`}>
                {tx.recovery_probability ?? 0}%
              </span>
              <span className="queuePreviewAction">{tx.recommended_action}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ── Shared Data Quality Card ── */
function DQCard({ label, value, accent, subtle }: { label: string; value: string; accent?: "green" | "amber" | "red"; subtle?: boolean }) {
  return (
    <div className={`dqCard ${accent ? `dqCard-${accent}` : ""} ${subtle ? "dqCardSubtle" : ""}`}>
      <span className="dqCardLabel">{label}</span>
      <strong className="dqCardValue">{value}</strong>
    </div>
  );
}
