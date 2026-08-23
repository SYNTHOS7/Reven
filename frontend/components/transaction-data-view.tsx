"use client";

import React, { useRef, useState } from "react";
import {
  AlertCircle,
  ArrowDownToLine,
  CheckCircle2,
  Database,
  FileSpreadsheet,
  FileText,
  Info,
  RefreshCw,
  Search,
  Sparkles,
  Trash2,
  Upload,
} from "lucide-react";
import { useTransactions } from "@/lib/transaction-context";
import type { CSVValidationError, Transaction } from "@/lib/types";

const money = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 0,
});

export function TransactionDataView() {
  const {
    transactions,
    loadDemoDataset,
    resetDemo,
    uploadCsvText,
    downloadSampleCsv,
    isSimulated,
  } = useTransactions();

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [dragActive, setDragActive] = useState(false);
  const [validationErrors, setValidationErrors] = useState<CSVValidationError[]>([]);
  const [uploadSuccess, setUploadSuccess] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [page, setPage] = useState(1);
  const pageSize = 15;

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
      t.customer_email.toLowerCase().includes(q) ||
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

  return (
    <main className="transactionDataPage">
      {/* Simulation Banner */}
      <div className="demoSimulationBanner">
        <div className="demoSimulationContent">
          <Sparkles size={16} className="sparkleIcon" />
          <div>
            <strong>Demo data — simulated, no customer communication is sent.</strong>
            <span>
              Transactions uploaded or seeded here are isolated to the revenue intelligence &amp;
              recovery sandbox. Real payment credentials (card numbers, CVVs, OTPs) are never stored.
            </span>
          </div>
        </div>
      </div>

      <section className="pageIntro">
        <div className="eyebrow">
          <span>01</span> TRANSACTION DATA INGESTION
        </div>
        <h1>
          Merchant Transaction Ledger &amp; <em>CSV Pipeline</em>
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
                    <small className="tableSubText">{tx.customer_email || tx.customer_phone}</small>
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
