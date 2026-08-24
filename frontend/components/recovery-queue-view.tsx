"use client";

import React, { useMemo, useState } from "react";
import {
  CheckCircle2,
  Copy,
  ExternalLink,
  Flame,
  HelpCircle,
  MessageSquare,
  Search,
  Sparkles,
  UserCheck,
  X,
  Zap,
} from "lucide-react";
import { useTransactions } from "@/lib/transaction-context";
import { maskPhone } from "@/lib/utils";
import { WhyDrawer } from "./why-drawer";
import { HelpTooltip } from "./help-tooltip";
import type { Transaction } from "@/lib/types";

const money = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 0,
});

export function RecoveryQueueView() {
  const {
    transactions,
    performAction,
    recoverAllHighPriority,
  } = useTransactions();

  // Search and Filters
  const [query, setQuery] = useState("");
  const [amountFilter, setAmountFilter] = useState<"all" | "high" | "mid" | "low">("all");
  const [reasonFilter, setReasonFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [priorityFilter, setPriorityFilter] = useState<"all" | "high" | "normal">("all");

  // Sorting
  const [sortField, setSortField] = useState<"amount" | "probability" | "date" | "customer">("probability");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");

  // Modals & Preview State
  const [previewModalTx, setPreviewModalTx] = useState<Transaction | null>(null);
  const [modalType, setModalType] = useState<"whatsapp" | "email" | "link" | "escalate" | null>(null);
  const [escalateNote, setEscalateNote] = useState("");
  const [copiedLink, setCopiedLink] = useState(false);
  const [batchAnimating, setBatchAnimating] = useState(false);
  const [whyDrawerTx, setWhyDrawerTx] = useState<Transaction | null>(null);

  // Pagination
  const [page, setPage] = useState(1);
  const pageSize = 15;

  const highPriorityItems = transactions.filter(
    (t) => t.status !== "recovered" && t.status !== "successful" && t.is_high_priority
  );
  const highPriorityTotal = highPriorityItems.reduce((acc, t) => acc + t.amount, 0);

  // Filter and Sort Logic
  const filteredAndSorted = useMemo(() => {
    const result = transactions.filter((tx) => {
      // Search
      if (query) {
        const q = query.toLowerCase();
        const matches =
          tx.transaction_id.toLowerCase().includes(q) ||
          tx.customer_name.toLowerCase().includes(q) ||
          tx.customer_email.toLowerCase().includes(q) ||
          tx.failure_reason.toLowerCase().includes(q) ||
          (tx.likely_root_cause && tx.likely_root_cause.toLowerCase().includes(q));
        if (!matches) return false;
      }

      // Amount Filter
      if (amountFilter === "high" && tx.amount < 5000) return false;
      if (amountFilter === "mid" && (tx.amount < 2000 || tx.amount >= 5000)) return false;
      if (amountFilter === "low" && tx.amount >= 2000) return false;

      // Status Filter
      if (statusFilter !== "all" && tx.status !== statusFilter) return false;

      // Reason Filter
      if (reasonFilter !== "all") {
        const fr = (tx.failure_reason || "").toLowerCase();
        if (!fr.includes(reasonFilter)) return false;
      }

      // Priority Filter
      if (priorityFilter === "high" && !tx.is_high_priority) return false;
      if (priorityFilter === "normal" && tx.is_high_priority) return false;

      return true;
    });

    // Sorting
    result.sort((a, b) => {
      let comparison = 0;
      if (sortField === "amount") {
        comparison = a.amount - b.amount;
      } else if (sortField === "probability") {
        comparison = (a.recovery_probability || 50) - (b.recovery_probability || 50);
      } else if (sortField === "date") {
        comparison = new Date(a.attempted_at).getTime() - new Date(b.attempted_at).getTime();
      } else if (sortField === "customer") {
        comparison = a.customer_name.localeCompare(b.customer_name);
      }
      return sortOrder === "desc" ? -comparison : comparison;
    });

    return result;
  }, [
    transactions,
    query,
    amountFilter,
    reasonFilter,
    statusFilter,
    priorityFilter,
    sortField,
    sortOrder,
  ]);

  const totalPages = Math.max(1, Math.ceil(filteredAndSorted.length / pageSize));
  const paginated = filteredAndSorted.slice((page - 1) * pageSize, page * pageSize);

  function handleBatchRecover() {
    setBatchAnimating(true);
    recoverAllHighPriority();
    setTimeout(() => {
      setBatchAnimating(false);
    }, 1200);
  }

  function openActionModal(tx: Transaction, type: "whatsapp" | "email" | "link" | "escalate") {
    setPreviewModalTx(tx);
    setModalType(type);
    setCopiedLink(false);
    setEscalateNote(
      type === "escalate" ? "High ticket purchase - student requested callback regarding EMI / UPI." : ""
    );
  }

  function closeModal() {
    setPreviewModalTx(null);
    setModalType(null);
  }

  function handleCopyLink(link: string) {
    navigator.clipboard.writeText(link);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  }

  // Generate plain-language rationale for each transaction
  function getActionRationale(tx: Transaction): string {
    const isHighValue = tx.amount >= 5000;
    const isLowProb = (tx.recovery_probability || 50) < 60;
    const isCardDecline = tx.payment_method === "card" || tx.failure_reason.includes("decline");
    const isInsufficient = tx.failure_reason.includes("insufficient");

    if (isHighValue) {
      return `Human review required because amount (${money.format(tx.amount)}) meets high-value threshold.`;
    }
    if (isLowProb) {
      return "Human review required because confidence is below the safety threshold.";
    }
    if (isCardDecline) {
      return "Recommend 1-Click UPI because card was declined and retry is allowed.";
    }
    if (isInsufficient) {
      return "Recommend smart retry in 2h because failure was temporary balance limit.";
    }
    return "Automated recovery action within safety policy bounds.";
  }

  return (
    <main className="recoveryQueuePage">
      {/* Simulation Banner */}
      <div className="demoSimulationBanner">
        <div className="demoSimulationContent">
          <Sparkles size={16} className="sparkleIcon" />
          <div>
            <strong>Demo Sandbox — Simulated Safe Actions</strong>
            <span>
              All recovery reminders, simulated links, and mock recoveries in this queue are safe simulations. No live customer messages are sent.
            </span>
          </div>
          <HelpTooltip topic="demo_scenario" />
        </div>
      </div>

      <section className="pageIntro">
        <div className="eyebrow">
          <span>03</span> ACTIONABLE WORKLIST
        </div>
        <div className="queueHeroHeader">
          <div>
            <h1>Which payments to recover first</h1>
            <p>
              Ranked list of payment drop-offs with explainable recommendations and safe actions.
            </p>
          </div>

          {/* Batch Recover Button */}
          <div className="batchActionContainer">
            <button
              type="button"
              onClick={handleBatchRecover}
              disabled={highPriorityItems.length === 0 || batchAnimating}
              className={`button buttonPrimary recoverAllBtn ${batchAnimating ? "btnPulse" : ""}`}
            >
              <Zap size={16} className={batchAnimating ? "spin" : ""} />
              <span>
                {batchAnimating
                  ? "Simulating Recovery..."
                  : `Recover All High-Priority (${highPriorityItems.length})`}
              </span>
              <strong className="recoverAmountBadge">{money.format(highPriorityTotal)}</strong>
            </button>
            <span className="batchActionHint">Simulates 1-click recovery for eligible carts</span>
          </div>
        </div>
      </section>

      {/* Filter and Search Bar */}
      <section className="queueFiltersSection">
        <div className="filtersGrid">
          {/* Search Box */}
          <div className="filterBox">
            <span className="filterLabel">SEARCH</span>
            <label className="searchBox fullWidth">
              <Search size={15} />
              <input
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  setPage(1);
                }}
                placeholder="Search customer, ID, failure reason..."
              />
            </label>
          </div>

          {/* Amount Filter */}
          <div className="filterBox">
            <span className="filterLabel">AMOUNT TIER</span>
            <select
              value={amountFilter}
              onChange={(e) => {
                setAmountFilter(e.target.value as "all" | "high" | "mid" | "low");
                setPage(1);
              }}
              className="filterSelect"
            >
              <option value="all">All Amounts</option>
              <option value="high">High Value (≥ ₹5,000)</option>
              <option value="mid">Mid Value (₹2,000–₹5,000)</option>
              <option value="low">Low Value (&lt; ₹2,000)</option>
            </select>
          </div>

          {/* Failure Reason Filter */}
          <div className="filterBox">
            <span className="filterLabel">FAILURE PATTERN</span>
            <select
              value={reasonFilter}
              onChange={(e) => {
                setReasonFilter(e.target.value);
                setPage(1);
              }}
              className="filterSelect"
            >
              <option value="all">All Failure Reasons</option>
              <option value="decline">Bank Decline / 3DS</option>
              <option value="insufficient">Insufficient Funds</option>
              <option value="tech">Technical / Timeout</option>
              <option value="auth">Authentication / OTP Drop</option>
              <option value="abandon">Checkout Abandoned</option>
            </select>
          </div>

          {/* Priority Filter */}
          <div className="filterBox">
            <span className="filterLabel">PRIORITY</span>
            <select
              value={priorityFilter}
              onChange={(e) => {
                setPriorityFilter(e.target.value as "all" | "high" | "normal");
                setPage(1);
              }}
              className="filterSelect"
            >
              <option value="all">All Priorities</option>
              <option value="high">High Priority Only</option>
              <option value="normal">Normal Priority</option>
            </select>
          </div>

          {/* Status Filter */}
          <div className="filterBox">
            <span className="filterLabel">STATUS</span>
            <select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value);
                setPage(1);
              }}
              className="filterSelect"
            >
              <option value="all">All Statuses</option>
              <option value="failed">Failed</option>
              <option value="abandoned">Abandoned</option>
              <option value="recovered">Recovered</option>
            </select>
          </div>
        </div>
      </section>

      {/* Queue Table */}
      <section className="eventsSection" id="recovery-table">
        <div className="eventsHeader">
          <div>
            <span className="utilityLabel">RECOVERY WORKLIST</span>
            <h2>Ranked Recovery Cases ({filteredAndSorted.length})</h2>
          </div>

          <div className="sortControls">
            <span className="sortLabel">SORT BY:</span>
            <button
              type="button"
              onClick={() => {
                if (sortField === "probability") {
                  setSortOrder(sortOrder === "asc" ? "desc" : "asc");
                } else {
                  setSortField("probability");
                  setSortOrder("desc");
                }
              }}
              className={`sortBtn ${sortField === "probability" ? "activeSort" : ""}`}
            >
              Probability {sortField === "probability" ? (sortOrder === "desc" ? "↓" : "↑") : ""}
            </button>
            <button
              type="button"
              onClick={() => {
                if (sortField === "amount") {
                  setSortOrder(sortOrder === "asc" ? "desc" : "asc");
                } else {
                  setSortField("amount");
                  setSortOrder("desc");
                }
              }}
              className={`sortBtn ${sortField === "amount" ? "activeSort" : ""}`}
            >
              Amount {sortField === "amount" ? (sortOrder === "desc" ? "↓" : "↑") : ""}
            </button>
          </div>
        </div>

        <div className="tableWrap">
          <table>
            <thead>
              <tr>
                <th>Amount</th>
                <th>Failure Reason</th>
                <th>Recommended Action &amp; Rationale</th>
                <th>Priority</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {paginated.length === 0 && (
                <tr>
                  <td colSpan={6} className="emptyTable">
                    No transactions match your search and filter criteria.
                  </td>
                </tr>
              )}
              {paginated.map((tx, idx) => {
                const isRecovered = tx.status === "recovered";
                const isHigh = tx.is_high_priority;
                const rationale = getActionRationale(tx);

                return (
                  <tr
                    key={tx.transaction_id}
                    className={`queueTableRow ${isRecovered ? "rowRecovered" : ""} ${
                      isHigh ? "rowHighPriority" : ""
                    }`}
                    style={{ "--row-index": idx } as React.CSSProperties}
                  >
                    {/* 1. Amount */}
                    <td className="number fontMedium">
                      <div className="amountCell">
                        <span className={isRecovered ? "recoveryText fontBold" : "riskText fontBold"}>
                          {money.format(tx.amount)}
                        </span>
                        <small className="block text-text-muted text-[10px]">{tx.customer_name}</small>
                      </div>
                    </td>

                    {/* 2. Failure Reason */}
                    <td>
                      <span className="failureReasonTag">
                        {tx.failure_reason === "none"
                          ? "—"
                          : tx.failure_reason.replaceAll("_", " ")}
                      </span>
                      <small className="block text-text-muted text-[10px]">Method: {tx.payment_method}</small>
                    </td>

                    {/* 3. Recommended Action with Visible One-Line Rationale */}
                    <td className="recommendedActionCell">
                      <div className="recommendationMain">
                        <strong className="recommendationText">{tx.recommended_action}</strong>
                      </div>
                      <p className="recommendationRationale">{rationale}</p>
                    </td>

                    {/* 4. Priority */}
                    <td>
                      {isHigh ? (
                        <span className="highPriorityTag" title="High-priority recovery target">
                          <Flame size={11} /> HIGH
                        </span>
                      ) : (
                        <span className="normalPriorityTag">NORMAL</span>
                      )}
                    </td>

                    {/* 5. Status */}
                    <td>
                      <span className={`statusPill statusPill-${tx.status}`}>
                        {isRecovered ? "Recovered" : tx.status}
                      </span>
                    </td>

                    {/* Explicit Action Buttons */}
                    <td className="actionsCell">
                      <div className="queueActionBtnGroup">
                        {/* View explanation button */}
                        <button
                          type="button"
                          onClick={() => setWhyDrawerTx(tx)}
                          className="button buttonSecondary buttonSmall"
                          title="View detailed explanation"
                        >
                          <HelpCircle size={12} />
                          <span>View explanation</span>
                        </button>

                        {isRecovered ? (
                          <span className="recoveryConfirmedBadge">
                            <CheckCircle2 size={13} />
                            <span>Recovered</span>
                          </span>
                        ) : (
                          <>
                            {/* Preview demo message */}
                            <button
                              type="button"
                              onClick={() => openActionModal(tx, "whatsapp")}
                              className="button buttonSecondary buttonSmall"
                              title="Preview simulated demo message"
                            >
                              <MessageSquare size={12} />
                              <span>Preview demo message</span>
                            </button>

                            {/* Create simulated retry link */}
                            <button
                              type="button"
                              onClick={() => openActionModal(tx, "link")}
                              className="button buttonSecondary buttonSmall"
                              title="Create simulated retry link"
                            >
                              <ExternalLink size={12} />
                              <span>Create simulated retry link</span>
                            </button>

                            {/* Mark demo recovery */}
                            <button
                              type="button"
                              onClick={() => performAction(tx.transaction_id, "mark_recovered")}
                              className="button buttonPrimary buttonSmall"
                              title="Mark as simulated recovery"
                            >
                              <CheckCircle2 size={12} />
                              <span>Mark demo recovery</span>
                            </button>

                            {/* Request human review if high value */}
                            {tx.amount >= 5000 && (
                              <button
                                type="button"
                                onClick={() => openActionModal(tx, "escalate")}
                                className="button buttonSecondary buttonSmall"
                                title="Request human review"
                              >
                                <UserCheck size={12} />
                                <span>Request human review</span>
                              </button>
                            )}
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
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
            <span className="pageNumberText">
              Page {page} of {totalPages}
            </span>
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
      </section>

      {/* Why Drawer */}
      {whyDrawerTx && (
        <WhyDrawer tx={whyDrawerTx} onClose={() => setWhyDrawerTx(null)} />
      )}

      {/* Action Preview Modals */}
      {previewModalTx && modalType && (
        <div className="modalOverlay" onClick={closeModal}>
          <div className="actionModal" onClick={(e) => e.stopPropagation()} role="dialog">
            <div className="modalHeader">
              <div>
                <span className="utilityLabel">SIMULATED ACTION WORKSPACE</span>
                <h3>
                  {modalType === "whatsapp" && "Preview WhatsApp Demo Message"}
                  {modalType === "email" && "Preview Email Demo Message"}
                  {modalType === "link" && "Simulated 1-Click Retry Link"}
                  {modalType === "escalate" && "Request Human Review"}
                </h3>
              </div>
              <button onClick={closeModal} className="modalCloseBtn" aria-label="Close">
                <X size={18} />
              </button>
            </div>

            <div className="modalBody">
              {/* WhatsApp Preview */}
              {modalType === "whatsapp" && (
                <div className="chatPreviewContainer">
                  <div className="chatBubble">
                    <div className="chatSender">Reven Payment Assistant</div>
                    <p className="chatText">
                      Hi {previewModalTx.customer_name}, we noticed your payment of{" "}
                      <strong>{money.format(previewModalTx.amount)}</strong> for your course was
                      interrupted ({previewModalTx.failure_reason.replaceAll("_", " ")}).
                    </p>
                    <p className="chatText">
                      You can complete your checkout safely in 1 click via UPI Intent or Card:
                    </p>
                    <div className="chatLinkBox">
                      <span>https://pay.reven.ai/rec/{previewModalTx.transaction_id}</span>
                    </div>
                  </div>
                  <div className="simNotice">
                    <Sparkles size={14} className="text-primary" />
                    <span>Demo mode only. No actual message is sent to {maskPhone(previewModalTx.customer_phone)}.</span>
                  </div>
                </div>
              )}

              {/* Retry Link Preview */}
              {modalType === "link" && (
                <div className="linkPreviewContainer">
                  <span className="fieldLabel">Simulated Recovery Payment URL</span>
                  <div className="linkCopyRow">
                    <input
                      readOnly
                      value={`https://pay.reven.ai/rec/${previewModalTx.transaction_id}`}
                      className="linkInput"
                    />
                    <button
                      type="button"
                      onClick={() =>
                        handleCopyLink(`https://pay.reven.ai/rec/${previewModalTx.transaction_id}`)
                      }
                      className="button buttonPrimary buttonSmall"
                    >
                      <Copy size={13} />
                      <span>{copiedLink ? "Copied!" : "Copy link"}</span>
                    </button>
                  </div>
                  <div className="simNotice">
                    <CheckCircle2 size={14} className="text-primary" />
                    <span>Payment link is simulated with deterministic Razorpay Test Mode schemas.</span>
                  </div>
                </div>
              )}

              {/* Escalate / Human Review */}
              {modalType === "escalate" && (
                <div className="escalateContainer">
                  <span className="fieldLabel">Human Review Escalation Note</span>
                  <textarea
                    value={escalateNote}
                    onChange={(e) => setEscalateNote(e.target.value)}
                    className="escalateTextarea"
                    rows={3}
                    placeholder="Add operator instructions or customer contact context..."
                  />
                  <div className="simNotice">
                    <UserCheck size={14} className="text-status-amber" />
                    <span>This flags the cart for operator manual approval in the Evidence tab.</span>
                  </div>
                </div>
              )}
            </div>

            <div className="modalFooter">
              <button type="button" onClick={closeModal} className="button buttonSecondary">
                Close
              </button>
              <button
                type="button"
                onClick={() => {
                  performAction(previewModalTx.transaction_id, "mark_recovered");
                  closeModal();
                }}
                className="button buttonPrimary"
              >
                <CheckCircle2 size={14} />
                <span>Mark as Simulated Recovery</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
