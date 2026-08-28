"use client";

import React, { useState } from "react";
import Link from "next/link";
import {
  X,
  ArrowRight,
  ArrowLeft,
  Sparkles,
  Database,
  PieChart,
  ListOrdered,
  ShieldCheck,
  CheckCircle2,
  Radio,
} from "lucide-react";
import { useTransactions } from "@/lib/transaction-context";

interface GuidedDemoModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const money = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 0,
});

export function GuidedDemoModal({ isOpen, onClose }: GuidedDemoModalProps) {
  const [currentStep, setCurrentStep] = useState(1);
  const { loadDemoDataset, transactions, metrics, setActiveDataSource } = useTransactions();
  const [loadedNotice, setLoadedNotice] = useState(false);

  if (!isOpen) return null;

  const totalSteps = 5;

  function handleLoadData() {
    loadDemoDataset();
    setActiveDataSource("demo");
    setLoadedNotice(true);
    setTimeout(() => setLoadedNotice(false), 3000);
  }

  return (
    <div className="modalOverlay" onClick={onClose}>
      <div className="guidedDemoModal" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
        {/* Header */}
        <div className="guidedDemoHeader">
          <div className="flex items-center gap-2">
            <span className="demoStepBadge">
              STEP {currentStep} OF {totalSteps}
            </span>
            <span className="demoCategoryTitle">GUIDED PRODUCT TOUR</span>
          </div>
          <button type="button" onClick={onClose} className="modalCloseBtn" aria-label="Close guided demo">
            <X size={18} />
          </button>
        </div>

        {/* Progress Bar */}
        <div className="demoProgressTrack">
          <div
            className="demoProgressBarFill"
            style={{ width: `${(currentStep / totalSteps) * 100}%` }}
          />
        </div>

        {/* Step Content */}
        <div className="guidedDemoBody">
          {currentStep === 1 && (
            <div className="demoStepContent">
              <div className="demoStepIconWrap iconEmerald">
                <Database size={24} />
              </div>
              <h3>Step 1: Load Simulated Merchant Data</h3>
              <p>
                Reven comes with a clearly labelled 500-transaction fictional online-course merchant scenario. Its numbers are calculated from the currently loaded demo data.
              </p>
              <div className="demoActionBox">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <strong>Fictional Merchant Dataset</strong>
                    <small>{transactions.length} simulated payments across multiple payment methods.</small>
                  </div>
                  <button
                    type="button"
                    onClick={handleLoadData}
                    className="button buttonPrimary buttonSmall"
                  >
                    <Sparkles size={14} />
                    <span>{transactions.length === 500 ? "Reload 500 Demo Cases" : "Load Demo Dataset"}</span>
                  </button>
                </div>
                {loadedNotice && (
                  <div className="demoSuccessNotice">
                    <CheckCircle2 size={14} />
                    <span>Dataset loaded successfully! Ready to analyse.</span>
                  </div>
                )}
              </div>
              <div className="demoCallout">
                <strong>Current demo totals:</strong> {money.format(metrics.revenueLost)} at risk and {money.format(metrics.potentiallyRecoverableRevenue)} potentially recoverable. No customer is contacted.
              </div>
            </div>
          )}

          {currentStep === 2 && (
            <div className="demoStepContent">
              <div className="demoStepIconWrap iconAmber">
                <PieChart size={24} />
              </div>
              <h3>Step 2: See Why Revenue Was Lost</h3>
              <p>
                Reven categorises every failed checkout into root causes and calculates the financial leakage across payment rails.
              </p>
              <div className="demoVisualInsight">
                {metrics.failureReasonStats.slice(0, 3).map((stat, index) => (
                  <div className="insightRow" key={stat.reason}>
                    <span className="insightLabel">{stat.label}</span>
                    <div className="insightBarWrap">
                      <div className="insightBar" style={{ width: `${stat.percentage}%`, background: index === 0 ? "var(--status-amber)" : index === 1 ? "var(--status-blue)" : "var(--text-muted)" }} />
                    </div>
                    <span className="insightVal">{stat.percentage}% of loss ({money.format(stat.lostAmount)})</span>
                  </div>
                ))}
              </div>
              <div className="demoCallout">
                <strong>Key Insight:</strong> The bars above are calculated from the loaded simulated dataset. Open Analyse to see the full cause breakdown and recommended alternatives.
              </div>
            </div>
          )}

          {currentStep === 3 && (
            <div className="demoStepContent">
              <div className="demoStepIconWrap iconBlue">
                <ListOrdered size={24} />
              </div>
              <h3>Step 3: Open the Recovery Queue</h3>
              <p>
                Every payment drop is ranked by recoverable value and likelihood of recovery. Uncluttered rows give clear next actions.
              </p>
              <div className="demoMockTable">
                <div className="mockTableHeader">
                  <span>AMOUNT</span>
                  <span>FAILURE REASON</span>
                  <span>RECOMMENDED ACTION</span>
                  <span>STATUS</span>
                </div>
                <div className="mockTableRow highlightMock">
                  <span className="mockAmt">₹5,999</span>
                  <span>Card declined by issuing bank</span>
                  <div>
                    <strong className="text-primary fontMedium">1-Click UPI Payment Link</strong>
                    <small className="block text-text-muted text-[11px]">Recommend UPI because card declined &amp; retry is allowed.</small>
                  </div>
                  <span className="statusPill statusPill-failed">Failed</span>
                </div>
              </div>
              <div className="demoCallout">
                <strong>No confusing jargon:</strong> Merchants immediately see the transaction amount, failure reason, and exact recommended next step.
              </div>
            </div>
          )}

          {currentStep === 4 && (
            <div className="demoStepContent">
              <div className="demoStepIconWrap iconEmerald">
                <ShieldCheck size={24} />
              </div>
              <h3>Step 4: Review One Safe Recommendation</h3>
              <p>
                Reven provides plain-language explanations for every recommendation and enforces strict safety policy thresholds.
              </p>
              <div className="demoRationaleCard">
                <div className="rationaleTop">
                  <span className="utilityLabel">SAFETY RULES IN ACTION</span>
                  <span className="rulePill">CASE-SPECIFIC CONFIDENCE</span>
                </div>
                <h4>&quot;Recommendations are evaluated from the failure reason, retry history, recovery probability, and safety rules for that specific case.&quot;</h4>
                <div className="rationaleChecks">
                  <div className="checkItem">
                    <CheckCircle2 size={15} className="text-primary" />
                    <span>Amount is checked against the human-approval threshold.</span>
                  </div>
                  <div className="checkItem">
                    <CheckCircle2 size={15} className="text-primary" />
                    <span>Diagnosis confidence is checked against the safety floor.</span>
                  </div>
                  <div className="checkItem">
                    <CheckCircle2 size={15} className="text-primary" />
                    <span>Retry and contact limits are checked before any action is allowed.</span>
                  </div>
                </div>
              </div>
              <div className="demoCallout">
                <strong>AI is strictly bounded:</strong> AI diagnoses the cause, but rules and human review control all actions.
              </div>
            </div>
          )}

          {currentStep === 5 && (
            <div className="demoStepContent">
              <div className="demoStepIconWrap iconViolet">
                <Radio size={24} />
              </div>
              <h3>Step 5: See Real Razorpay Test Mode Proof</h3>
              <p>
                In Live Test Mode, Reven connects to real signed Razorpay webhooks. Revenue is attributed and counted only after Razorpay verifies payment.
              </p>
              <div className="demoProofReceipt">
                <div className="receiptHeader">
                  <span className="font-mono text-xs text-status-amber">RAZORPAY TEST MODE WEBHOOK RECEIPT</span>
                  <span className="badgeLive"><span className="liveDot" /> SIGNED &amp; VERIFIED</span>
                </div>
                <div className="receiptBody">
                  <div className="receiptRow">
                  <span>Verified event:</span>
                    <code>payment_link.paid</code>
                  </div>
                  <div className="receiptRow">
                    <span>Recovery evidence:</span>
                    <code>Signed Razorpay Test Mode webhook</code>
                  </div>
                  <div className="receiptRow">
                    <span>Verified Test Mode recovery:</span>
                    <strong className="text-primary fontMedium">₹201.00 across 2 paid webhooks</strong>
                  </div>
                </div>
              </div>
              <div className="demoCallout">
                <strong>Important:</strong> Generating a payment link is never counted as revenue until a signed Razorpay webhook confirms payment.
              </div>
            </div>
          )}
        </div>

        {/* Footer Navigation */}
        <div className="guidedDemoFooter">
          <button
            type="button"
            onClick={() => setCurrentStep((prev) => Math.max(1, prev - 1))}
            disabled={currentStep === 1}
            className="button buttonSecondary buttonSmall"
          >
            <ArrowLeft size={14} /> Previous
          </button>

          <div className="flex items-center gap-2">
            {currentStep < totalSteps ? (
              <button
                type="button"
                onClick={() => setCurrentStep((prev) => Math.min(totalSteps, prev + 1))}
                className="button buttonPrimary buttonSmall"
              >
                Next Step <ArrowRight size={14} />
              </button>
            ) : (
              <Link
                href="/queue"
                onClick={onClose}
                className="button buttonPrimary buttonSmall"
              >
                Explore Recovery Queue <ArrowRight size={14} />
              </Link>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
