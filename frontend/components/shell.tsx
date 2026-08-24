"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, type ReactNode } from "react";
import { useTransactions } from "@/lib/transaction-context";
import {
  Activity,
  ArrowRight,
  Database,
  Menu,
  Sparkles,
  X,
  FileCheck2,
  ShieldCheck,
} from "lucide-react";
import { HelpTooltip } from "./help-tooltip";

export function Shell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const { activeDataSource, setActiveDataSource, notification, clearNotification } = useTransactions();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  function toggleMode() {
    setActiveDataSource(activeDataSource === "live" ? "demo" : "live");
  }

  const isHome = pathname === "/";
  const isAnalyse =
    pathname === "/analyse" ||
    pathname === "/intelligence" ||
    pathname === "/revenue" ||
    pathname === "/data" ||
    pathname === "/transactions" ||
    pathname === "/transaction-data";
  const isQueue = pathname === "/queue" || pathname === "/recovery-queue";
  const isEvidence = pathname === "/evidence" || pathname.startsWith("/case");
  const isRules = pathname === "/rules" || pathname === "/settings";

  return (
    <div className="siteShell">
      {/* Top Header Bar */}
      <header className="topbar">
        {/* Left: Brand */}
        <Link href="/" className="brand" aria-label="Reven dashboard" onClick={() => setMobileMenuOpen(false)}>
          <span className="brandMark">R</span>
          <div className="flex flex-col">
            <span className="font-bold tracking-widest text-primary">REVEN</span>
            <span className="text-[9px] text-text-technical tracking-wider -mt-0.5 font-medium">REVENUE RECOVERY</span>
          </div>
        </Link>

        {/* Center: Desktop Navigation (5 Sections) */}
        <nav aria-label="Primary navigation" className="desktopNav">
          <Link href="/" className={isHome ? "activeNavLink" : ""}>
            Home
          </Link>
          <Link href="/analyse" className={isAnalyse ? "activeNavLink" : ""}>
            Analyse
          </Link>
          <Link href="/queue" className={isQueue ? "activeNavLink" : ""}>
            Recovery Queue
          </Link>
          <Link href="/evidence" className={isEvidence ? "activeNavLink" : ""}>
            Evidence
          </Link>
          <Link href="/rules" className={isRules ? "activeNavLink" : ""}>
            Rules
          </Link>
        </nav>

        {/* Right: Mode Indicator & Toggler */}
        <div className="topbarRight">
          <div className="flex items-center gap-2 border border-border-subtle bg-surface-container-highest px-3 py-1 mr-2 hidden sm:flex">
            <div className={`w-1.5 h-1.5 rounded-full ${activeDataSource === "live" ? "bg-status-amber animate-pulse" : "bg-primary"}`} />
            <span className={`font-mono text-[11px] font-semibold uppercase ${activeDataSource === "live" ? "text-status-amber" : "text-primary"}`}>
              {activeDataSource === "live" ? "Live Test Mode" : "Demo Sandbox"}
            </span>
            <HelpTooltip
              topic={activeDataSource === "live" ? "live_test_mode" : "demo_scenario"}
              className="ml-1"
            />
          </div>

          <button
            type="button"
            onClick={toggleMode}
            className="button buttonSecondary buttonSmall text-[11px] h-8 px-3"
            title={`Click to switch to ${activeDataSource === "live" ? "Demo Sandbox" : "Live Test Mode"}`}
            aria-label={`Current mode: ${activeDataSource === "live" ? "Live Test Mode" : "Demo Sandbox"}. Click to toggle.`}
          >
            {activeDataSource === "live" ? (
              <>
                <Sparkles size={12} className="text-primary" />
                <span>Switch to Demo</span>
              </>
            ) : (
              <>
                <span className="w-1.5 h-1.5 rounded-full bg-status-amber animate-pulse" />
                <span>Switch to Live</span>
              </>
            )}
          </button>

          {/* Mobile Hamburger Button */}
          <button
            type="button"
            className="mobileMenuToggle"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            aria-label={mobileMenuOpen ? "Close navigation menu" : "Open navigation menu"}
            aria-expanded={mobileMenuOpen}
          >
            {mobileMenuOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>
      </header>

      {/* Mobile Drawer Menu */}
      {mobileMenuOpen && (
        <div className="mobileMenuOverlay" onClick={() => setMobileMenuOpen(false)}>
          <div className="mobileMenuDrawer" onClick={(e) => e.stopPropagation()}>
            <div className="mobileDrawerHeader">
              <span className="utilityLabel">NAVIGATION</span>
              <button
                type="button"
                className="closeDrawerBtn"
                onClick={() => setMobileMenuOpen(false)}
                aria-label="Close menu"
              >
                <X size={18} />
              </button>
            </div>

            <nav className="mobileNavLinks" aria-label="Mobile navigation">
              <Link
                href="/"
                className={`mobileNavLink ${isHome ? "activeMobileLink" : ""}`}
                onClick={() => setMobileMenuOpen(false)}
              >
                <span>Home</span>
                <ArrowRight size={14} />
              </Link>
              <Link
                href="/analyse"
                className={`mobileNavLink ${isAnalyse ? "activeMobileLink" : ""}`}
                onClick={() => setMobileMenuOpen(false)}
              >
                <span>Analyse</span>
                <ArrowRight size={14} />
              </Link>
              <Link
                href="/queue"
                className={`mobileNavLink ${isQueue ? "activeMobileLink" : ""}`}
                onClick={() => setMobileMenuOpen(false)}
              >
                <span>Recovery Queue</span>
                <ArrowRight size={14} />
              </Link>
              <Link
                href="/evidence"
                className={`mobileNavLink ${isEvidence ? "activeMobileLink" : ""}`}
                onClick={() => setMobileMenuOpen(false)}
              >
                <span>Evidence</span>
                <ArrowRight size={14} />
              </Link>
              <Link
                href="/rules"
                className={`mobileNavLink ${isRules ? "activeMobileLink" : ""}`}
                onClick={() => setMobileMenuOpen(false)}
              >
                <span>Rules &amp; Safety</span>
                <ArrowRight size={14} />
              </Link>
            </nav>

            <div className="mobileDrawerFooter">
              <span className="utilityLabel">ACTIVE ENVIRONMENT</span>
              <div className="mobileModeToggleGroup">
                <button
                  type="button"
                  onClick={() => {
                    setActiveDataSource("live");
                    setMobileMenuOpen(false);
                  }}
                  className={`mobileModeBtn ${activeDataSource === "live" ? "activeLive" : ""}`}
                >
                  <span className="liveDot" /> Live Test Mode
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setActiveDataSource("demo");
                    setMobileMenuOpen(false);
                  }}
                  className={`mobileModeBtn ${activeDataSource === "demo" ? "activeDemo" : ""}`}
                >
                  <Sparkles size={12} /> Demo Sandbox
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

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
          <span>REVEN / REVENUE RECOVERY</span>
          <span className="footerDivider">·</span>
          <span className="footerDisclaimer">
            {activeDataSource === "demo"
              ? "DEMO DATA — 500 simulated transactions. No customer messages are dispatched."
              : "RAZORPAY TEST MODE — Real cryptographic webhook verification active."}
          </span>
        </div>
        <div className="footerRight">
          <Link href="/analyse" className="footerLink">
            <Activity size={12} /> Analyse
          </Link>
          <Link href="/queue" className="footerLink">
            <Database size={12} /> Recovery Queue
          </Link>
          <Link href="/evidence" className="footerLink">
            <FileCheck2 size={12} /> Evidence
          </Link>
          <Link href="/rules" className="footerLink">
            <ShieldCheck size={12} /> Rules
          </Link>
        </div>
      </footer>
    </div>
  );
}
