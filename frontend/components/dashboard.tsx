"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  ArrowUpRight,
  ShieldCheck,
  Sparkles,
  Play,
} from "lucide-react";
import type { DashboardData, VerifiedRecoverySummary } from "@/lib/types";
import { loadDashboard, loadVerifiedRecoverySummary } from "@/lib/api";
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
  const [recoverySummary, setRecoverySummary] = useState<VerifiedRecoverySummary | null>(null);
  const [liveLoading, setLiveLoading] = useState(initialData.source !== "api");

  useEffect(() => {
    let active = true;
    Promise.all([loadDashboard(), loadVerifiedRecoverySummary()]).then(([data, summary]) => {
      if (!active) return;
      setDashboardData(data);
      setRecoverySummary(summary);
      setLiveLoading(false);
    });
    return () => { active = false; };
  }, []);

  const awaitingReviewCount = useMemo(() => {
    if (activeDataSource === "demo") {
      return transactions.filter((t) => t.status !== "recovered" && t.amount >= 5000).length;
    }
    return dashboardData.results.filter((r) => r.decision.action === "escalate_human").length;
  }, [activeDataSource, transactions, dashboardData.results]);

  const verifiedRecovery = useMemo((): number | null => {
    if (activeDataSource === "demo") return metrics.revenueRecovered;
    return recoverySummary?.verified_recovery_amount ?? null;
  }, [activeDataSource, metrics.revenueRecovered, recoverySummary]);

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
    if (activeDataSource === "demo") return transactions.slice(0, 3);
    return dashboardData.results.slice(0, 3);
  }, [activeDataSource, dashboardData.results, transactions]);

  const topOpportunityHref = topOpportunity
    ? ("transaction_id" in topOpportunity ? "/queue" : `/case/${topOpportunity.event_id}`)
    : "/queue";

  return (
    <main className="dashboardPage">
      <section className="welcomeHero">
        <div className="welcomeCopy">
          <div className="eyebrow">
            <Sparkles size={13} className="text-primary" />
            <span>RECOVERY DECISION HARNESS</span>
          </div>
          <h1>One safe next step for every failed payment.</h1>
          <p className="welcomeSubtitle">
            Reven sits alongside Razorpay after a signed failure—not in the payment path—to investigate, apply policy, and prove outcomes.
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

      <section className="controlStatus" aria-label="Recovery control status">
        <div className="kpiCard">
          <div className="kpiHeader">
            <span className="kpiLabel">NEEDS A DECISION</span>
            <HelpTooltip topic="human_review" />
          </div>
          <strong className="kpiValue">{awaitingReviewCount} cases</strong>
          <p className="kpiExplainer">
            Uncertain or high-value failures stay with an operator.
          </p>
        </div>
        <div className="kpiCard accentCard">
          <div className="kpiHeader">
            <span className="kpiLabel">PROVIDER-VERIFIED</span>
            <HelpTooltip topic="verified_recovery" />
          </div>
          <strong className="kpiValue recoveryText">
            {verifiedRecovery === null ? "—" : money.format(verifiedRecovery)}
          </strong>
          <p className="kpiExplainer">
            Counted only after a signed Razorpay paid webhook.
          </p>
        </div>
        <div className="harnessPromise">
          <ShieldCheck size={18} />
          <div><span>POLICY BOUNDARY</span><strong>AI can advise. Policy permits. Razorpay verifies.</strong></div>
          <Link href="/rules" className="kpiDetailsLink">View safety rules <ArrowUpRight size={13} /></Link>
        </div>
      </section>

      {topOpportunity && (
        <section className="featuredOpportunitySection">
          <div className="featuredOppCard">
            <div className="featuredOppHeader">
              <div className="flex items-center gap-2">
                <span className="utilityLabel">NEXT CASE TO REVIEW</span>
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
                <Link href={topOpportunityHref} className="button buttonPrimary">
                  <span>Open decision harness</span>
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
            <span className="utilityLabel">RECOVERY QUEUE</span>
            <h2 id="recent-cases-title">Only the cases that need attention</h2>
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
