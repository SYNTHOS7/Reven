"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  ArrowUpRight,
  Sparkles,
  Play,
} from "lucide-react";
import type { DashboardData } from "@/lib/types";
import { loadDashboard } from "@/lib/api";
import { useTransactions } from "@/lib/transaction-context";
import { HelpTooltip } from "./help-tooltip";
import { GuidedDemoModal } from "./guided-demo-modal";
import { StatusBadge } from "./status-badge";

const money = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 0,
});

export function Dashboard({ initialData }: { initialData: DashboardData }) {
  const { metrics, transactions, activeDataSource } = useTransactions();
  const [demoModalOpen, setDemoModalOpen] = useState(false);
  const [dashboardData, setDashboardData] = useState(initialData);
  const [liveLoading, setLiveLoading] = useState(initialData.source !== "api");

  useEffect(() => {
    let active = true;
    loadDashboard().then((data) => {
      if (!active) return;
      setDashboardData(data);
      setLiveLoading(false);
    });
    return () => { active = false; };
  }, []);

  // Compute Home Metrics
  const revenueAtRisk = useMemo(() => {
    if (activeDataSource === "demo") return metrics.revenueLost;
    return dashboardData.results.reduce((sum, r) => sum + (r.amount || 0), 0);
  }, [activeDataSource, metrics.revenueLost, dashboardData.results]);

  const recoverableOpportunity = useMemo(() => {
    if (activeDataSource === "demo") return metrics.potentiallyRecoverableRevenue;
    return dashboardData.results
      .filter((r) => ["retry_later", "create_payment_link", "update_payment_method"].includes(r.decision.action))
      .reduce((sum, r) => sum + (r.amount || 0), 0);
  }, [activeDataSource, metrics.potentiallyRecoverableRevenue, dashboardData.results]);

  const awaitingReviewCount = useMemo(() => {
    if (activeDataSource === "demo") {
      return transactions.filter((t) => t.status !== "recovered" && t.amount >= 5000).length;
    }
    return dashboardData.results.filter((r) => r.decision.action === "escalate_human").length;
  }, [activeDataSource, transactions, dashboardData.results]);

  const verifiedRecovery = useMemo(() => {
    if (activeDataSource === "demo") return metrics.revenueRecovered;
    return dashboardData.results.reduce((sum, r) => sum + (r.verified_recovered_amount || 0), 0);
  }, [activeDataSource, metrics.revenueRecovered, dashboardData.results]);

  // Featured Top Recovery Opportunity
  const topOpportunity = useMemo(() => {
    if (activeDataSource === "demo") {
      return (
        transactions.find(
          (t) => t.status !== "recovered" && t.status !== "successful" && t.is_high_priority
        ) || transactions[0]
      );
    }
    return dashboardData.results[0];
  }, [activeDataSource, transactions, dashboardData.results]);

  const opportunityExplanation = useMemo(() => {
    if (!topOpportunity) return "No recovery opportunity is available yet.";
    if ("transaction_id" in topOpportunity) {
      return `${topOpportunity.failure_reason || "Payment failure"}. ${topOpportunity.recommended_action || "Review this case before taking action."}`;
    }
    return `${topOpportunity.failure_code || "Payment failure"}. ${topOpportunity.decision.reason}`;
  }, [topOpportunity]);

  const recentCases = useMemo(() => {
    if (activeDataSource === "demo") return transactions.slice(0, 5);
    return dashboardData.results.slice(0, 5);
  }, [activeDataSource, dashboardData.results, transactions]);

  return (
    <main className="dashboardPage">
      {/* Calm Top Welcome Section */}
      <section className="welcomeHero">
        <div className="welcomeCopy">
          <div className="eyebrow">
            <Sparkles size={13} className="text-primary" />
            <span>FINANCIAL RECOVERY CONTROL</span>
          </div>
          <h1>Welcome to Reven</h1>
          <p className="welcomeSubtitle">
            Find failed payments, choose safe recovery actions, and verify what comes back.
          </p>
        </div>

        <div className="welcomeActions">
          {activeDataSource === "live" && liveLoading && <span className="dashboardSync">Syncing live Test Mode data…</span>}
          <button
            type="button"
            onClick={() => setDemoModalOpen(true)}
            className="button buttonPrimary guidedDemoBtn"
          >
            <Play size={15} />
            <span>Start guided demo</span>
          </button>
        </div>
      </section>

      {/* Summary answers only: what is at risk, what is actionable, what needs review, what is verified. */}
      <section className="homeSummaryGrid" aria-label="Key revenue metrics">
        {/* 1. Revenue at risk */}
        <div className="kpiCard">
          <div className="kpiHeader">
            <span className="kpiLabel">REVENUE AT RISK</span>
            <HelpTooltip topic="revenue_at_risk" />
          </div>
          <strong className="kpiValue riskText">{money.format(revenueAtRisk)}</strong>
          <p className="kpiExplainer">
            Money from failed or abandoned payments not yet collected.
          </p>
          <div className="kpiCardAction">
            <Link href="/analyse" className="kpiDetailsLink">
              <span>View details</span>
              <ArrowUpRight size={13} />
            </Link>
          </div>
        </div>

        {/* 2. Recoverable opportunity */}
        <div className="kpiCard">
          <div className="kpiHeader">
            <span className="kpiLabel">RECOVERABLE OPPORTUNITY</span>
            <HelpTooltip topic="recoverable_opportunity" />
          </div>
          <strong className="kpiValue warningText">
            {money.format(recoverableOpportunity)}
          </strong>
          <p className="kpiExplainer">
            Estimated value of payments that may be recovered safely.
          </p>
          <div className="kpiCardAction">
            <Link href="/queue" className="kpiDetailsLink">
              <span>View details</span>
              <ArrowUpRight size={13} />
            </Link>
          </div>
        </div>

        {/* 3. Awaiting review */}
        <div className="kpiCard">
          <div className="kpiHeader">
            <span className="kpiLabel">AWAITING REVIEW</span>
            <HelpTooltip topic="human_review" />
          </div>
          <strong className="kpiValue">{awaitingReviewCount} cases</strong>
          <p className="kpiExplainer">
            High-value or uncertain cases requiring human approval.
          </p>
          <div className="kpiCardAction">
            <Link href="/queue" className="kpiDetailsLink">
              <span>View details</span>
              <ArrowUpRight size={13} />
            </Link>
          </div>
        </div>

        {/* 4. Verified recovery */}
        <div className="kpiCard accentCard">
          <div className="kpiHeader">
            <span className="kpiLabel">VERIFIED RECOVERY</span>
            <HelpTooltip topic="verified_recovery" />
          </div>
          <strong className="kpiValue recoveryText">
            {money.format(verifiedRecovery)}
          </strong>
          <p className="kpiExplainer">
            Revenue counted only after Razorpay payment confirmation.
          </p>
          <div className="kpiCardAction">
            <Link href="/evidence" className="kpiDetailsLink">
              <span>View details</span>
              <ArrowUpRight size={13} />
            </Link>
          </div>
        </div>
      </section>

      {/* Featured Current Recovery Opportunity */}
      {topOpportunity && (
        <section className="featuredOpportunitySection">
          <div className="featuredOppCard">
            <div className="featuredOppHeader">
              <div className="flex items-center gap-2">
                <span className="utilityLabel">TOP RECOVERY OPPORTUNITY</span>
                <span className="highPriorityTag">HIGH VALUE</span>
              </div>
              <span className="fontMono text-xs text-text-muted">
                {"transaction_id" in topOpportunity ? topOpportunity.transaction_id : topOpportunity.event_id}
              </span>
            </div>

            <div className="featuredOppBody">
              <div className="featuredOppAmount">
                <span className="oppAmtLabel">Recoverable Amount:</span>
                <strong className="oppAmtValue">{money.format(topOpportunity.amount)}</strong>
                <span className="oppCustomer">
                  {"customer_name" in topOpportunity ? topOpportunity.customer_name : "Student Checkout"}
                </span>
              </div>

              <div className="featuredOppRationale">
                <span className="oppRationaleTitle">Diagnosed Failure &amp; Safe Action:</span>
                <p className="oppRationaleText">
                  {opportunityExplanation}
                </p>
              </div>

              <div className="featuredOppCta">
                <Link href="/queue" className="button buttonPrimary">
                  <span>Review in Recovery Queue</span>
                  <ArrowRight size={14} />
                </Link>
              </div>
            </div>
          </div>
        </section>
      )}

      <section className="recentCasesPanel" aria-labelledby="recent-cases-title">
        <div className="recentCasesHead">
          <div>
            <span className="utilityLabel">RECENT ACTIVITY</span>
            <h2 id="recent-cases-title">Latest recovery cases</h2>
          </div>
          <Link href={activeDataSource === "demo" ? "/queue" : "/evidence"} className="kpiDetailsLink">View all <ArrowUpRight size={13} /></Link>
        </div>
        <div className="recentCasesList">
          {recentCases.map((item) => {
            const isDemo = "transaction_id" in item;
            const caseId = isDemo ? item.transaction_id : item.event_id;
            const action = isDemo ? item.recommended_action || "Needs review" : item.decision.action;
            const reason = isDemo ? item.failure_reason : item.failure_code;
            const href = isDemo ? "/queue" : `/case/${item.event_id}`;
            return (
              <Link className="recentCaseRow" href={href} key={caseId}>
                <div><strong>{money.format(item.amount)}</strong><span>{reason.replaceAll("_", " ")}</span></div>
                <div className="recentCaseAction"><StatusBadge value={action} /><small>{isDemo ? "Simulated scenario" : "Razorpay Test Mode"}</small></div>
                <ArrowRight size={15} />
              </Link>
            );
          })}
          {recentCases.length === 0 && <p className="recentCasesEmpty">No cases yet. Send a Razorpay Test Mode failure to begin the evidence trail.</p>}
        </div>
      </section>

      {/* Guided Demo Modal */}
      <GuidedDemoModal
        isOpen={demoModalOpen}
        onClose={() => setDemoModalOpen(false)}
      />
    </main>
  );
}
