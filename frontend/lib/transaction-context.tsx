"use client";

import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import {
  generateSampleCsvString,
  generateSeededDemoTransactions,
  parseAndValidateCSV,
} from "./demo-data";
import { computeRevenueIntelligence, deriveTransactionIntelligence } from "./recovery-logic";
import type {
  CSVValidationResult,
  DemoActionType,
  RevenueIntelligenceMetrics,
  Transaction,
} from "./types";

interface TransactionContextType {
  transactions: Transaction[];
  activeDataSource: "demo" | "live";
  setActiveDataSource: (source: "demo" | "live") => void;
  metrics: RevenueIntelligenceMetrics;
  isSimulated: boolean;
  notification: { type: "success" | "error" | "info"; message: string } | null;
  clearNotification: () => void;
  loadDemoDataset: () => void;
  resetDemo: () => void;
  uploadCsvText: (csvText: string) => CSVValidationResult;
  downloadSampleCsv: () => void;
  performAction: (transactionId: string, actionType: DemoActionType, note?: string) => void;
  recoverAllHighPriority: () => { recoveredCount: number; recoveredAmount: number };
  lastActionSummary: { count: number; amount: number; timestamp: number } | null;
}

const TransactionContext = createContext<TransactionContextType | null>(null);

const STORAGE_KEY = "reven_demo_transactions_v2";
const SOURCE_KEY = "reven_data_source_mode";

export function TransactionProvider({ children }: { children: React.ReactNode }) {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [activeDataSource, setActiveDataSourceState] = useState<"demo" | "live">("demo");
  const [notification, setNotification] = useState<{
    type: "success" | "error" | "info";
    message: string;
  } | null>(null);
  const [lastActionSummary, setLastActionSummary] = useState<{
    count: number;
    amount: number;
    timestamp: number;
  } | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);

  // Initialize from LocalStorage or Seeded Data
  useEffect(() => {
    try {
      const savedSource = localStorage.getItem(SOURCE_KEY) as "demo" | "live" | null;
      if (savedSource === "live" || savedSource === "demo") {
        setActiveDataSourceState(savedSource);
      }

      const savedData = localStorage.getItem(STORAGE_KEY);
      if (savedData) {
        const parsed = JSON.parse(savedData);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setTransactions(parsed);
          setIsInitialized(true);
          return;
        }
      }
    } catch {
      // Fallback
    }

    // Default: initialize with seeded demo dataset
    const seeded = generateSeededDemoTransactions();
    setTransactions(seeded);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(seeded));
    } catch {
      // ignore
    }
    setIsInitialized(true);
  }, []);

  // Save to LocalStorage whenever transactions change
  useEffect(() => {
    if (!isInitialized) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(transactions));
    } catch {
      // ignore
    }
  }, [transactions, isInitialized]);

  function setActiveDataSource(source: "demo" | "live") {
    setActiveDataSourceState(source);
    try {
      localStorage.setItem(SOURCE_KEY, source);
    } catch {
      // ignore
    }
  }

  function loadDemoDataset() {
    const seeded = generateSeededDemoTransactions();
    setTransactions(seeded);
    setNotification({
      type: "success",
      message: "Loaded 500 simulated online-course transactions (~₹1.40L lost, ~₹46K recovered).",
    });
  }

  function resetDemo() {
    localStorage.removeItem(STORAGE_KEY);
    const seeded = generateSeededDemoTransactions();
    setTransactions(seeded);
    setNotification({
      type: "info",
      message: "Demo dataset reset to initial state.",
    });
  }

  function uploadCsvText(csvText: string): CSVValidationResult {
    const res = parseAndValidateCSV(csvText);
    if (res.valid && res.transactions.length > 0) {
      setTransactions(res.transactions);
      setNotification({
        type: "success",
        message: `Successfully imported ${res.transactions.length} transactions from CSV.`,
      });
    } else {
      setNotification({
        type: "error",
        message: res.errors[0]?.message || "CSV validation failed. Please review the errors.",
      });
    }
    return res;
  }

  function downloadSampleCsv() {
    const csvContent = generateSampleCsvString();
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", "reven_sample_transactions.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setNotification({
      type: "info",
      message: "Sample CSV template downloaded.",
    });
  }

  function performAction(transactionId: string, actionType: DemoActionType, note?: string) {
    setTransactions((prev) =>
      prev.map((tx) => {
        if (tx.transaction_id !== transactionId) return tx;

        const isRecovering = actionType === "mark_recovered";
        const newStatus = isRecovering ? "recovered" : tx.status;
        const now = new Date().toISOString();

        return {
          ...tx,
          status: newStatus,
          action_status: actionType,
          action_note: note || getActionDefaultNote(actionType, tx),
          simulated_link:
            actionType === "create_payment_link"
              ? `https://pay.reven.ai/rec/${tx.transaction_id}`
              : tx.simulated_link,
          recovered_at: isRecovering ? now : tx.recovered_at,
          ...deriveTransactionIntelligence({ ...tx, status: newStatus }),
        };
      })
    );

    if (actionType === "mark_recovered") {
      const target = transactions.find((t) => t.transaction_id === transactionId);
      const amt = target ? target.amount : 0;
      setLastActionSummary({ count: 1, amount: amt, timestamp: Date.now() });
      setNotification({
        type: "success",
        message: `Marked ₹${amt.toLocaleString("en-IN")} as Recovered! Revenue intelligence updated.`,
      });
    } else {
      setNotification({
        type: "info",
        message: `Simulated action '${actionType.replaceAll("_", " ")}' triggered. No real messages sent.`,
      });
    }
  }

  function recoverAllHighPriority(): { recoveredCount: number; recoveredAmount: number } {
    let count = 0;
    let amount = 0;
    const now = new Date().toISOString();

    setTransactions((prev) =>
      prev.map((tx) => {
        if (tx.status !== "recovered" && tx.status !== "successful" && tx.is_high_priority) {
          count++;
          amount += tx.amount;
          return {
            ...tx,
            status: "recovered",
            action_status: "mark_recovered",
            action_note: "Batch recovered via 1-click High-Priority Recovery simulation",
            simulated_link: `https://pay.reven.ai/rec/${tx.transaction_id}`,
            recovered_at: now,
            ...deriveTransactionIntelligence({ ...tx, status: "recovered" }),
          };
        }
        return tx;
      })
    );

    setLastActionSummary({ count, amount, timestamp: Date.now() });
    setNotification({
      type: "success",
      message: `Batch simulated recovery complete! Recovered ${count} high-priority payments totaling ₹${amount.toLocaleString("en-IN")}.`,
    });

    return { recoveredCount: count, recoveredAmount: amount };
  }

  const metrics = useMemo(() => {
    return computeRevenueIntelligence(transactions);
  }, [transactions]);

  function clearNotification() {
    setNotification(null);
  }

  return (
    <TransactionContext.Provider
      value={{
        transactions,
        activeDataSource,
        setActiveDataSource,
        metrics,
        isSimulated: activeDataSource === "demo",
        notification,
        clearNotification,
        loadDemoDataset,
        resetDemo,
        uploadCsvText,
        downloadSampleCsv,
        performAction,
        recoverAllHighPriority,
        lastActionSummary,
      }}
    >
      {children}
    </TransactionContext.Provider>
  );
}

export function useTransactions() {
  const context = useContext(TransactionContext);
  if (!context) {
    throw new Error("useTransactions must be used within a TransactionProvider");
  }
  return context;
}

function getActionDefaultNote(action: DemoActionType, tx: Transaction): string {
  switch (action) {
    case "preview_whatsapp":
      return "WhatsApp reminder previewed & ready to send";
    case "preview_email":
      return "Email payment link template generated";
    case "create_payment_link":
      return `Simulated payment link created: https://pay.reven.ai/rec/${tx.transaction_id}`;
    case "recommend_alternative":
      return "Alternative UPI Intent recommended to bypass card decline";
    case "escalate_high_value":
      return "Escalated to human concierge for priority recovery";
    case "mark_recovered":
      return "Simulated payment received and attributed";
    default:
      return "";
  }
}
