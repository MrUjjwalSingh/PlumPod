"use client";

import { useState } from "react";
import {
  ShieldAlert,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  RefreshCw,
  ChevronDown,
  Filter,
  TrendingUp,
  Clock,
  Activity,
  Users,
} from "lucide-react";
import Navbar from "@/components/Navbar";
import ClaimStatusTable from "@/components/ClaimStatusTable";
import AdjudicateSummary from "@/components/AdjudicateSummary";
import {
  useClaimsStore,
  formatCurrency,
  STATUS_CONFIG,
  type ClaimStatus,
  type Claim,
} from "@/store/claimsStore";

// The statuses that require human review
const REVIEW_STATUSES: ClaimStatus[] = ["MANUAL_REVIEW", "LOW_SYSTEM_CONFIDENCE"];

export default function AdminDashboardPage() {
  const { claims, updateClaimStatus, selectClaim } = useClaimsStore();
  const [activeQueue, setActiveQueue] = useState<"all" | "review" | "pending">("all");
  const [overrideModal, setOverrideModal] = useState<{
    claim: Claim | null;
    action: "APPROVED" | "REJECTED" | null;
  }>({ claim: null, action: null });
  const [overrideNote, setOverrideNote] = useState("");
  const [overriding, setOverriding] = useState(false);
  const [overrideDone, setOverrideDone] = useState<string | null>(null);

  // Aggregate stats
  const reviewQueue = claims.filter((c) => REVIEW_STATUSES.includes(c.status));
  const totalClaims = claims.length;
  const autoApproved = claims.filter((c) => c.status === "APPROVED").length;
  const totalExposure = claims.reduce((s, c) => s + c.amountRequested, 0);
  const pendingExposure = reviewQueue.reduce((s, c) => s + c.amountRequested, 0);

  const displayClaims =
    activeQueue === "review"
      ? claims.filter((c) => REVIEW_STATUSES.includes(c.status))
      : activeQueue === "pending"
      ? claims.filter((c) => c.status === "PROCESSING")
      : claims;

  const handleOverrideConfirm = async () => {
    if (!overrideModal.claim || !overrideModal.action) return;
    setOverriding(true);
    await sleep(1400);
    updateClaimStatus(
      overrideModal.claim.id,
      overrideModal.action,
      overrideNote ||
        `Adjuster ${overrideModal.action === "APPROVED" ? "approved" : "rejected"} claim after manual review.`
    );
    setOverriding(false);
    setOverrideDone(overrideModal.claim.id);
    setOverrideModal({ claim: null, action: null });
    setOverrideNote("");
    setTimeout(() => setOverrideDone(null), 3000);
  };

  return (
    <div className="min-h-screen">
      <Navbar />

      {/* Page header */}
      <div className="border-b border-[--border] bg-[--bg-surface]/50">
        <div className="mx-auto max-w-screen-xl px-6 py-8">
          <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="flex items-center gap-2.5 mb-1">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600">
                  <ShieldAlert size={16} />
                </div>
                <span className="text-xs font-semibold text-indigo-600 uppercase tracking-wider">
                  Adjuster Console
                </span>
              </div>
              <h1 className="text-2xl font-bold text-[--text-primary]">
                Claims Review Dashboard
              </h1>
              <p className="text-sm text-[--text-secondary] mt-1">
                Override AI decisions · Manage escalations · Audit all submissions
              </p>
            </div>
            {reviewQueue.length > 0 && (
              <div className="flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
                <AlertTriangle size={16} className="text-amber-700 flex-shrink-0" />
                <div>
                  <p className="text-sm font-bold text-amber-700">{reviewQueue.length} items</p>
                  <p className="text-xs text-[--text-muted]">Need manual review</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Success toast */}
      {overrideDone && (
        <div className="fixed top-5 right-5 z-50 flex items-center gap-3 rounded-xl border border-emerald-200 bg-[--bg-elevated] px-5 py-3 shadow-xl animate-fade-in">
          <CheckCircle2 size={18} className="text-emerald-700" />
          <p className="text-sm text-[--text-primary]">
            Claim <span className="font-mono text-emerald-700">{overrideDone}</span> override applied successfully.
          </p>
        </div>
      )}

      <main className="mx-auto max-w-screen-xl px-6 py-8">
        <div className="flex flex-col gap-6">
          {/* KPI Stats */}
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <AdminStatCard
              icon={<Users size={18} />}
              label="Total Claims"
              value={String(totalClaims)}
              sub="All time"
              color="violet"
            />
            <AdminStatCard
              icon={<Activity size={18} />}
              label="Auto-Approved"
              value={String(autoApproved)}
              sub={`${Math.round((autoApproved / totalClaims) * 100)}% automation rate`}
              color="emerald"
            />
            <AdminStatCard
              icon={<Clock size={18} />}
              label="Review Queue"
              value={String(reviewQueue.length)}
              sub={`${formatCurrency(pendingExposure)} at risk`}
              color="amber"
            />
            <AdminStatCard
              icon={<TrendingUp size={18} />}
              label="Total Exposure"
              value={formatCurrency(totalExposure)}
              sub="Across all claims"
              color="sky"
            />
          </div>

          {/* Filter bar */}
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-1.5 text-xs text-[--text-muted]">
              <Filter size={13} />
              View Queue:
            </div>
            {(
              [
                { id: "all", label: "All Claims", count: claims.length },
                { id: "review", label: "Manual Review / Low Confidence", count: reviewQueue.length, highlight: true },
                { id: "pending", label: "Processing", count: claims.filter(c => c.status === "PROCESSING").length },
              ] as const
            ).map((q) => (
              <button
                key={q.id}
                id={`admin-queue-filter-${q.id}`}
                onClick={() => setActiveQueue(q.id)}
                className={`flex items-center gap-2 rounded-lg border px-3 py-1.5 text-xs font-medium transition-all duration-200 ${
                  activeQueue === q.id
                    ? ('highlight' in q && q.highlight)
                      ? "border-amber-500/40 bg-amber-50 text-amber-300"
                      : "border-indigo-200 bg-indigo-50 text-indigo-700"
                    : "border-[--border] text-[--text-muted] hover:border-[--border-strong] hover:text-[--text-primary]"
                }`}
              >
                {q.label}
                <span className={`rounded-full px-1.5 py-0.5 text-[10px] ${activeQueue === q.id ? "bg-white/15" : "bg-[--bg-elevated]"}`}>
                  {q.count}
                </span>
              </button>
            ))}
          </div>

          {/* Review Queue — Override Cards */}
          {activeQueue === "review" && reviewQueue.length > 0 && (
            <div className="flex flex-col gap-3">
              <h2 className="text-sm font-semibold text-[--text-primary] flex items-center gap-2">
                <AlertTriangle size={14} className="text-amber-700" />
                Items Requiring Adjuster Action
              </h2>
              {reviewQueue.map((claim) => (
                <ReviewCard
                  key={claim.id}
                  claim={claim}
                  onViewBreakdown={() => selectClaim(claim.id)}
                  onApprove={() => setOverrideModal({ claim, action: "APPROVED" })}
                  onReject={() => setOverrideModal({ claim, action: "REJECTED" })}
                />
              ))}
            </div>
          )}

          {/* Global claims table */}
          <ClaimStatusTable isAdmin />
        </div>
      </main>

      {/* Adjudication breakdown modal */}
      <AdjudicateSummary />

      {/* Override confirmation modal */}
      {overrideModal.claim && (
        <OverrideModal
          claim={overrideModal.claim}
          action={overrideModal.action!}
          note={overrideNote}
          loading={overriding}
          onNoteChange={setOverrideNote}
          onConfirm={handleOverrideConfirm}
          onCancel={() => { setOverrideModal({ claim: null, action: null }); setOverrideNote(""); }}
        />
      )}
    </div>
  );
}

// ─── Review Card ────────────────────────────────────────────────────────────

function ReviewCard({
  claim,
  onViewBreakdown,
  onApprove,
  onReject,
}: {
  claim: Claim;
  onViewBreakdown: () => void;
  onApprove: () => void;
  onReject: () => void;
}) {
  const cfg = STATUS_CONFIG[claim.status];
  const hardStops = claim.ruleViolations.filter((r) => r.severity === "HARD_STOP");

  return (
    <div className="glass-card glass-card-hover animate-fade-in">
      <div className="flex flex-col gap-4 p-5 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2 mb-2">
            <span className="font-mono text-sm font-bold text-indigo-600">{claim.id}</span>
            <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold ${cfg.bg} ${cfg.text}`}>
              <span className={`h-1.5 w-1.5 rounded-full ${cfg.dot}`} />
              {cfg.label}
            </span>
            {hardStops.length > 0 && (
              <span className="rounded-full bg-red-50 px-2.5 py-0.5 text-xs font-semibold text-red-700">
                ⛔ {hardStops.length} Hard Stop{hardStops.length > 1 ? "s" : ""}
              </span>
            )}
          </div>
          <p className="font-medium text-[--text-primary]">{claim.patientName}</p>
          <p className="text-sm text-[--text-secondary] mt-0.5">
            {claim.department} · {claim.extractedFields.providerName}
          </p>

          {/* Top violation highlight */}
          {claim.ruleViolations[0] && (
            <div className="mt-3 rounded-lg border border-[--border] bg-[--bg-base]/60 px-3 py-2">
              <p className="text-xs text-[--text-muted] mb-0.5">Top Flag</p>
              <p className="text-xs text-[--text-primary] font-mono">{claim.ruleViolations[0].code}</p>
              <p className="text-xs text-[--text-secondary] mt-0.5 line-clamp-1">
                {claim.ruleViolations[0].description}
              </p>
            </div>
          )}
        </div>

        <div className="flex flex-col items-end gap-3 flex-shrink-0">
          <div className="text-right">
            <p className="text-xs text-[--text-muted]">Requested</p>
            <p className="text-lg font-bold text-[--text-primary]">{formatCurrency(claim.amountRequested)}</p>
            <p className="text-xs text-[--text-muted] mt-0.5">
              OCR: {(claim.extractedFields.ocrConfidence * 100).toFixed(0)}%
              · Fraud Risk: {claim.adjudicationMetrics.fraudScore}/100
            </p>
          </div>

          <div className="flex gap-2">
            <button
              id={`view-breakdown-admin-${claim.id}`}
              onClick={onViewBreakdown}
              className="rounded-lg border border-[--border] bg-[--bg-elevated] px-3 py-1.5 text-xs font-medium text-[--text-secondary] hover:text-[--text-primary] hover:border-[--border-strong] transition-all"
            >
              View Details
            </button>
            <button
              id={`reject-claim-${claim.id}`}
              onClick={onReject}
              className="flex items-center gap-1.5 rounded-lg border border-red-200 bg-red-500/10 px-3 py-1.5 text-xs font-semibold text-red-700 hover:bg-red-100 transition-all active:scale-95"
            >
              <XCircle size={13} />
              Reject
            </button>
            <button
              id={`approve-claim-${claim.id}`}
              onClick={onApprove}
              className="flex items-center gap-1.5 rounded-lg border border-emerald-200 bg-emerald-500/10 px-3 py-1.5 text-xs font-semibold text-emerald-700 hover:bg-emerald-100 transition-all active:scale-95"
            >
              <CheckCircle2 size={13} />
              Approve
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Override Modal ─────────────────────────────────────────────────────────

function OverrideModal({
  claim,
  action,
  note,
  loading,
  onNoteChange,
  onConfirm,
  onCancel,
}: {
  claim: Claim;
  action: "APPROVED" | "REJECTED";
  note: string;
  loading: boolean;
  onNoteChange: (v: string) => void;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const isApprove = action === "APPROVED";

  return (
    <>
      <div
        className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm animate-fade-in"
        onClick={onCancel}
      />
      <div
        id="override-confirm-modal"
        role="dialog"
        aria-modal="true"
        className="fixed inset-0 z-50 flex items-center justify-center p-4"
      >
        <div className="animate-slide-up glass-card w-full max-w-md p-6 shadow-2xl">
          <div className={`mb-5 flex items-center gap-3 rounded-xl border p-4 ${isApprove ? "border-emerald-200 bg-emerald-50" : "border-red-200 bg-red-50"}`}>
            <div className={`flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full ${isApprove ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-700"}`}>
              {isApprove ? <CheckCircle2 size={22} /> : <XCircle size={22} />}
            </div>
            <div>
              <p className={`font-semibold ${isApprove ? "text-emerald-700" : "text-red-700"}`}>
                {isApprove ? "Approve Claim Payout" : "Reject Claim Execution"}
              </p>
              <p className="text-sm text-[--text-secondary] mt-0.5">
                {claim.id} · {formatCurrency(claim.amountRequested)}
              </p>
            </div>
          </div>

          <p className="text-sm text-[--text-secondary] mb-4">
            You are manually overriding the AI adjudication decision for{" "}
            <span className="font-semibold text-[--text-primary]">{claim.patientName}</span>. This action will be
            recorded in the audit ledger with your identity.
          </p>

          <div className="mb-5">
            <label
              htmlFor="override-note-input"
              className="block text-xs font-semibold text-[--text-muted] uppercase tracking-wider mb-1.5"
            >
              Adjuster Note (required for audit trail)
            </label>
            <textarea
              id="override-note-input"
              rows={3}
              value={note}
              onChange={(e) => onNoteChange(e.target.value)}
              placeholder="Enter the reason for this override decision…"
              className="w-full resize-none rounded-lg border border-[--border] bg-[--bg-base] px-3 py-2 text-sm text-[--text-primary] placeholder:text-[--text-muted] focus:border-indigo-400 focus:outline-none focus:ring-1 focus:ring-indigo-200 transition-all"
            />
          </div>

          <div className="flex gap-3">
            <button
              id="cancel-override-btn"
              onClick={onCancel}
              disabled={loading}
              className="flex-1 rounded-lg border border-[--border] py-2.5 text-sm font-medium text-[--text-secondary] hover:text-[--text-primary] hover:border-[--border-strong] transition-all disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              id="confirm-override-btn"
              onClick={onConfirm}
              disabled={loading}
              className={`flex flex-1 items-center justify-center gap-2 rounded-lg py-2.5 text-sm font-semibold transition-all active:scale-95 disabled:opacity-60 ${
                isApprove
                  ? "bg-emerald-600 text-white hover:bg-emerald-500"
                  : "bg-red-600 text-white hover:bg-red-500"
              }`}
            >
              {loading ? (
                <>
                  <RefreshCw size={14} className="spin-ring" />
                  Applying…
                </>
              ) : (
                <>
                  {isApprove ? <CheckCircle2 size={14} /> : <XCircle size={14} />}
                  Confirm {isApprove ? "Approval" : "Rejection"}
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function AdminStatCard({
  icon,
  label,
  value,
  sub,
  color,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  sub?: string;
  color: "violet" | "emerald" | "amber" | "sky";
}) {
  const colorMap = {
    violet: "text-indigo-600 bg-indigo-50",
    emerald: "text-emerald-700 bg-emerald-50",
    amber: "text-amber-700 bg-amber-50",
    sky: "text-sky-600 bg-sky-50",
  };
  const c = colorMap[color];
  return (
    <div className="glass-card p-5 animate-fade-in">
      <div className={`mb-3 inline-flex h-10 w-10 items-center justify-center rounded-xl ${c}`}>
        {icon}
      </div>
      <p className="text-2xl font-bold text-[--text-primary]">{value}</p>
      <p className="text-xs text-[--text-muted] mt-0.5">{label}</p>
      {sub && <p className={`text-xs mt-1 ${c.split(" ")[0]}`}>{sub}</p>}
    </div>
  );
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}
