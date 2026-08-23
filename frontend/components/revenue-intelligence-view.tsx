"use client";

import React, { useState } from "react";
import Link from "next/link";
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  ArrowUpRight,
  CheckCircle,
  Percent,
  Sparkles,
  TrendingUp,
  Users,
  Zap,
} from "lucide-react";
import { useTransactions } from "@/lib/transaction-context";

const money = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 0,
});

export function RevenueIntelligenceView() {
  const {
    metrics,
    activeDataSource,
    setActiveDataSource,
  } = useTransactions();

  const [hoveredPoint, setHoveredPoint] = useState<number | null>(null);
  const [selectedReason, setSelectedReason] = useState<string | null>(null);

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

  // Max value for trend scaling
  const maxTrendVal = Math.max(
    ...recoveryTrends.map((t) => Math.max(t.attempted, t.lost + t.recovered)),
    1000
  );

  return (
    <main className="revenueIntelligencePage">
      {/* Top Source Mode Strip */}
      <div className="sourceIndicatorStrip">
        <div className="sourceIndicatorLeft">
          <span className="sourcePillTitle">ACTIVE TELEMETRY SOURCE:</span>
          {activeDataSource === "demo" ? (
            <span className="sourceIndicatorBadge badgeDemo">
              <Sparkles size={13} /> SIMULATED DEMO DATA (500 TRANSACTIONS)
            </span>
          ) : (
            <span className="sourceIndicatorBadge badgeLive">
              <span className="liveDot" /> LIVE RAZORPAY TEST MODE (SIGNED WEBHOOKS)
            </span>
          )}
        </div>
        <div className="sourceIndicatorRight">
          <span className="sourceNoticeText">
            {activeDataSource === "demo"
              ? "Simulated dataset — no real customer messages are sent."
              : "Live test ledger — backed by cryptographic Razorpay signatures."}
          </span>
          <div className="toggleSwitchGroup">
            <button
              type="button"
              onClick={() => setActiveDataSource("demo")}
              className={`toggleSwitchBtn ${activeDataSource === "demo" ? "activeToggle" : ""}`}
            >
              Simulated Demo
            </button>
            <button
              type="button"
              onClick={() => setActiveDataSource("live")}
              className={`toggleSwitchBtn ${activeDataSource === "live" ? "activeToggle" : ""}`}
            >
              Live Razorpay
            </button>
          </div>
        </div>
      </div>

      <section className="pageIntro">
        <div className="eyebrow">
          <span>02</span> FINANCIAL IMPACT ENGINE
        </div>
        <h1>
          Revenue Intelligence &amp; <em>Leakage Analysis</em>
        </h1>
        <p>
          Gain crystal-clear visibility into revenue attempted, lost to payment drops, and recovered
          through policy-safe interventions.
        </p>
      </section>

      {/* Primary KPI Hero Metrics Grid */}
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
            <AlertTriangle size={16} className="kpiIcon riskIcon" />
          </div>
          <strong className="kpiValue riskText">{money.format(revenueLost)}</strong>
          <div className="kpiFooter">
            <span className="riskText">{affectedCustomersCount} affected customers</span>
          </div>
        </div>

        {/* Potentially Recoverable */}
        <div className="kpiCard kpiCard-recoverable">
          <div className="kpiHeader">
            <span className="kpiLabel">POTENTIALLY RECOVERABLE</span>
            <Zap size={16} className="kpiIcon warningIcon" />
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
            <Sparkles size={16} className="kpiIcon recoveryIcon" />
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

      {/* Visual Analytics & Breakdown Section */}
      <section className="analyticsSplitSection">
        {/* Left Column: Failure Reasons Chart */}
        <div className="analyticsCard failureChartCard">
          <div className="cardHeading">
            <div>
              <span className="utilityLabel">ROOT CAUSE BREAKDOWN</span>
              <h2>Failure Reasons &amp; Lost Revenue Share</h2>
            </div>
            <span className="pillTag warningPill">Card drops dominant</span>
          </div>
          <p className="cardSubtext">
            Card declines and limits account for the largest revenue loss. Offering 1-click UPI
            recovers up to 78% of these drop-offs.
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

        {/* Right Column: Recovery Trend Chart */}
        <div className="analyticsCard trendChartCard">
          <div className="cardHeading">
            <div>
              <span className="utilityLabel">RECOVERY TIMELINE</span>
              <h2>14-Day Revenue &amp; Recovery Trend</h2>
            </div>
            <span className="pillTag recoveryPill">Daily Cohort</span>
          </div>
          <p className="cardSubtext">
            Tracking attempted checkouts (white), unrecovered losses (amber/red), and simulated
            recovered revenue (emerald) over time.
          </p>

          {/* SVG Trend Chart */}
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
                <span>Simulated Recovered</span>
              </div>
            </div>

            {/* Custom Interactive SVG Chart */}
            <div className="trendBarsGrid">
              {recoveryTrends.map((pt, idx) => {
                const heightAttempted = Math.max(12, (pt.attempted / maxTrendVal) * 160);
                const heightLost = (pt.lost / maxTrendVal) * 160;
                const heightRecovered = (pt.recovered / maxTrendVal) * 160;
                const isHovered = hoveredPoint === idx;

                return (
                  <div
                    key={pt.date}
                    className="trendBarColumn"
                    onMouseEnter={() => setHoveredPoint(idx)}
                    onMouseLeave={() => setHoveredPoint(null)}
                  >
                    {/* Tooltip */}
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

                    <div className="stackedBar">
                      <div
                        className="barSegment barAttempted"
                        style={{ height: `${heightAttempted}px` }}
                      >
                        <div
                          className="barSegment barLost"
                          style={{ height: `${heightLost}px` }}
                        />
                        <div
                          className="barSegment barRecovered"
                          style={{ height: `${heightRecovered}px` }}
                        />
                      </div>
                    </div>
                    <span className="barLabel">{pt.date.slice(8, 10)} Aug</span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Quick Insights Box */}
          <div className="trendInsightsBox">
            <div className="insightItem">
              <Users size={14} className="insightIcon" />
              <div>
                <strong>{affectedCustomersCount} Unique Students Impacted</strong>
                <small>High intent checkout drops ready for automated outreach</small>
              </div>
            </div>
            <div className="insightItem">
              <TrendingUp size={14} className="insightIcon recoveryText" />
              <div>
                <strong>₹{potentiallyRecoverableRevenue.toLocaleString("en-IN")} Addressable Pipeline</strong>
                <small>Recoverable via WhatsApp 1-click UPI links and smart retries</small>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* High-Priority Opportunities Deck */}
      <section className="highPrioritySection">
        <div className="eventsHeader">
          <div>
            <span className="utilityLabel recoveryText">ACTIONABLE PIPELINE</span>
            <h2>Top High-Priority Recovery Opportunities</h2>
          </div>
          <Link href="/queue" className="button buttonOutline">
            Open Recovery Queue <ArrowRight size={14} />
          </Link>
        </div>

        <div className="tableWrap">
          <table>
            <thead>
              <tr>
                <th>Customer</th>
                <th>Amount</th>
                <th>Payment Method</th>
                <th>Failure Reason</th>
                <th>Likely Root Cause</th>
                <th>Recovery Probability</th>
                <th>Recommended Intervention</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {highPriorityOpportunities.length === 0 && (
                <tr>
                  <td colSpan={8} className="emptyTable">
                    No high-priority opportunities pending. All critical items have been processed.
                  </td>
                </tr>
              )}
              {highPriorityOpportunities.slice(0, 8).map((tx, idx) => (
                <tr key={tx.transaction_id} style={{ "--row-index": idx } as React.CSSProperties}>
                  <td>
                    <strong>{tx.customer_name}</strong>
                    <small className="tableSubText">{tx.customer_email}</small>
                  </td>
                  <td className="number fontMedium riskText">{money.format(tx.amount)}</td>
                  <td>
                    <span className="methodBadge">{tx.payment_method}</span>
                  </td>
                  <td>
                    <span className="failureReasonTag">{tx.failure_reason.replaceAll("_", " ")}</span>
                  </td>
                  <td className="causeCell">
                    <span>{tx.likely_root_cause}</span>
                  </td>
                  <td>
                    <div className="probabilityBarContainer">
                      <div
                        className="probabilityBarFill"
                        style={{ width: `${tx.recovery_probability || 50}%` }}
                      />
                      <span className="probabilityText">{tx.recovery_probability}%</span>
                    </div>
                  </td>
                  <td>
                    <span className="recommendationText">{tx.recommended_action}</span>
                  </td>
                  <td>
                    <Link
                      href={`/queue?highlight=${tx.transaction_id}`}
                      className="button buttonSmall buttonPrimary"
                    >
                      Inspect <ArrowUpRight size={13} />
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}
