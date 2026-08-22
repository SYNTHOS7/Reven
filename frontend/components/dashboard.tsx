"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ArrowUpRight, RefreshCcw, Search, ShieldCheck } from "lucide-react";

import { runEvaluation } from "@/lib/api";
import type { DashboardData } from "@/lib/types";
import { formatConfidence } from "@/lib/confidence";
import { getWhyThisAction } from "@/lib/utils";
import { Button } from "./ui/button";
import { DecisionInspector } from "./decision-inspector";
import { PipelineRail } from "./pipeline-rail";
import { RecoveryCommandDeck } from "./recovery-command-deck";
import { RecoveryIntelligence } from "./recovery-intelligence";
import { StatusBadge } from "./status-badge";

const money = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 });

export function Dashboard({ initialData }: { initialData: DashboardData }) {
  const [data, setData] = useState(initialData);
  const [running, setRunning] = useState(false);
  const [query, setQuery] = useState("");
  const [notice, setNotice] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const term = query.toLowerCase().trim();
    if (!term) return data.results;
    return data.results.filter((result) =>
      [result.event_id, result.customer_name, result.failure_code, result.decision.action]
        .join(" ")
        .toLowerCase()
        .includes(term),
    );
  }, [data.results, query]);

  const outcomeMatrix = useMemo(() => {
    const safeActions = data.results.filter((r) =>
      ["retry_later", "create_payment_link", "update_payment_method"].includes(r.decision.action),
    ).length;
    const humanReviews = data.results.filter((r) => r.decision.action === "escalate_human").length;
    const policyBlocks = data.results.filter((r) =>
      ["stop_limit_reached", "refuse_suspicious"].includes(r.decision.action),
    ).length;
    const awaitingPayment = data.results.filter(
      (r) => r.razorpay_payment_link_id && r.verified_recovered_amount === 0,
    ).length;
    const verifiedRecoveries = data.results.filter((r) => r.verified_recovered_amount > 0).length;

    return { safeActions, humanReviews, policyBlocks, awaitingPayment, verifiedRecoveries };
  }, [data.results]);

  async function handleRun() {
    setRunning(true);
    setNotice(null);
    try {
      setData(await runEvaluation());
      setNotice("Evaluation complete. The ledger now reflects the latest run.");
    } catch {
      setNotice("The recovery API could not complete the run. Check the backend URL and service health.");
    } finally {
      setRunning(false);
    }
  }

  const score = data.scorecard;
  const connected = data.source === "api";
  const hasData = score.total_cases > 0;

  return (
    <main className="dashboardPage">
      <section className="hero">
        <div className="heroCopy">
          <div className="eyebrow"><span>03</span> AI REVENUE RECOVERY</div>
          <h1>Revenue recovery,<br /><em>under control.</em></h1>
          <p>Detect lost revenue. Refuse unsafe actions. Prove every decision against human-reviewed evidence.</p>
          <div className="proofStrip" aria-label="Reven operating principles">
            <span>Webhook-led</span><span>Human-guarded</span><span>Verified attribution</span>
          </div>
          <div className="heroSignal" aria-hidden="true"><span>05</span><small>control stages</small></div>
        </div>
        <div className="runPanel">
          <div>
            <span className="utilityLabel">LATEST EVALUATION</span>
            <strong>{connected ? new Date(score.run_at).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" }) : "Backend not connected"}</strong>
            <small>{connected ? `RUN ${score.id.slice(0, 12)} · ${score.data_source.toUpperCase()}` : "SET NEXT_PUBLIC_API_URL IN VERCEL"}</small>
          </div>
          <Button onClick={handleRun} disabled={running || !connected}>
            <RefreshCcw size={15} className={running ? "spin" : ""} />
            {running ? "Running pipeline" : "Run evaluation"}
          </Button>
          <span className="modeLabel">{connected ? "RAZORPAY TEST MODE" : "BACKEND DISCONNECTED"}</span>
        </div>
      </section>

      <PipelineRail running={running} />
      {notice && <div className="notice" role="status">{notice}</div>}

      <RecoveryIntelligence />

      <DecisionInspector results={data.results} policy={score.policy_snapshot} />

      <RecoveryCommandDeck results={data.results} policy={score.policy_snapshot} connected={connected} />

      {/* Outcome Matrix */}
      <section className="outcomeMatrixSection" aria-label="Recovery outcome matrix">
        <div className="outcomeMatrixHeader">
          <div>
            <span className="utilityLabel">OUTCOME MATRIX</span>
            <h2>Real-time Action Distribution</h2>
          </div>
          <span className="matrixBadge">RAZORPAY TEST MODE</span>
        </div>
        <div className="matrixGrid">
          <div className="matrixCard">
            <span className="matrixCount">{outcomeMatrix.safeActions}</span>
            <span className="matrixLabel">Safe Automated Actions</span>
            <small>Within policy bounds</small>
          </div>
          <div className="matrixCard">
            <span className="matrixCount warningText">{outcomeMatrix.humanReviews}</span>
            <span className="matrixLabel">Human Reviews</span>
            <small>Uncertainty or high amount</small>
          </div>
          <div className="matrixCard">
            <span className="matrixCount riskText">{outcomeMatrix.policyBlocks}</span>
            <span className="matrixLabel">Policy Blocks</span>
            <small>Retries or contact capped</small>
          </div>
          <div className="matrixCard">
            <span className="matrixCount">{outcomeMatrix.awaitingPayment}</span>
            <span className="matrixLabel">Awaiting Payment</span>
            <small>Payment link created</small>
          </div>
          <div className="matrixCard accentCard">
            <span className="matrixCount recoveryText">{outcomeMatrix.verifiedRecoveries}</span>
            <span className="matrixLabel">Verified Recoveries</span>
            <small>Paid webhook confirmed</small>
          </div>
        </div>
      </section>

      <section className="ledger" aria-label="Evaluation scorecard">
        <Metric index={0} label="Diagnosis match" value={score.labeled_cases ? `${score.diagnosis_accuracy_pct}%` : "—"} detail={`${score.labeled_cases} human-labelled cases`} />
        <Metric index={1} label="Action match" value={score.labeled_cases ? `${score.action_accuracy_pct}%` : "—"} detail={`${score.escalated_cases} safely escalated`} />
        <Metric index={2} label="Policy compliance" value={hasData ? `${score.policy_compliance_pct}%` : "—"} detail={`${score.suspicious_refusals} suspicious refused`} />
        <Metric index={3} label="Verified test recovery" value={hasData ? money.format(score.actual_test_recovery) : "—"} detail="from signed paid webhooks" accent />
      </section>

      <section className="splitSection">
        <div className="exceptionsPanel">
          <div className="sectionHeading">
            <div><span className="utilityLabel riskText">HONEST EXCEPTIONS</span><h2>Where Reven hesitated.</h2></div>
            <span className="exceptionCount">{score.wrong_or_uncertain_cases.length.toString().padStart(2, "0")}</span>
          </div>
          <p className="sectionIntro">Uncertain and mismatched cases stay visible. They are evidence, not clutter.</p>
          <div className="exceptionList">
            {score.wrong_or_uncertain_cases.length === 0 && <div className="emptyInline">No evaluated exceptions yet.</div>}
            {score.wrong_or_uncertain_cases.slice(0, 4).map((item) => (
              <Link href={`/case/${item.event_id}`} key={item.event_id}>
                <div><strong>{item.event_id}</strong><span>{item.reason}</span></div>
                <ArrowUpRight size={16} />
              </Link>
            ))}
          </div>
        </div>
        <div className="runFacts">
          <span className="utilityLabel">RUN PROVENANCE</span>
          <dl>
            <div><dt>Pipeline</dt><dd>v{score.pipeline_version}</dd></div>
            <div><dt>Policy snapshot</dt><dd>attached</dd></div>
            <div><dt>Source</dt><dd>{connected ? score.data_source.replaceAll("_", " ") : "not connected"}</dd></div>
            <div><dt>Evidence</dt><dd>signed test webhooks</dd></div>
          </dl>
        </div>
      </section>

      <section className="eventsSection" id="events">
        <div className="eventsHeader">
          <div><span className="utilityLabel">RECOVERY LEDGER</span><h2>Every case. Every reason.</h2></div>
          <label className="searchBox">
            <Search size={15} />
            <span className="srOnly">Search cases</span>
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search cases" />
          </label>
        </div>
        <div className="tableWrap">
          <table>
            <thead><tr><th>Case</th><th>Customer</th><th>Amount</th><th>Cause</th><th>Action & Rationale</th><th>Verified</th><th><span className="srOnly">Open</span></th></tr></thead>
            <tbody>
              {filtered.length === 0 && (
                <tr><td colSpan={7} className="emptyTable">No Razorpay test failures received yet. Connect the backend, configure the signed webhook, then create a failed test payment.</td></tr>
              )}
              {filtered.map((result, index) => (
                <tr key={result.event_id} style={{ "--row-index": index } as React.CSSProperties}>
                  <td><Link href={`/case/${result.event_id}`}>{result.event_id}</Link><small>{result.event_type.replaceAll("_", " ")}</small></td>
                  <td>{result.customer_name}</td>
                  <td className="number">{money.format(result.amount)}</td>
                  <td>{result.diagnosis.cause.replaceAll("_", " ")}<small>{result.diagnosis.method} · {formatConfidence(result.diagnosis.confidence)}</small></td>
                  <td>
                    <StatusBadge value={result.decision.action} />
                    <small className="tableWhyText">{getWhyThisAction(result, score.policy_snapshot)}</small>
                  </td>
                  <td className="number recovered">{result.verified_recovered_amount ? money.format(result.verified_recovered_amount) : "—"}</td>
                  <td><Link className="rowLink" href={`/case/${result.event_id}`} aria-label={`Open ${result.event_id}`}><ArrowUpRight size={16} /></Link></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* What makes Reven different */}
      <section className="differentiationSection" aria-label="What makes Reven different">
        <div className="diffHeader">
          <div className="utilityLabel"><ShieldCheck size={14} /> CORE DIFFERENTIATOR</div>
          <h2>Automation with proof, not blind retries.</h2>
        </div>
        <div className="diffGrid">
          <div className="diffCard">
            <span className="diffNumber">01</span>
            <h3>Evidence before action</h3>
            <p>Diagnosis requires rich processor signals (error code, method, bank, attempt history). Generic evidence fails safe to human review.</p>
          </div>
          <div className="diffCard">
            <span className="diffNumber">02</span>
            <h3>Policy bounds around AI</h3>
            <p>Hard financial limits (₹ threshold, retry limit, confidence floor) are strictly code-enforced. AI can diagnose but never bypasses policy.</p>
          </div>
          <div className="diffCard">
            <span className="diffNumber">03</span>
            <h3>Human review for uncertainty</h3>
            <p>Low confidence or high-value cases are escalated to human operators, complete with full audit traces and side-by-side feedback tracking.</p>
          </div>
          <div className="diffCard">
            <span className="diffNumber">04</span>
            <h3>Recovery counted only after paid webhook verification</h3>
            <p>Generating a link is never counted as recovered revenue. Attribution occurs only when a signed Razorpay paid webhook confirms payment.</p>
          </div>
        </div>
      </section>
    </main>
  );
}

function Metric({ index, label, value, detail, accent = false }: { index: number; label: string; value: string; detail: string; accent?: boolean }) {
  return <div className={accent ? "metric accentMetric" : "metric"} style={{ "--metric-index": index } as React.CSSProperties}><span>{label}</span><strong>{value}</strong><small>{detail}</small></div>;
}
