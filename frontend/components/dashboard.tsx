"use client";

import React, { useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  ArrowUpRight,
  Sparkles,
  ShieldCheck,
  Play,
} from "lucide-react";
import type { DashboardData } from "@/lib/types";
import { useTransactions } from "@/lib/transaction-context";
import { HelpTooltip } from "./help-tooltip";
import { FiveStageFlow } from "./five-stage-flow";
import { GuidedDemoModal } from "./guided-demo-modal";

const money = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 0,
});

export function Dashboard({ initialData }: { initialData: DashboardData }) {
  const { metrics, transactions, activeDataSource } = useTransactions();
  const [demoModalOpen, setDemoModalOpen] = useState(false);

  // Compute Home Metrics
  const revenueAtRisk = useMemo(() => {
    if (activeDataSource === "demo") return metrics.revenueLost;
    return initialData.results.reduce((sum, r) => sum + (r.amount || 0), 0);
  }, [activeDataSource, metrics.revenueLost, initialData.results]);

  const recoverableOpportunity = useMemo(() => {
    if (activeDataSource === "demo") return metrics.potentiallyRecoverableRevenue;
    return initialData.results
      .filter((r) => ["retry_later", "create_payment_link", "update_payment_method"].includes(r.decision.action))
      .reduce((sum, r) => sum + (r.amount || 0), 0);
  }, [activeDataSource, metrics.potentiallyRecoverableRevenue, initialData.results]);

  const awaitingReviewCount = useMemo(() => {
    if (activeDataSource === "demo") {
      return transactions.filter((t) => t.status !== "recovered" && t.amount >= 5000).length;
    }
    return initialData.results.filter((r) => r.decision.action === "escalate_human").length;
  }, [activeDataSource, transactions, initialData.results]);

  const verifiedRecovery = useMemo(() => {
    if (activeDataSource === "demo") return metrics.revenueRecovered;
    return initialData.results.reduce((sum, r) => sum + (r.verified_recovered_amount || 0), 0);
  }, [activeDataSource, metrics.revenueRecovered, initialData.results]);

  // Featured Top Recovery Opportunity
  const topOpportunity = useMemo(() => {
    if (activeDataSource === "demo") {
      return (
        transactions.find(
          (t) => t.status !== "recovered" && t.status !== "successful" && t.is_high_priority
        ) || transactions[0]
      );
    }
    return initialData.results[0];
  }, [activeDataSource, transactions, initialData.results]);

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

      {/* Guided Three-Step Action Strip */}
      <section className="guidedStepStrip" aria-label="Guided workflow">
        <Link href="/analyse" className="guidedStepItem">
          <div className="stepNum">1</div>
          <div className="stepContent">
            <strong>Analyse payment data</strong>
            <small>See why checkouts failed &amp; where revenue is lost</small>
          </div>
          <ArrowRight size={14} className="stepArrow" />
        </Link>

        <Link href="/queue" className="guidedStepItem">
          <div className="stepNum">2</div>
          <div className="stepContent">
            <strong>Review recovery opportunities</strong>
            <small>Pick safe actions from the ranked recovery queue</small>
          </div>
          <ArrowRight size={14} className="stepArrow" />
        </Link>

        <Link href="/evidence" className="guidedStepItem">
          <div className="stepNum">3</div>
          <div className="stepContent">
            <strong>Verify recovered revenue</strong>
            <small>Prove recovery through signed Razorpay Test webhooks</small>
          </div>
          <ArrowRight size={14} className="stepArrow" />
        </Link>
      </section>

      {/* Exactly Four Summary Cards with Plain-Language Labels & "View Details" Links */}
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
                  {"failure_reason" in topOpportunity
                    ? `Card limit reached. Recommend 1-Click UPI payment link because customer has not been contacted today.`
                    : topOpportunity.decision.reason}
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

      {/* Reusable Five-Stage Flow Visual */}
      <FiveStageFlow
        title="How Reven Recovers Payments Safely"
        subtitle="Every transaction follows this 5-stage lifecycle to guarantee safety, customer trust, and financial proof."
      />

      {/* Guided Next Step Recommendation Card */}
      <section className="guidedNextStepCard">
        <div className="nextStepContent">
          <div className="nextStepIconWrap">
            <ShieldCheck size={24} className="text-primary" />
          </div>
          <div>
            <h3>What should I do right now?</h3>
            <p>
              {activeDataSource === "demo"
                ? "You are exploring the simulated 500-transaction merchant dataset. Open the Recovery Queue to review recommendations or try the 5-step guided tour."
                : "Live Razorpay Test Mode is active. Check the Evidence tab to inspect cryptographic webhook receipts and live test cases."}
            </p>
          </div>
        </div>
        <div className="nextStepActions">
          <button
            type="button"
            onClick={() => setDemoModalOpen(true)}
            className="button buttonSecondary buttonSmall"
          >
            <Play size={13} />
            <span>Guided Tour</span>
          </button>
          <Link href="/queue" className="button buttonPrimary buttonSmall">
            <span>Open Recovery Queue</span>
            <ArrowRight size={13} />
          </Link>
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
