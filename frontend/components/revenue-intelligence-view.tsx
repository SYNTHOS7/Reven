"use client";

import React, { useState, useRef } from "react";
import Link from "next/link";
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  CheckCircle,
  Percent,
  Sparkles,
  Upload,
  Layers,
  ArrowDownToLine,
  RefreshCw,
  Search,
} from "lucide-react";
import { useTransactions } from "@/lib/transaction-context";
import { HelpTooltip } from "./help-tooltip";
import { maskEmail } from "@/lib/utils";
import type { CSVValidationError } from "@/lib/types";

const money = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 0,
});

export function RevenueIntelligenceView() {
  const {
    metrics,
    transactions,
    activeDataSource,
    setActiveDataSource,
    loadDemoDataset,
    resetDemo,
    uploadCsvText,
    downloadSampleCsv,
  } = useTransactions();

  const [activeTab, setActiveTab] = useState<"patterns" | "workbench">("patterns");
  const [hoveredPoint, setHoveredPoint] = useState<number | null>(null);
  const [selectedReason, setSelectedReason] = useState<string | null>(null);

  // Workbench / CSV state
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [dragActive, setDragActive] = useState(false);
  const [validationErrors, setValidationErrors] = useState<CSVValidationError[]>([]);
  const [uploadSuccess, setUploadSuccess] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const pageSize = 15;

  const {
    totalAttemptedRevenue,
    revenueCollected,
    revenueLost,
    potentiallyRecoverableRevenue,
    revenueRecovered,
    recoveryRatePct,
    affectedCustomersCount,
    failureReasonStats,
    recoveryTrends,
    highPriorityOpportunities,
  } = metrics;

  const maxTrendVal = Math.max(
    ...recoveryTrends.map((t) => Math.max(t.attempted, t.lost + t.recovered)),
    1000
  );

  function handleFile(file: File) {
    setValidationErrors([]);
    setUploadSuccess(null);

    if (!file.name.endsWith(".csv")) {
      setValidationErrors([{ row: 0, message: "Please select a valid .csv file." }]);
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

  const filtered = transactions.filter((t) => {
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

  return (
    <main className="revenueIntelligencePage">
      {/* Top Source Mode Strip with Plain-Language Tooltips */}
      <div className="sourceIndicatorStrip">
        <div className="sourceIndicatorLeft">
          <span className="sourcePillTitle">ENVIRONMENT:</span>
          {activeDataSource === "demo" ? (
            <span className="sourceIndicatorBadge badgeDemo">
              <Sparkles size={13} /> SIMULATED MERCHANT DATA (500 TRANSACTIONS)
            </span>
          ) : (
            <span className="sourceIndicatorBadge badgeLive">
              <span className="liveDot" /> LIVE RAZORPAY TEST MODE
            </span>
          )}
          <HelpTooltip
            topic={activeDataSource === "demo" ? "demo_scenario" : "live_test_mode"}
            customText={
              activeDataSource === "demo"
                ? "A fictional 500-transaction merchant dataset used to show business-scale recovery intelligence. No customer is contacted."
                : "Real Razorpay Test Mode webhook evidence. Cryptographically signed receipts, no real money is moved."
            }
          />
        </div>

        <div className="sourceIndicatorRight">
          <div className="toggleSwitchGroup">
            <button
              type="button"
              onClick={() => setActiveDataSource("demo")}
              className={`toggleSwitchBtn ${activeDataSource === "demo" ? "activeToggle" : ""}`}
            >
              <Sparkles size={12} /> Simulated Demo
            </button>
            <button
              type="button"
              onClick={() => setActiveDataSource("live")}
              className={`toggleSwitchBtn ${activeDataSource === "live" ? "activeToggle" : ""}`}
            >
              <span className="liveDot" /> Live Test Mode
            </button>
          </div>
        </div>
      </div>

      <section className="pageIntro">
        <div className="eyebrow">
          <span>02</span> FINANCIAL LEAKAGE ANALYSIS
        </div>
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1>Where revenue is being lost</h1>
            <p>
              Understand failure patterns, discover recoverable revenue, and analyze payment drop-offs across payment methods.
            </p>
          </div>

          {/* Tab navigation */}
          <div className="tabButtonGroup">
            <button
              type="button"
              onClick={() => setActiveTab("patterns")}
              className={`tabButton ${activeTab === "patterns" ? "activeTab" : ""}`}
            >
              <Activity size={14} />
              <span>Leakage &amp; Patterns</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("workbench")}
              className={`tabButton ${activeTab === "workbench" ? "activeTab" : ""}`}
            >
              <Layers size={14} />
              <span>Data Ingestion &amp; CSV</span>
            </button>
          </div>
        </div>
      </section>

      {/* Primary KPI Summary Cards */}
      <section className="financialKpiGrid" aria-label="Financial impact summary">
        {/* Total Attempted */}
        <div className="kpiCard">
          <div className="kpiHeader">
            <span className="kpiLabel">TOTAL ATTEMPTED REVENUE</span>
            <Activity size={16} className="kpiIcon" />
          </div>
          <strong className="kpiValue">{money.format(totalAttemptedRevenue)}</strong>
          <div className="kpiFooter">
            <span>Gross checkout intent</span>
          </div>
        </div>

        {/* Revenue Collected */}
        <div className="kpiCard">
          <div className="kpiHeader">
            <span className="kpiLabel">REVENUE COLLECTED</span>
            <CheckCircle size={16} className="kpiIcon" />
          </div>
          <strong className="kpiValue">{money.format(revenueCollected)}</strong>
          <div className="kpiFooter">
            <span>First-pass successful payments</span>
          </div>
        </div>

        {/* Revenue Lost */}
        <div className="kpiCard kpiCard-lost">
          <div className="kpiHeader">
            <span className="kpiLabel">REVENUE LOST</span>
            <HelpTooltip topic="revenue_at_risk" />
          </div>
          <strong className="kpiValue riskText">{money.format(revenueLost)}</strong>
          <div className="kpiFooter">
            <span className="riskText">{affectedCustomersCount} affected customers</span>
          </div>
        </div>

        {/* Potentially Recoverable */}
        <div className="kpiCard kpiCard-recoverable">
          <div className="kpiHeader">
            <span className="kpiLabel">RECOVERABLE OPPORTUNITY</span>
            <HelpTooltip topic="recoverable_opportunity" />
          </div>
          <strong className="kpiValue warningText">{money.format(potentiallyRecoverableRevenue)}</strong>
          <div className="kpiFooter">
            <span>High &amp; medium probability cases</span>
          </div>
        </div>

        {/* Revenue Recovered */}
        <div className="kpiCard kpiCard-recovered accentCard">
          <div className="kpiHeader">
            <span className="kpiLabel">REVENUE RECOVERED</span>
            <HelpTooltip topic="verified_recovery" />
          </div>
          <strong className="kpiValue recoveryText">{money.format(revenueRecovered)}</strong>
          <div className="kpiFooter">
            <span className="recoveryText">Simulated attributed recovery</span>
          </div>
        </div>

        {/* Recovery Rate */}
        <div className="kpiCard kpiCard-rate">
          <div className="kpiHeader">
            <span className="kpiLabel">RECOVERY RATE</span>
            <Percent size={16} className="kpiIcon" />
          </div>
          <strong className="kpiValue recoveryText">{recoveryRatePct}%</strong>
          <div className="kpiFooter">
            <span>Of total payment drop volume</span>
          </div>
        </div>
      </section>

      {/* Tab 1: Patterns & Trends */}
      {activeTab === "patterns" && (
        <>
          <section className="analyticsSplitSection">
            {/* Left Column: Failure Reasons Breakdown */}
            <div className="analyticsCard failureChartCard">
              <div className="cardHeading">
                <div>
                  <span className="utilityLabel">ROOT CAUSE BREAKDOWN</span>
                  <h2>Failure Reasons &amp; Lost Revenue Share</h2>
                </div>
                <span className="pillTag warningPill">Card declines dominant</span>
              </div>
              <p className="cardSubtext">
                Card declines and limits account for the largest revenue loss. Offering an alternative 1-click UPI Intent link recovers up to 78% of these drop-offs.
              </p>

              <div className="failureReasonList">
                {failureReasonStats.map((item) => {
                  const isSelected = selectedReason === item.reason;
                  return (
                    <div
                      key={item.reason}
                      className={`failureRow ${isSelected ? "failureRowSelected" : ""}`}
                      onClick={() => setSelectedReason(isSelected ? null : item.reason)}
                    >
                      <div className="failureRowHeader">
                        <div className="failureReasonTitle">
                          <strong>{item.label}</strong>
                          {item.isCardPattern && <span className="cardPatternBadge">CARD PATTERN</span>}
                        </div>
                        <div className="failureRowAmount">
                          <span className="countBadge">{item.count} cases</span>
                          <strong className="riskText">{money.format(item.lostAmount)}</strong>
                          <span className="percentageBadge">{item.percentage}%</span>
                        </div>
                      </div>

                      {/* Visual Progress Bar */}
                      <div className="progressBarTrack">
                        <div
                          className={`progressBarFill ${item.isCardPattern ? "barCard" : "barOther"}`}
                          style={{ width: `${Math.max(item.percentage, 4)}%` }}
                        />
                      </div>

                      {/* Recommended Alternative Drawer */}
                      <div className="alternativeHint">
                        <span className="alternativeLabel">Recommended Intervention:</span>
                        <span className="alternativeText">{item.recommendedAlternative}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Right Column: 14-Day Recovery Trend Chart */}
            <div className="analyticsCard trendChartCard">
              <div className="cardHeading">
                <div>
                  <span className="utilityLabel">RECOVERY TIMELINE</span>
                  <h2>14-Day Revenue &amp; Recovery Trend</h2>
                </div>
                <span className="pillTag recoveryPill">Daily Cohort</span>
              </div>
              <p className="cardSubtext">
                Tracking attempted checkouts (white), unrecovered losses (amber/red), and simulated recovered revenue (emerald) over time.
              </p>

              <div className="trendChartContainer">
                <div className="trendChartLegend">
                  <div className="legendItem">
                    <span className="legendDot dotAttempted" />
                    <span>Attempted</span>
                  </div>
                  <div className="legendItem">
                    <span className="legendDot dotLost" />
                    <span>Lost Revenue</span>
                  </div>
                  <div className="legendItem">
                    <span className="legendDot dotRecovered" />
                    <span>Recovered</span>
                  </div>
                </div>

                <div className="trendBarsGrid">
                  {recoveryTrends.map((pt, idx) => {
                    const isHovered = hoveredPoint === idx;
                    const hAttempted = Math.max(12, (pt.attempted / maxTrendVal) * 160);
                    const hLost = (pt.lost / maxTrendVal) * 160;
                    const hRecovered = (pt.recovered / maxTrendVal) * 160;

                    return (
                      <div
                        key={pt.date}
                        className="trendBarColumn"
                        onMouseEnter={() => setHoveredPoint(idx)}
                        onMouseLeave={() => setHoveredPoint(null)}
                      >
                        {isHovered && (
                          <div className="barTooltip">
                            <div className="tooltipDate">{pt.date}</div>
                            <div className="tooltipRow">
                              <span>Attempted:</span>
                              <strong>{money.format(pt.attempted)}</strong>
                            </div>
                            <div className="tooltipRow riskText">
                              <span>Lost:</span>
                              <strong>{money.format(pt.lost)}</strong>
                            </div>
                            <div className="tooltipRow recoveryText">
                              <span>Recovered:</span>
                              <strong>{money.format(pt.recovered)}</strong>
                            </div>
                          </div>
                        )}
                        <div className="barsStack">
                          <div className="barAttempted" style={{ height: `${hAttempted}px` }}>
                            <div className="barLost" style={{ height: `${hLost}px` }} />
                            <div className="barRecovered" style={{ height: `${hRecovered}px` }} />
                          </div>
                        </div>
                        <span className="barLabel">{pt.date.split(" ")[0]}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </section>

          {/* Quick CTA to Queue */}
          <section className="opportunityCalloutCard">
            <div>
              <span className="utilityLabel">ACTIONABLE OPPORTUNITIES</span>
              <h3>Ready to recover payment drop-offs?</h3>
              <p>
                {highPriorityOpportunities.length} high-priority carts worth{" "}
                <strong>
                  {money.format(
                    highPriorityOpportunities.reduce((acc, t) => acc + t.amount, 0)
                  )}
                </strong>{" "}
                are ready for safe recovery in the Recovery Queue.
              </p>
            </div>
            <Link href="/queue" className="button buttonPrimary">
              <span>Open Recovery Queue</span>
              <ArrowRight size={15} />
            </Link>
          </section>
        </>
      )}

      {/* Tab 2: Data Ingestion & CSV Workbench */}
      {activeTab === "workbench" && (
        <section className="workbenchTabSection">
          {/* Action Bar */}
          <div className="workbenchActionsBar">
            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={loadDemoDataset}
                className="button buttonPrimary buttonSmall"
              >
                <Sparkles size={14} />
                <span>Load 500-Transaction Demo</span>
              </button>
              <button
                type="button"
                onClick={resetDemo}
                className="button buttonSecondary buttonSmall"
              >
                <RefreshCw size={13} />
                <span>Reset Demo</span>
              </button>
              <button
                type="button"
                onClick={downloadSampleCsv}
                className="button buttonSecondary buttonSmall"
              >
                <ArrowDownToLine size={14} />
                <span>Download Sample CSV Template</span>
              </button>
            </div>
          </div>

          {/* File Upload Dropzone */}
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
            <div className="dropzoneContent">
              <div className="dropzoneIconWrap">
                <Upload size={24} />
              </div>
              <h3>Drop your transaction CSV here or click to browse</h3>
              <p>Supported columns: transaction_id, customer_name, customer_email, amount, status, failure_reason, payment_method, attempted_at</p>
            </div>
          </div>

          {/* Validation Feedback */}
          {validationErrors.length > 0 && (
            <div className="validationErrorBox" role="alert">
              <div className="errorBoxHeader">
                <AlertTriangle size={16} />
                <strong>CSV Validation Errors ({validationErrors.length})</strong>
              </div>
              <ul className="errorList">
                {validationErrors.slice(0, 5).map((err, i) => (
                  <li key={i}>
                    {err.row > 0 ? `Row ${err.row}: ` : ""}
                    {err.message}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {uploadSuccess && (
            <div className="notificationBanner notification-success" role="status">
              <div className="notificationContent">
                <span>{uploadSuccess}</span>
                <button onClick={() => setUploadSuccess(null)} className="closeNotifBtn">
                  ×
                </button>
              </div>
            </div>
          )}

          {/* Raw Ingestion Table */}
          <div className="eventsSection mt-6">
            <div className="eventsHeader">
              <div>
                <span className="utilityLabel">INGESTED TRANSACTIONS</span>
                <h2>Raw Transaction Rows ({filtered.length})</h2>
              </div>
              <label className="searchBox">
                <Search size={15} />
                <input
                  value={query}
                  onChange={(e) => {
                    setQuery(e.target.value);
                    setPage(1);
                  }}
                  placeholder="Filter by customer, ID, reason..."
                />
              </label>
            </div>

            <div className="tableWrap">
              <table>
                <thead>
                  <tr>
                    <th>ID</th>
                    <th>Customer</th>
                    <th>Amount</th>
                    <th>Method</th>
                    <th>Status</th>
                    <th>Failure Reason</th>
                  </tr>
                </thead>
                <tbody>
                  {paginated.length === 0 && (
                    <tr>
                      <td colSpan={6} className="emptyTable">
                        No transactions found.
                      </td>
                    </tr>
                  )}
                  {paginated.map((tx) => (
                    <tr key={tx.transaction_id}>
                      <td className="fontMono text-[11px]">{tx.transaction_id}</td>
                      <td>
                        <strong>{tx.customer_name}</strong>
                        <small className="block text-text-muted text-[10px]">{maskEmail(tx.customer_email)}</small>
                      </td>
                      <td className="number fontMedium">{money.format(tx.amount)}</td>
                      <td>{tx.payment_method}</td>
                      <td>
                        <span className={`statusPill statusPill-${tx.status}`}>{tx.status}</span>
                      </td>
                      <td>{tx.failure_reason.replaceAll("_", " ")}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {totalPages > 1 && (
              <div className="paginationBar">
                <button
                  type="button"
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="button buttonSecondary buttonSmall"
                >
                  Previous
                </button>
                <span>Page {page} of {totalPages}</span>
                <button
                  type="button"
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                  className="button buttonSecondary buttonSmall"
                >
                  Next
                </button>
              </div>
            )}
          </div>
        </section>
      )}
    </main>
  );
}
