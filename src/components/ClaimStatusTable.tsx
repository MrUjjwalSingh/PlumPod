"use client";

import { useState } from "react";
import {
  ChevronRight,
  ArrowUpDown,
  Search,
  SlidersHorizontal,
  FileSearch,
} from "lucide-react";
import {
  useClaimsStore,
  formatCurrency,
  STATUS_CONFIG,
  type ClaimStatus,
  type Claim,
} from "@/store/claimsStore";

const ALL_STATUSES: ClaimStatus[] = [
  "APPROVED",
  "PARTIAL",
  "MANUAL_REVIEW",
  "REJECTED",
  "LOW_SYSTEM_CONFIDENCE",
  "PROCESSING",
];

interface ClaimStatusTableProps {
  /** If provided, only show claims for this employee */
  employeeId?: string;
  /** Show admin-level columns */
  isAdmin?: boolean;
}

export default function ClaimStatusTable({
  employeeId,
  isAdmin = false,
}: ClaimStatusTableProps) {
  const { claims, selectClaim } = useClaimsStore();
  const [searchQuery, setSearchQuery] = useState("");
  const [activeFilters, setActiveFilters] = useState<Set<ClaimStatus>>(new Set());
  const [sortField, setSortField] = useState<keyof Claim>("date");
  const [sortAsc, setSortAsc] = useState(false);

  const toggleFilter = (status: ClaimStatus) => {
    setActiveFilters((prev) => {
      const next = new Set(prev);
      next.has(status) ? next.delete(status) : next.add(status);
      return next;
    });
  };

  const toggleSort = (field: keyof Claim) => {
    if (sortField === field) setSortAsc((v) => !v);
    else { setSortField(field); setSortAsc(false); }
  };

  const filtered = claims
    .filter((c) => {
      if (employeeId && c.employeeId !== employeeId) return false;
      if (activeFilters.size > 0 && !activeFilters.has(c.status)) return false;
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        return (
          c.id.toLowerCase().includes(q) ||
          c.patientName.toLowerCase().includes(q) ||
          c.submittedBy.toLowerCase().includes(q) ||
          c.department.toLowerCase().includes(q)
        );
      }
      return true;
    })
    .sort((a, b) => {
      let aVal: string | number = a[sortField] as string | number;
      let bVal: string | number = b[sortField] as string | number;
      if (typeof aVal === "string") aVal = aVal.toLowerCase();
      if (typeof bVal === "string") bVal = bVal.toLowerCase();
      if (aVal < bVal) return sortAsc ? -1 : 1;
      if (aVal > bVal) return sortAsc ? 1 : -1;
      return 0;
    });

  return (
    <div className="glass-card animate-fade-in overflow-hidden">
      {/* Header */}
      <div className="flex flex-col gap-4 border-b border-[--border] p-6 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-white">
            {isAdmin ? "All Claims — Global View" : "Claim History"}
          </h2>
          <p className="text-sm text-[--text-secondary] mt-0.5">
            {filtered.length} claim{filtered.length !== 1 ? "s" : ""}{" "}
            {activeFilters.size > 0 ? "matching filters" : "total"}
          </p>
        </div>

        {/* Search */}
        <div className="relative w-full sm:w-72">
          <Search
            size={15}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-[--text-muted]"
          />
          <input
            id="claims-search-input"
            type="text"
            placeholder="Search by ID, patient, dept…"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full rounded-lg border border-[--border] bg-[--bg-surface] pl-9 pr-4 py-2 text-sm text-white placeholder:text-[--text-muted] focus:border-violet-500/50 focus:outline-none focus:ring-1 focus:ring-violet-500/30 transition-all"
          />
        </div>
      </div>

      {/* Status Filters */}
      <div className="flex flex-wrap items-center gap-2 border-b border-[--border] px-6 py-3">
        <SlidersHorizontal size={13} className="text-[--text-muted]" />
        <span className="text-xs text-[--text-muted] mr-1">Filter:</span>
        {ALL_STATUSES.map((status) => {
          const cfg = STATUS_CONFIG[status];
          const active = activeFilters.has(status);
          return (
            <button
              key={status}
              id={`filter-btn-${status.toLowerCase()}`}
              onClick={() => toggleFilter(status)}
              className={`flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium transition-all duration-200 border ${
                active
                  ? `${cfg.bg} ${cfg.text} border-current/30`
                  : "border-[--border] text-[--text-muted] hover:border-[--border-strong] hover:text-white"
              }`}
            >
              <span className={`h-1.5 w-1.5 rounded-full ${active ? cfg.dot : "bg-current opacity-50"}`} />
              {cfg.label}
            </button>
          );
        })}
        {activeFilters.size > 0 && (
          <button
            id="clear-filters-btn"
            onClick={() => setActiveFilters(new Set())}
            className="ml-auto text-xs text-[--text-muted] hover:text-white underline underline-offset-2 transition-colors"
          >
            Clear all
          </button>
        )}
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full min-w-[720px] border-collapse">
          <thead>
            <tr className="border-b border-[--border]">
              {[
                { label: "Claim ID", field: "id" as keyof Claim },
                { label: "Patient", field: "patientName" as keyof Claim },
                ...(isAdmin ? [{ label: "Department", field: "department" as keyof Claim }] : []),
                { label: "Date", field: "date" as keyof Claim },
                { label: "Requested", field: "amountRequested" as keyof Claim },
                { label: "Status", field: "status" as keyof Claim },
              ].map(({ label, field }) => (
                <th
                  key={field}
                  className="px-6 py-3 text-left"
                  onClick={() => toggleSort(field)}
                >
                  <button
                    id={`sort-${field}-btn`}
                    className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-widest text-[--text-muted] hover:text-white transition-colors"
                  >
                    {label}
                    <ArrowUpDown
                      size={11}
                      className={`transition-opacity ${sortField === field ? "opacity-100 text-violet-400" : "opacity-40"}`}
                    />
                  </button>
                </th>
              ))}
              <th className="px-6 py-3 text-right text-xs font-semibold uppercase tracking-widest text-[--text-muted]">
                Action
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[--border]">
            {filtered.length === 0 ? (
              <tr>
                <td
                  colSpan={isAdmin ? 7 : 6}
                  className="py-16 text-center"
                >
                  <div className="flex flex-col items-center gap-3">
                    <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[--bg-elevated] text-[--text-muted]">
                      <FileSearch size={22} />
                    </div>
                    <p className="text-sm text-[--text-muted]">No claims found</p>
                  </div>
                </td>
              </tr>
            ) : (
              filtered.map((claim) => (
                <ClaimRow
                  key={claim.id}
                  claim={claim}
                  isAdmin={isAdmin}
                  onSelect={() => selectClaim(claim.id)}
                />
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── Row Component ──────────────────────────────────────────────────────────

function ClaimRow({
  claim,
  isAdmin,
  onSelect,
}: {
  claim: Claim;
  isAdmin: boolean;
  onSelect: () => void;
}) {
  const cfg = STATUS_CONFIG[claim.status];
  const approved = claim.adjudicationMetrics.approvedAmount;

  return (
    <tr
      className="group transition-colors duration-150 hover:bg-[--bg-elevated]/60"
    >
      {/* Claim ID */}
      <td className="px-6 py-4">
        <span className="font-mono text-sm font-semibold text-violet-400">
          {claim.id}
        </span>
        {claim.fileName && (
          <p className="text-xs text-[--text-muted] mt-0.5 truncate max-w-[120px]">
            {claim.fileName}
          </p>
        )}
      </td>

      {/* Patient */}
      <td className="px-6 py-4">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-violet-500/15 text-xs font-bold text-violet-400">
            {claim.patientName.split(" ").map((n) => n[0]).join("").slice(0, 2)}
          </div>
          <div>
            <p className="text-sm font-medium text-white leading-tight">{claim.patientName}</p>
            <p className="text-xs text-[--text-muted]">{claim.submittedBy}</p>
          </div>
        </div>
      </td>

      {/* Department (admin only) */}
      {isAdmin && (
        <td className="px-6 py-4">
          <span className="text-sm text-[--text-secondary]">{claim.department}</span>
        </td>
      )}

      {/* Date */}
      <td className="px-6 py-4">
        <span className="text-sm text-[--text-secondary]">
          {new Date(claim.date).toLocaleDateString("en-IN", {
            day: "2-digit",
            month: "short",
            year: "numeric",
          })}
        </span>
      </td>

      {/* Amount */}
      <td className="px-6 py-4">
        <div>
          <p className="text-sm font-semibold text-white">{formatCurrency(claim.amountRequested)}</p>
          {approved > 0 && approved < claim.amountRequested && (
            <p className="text-xs text-emerald-400 mt-0.5">
              Approved: {formatCurrency(approved)}
            </p>
          )}
          {approved === claim.amountRequested && approved > 0 && (
            <p className="text-xs text-emerald-400 mt-0.5">Full payout</p>
          )}
          {approved === 0 && claim.status !== "PROCESSING" && (
            <p className="text-xs text-red-400/80 mt-0.5">No payout</p>
          )}
        </div>
      </td>

      {/* Status Badge */}
      <td className="px-6 py-4">
        <span
          className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${cfg.bg} ${cfg.text}`}
        >
          <span className={`h-1.5 w-1.5 rounded-full ${cfg.dot} ${claim.status === "PROCESSING" ? "pulse-dot" : ""}`} />
          {cfg.label}
          {claim.ruleViolations.some((r) => r.severity === "HARD_STOP") && (
            <span className="ml-0.5 text-[10px] opacity-70">⛔</span>
          )}
        </span>
      </td>

      {/* Action */}
      <td className="px-6 py-4 text-right">
        <button
          id={`view-breakdown-${claim.id}`}
          onClick={onSelect}
          className="inline-flex items-center gap-1.5 rounded-lg border border-[--border] bg-[--bg-elevated] px-3 py-1.5 text-xs font-medium text-white transition-all duration-200 hover:border-violet-500/50 hover:bg-violet-500/10 hover:text-violet-300 active:scale-95"
        >
          View Breakdown
          <ChevronRight size={13} className="group-hover:translate-x-0.5 transition-transform" />
        </button>
      </td>
    </tr>
  );
}
