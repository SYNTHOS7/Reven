"use client";

import Link from "next/link";
import { Activity, ArrowRight, BrainCircuit, CircleAlert, ShieldCheck, Sparkles } from "lucide-react";

import { useTransactions } from "@/lib/transaction-context";
import { HelpTooltip } from "./help-tooltip";

const money = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 });

export function RevenueIntelligenceView() {
  const { metrics, activeDataSource, setActiveDataSource } = useTransactions();
  const { revenueLost, potentiallyRecoverableRevenue, revenueRecovered, failureReasonStats, highPriorityOpportunities } = metrics;
  const leadingPattern = failureReasonStats[0];
  const topAmount = highPriorityOpportunities.reduce((sum, item) => sum + item.amount, 0);
  const sourceName = activeDataSource === "demo" ? "simulated 500-transaction merchant scenario" : "Razorpay Test Mode evidence";

  return (
    <main className="revenueIntelligencePage cleanAnalysePage">
      <div className="sourceIndicatorStrip">
        <div className="sourceIndicatorLeft">
          <span className="sourcePillTitle">ANALYSING:</span>
          <span className={`sourceIndicatorBadge ${activeDataSource === "demo" ? "badgeDemo" : "badgeLive"}`}>
            {activeDataSource === "demo" ? <><Sparkles size={13} /> SIMULATED MERCHANT DATA</> : <><span className="liveDot" /> RAZORPAY TEST MODE</>}
          </span>
          <HelpTooltip topic={activeDataSource === "demo" ? "demo_scenario" : "live_test_mode"} />
        </div>
        <div className="toggleSwitchGroup">
          <button type="button" onClick={() => setActiveDataSource("demo")} className={`toggleSwitchBtn ${activeDataSource === "demo" ? "activeToggle" : ""}`}>Demo scenario</button>
          <button type="button" onClick={() => setActiveDataSource("live")} className={`toggleSwitchBtn ${activeDataSource === "live" ? "activeToggle" : ""}`}>Live Test Mode</button>
        </div>
      </div>

      <section className="pageIntro">
        <div className="eyebrow"><span>02</span> MERCHANT BRIEFING</div>
        <h1>What should this merchant fix first?</h1>
        <p>One concise recovery view. Raw records and CSV tools live separately in <Link href="/data">Data</Link>.</p>
      </section>

      <section className="merchantBrief" aria-labelledby="merchant-brief-title">
        <div className="merchantBriefIcon"><BrainCircuit size={22} /></div>
        <div>
          <span className="utilityLabel">RECOVERY BRIEFING · {activeDataSource === "demo" ? "SIMULATED" : "LIVE EVIDENCE"}</span>
          <h2 id="merchant-brief-title">{leadingPattern ? `${leadingPattern.label} is the largest visible leakage pattern.` : "No failure pattern is available yet."}</h2>
          <p>
            In this {sourceName}, {leadingPattern ? `${leadingPattern.count} cases account for ${money.format(leadingPattern.lostAmount)} of lost revenue.` : "send a failed payment event to begin analysis."}
            {highPriorityOpportunities.length > 0 ? ` ${highPriorityOpportunities.length} cases worth ${money.format(topAmount)} are ready for a policy-bounded review.` : ""}
          </p>
        </div>
        <Link href="/queue" className="button buttonPrimary buttonSmall">Review opportunities <ArrowRight size={14} /></Link>
      </section>

      <section className="analyseFocusGrid" aria-label="Merchant recovery summary">
        <article className="analyseFocusCard"><span>REVENUE LEAKAGE</span><strong className="riskText">{money.format(revenueLost)}</strong><p>Failed or abandoned payment value not yet collected.</p></article>
        <article className="analyseFocusCard"><span>SAFE OPPORTUNITY</span><strong className="warningText">{money.format(potentiallyRecoverableRevenue)}</strong><p>Value that can enter the Recovery Queue under current rules.</p></article>
        <article className="analyseFocusCard accent"><span>VERIFIED RECOVERY</span><strong className="recoveryText">{money.format(revenueRecovered)}</strong><p>Only counted after an attributed, confirmed outcome.</p></article>
      </section>

      <section className="analyseDecisionGrid">
        <article className="analysisCard">
          <div className="cardHeading"><div><span className="utilityLabel">WHY PAYMENTS FAIL</span><h2>Top leakage patterns</h2></div><Activity size={18} /></div>
          <div className="briefPatternList">
            {failureReasonStats.slice(0, 4).map((item) => <div className="briefPattern" key={item.reason}>
              <div><strong>{item.label}</strong><span>{item.count} cases · {item.percentage}% of failure volume</span></div>
              <b className="riskText">{money.format(item.lostAmount)}</b>
            </div>)}
          </div>
          <Link href="/data" className="subtleLink">Inspect raw data and validation <ArrowRight size={13} /></Link>
        </article>

        <article className="analysisCard actionCard">
          <div className="cardHeading"><div><span className="utilityLabel">SAFE NEXT MOVE</span><h2>Use the Recovery Queue</h2></div><ShieldCheck size={18} /></div>
          <p>Reven does not turn every failure into a message or payment link. Open the ranked queue to see the allowed action and the reason for each case.</p>
          <div className="actionCardRule"><CircleAlert size={15} /> AI investigates evidence; policy independently permits or blocks action.</div>
          <Link href="/queue" className="button buttonSecondary">Open Recovery Queue <ArrowRight size={14} /></Link>
        </article>
      </section>
    </main>
  );
}
