"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { useTransactions } from "@/lib/transaction-context";
import { Activity, ArrowRight, BarChart3, Database, ShieldAlert, Sparkles, X } from "lucide-react";

export function Shell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const { activeDataSource, setActiveDataSource, notification, clearNotification } = useTransactions();

  return (
    <div className="siteShell">
      <header className="topbar">
        <Link href="/" className="brand" aria-label="Reven dashboard">
          <span className="brandMark">R</span>
          <span>REVEN</span>
        </Link>
        <nav aria-label="Primary navigation" className="mainNav">
          <Link href="/" className={pathname === "/" ? "activeNavLink" : ""}>
            Overview
          </Link>
          <Link href="/revenue" className={pathname === "/revenue" ? "activeNavLink" : ""}>
            Revenue Intelligence
          </Link>
          <Link href="/queue" className={pathname === "/queue" ? "activeNavLink" : ""}>
            Recovery Queue
          </Link>
          <Link href="/transactions" className={pathname === "/transactions" || pathname === "/transaction-data" ? "activeNavLink" : ""}>
            Transaction Data
          </Link>
          <Link href="/settings" className={pathname === "/settings" ? "activeNavLink" : ""}>
            Policy
          </Link>
        </nav>
        <div className="systemStateContainer">
          <div className="sourceToggleGroup" role="group" aria-label="Data source mode">
            <button
              type="button"
              onClick={() => setActiveDataSource("live")}
              className={`sourceBadgeBtn ${activeDataSource === "live" ? "activeLive" : ""}`}
              title="Signed Razorpay Webhook Events"
            >
              <span className="liveDot" /> LIVE RAZORPAY TEST
            </button>
            <button
              type="button"
              onClick={() => setActiveDataSource("demo")}
              className={`sourceBadgeBtn ${activeDataSource === "demo" ? "activeDemo" : ""}`}
              title="Seeded / Uploaded CSV Demo Dataset"
            >
              <Sparkles size={11} /> SIMULATED DEMO
            </button>
          </div>
        </div>
      </header>

      {/* Global Notification Toast */}
      {notification && (
        <div className={`notificationBanner notification-${notification.type}`} role="status">
          <div className="notificationContent">
            <span>{notification.message}</span>
            <button onClick={clearNotification} className="closeNotifBtn" aria-label="Dismiss notification">
              <X size={14} />
            </button>
          </div>
        </div>
      )}

      {children}

      <footer className="footer">
        <div className="footerLeft">
          <span>REVEN / REVENUE INTELLIGENCE & RECOVERY CONTROL</span>
          <span className="footerDivider">·</span>
          <span className="footerDisclaimer">
            {activeDataSource === "demo"
              ? "DEMO MODE — All communications & links are simulated. No live cards/PII stored."
              : "RAZORPAY TEST MODE ONLY — Real signed webhook verification active."}
          </span>
        </div>
        <div className="footerRight">
          <Link href="/transactions" className="footerLink">
            <Database size={12} /> CSV Ingestion
          </Link>
          <Link href="/queue" className="footerLink">
            <Activity size={12} /> Recovery Queue
          </Link>
        </div>
      </footer>
    </div>
  );
}
