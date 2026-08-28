"use client";

import React, { useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowUpRight,
  RefreshCcw,
  Search,
} from "lucide-react";
import { loadVerifiedRecoverySummary, runEvaluation } from "@/lib/api";
import type { DashboardData, VerifiedRecoverySummary } from "@/lib/types";
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

interface EvidenceViewProps {
  initialData: DashboardData;
  initialRecoverySummary: VerifiedRecoverySummary | null;
}

export function EvidenceView({ initialData, initialRecoverySummary }: EvidenceViewProps) {
  const [data, setData] = useState<DashboardData>(initialData);
  const [recoverySummary, setRecoverySummary] = useState<VerifiedRecoverySummary | null>(initialRecoverySummary);
  const [running, setRunning] = useState(false);
  const [query, setQuery] = useState("");
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
      setRecoverySummary(await loadVerifiedRecoverySummary());
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

  const score = data.scorecard;
  const connected = data.source === "api";
  const escalatedCases = data.results.filter((result) => result.decision.action === "escalate_human").length;
  const earlyAgreement = score.labeled_cases > 0 && score.labeled_cases < 10;

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
            <span className="kpiLabel">VERIFIED TEST RECOVERY</span>
            <HelpTooltip topic="verified_recovery" />
          </div>
          <strong className="kpiValue recoveryText">{recoverySummary ? money.format(recoverySummary.verified_recovery_amount) : "—"}</strong>
          <div className="kpiFooter">
            <span className="recoveryText">{recoverySummary ? `${recoverySummary.verified_recovery_count} verified recovery record${recoverySummary.verified_recovery_count === 1 ? "" : "s"}` : "Live recovery total unavailable"}</span>
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
          <strong className="kpiValue riskText">{score.suspicious_refusals}</strong>
          <div className="kpiFooter">
            <span className="riskText">Actions safely blocked by Trust Gate</span>
          </div>
        </div>

        {/* Diagnosis agreement */}
        <div className="kpiCard">
          <div className="kpiHeader">
            <span className="kpiLabel">{earlyAgreement ? "EARLY DIAGNOSIS AGREEMENT" : "DIAGNOSIS AGREEMENT"}</span>
            <HelpTooltip topic="diagnosis_confidence" />
          </div>
          <strong className="kpiValue">{score.labeled_cases ? `${score.diagnosis_accuracy_pct}%` : "—"}</strong>
          <div className="kpiFooter">
            <span>{score.labeled_cases ? `${earlyAgreement ? "Early evidence" : "Measured"} · n=${score.labeled_cases} human-reviewed cases` : "No human-reviewed cases yet"}</span>
          </div>
        </div>
      </section>

      <section className="evidenceBatchSummary" aria-label="Current Test Mode batch summary">
        <div>
          <span className="utilityLabel">CURRENT TEST MODE BATCH</span>
          <h2>Evidence is earned case by case.</h2>
          <p>This is an early Test Mode batch, not a production recovery-rate claim. Every total below comes from stored Razorpay events, operator decisions, and signed paid-webhook confirmation.</p>
        </div>
        <dl>
          <div><dt>Cases received</dt><dd>{data.results.length}</dd></div>
          <div><dt>Human escalations</dt><dd>{escalatedCases}</dd></div>
          <div><dt>Trust Gate stops</dt><dd>{score.suspicious_refusals}</dd></div>
          <div><dt>Verified recoveries</dt><dd>{recoverySummary?.verified_recovery_count ?? "—"}</dd></div>
        </dl>
        <small>Known limitation: Test Mode evidence is intentionally small. Reven does not claim stable diagnosis performance until more human-reviewed cases are collected.</small>
      </section>

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
