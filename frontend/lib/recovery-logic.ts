import type {
  FailureReasonStat,
  RecoveryTrendPoint,
  RevenueIntelligenceMetrics,
  Transaction,
} from "./types";

export interface IntelligenceDerivation {
  likely_root_cause: string;
  recovery_probability: number;
  recommended_action: string;
  is_high_priority: boolean;
}

export function deriveTransactionIntelligence(tx: Partial<Transaction>): IntelligenceDerivation {
  const reason = (tx.failure_reason || "").toLowerCase().trim();
  const method = (tx.payment_method || "").toLowerCase().trim();
  const retryCount = tx.retry_count ?? 0;
  const amount = tx.amount ?? 0;
  const status = tx.status ?? "failed";

  let likely_root_cause = "Unclassified Payment Failure";
  let recovery_probability = 50;
  let recommended_action = "Escalate for manual inspection";

  // Check repeated failure first
  if (retryCount >= 3 || reason.includes("repeated")) {
    likely_root_cause = `Multi-attempt Recurring Rejection (${retryCount} attempts)`;
    recommended_action = "Escalate to human review";
    recovery_probability = 42;
  } else if (
    reason.includes("insufficient") ||
    reason.includes("balance") ||
    reason.includes("limit_exceeded")
  ) {
    likely_root_cause = method === "card" ? "Credit Card Limit Exhausted" : "Bank Account Balance Insufficient";
    recommended_action = "Retry later (scheduled) / Offer UPI instant switch";
    recovery_probability = 72;
  } else if (
    reason.includes("bank_decline") ||
    reason.includes("decline") ||
    reason.includes("do_not_honor")
  ) {
    likely_root_cause = "Issuer Bank 3DS / Risk Decline";
    recommended_action = "Recommend alternative payment method (UPI / Netbanking) / Retry later";
    recovery_probability = 78;
  } else if (
    reason.includes("tech") ||
    reason.includes("network") ||
    reason.includes("timeout") ||
    reason.includes("gateway")
  ) {
    likely_root_cause = "Gateway Network Glitch / Peak Load Drop";
    recommended_action = "Create simulated retry-payment link";
    recovery_probability = 91;
  } else if (
    reason.includes("auth") ||
    reason.includes("otp") ||
    reason.includes("3ds") ||
    reason.includes("verification")
  ) {
    likely_root_cause = "SMS OTP Timeout / Verification Abandonment";
    recommended_action = "Retry with supported method (UPI Intent / Biometric)";
    recovery_probability = 84;
  } else if (
    reason.includes("missing") ||
    reason.includes("unsupported") ||
    reason.includes("no_option")
  ) {
    likely_root_cause = "Customer Preferred Payment Rail Not Supported";
    recommended_action = "Recommend UPI or Digital Wallet";
    recovery_probability = 76;
  } else if (
    status === "abandoned" ||
    reason.includes("abandon") ||
    reason.includes("closed")
  ) {
    likely_root_cause = "Checkout Window Closed Before Completion";
    recommended_action = "Send gentle reminder with discount/perk";
    recovery_probability = 64;
  } else {
    likely_root_cause = "General Card/Bank Processing Failure";
    recommended_action = "Escalate for manual inspection";
    recovery_probability = 50;
  }

  // High priority criteria: High ticket amount (>= 4000) OR high recovery probability with non-recovered status
  const is_high_priority =
    status !== "successful" &&
    status !== "recovered" &&
    (amount >= 4000 || recovery_probability >= 78);

  return {
    likely_root_cause,
    recovery_probability,
    recommended_action,
    is_high_priority,
  };
}

export function computeRevenueIntelligence(transactions: Transaction[]): RevenueIntelligenceMetrics {
  let totalAttemptedRevenue = 0;
  let revenueCollected = 0;
  let revenueLost = 0;
  let potentiallyRecoverableRevenue = 0;
  let revenueRecovered = 0;

  const affectedCustomerEmails = new Set<string>();
  const failureReasonMap: Record<
    string,
    { count: number; lostAmount: number; isCard: boolean; alternative: string; label: string }
  > = {
    insufficient_funds: {
      count: 0,
      lostAmount: 0,
      isCard: true,
      label: "Insufficient Funds",
      alternative: "Offer UPI Instant QR or split payment",
    },
    bank_decline: {
      count: 0,
      lostAmount: 0,
      isCard: true,
      label: "Bank Decline / 3DS Rejection",
      alternative: "Recommend UPI / Direct Netbanking",
    },
    technical_failure: {
      count: 0,
      lostAmount: 0,
      isCard: false,
      label: "Technical / Network Timeout",
      alternative: "Instant retry-payment link via WhatsApp/Email",
    },
    authentication_failure: {
      count: 0,
      lostAmount: 0,
      isCard: true,
      label: "Authentication / OTP Timeout",
      alternative: "Switch to UPI App Intent (no OTP required)",
    },
    missing_payment_option: {
      count: 0,
      lostAmount: 0,
      isCard: false,
      label: "Missing Payment Rail / Wallet",
      alternative: "Present UPI / GPay / PhonePe / Paytm",
    },
    abandoned: {
      count: 0,
      lostAmount: 0,
      isCard: false,
      label: "Checkout Window Abandoned",
      alternative: "WhatsApp cart reminder with 1-click buy link",
    },
    repeated_failure: {
      count: 0,
      lostAmount: 0,
      isCard: true,
      label: "Repeated Retries (>3x Rejection)",
      alternative: "Escalate to Concierge Assisted Checkout",
    },
    unknown: {
      count: 0,
      lostAmount: 0,
      isCard: false,
      label: "Unspecified Error",
      alternative: "Manual review by recovery team",
    },
  };

  const trendMap: Record<string, { attempted: number; lost: number; recovered: number }> = {};

  const highPriorityOpportunities: Transaction[] = [];

  for (const tx of transactions) {
    const amount = Number(tx.amount) || 0;
    totalAttemptedRevenue += amount;

    // Aggregate trends by date (YYYY-MM-DD)
    const dateKey = tx.attempted_at ? tx.attempted_at.slice(0, 10) : "2026-08-20";
    if (!trendMap[dateKey]) {
      trendMap[dateKey] = { attempted: 0, lost: 0, recovered: 0 };
    }
    trendMap[dateKey].attempted += amount;

    if (tx.status === "successful") {
      revenueCollected += amount;
    } else if (tx.status === "recovered") {
      revenueRecovered += amount;
      trendMap[dateKey].recovered += amount;
    } else {
      // failed or abandoned
      revenueLost += amount;
      trendMap[dateKey].lost += amount;
      if (tx.customer_email) {
        affectedCustomerEmails.add(tx.customer_email);
      }

      // Categorize failure reason
      const reasonKey = categorizeFailureReasonKey(tx.failure_reason, tx.retry_count, tx.status);
      if (failureReasonMap[reasonKey]) {
        failureReasonMap[reasonKey].count += 1;
        failureReasonMap[reasonKey].lostAmount += amount;
      } else {
        failureReasonMap.unknown.count += 1;
        failureReasonMap.unknown.lostAmount += amount;
      }

      // Potentially recoverable if recovery probability >= 50
      const prob = tx.recovery_probability ?? 50;
      if (prob >= 50) {
        potentiallyRecoverableRevenue += Math.round(amount * (prob / 100));
      }

      if (tx.is_high_priority) {
        highPriorityOpportunities.push(tx);
      }
    }
  }

  // Calculate Recovery Rate % = (Recovered / (Lost + Recovered)) * 100
  const totalFailureVolume = revenueLost + revenueRecovered;
  const recoveryRatePct =
    totalFailureVolume > 0 ? Number(((revenueRecovered / totalFailureVolume) * 100).toFixed(1)) : 0;

  // Failure Reason Stats array sorted by lostAmount desc
  const failureReasonStats: FailureReasonStat[] = Object.entries(failureReasonMap)
    .filter(([, data]) => data.count > 0)
    .map(([key, data]) => ({
      reason: key,
      label: data.label,
      count: data.count,
      lostAmount: data.lostAmount,
      percentage: revenueLost > 0 ? Number(((data.lostAmount / revenueLost) * 100).toFixed(1)) : 0,
      recommendedAlternative: data.alternative,
      isCardPattern: data.isCard,
    }))
    .sort((a, b) => b.lostAmount - a.lostAmount);

  // Recovery Trends array sorted chronologically
  const recoveryTrends: RecoveryTrendPoint[] = Object.entries(trendMap)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, vals]) => ({
      date,
      attempted: vals.attempted,
      lost: vals.lost,
      recovered: vals.recovered,
    }));

  // Sort high priority opportunities by amount desc
  highPriorityOpportunities.sort((a, b) => (b.amount || 0) - (a.amount || 0));

  return {
    totalAttemptedRevenue,
    revenueCollected,
    revenueLost,
    potentiallyRecoverableRevenue,
    revenueRecovered,
    recoveryRatePct,
    affectedCustomersCount: affectedCustomerEmails.size,
    failureReasonStats,
    recoveryTrends,
    highPriorityOpportunities: highPriorityOpportunities.slice(0, 15),
  };
}

export function categorizeFailureReasonKey(
  reasonRaw: string,
  retryCount: number = 0,
  status: string = "failed"
): string {
  if (retryCount >= 3) return "repeated_failure";
  if (status === "abandoned") return "abandoned";

  const r = (reasonRaw || "").toLowerCase();
  if (r.includes("insufficient") || r.includes("balance") || r.includes("limit")) return "insufficient_funds";
  if (r.includes("bank_decline") || r.includes("decline") || r.includes("do_not_honor")) return "bank_decline";
  if (r.includes("tech") || r.includes("network") || r.includes("timeout") || r.includes("gateway"))
    return "technical_failure";
  if (r.includes("auth") || r.includes("otp") || r.includes("3ds")) return "authentication_failure";
  if (r.includes("missing") || r.includes("unsupported") || r.includes("no_option")) return "missing_payment_option";
  if (r.includes("abandon")) return "abandoned";
  if (r.includes("repeated")) return "repeated_failure";

  return "unknown";
}
