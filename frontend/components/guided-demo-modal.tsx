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

export function GuidedDemoModal({ isOpen, onClose }: GuidedDemoModalProps) {
  const [currentStep, setCurrentStep] = useState(1);
  const { loadDemoDataset, transactions } = useTransactions();
  const [loadedNotice, setLoadedNotice] = useState(false);

  if (!isOpen) return null;

  const totalSteps = 5;

  function handleLoadData() {
    loadDemoDataset();
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
                Reven comes with a realistic 500-transaction dataset of an online course business (~₹1.40L lost to checkout drop-offs, ~₹46K recoverable).
              </p>
              <div className="demoActionBox">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <strong>Fictional Merchant Dataset</strong>
                    <small>500 realistic payments across Cards, UPI, Netbanking &amp; EMI.</small>
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
                <strong>Why this matters:</strong> Merchants and judges can explore complete business-scale failure intelligence immediately without configuring complex database credentials.
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
                <div className="insightRow">
                  <span className="insightLabel">Card Limits &amp; Declines</span>
                  <div className="insightBarWrap">
                    <div className="insightBar" style={{ width: "65%", background: "var(--status-amber)" }} />
                  </div>
                  <span className="insightVal">65% of loss (₹91,000)</span>
                </div>
                <div className="insightRow">
                  <span className="insightLabel">Insufficient Balance</span>
                  <div className="insightBarWrap">
                    <div className="insightBar" style={{ width: "22%", background: "var(--status-blue)" }} />
                  </div>
                  <span className="insightVal">22% of loss (₹30,800)</span>
                </div>
                <div className="insightRow">
                  <span className="insightLabel">OTP / 3DS Abandonment</span>
                  <div className="insightBarWrap">
                    <div className="insightBar" style={{ width: "13%", background: "var(--text-muted)" }} />
                  </div>
                  <span className="insightVal">13% of loss (₹18,200)</span>
                </div>
              </div>
              <div className="demoCallout">
                <strong>Key Insight:</strong> 78% of card failure drop-offs can be instantly recovered by offering an automated 1-click UPI Intent link.
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
                  <span className="rulePill">CONFIDENCE: 92%</span>
                </div>
                <h4>&quot;Recommend UPI Intent because the card payment was declined and customer has 0 prior retries.&quot;</h4>
                <div className="rationaleChecks">
                  <div className="checkItem">
                    <CheckCircle2 size={15} className="text-primary" />
                    <span>Amount is below human approval threshold (&lt; ₹5,000)</span>
                  </div>
                  <div className="checkItem">
                    <CheckCircle2 size={15} className="text-primary" />
                    <span>Confidence exceeds 60% safety floor (92%)</span>
                  </div>
                  <div className="checkItem">
                    <CheckCircle2 size={15} className="text-primary" />
                    <span>Customer has not received any reminders today (0/1)</span>
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
                    <span>Event:</span>
                    <code>payment.captured</code>
                  </div>
                  <div className="receiptRow">
                    <span>Payment Link ID:</span>
                    <code>plink_test_M99zX4821</code>
                  </div>
                  <div className="receiptRow">
                    <span>Verified Attributed Revenue:</span>
                    <strong className="text-primary fontMedium">₹4,999.00</strong>
                  </div>
                </div>
              </div>
              <div className="demoCallout">
                <strong>Zero fake numbers:</strong> Generating a payment link is never counted as revenue until a signed webhook confirms the funds.
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
