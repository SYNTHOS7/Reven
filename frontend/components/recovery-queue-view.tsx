"use client";

import React, { useMemo, useState } from "react";
import {
  AlertTriangle,
  ArrowDownUp,
  ArrowUpRight,
  CheckCircle2,
  ChevronDown,
  Copy,
  ExternalLink,
  Filter,
  Flame,
  Info,
  Mail,
  MessageSquare,
  Play,
  RotateCw,
  Search,
  Send,
  ShieldAlert,
  Sparkles,
  UserCheck,
  X,
  Zap,
} from "lucide-react";
import { useTransactions } from "@/lib/transaction-context";
import type { DemoActionType, Transaction } from "@/lib/types";

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
    isSimulated,
    lastActionSummary,
  } = useTransactions();

  // Search and Filters
  const [query, setQuery] = useState("");
  const [amountFilter, setAmountFilter] = useState<"all" | "high" | "mid" | "low">("all");
  const [reasonFilter, setReasonFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [probabilityFilter, setProbabilityFilter] = useState<"all" | "high" | "med" | "low">("all");

  // Sorting
  const [sortField, setSortField] = useState<"amount" | "probability" | "date" | "customer">("probability");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");

  // Modals & Preview State
  const [previewModalTx, setPreviewModalTx] = useState<Transaction | null>(null);
  const [modalType, setModalType] = useState<"whatsapp" | "email" | "link" | "escalate" | null>(null);
  const [escalateNote, setEscalateNote] = useState("");
  const [copiedLink, setCopiedLink] = useState(false);
  const [batchAnimating, setBatchAnimating] = useState(false);

  // Pagination
  const [page, setPage] = useState(1);
  const pageSize = 15;

  // High-priority count for button
  const highPriorityItems = transactions.filter(
    (t) => t.status !== "recovered" && t.status !== "successful" && t.is_high_priority
  );
  const highPriorityTotal = highPriorityItems.reduce((acc, t) => acc + t.amount, 0);

  // Filter and Sort Logic
  const filteredAndSorted = useMemo(() => {
    let result = transactions.filter((tx) => {
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

      // Probability Filter
      const prob = tx.recovery_probability || 50;
      if (probabilityFilter === "high" && prob < 75) return false;
      if (probabilityFilter === "med" && (prob < 40 || prob >= 75)) return false;
      if (probabilityFilter === "low" && prob >= 40) return false;

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
    probabilityFilter,
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

  return (
    <main className="recoveryQueuePage">
      {/* Simulation Banner */}
      <div className="demoSimulationBanner">
        <div className="demoSimulationContent">
          <Sparkles size={16} className="sparkleIcon" />
          <div>
            <strong>Demo Sandbox — Simulated Safe Actions</strong>
            <span>
              All reminders, payment links, and recoveries executed in this queue are simulated. No
              live customer communications or Razorpay production charges are dispatched.
            </span>
          </div>
        </div>
      </div>

      <section className="pageIntro">
        <div className="eyebrow">
          <span>03</span> ACTIONABLE WORKSPACE
        </div>
        <div className="queueHeroHeader">
          <div>
            <h1>
              Recovery Queue &amp; <em>Intervention Engine</em>
            </h1>
            <p>
              Prescribe deterministic recovery actions for payment drops. Preview WhatsApp/Email
              prompts, generate instant retry links, or batch-recover high-priority carts.
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
            <span className="batchActionHint">Simulates approved 1-click recovery actions</span>
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
                placeholder="Customer name, email, error, cause..."
              />
            </label>
          </div>

          {/* Amount Filter */}
          <div className="filterBox">
            <span className="filterLabel">AMOUNT TIER</span>
            <select
              value={amountFilter}
              onChange={(e) => {
                setAmountFilter(e.target.value as any);
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
              <option value="missing">Missing Payment Option</option>
              <option value="abandon">Checkout Abandoned</option>
              <option value="repeated">Repeated Failures</option>
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

          {/* Probability Filter */}
          <div className="filterBox">
            <span className="filterLabel">RECOVERY PROBABILITY</span>
            <select
              value={probabilityFilter}
              onChange={(e) => {
                setProbabilityFilter(e.target.value as any);
                setPage(1);
              }}
              className="filterSelect"
            >
              <option value="all">All Probabilities</option>
              <option value="high">High (&gt;75%)</option>
              <option value="med">Medium (40–75%)</option>
              <option value="low">Low (&lt;40%)</option>
            </select>
          </div>
        </div>
      </section>

      {/* Queue Table */}
      <section className="eventsSection" id="recovery-table">
        <div className="eventsHeader">
          <div>
            <span className="utilityLabel">RECOVERY WORKLIST</span>
            <h2>Active Payment Cases ({filteredAndSorted.length})</h2>
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
            <button
              type="button"
              onClick={() => {
                if (sortField === "date") {
                  setSortOrder(sortOrder === "asc" ? "desc" : "asc");
                } else {
                  setSortField("date");
                  setSortOrder("desc");
                }
              }}
              className={`sortBtn ${sortField === "date" ? "activeSort" : ""}`}
            >
              Date {sortField === "date" ? (sortOrder === "desc" ? "↓" : "↑") : ""}
            </button>
          </div>
        </div>

        <div className="tableWrap">
          <table>
            <thead>
              <tr>
                <th>Customer</th>
                <th>Amount</th>
                <th>Status</th>
                <th>Failure Reason</th>
                <th>Likely Root Cause</th>
                <th>Recovery Probability</th>
                <th>Recommended Action</th>
                <th>Action Status &amp; Controls</th>
              </tr>
            </thead>
            <tbody>
              {paginated.length === 0 && (
                <tr>
                  <td colSpan={8} className="emptyTable">
                    No transactions match your search and filter criteria.
                  </td>
                </tr>
              )}
              {paginated.map((tx, idx) => {
                const prob = tx.recovery_probability || 50;
                const isRecovered = tx.status === "recovered";
                const isHigh = tx.is_high_priority;

                return (
                  <tr
                    key={tx.transaction_id}
                    className={`queueTableRow ${isRecovered ? "rowRecovered" : ""} ${
                      isHigh ? "rowHighPriority" : ""
                    }`}
                    style={{ "--row-index": idx } as React.CSSProperties}
                  >
                    {/* Customer */}
                    <td>
                      <div className="customerCell">
                        <strong>{tx.customer_name}</strong>
                        <small className="tableSubText">{tx.customer_email}</small>
                        <small className="phoneText">{tx.customer_phone}</small>
                      </div>
                    </td>

                    {/* Amount */}
                    <td className="number fontMedium">
                      <div className="amountCell">
                        <span className={isRecovered ? "recoveryText" : "riskText"}>
                          {money.format(tx.amount)}
                        </span>
                        {isHigh && !isRecovered && (
                          <span className="highPriorityTag" title="High-priority recovery target">
                            <Flame size={10} /> HIGH
                          </span>
                        )}
                      </div>
                    </td>

                    {/* Status */}
                    <td>
                      <span className={`statusPill statusPill-${tx.status}`}>{tx.status}</span>
                    </td>

                    {/* Failure Reason */}
                    <td>
                      <span className="failureReasonTag">
                        {tx.failure_reason === "none"
                          ? "—"
                          : tx.failure_reason.replaceAll("_", " ")}
                      </span>
                      <small className="tableSubText methodLabel">Method: {tx.payment_method}</small>
                    </td>

                    {/* Likely Root Cause */}
                    <td className="causeCell">
                      <span>{tx.likely_root_cause || "Pending classification"}</span>
                    </td>

                    {/* Recovery Probability */}
                    <td>
                      <div className="probabilityBarContainer">
                        <div
                          className={`probabilityBarFill ${
                            prob >= 75
                              ? "barHighProb"
                              : prob >= 50
                              ? "barMedProb"
                              : "barLowProb"
                          }`}
                          style={{ width: `${prob}%` }}
                        />
                        <span className="probabilityText">{prob}%</span>
                      </div>
                    </td>

                    {/* Recommended Action */}
                    <td className="recommendedActionCell">
                      <span className="recommendationText">{tx.recommended_action}</span>
                    </td>

                    {/* Action Controls & Status */}
                    <td className="actionsCell">
                      {isRecovered ? (
                        <div className="recoveredState">
                          <CheckCircle2 size={15} className="recoveryText" />
                          <span className="recoveryText fontMedium">Simulated Recovered</span>
                        </div>
                      ) : (
                        <div className="actionButtonToolbar">
                          {/* WhatsApp Preview */}
                          <button
                            type="button"
                            title="Preview WhatsApp Reminder"
                            onClick={() => openActionModal(tx, "whatsapp")}
                            className="actionIconBtn"
                          >
                            <MessageSquare size={13} />
                          </button>

                          {/* Email Preview */}
                          <button
                            type="button"
                            title="Preview Email Reminder"
                            onClick={() => openActionModal(tx, "email")}
                            className="actionIconBtn"
                          >
                            <Mail size={13} />
                          </button>

                          {/* Create Retry Link */}
                          <button
                            type="button"
                            title="Create Simulated Retry-Payment Link"
                            onClick={() => openActionModal(tx, "link")}
                            className="actionIconBtn"
                          >
                            <ExternalLink size={13} />
                          </button>

                          {/* Escalate High-Value */}
                          <button
                            type="button"
                            title="Escalate Transaction"
                            onClick={() => openActionModal(tx, "escalate")}
                            className="actionIconBtn"
                          >
                            <UserCheck size={13} />
                          </button>

                          {/* Mark as Recovered Button */}
                          <button
                            type="button"
                            onClick={() => performAction(tx.transaction_id, "mark_recovered")}
                            className="button buttonSmall buttonPrimary markRecoveredBtn"
                          >
                            <CheckCircle2 size={12} />
                            <span>Mark Recovered</span>
                          </button>
                        </div>
                      )}

                      {/* Display current action status if not recovered */}
                      {!isRecovered && tx.action_status && tx.action_status !== "not_started" && (
                        <div className="actionStatusPill">
                          <span>Status: {tx.action_status.replaceAll("_", " ")}</span>
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="tablePagination">
            <span className="pageInfo">
              Showing {(page - 1) * pageSize + 1}–
              {Math.min(page * pageSize, filteredAndSorted.length)} of {filteredAndSorted.length}
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

      {/* Action Preview Modals */}
      {previewModalTx && modalType && (
        <div className="modalOverlay" onClick={closeModal}>
          <div className="modalCard" onClick={(e) => e.stopPropagation()}>
            <div className="modalHeader">
              <div className="modalTitleWrap">
                {modalType === "whatsapp" && <MessageSquare className="modalIcon recoveryText" />}
                {modalType === "email" && <Mail className="modalIcon warningText" />}
                {modalType === "link" && <ExternalLink className="modalIcon" />}
                {modalType === "escalate" && <ShieldAlert className="modalIcon riskText" />}
                <h3>
                  {modalType === "whatsapp" && "Preview WhatsApp Recovery Template"}
                  {modalType === "email" && "Preview Branded Email Reminder"}
                  {modalType === "link" && "Simulated Retry-Payment Link"}
                  {modalType === "escalate" && "Escalate High-Value Transaction"}
                </h3>
              </div>
              <button onClick={closeModal} className="modalCloseBtn">
                <X size={16} />
              </button>
            </div>

            <div className="modalBody">
              {/* WhatsApp Modal */}
              {modalType === "whatsapp" && (
                <div className="whatsappPreview">
                  <div className="whatsappHeader">
                    <div className="waAvatar">NA</div>
                    <div>
                      <strong>NextGen Academy (Verified)</strong>
                      <small>Official Recovery Bot</small>
                    </div>
                  </div>
                  <div className="whatsappBubble">
                    <p>
                      Hi <strong>{previewModalTx.customer_name}</strong> 👋
                    </p>
                    <p>
                      We noticed your enrollment payment of{" "}
                      <strong>{money.format(previewModalTx.amount)}</strong> was interrupted due to a{" "}
                      <em>{previewModalTx.failure_reason.replaceAll("_", " ")}</em>.
                    </p>
                    <p>
                      Your cohort seat is reserved for the next 24 hours. Tap below to complete your
                      registration via 1-click UPI or Netbanking:
                    </p>
                    <div className="simulatedLinkBlock">
                      <code>https://pay.reven.ai/rec/{previewModalTx.transaction_id}</code>
                    </div>
                    <span className="waTime">
                      {new Date().toLocaleTimeString("en-IN", {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                  </div>
                  <div className="modalDisclaimer">
                    <span>⚠️ Demo Preview only. No actual message is dispatched to customer.</span>
                  </div>
                </div>
              )}

              {/* Email Modal */}
              {modalType === "email" && (
                <div className="emailPreview">
                  <div className="emailMeta">
                    <div>
                      <span>To:</span> {previewModalTx.customer_email}
                    </div>
                    <div>
                      <span>Subject:</span> Complete your enrollment — NextGen Tech Academy
                    </div>
                  </div>
                  <div className="emailContent">
                    <h4>NextGen Academy Cohort Enrollment</h4>
                    <p>Dear {previewModalTx.customer_name},</p>
                    <p>
                      Your checkout attempt for <strong>{money.format(previewModalTx.amount)}</strong> could not be processed by your bank.
                    </p>
                    <div className="emailSummaryCard">
                      <div className="summaryRow">
                        <span>Course Cohort:</span>
                        <strong>Fullstack &amp; AI Engineering</strong>
                      </div>
                      <div className="summaryRow">
                        <span>Total Due:</span>
                        <strong>{money.format(previewModalTx.amount)}</strong>
                      </div>
                      <div className="summaryRow">
                        <span>Recommended Rail:</span>
                        <strong>UPI / Instant Netbanking</strong>
                      </div>
                    </div>
                    <div className="emailCtaWrap">
                      <span className="emailBtnPlaceholder">
                        Complete Payment via Secure UPI Link →
                      </span>
                    </div>
                  </div>
                  <div className="modalDisclaimer">
                    <span>⚠️ Simulated email template. No real emails are sent.</span>
                  </div>
                </div>
              )}

              {/* Link Modal */}
              {modalType === "link" && (
                <div className="linkModalContent">
                  <p>
                    A simulated one-click retry payment link has been provisioned for{" "}
                    <strong>{previewModalTx.customer_name}</strong>:
                  </p>
                  <div className="copyLinkRow">
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
                      {copiedLink ? <CheckCircle2 size={14} /> : <Copy size={14} />}
                      {copiedLink ? "Copied" : "Copy"}
                    </button>
                  </div>
                  <div className="modalDisclaimer">
                    <span>
                      Demo mode: This link is a sandbox identifier for testing customer UX flows.
                    </span>
                  </div>
                </div>
              )}

              {/* Escalate Modal */}
              {modalType === "escalate" && (
                <div className="escalateModalContent">
                  <p>
                    Escalate case <strong>{previewModalTx.transaction_id}</strong> (
                    {money.format(previewModalTx.amount)}) to high-touch concierge support:
                  </p>
                  <label className="inputLabel">
                    Operator Review Notes:
                    <textarea
                      value={escalateNote}
                      onChange={(e) => setEscalateNote(e.target.value)}
                      rows={3}
                      className="escalateTextarea"
                    />
                  </label>
                </div>
              )}
            </div>

            <div className="modalFooter">
              <button type="button" onClick={closeModal} className="button buttonOutline">
                Cancel
              </button>

              {modalType === "whatsapp" && (
                <button
                  type="button"
                  onClick={() => {
                    performAction(previewModalTx.transaction_id, "preview_whatsapp");
                    closeModal();
                  }}
                  className="button buttonPrimary"
                >
                  <Send size={14} /> Simulate WhatsApp Sent
                </button>
              )}

              {modalType === "email" && (
                <button
                  type="button"
                  onClick={() => {
                    performAction(previewModalTx.transaction_id, "preview_email");
                    closeModal();
                  }}
                  className="button buttonPrimary"
                >
                  <Send size={14} /> Simulate Email Sent
                </button>
              )}

              {modalType === "link" && (
                <button
                  type="button"
                  onClick={() => {
                    performAction(previewModalTx.transaction_id, "create_payment_link");
                    closeModal();
                  }}
                  className="button buttonPrimary"
                >
                  Save Link to Case
                </button>
              )}

              {modalType === "escalate" && (
                <button
                  type="button"
                  onClick={() => {
                    performAction(
                      previewModalTx.transaction_id,
                      "escalate_high_value",
                      escalateNote
                    );
                    closeModal();
                  }}
                  className="button buttonPrimary"
                >
                  Confirm Concierge Escalation
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
