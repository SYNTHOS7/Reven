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
} from "lucide-react";

export function Shell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const { activeDataSource, setActiveDataSource, notification, clearNotification } = useTransactions();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  function toggleMode() {
    setActiveDataSource(activeDataSource === "live" ? "demo" : "live");
  }

  const isOverview = pathname === "/";
  const isIntelligence = pathname === "/intelligence" || pathname === "/revenue";
  const isQueue = pathname === "/queue" || pathname === "/recovery-queue";
  const isData = pathname === "/data" || pathname === "/transactions" || pathname === "/transaction-data";
  const isPolicy = pathname === "/settings";

  return (
    <div className="siteShell">
      {/* Top Header Bar */}
      <header className="topbar">
        {/* Left: Brand */}
        <Link href="/" className="brand" aria-label="Reven dashboard" onClick={() => setMobileMenuOpen(false)}>
          <span className="brandMark">R</span>
          <div className="flex flex-col">
            <span className="font-bold tracking-widest text-primary">REVEN</span>
            <span className="text-[9px] text-text-technical tracking-wider -mt-0.5">TERMINAL v1.0.4</span>
          </div>
        </Link>

        {/* Center: Desktop Navigation */}
        <nav aria-label="Primary navigation" className="desktopNav">
          <Link href="/" className={isOverview ? "activeNavLink" : ""}>
            Overview
          </Link>
          <Link href="/intelligence" className={isIntelligence ? "activeNavLink" : ""}>
            Intelligence
          </Link>
          <Link href="/queue" className={isQueue ? "activeNavLink" : ""}>
            Recovery Queue
          </Link>
          <Link href="/data" className={isData ? "activeNavLink" : ""}>
            Data
          </Link>
          <Link href="/settings" className={isPolicy ? "activeNavLink" : ""}>
            Policy & Rules
          </Link>
        </nav>

        {/* Right: Mode Indicator & Toggler */}
        <div className="topbarRight">
          <div className="flex items-center gap-2 border border-border-subtle bg-surface-container-highest px-3 py-1 mr-2 hidden sm:flex">
            <div className={`w-1.5 h-1.5 rounded-full ${activeDataSource === "live" ? "bg-status-amber animate-pulse" : "bg-primary"}`} />
            <span className={`font-mono text-[11px] font-semibold uppercase ${activeDataSource === "live" ? "text-status-amber" : "text-primary"}`}>
              {activeDataSource === "live" ? "Live Test Mode" : "Demo Sandbox"}
            </span>
          </div>

          <button
            type="button"
            onClick={toggleMode}
            className="btnMidnightSecondary text-[10px] h-8 px-3"
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
                className={`mobileNavLink ${isOverview ? "activeMobileLink" : ""}`}
                onClick={() => setMobileMenuOpen(false)}
              >
                <span>Overview</span>
                <ArrowRight size={14} />
              </Link>
              <Link
                href="/intelligence"
                className={`mobileNavLink ${isIntelligence ? "activeMobileLink" : ""}`}
                onClick={() => setMobileMenuOpen(false)}
              >
                <span>Intelligence</span>
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
                href="/data"
                className={`mobileNavLink ${isData ? "activeMobileLink" : ""}`}
                onClick={() => setMobileMenuOpen(false)}
              >
                <span>Data</span>
                <ArrowRight size={14} />
              </Link>
              <Link
                href="/settings"
                className={`mobileNavLink ${isPolicy ? "activeMobileLink" : ""}`}
                onClick={() => setMobileMenuOpen(false)}
              >
                <span>Policy</span>
                <ArrowRight size={14} />
              </Link>
            </nav>

            <div className="mobileDrawerFooter">
              <span className="utilityLabel">ACTIVE TELEMETRY MODE</span>
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
          <span>REVEN / RECOVERY CONTROL</span>
          <span className="footerDivider">·</span>
          <span className="footerDisclaimer">
            {activeDataSource === "demo"
              ? "DEMO DATA — simulated, no customer communication is sent."
              : "RAZORPAY TEST MODE ONLY — Real signed webhook verification active."}
          </span>
        </div>
        <div className="footerRight">
          <Link href="/data" className="footerLink">
            <Database size={12} /> Data
          </Link>
          <Link href="/queue" className="footerLink">
            <Activity size={12} /> Recovery Queue
          </Link>
        </div>
      </footer>
    </div>
  );
}
