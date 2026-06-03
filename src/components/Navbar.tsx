"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Zap,
  LayoutDashboard,
  ShieldAlert,
  ChevronRight,
} from "lucide-react";

const NAV_ITEMS = [
  { label: "My Dashboard", href: "/", icon: LayoutDashboard },
  { label: "Adjuster Console", href: "/admin", icon: ShieldAlert },
];

export default function Navbar() {
  const pathname = usePathname();

  return (
    <nav
      className="sticky top-0 z-30 border-b border-[--border] bg-[--bg-surface]/80 backdrop-blur-xl"
      role="navigation"
      aria-label="Main navigation"
    >
      <div className="mx-auto flex h-16 max-w-screen-xl items-center justify-between px-6">
        {/* Brand */}
        <Link href="/" id="nav-brand" className="flex items-center gap-2.5 group">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-violet-600 to-indigo-700 shadow-lg shadow-violet-900/40 group-hover:shadow-violet-700/50 transition-shadow">
            <Zap size={18} className="text-white" fill="currentColor" />
          </div>
          <div>
            <span className="block text-sm font-bold text-white leading-tight">Plum AI Adjudicator</span>
            <span className="block text-[10px] text-[--text-muted] leading-tight">Insurance Automation Platform</span>
          </div>
        </Link>

        {/* Nav links */}
        <div className="flex items-center gap-1">
          {NAV_ITEMS.map(({ label, href, icon: Icon }) => {
            const active = pathname === href;
            return (
              <Link
                key={href}
                href={href}
                id={`nav-${label.toLowerCase().replace(/\s+/g, "-")}`}
                className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-all duration-200 ${
                  active
                    ? "bg-violet-500/15 text-violet-300"
                    : "text-[--text-secondary] hover:bg-[--bg-elevated] hover:text-white"
                }`}
              >
                <Icon size={15} />
                {label}
                {active && <ChevronRight size={13} className="text-violet-400 opacity-60" />}
              </Link>
            );
          })}
        </div>

        {/* Status indicator */}
        <div className="hidden sm:flex items-center gap-2 rounded-full border border-[--border] bg-[--bg-elevated] px-3 py-1.5">
          <span className="h-2 w-2 rounded-full bg-emerald-400 pulse-dot" />
          <span className="text-xs text-[--text-secondary]">AGY Engine Online</span>
        </div>
      </div>
    </nav>
  );
}
