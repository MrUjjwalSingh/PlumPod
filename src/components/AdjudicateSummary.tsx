"use client";

import { useEffect, useRef } from "react";
import {
  X,
  ShieldCheck,
  ShieldX,
  AlertTriangle,
  Info,
  Clock,
  Cpu,
  User,
  Building2,
  FileBarChart2,
  CheckCircle2,
  XCircle,
  Activity,
  Stethoscope,
  BadgeDollarSign,
  Bot,
  Wrench,
} from "lucide-react";
import {
  useClaimsStore,
  formatCurrency,
  STATUS_CONFIG,
  RULE_SEVERITY_CONFIG,
  type AuditNote,
} from "@/store/claimsStore";

const SEVERITY_ICONS = {
  HARD_STOP: <ShieldX size={14} />,
  SOFT_FLAG: <AlertTriangle size={14} />,
  WARNING: <Info size={14} />,
};

const ACTOR_ICONS: Record<AuditNote["actor"], JSX.Element> = {
  AI_ENGINE: <Bot size={13} />,
  SYSTEM: <Cpu size={13} />,
  ADJUSTER: <Wrench size={13} />,
};

const ACTOR_COLORS: Record<AuditNote["actor"], string> = {
  AI_ENGINE: "text-violet-400 bg-violet-500/15",
  SYSTEM: "text-sky-400 bg-sky-500/15",
  ADJUSTER: "text-amber-400 bg-amber-500/15",
};

export default function AdjudicationSummary() {
  const { claims, selectedClaimId, selectClaim } = useClaimsStore();
  const panelRef = useRef<HTMLDivElement>(null);

  const claim = claims.find((c) => c.id === selectedClaimId);

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") selectClaim(null);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [selectClaim]);

  // Lock body scroll when open
  useEffect(() => {
    if (claim) document.body.style.overflow = "hidden";
    else document.body.style.overflow = "";
    return () => { document.body.style.overflow = ""; };
  }, [claim]);

  if (!claim) return null;

  const { extractedFields: ef, adjudicationMetrics: am, ruleViolations, auditNotes, status } = claim;
  const cfg = STATUS_CONFIG[status];
  const limitPct = Math.min(
    100,
    Math.round(((500000 - am.annualLimitAfter) / 500000) * 100)
  );

  return (
    <>
      {/* Backdrop */}
      <div
        id="adjudication-modal-backdrop"
        className="fixed inset-0 z-40 bg-black/70 backdrop-blur-sm animate-fade-in"
        onClick={() => selectClaim(null)}
      />

      {/* Side panel */}
      <div
        ref={panelRef}
        id="adjudication-modal"
        role="dialog"
        aria-modal="true"
        aria-label={`Adjudication breakdown for ${claim.id}`}
        className="fixed inset-y-0 right-0 z-50 flex w-full max-w-2xl flex-col border-l border-[--border] bg-[--bg-surface] animate-slide-up overflow-hidden shadow-2xl"
        style={{ animationName: "slideInRight" }}
      >
        {/* ── Header ── */}
        <div className="flex items-start justify-between gap-4 border-b border-[--border] bg-[--bg-elevated]/80 px-6 py-5 backdrop-blur-xl">
          <div className="min-w-0">
            <div className="flex items-center gap-3 flex-wrap">
              <h2 className="font-mono text-xl font-bold text-white">{claim.id}</h2>
              <span
                className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${cfg.bg} ${cfg.text}`}
              >
                <span className={`h-1.5 w-1.5 rounded-full ${cfg.dot}`} />
                {cfg.label}
              </span>
            </div>
            <p className="mt-1 text-sm text-[--text-secondary] truncate">
              {claim.patientName} · {ef.providerName}
            </p>
            <p className="text-xs text-[--text-muted] mt-0.5">
              Submitted {new Date(claim.date).toLocaleDateString("en-IN", { day: "2-digit", month: "long", year: "numeric" })}
              {" · "}
              Processed in {(am.processingTimeMs / 1000).toFixed(1)}s by {am.systemVersion}
            </p>
          </div>
          <button
            id="close-adjudication-modal"
            onClick={() => selectClaim(null)}
            className="flex-shrink-0 flex h-9 w-9 items-center justify-center rounded-lg border border-[--border] text-[--text-muted] hover:border-[--border-strong] hover:text-white transition-colors"
            aria-label="Close"
          >
            <X size={17} />
          </button>
        </div>

        {/* ── Scrollable body ── */}
        <div className="flex-1 overflow-y-auto">
          {/* Payout Summary Banner */}
          <div className={`mx-6 mt-5 rounded-xl border px-5 py-4 ${
            am.approvedAmount > 0
              ? "border-emerald-500/25 bg-emerald-500/8"
              : "border-red-500/25 bg-red-500/8"
          }`}>
            <div className="flex items-center justify-between flex-wrap gap-3">
              <div>
                <p className="text-xs text-[--text-secondary] uppercase tracking-wider">Approved Payout</p>
                <p className={`text-2xl font-bold mt-0.5 ${am.approvedAmount > 0 ? "text-emerald-400" : "text-red-400"}`}>
                  {formatCurrency(am.approvedAmount)}
                </p>
                <p className="text-xs text-[--text-muted] mt-0.5">
                  of {formatCurrency(claim.amountRequested)} requested
                  {am.deductibleApplied > 0 && ` · Deductible: ${formatCurrency(am.deductibleApplied)}`}
                  {am.coPayApplied > 0 && ` · Co-pay: ${formatCurrency(am.coPayApplied)}`}
                </p>
              </div>
              <div className={`flex h-12 w-12 items-center justify-center rounded-full ${
                am.approvedAmount > 0 ? "bg-emerald-500/20 text-emerald-400" : "bg-red-500/20 text-red-400"
              }`}>
                {am.approvedAmount > 0 ? <CheckCircle2 size={22} /> : <XCircle size={22} />}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-5 p-6 sm:grid-cols-2">
            {/* ── AI Confidence Scores ── */}
            <section aria-labelledby="scores-heading" className="sm:col-span-2">
              <h3 id="scores-heading" className="section-label mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-[--text-muted]">
                <Activity size={13} />
                AI Decision Metrics
              </h3>
              <div className="grid grid-cols-3 gap-3">
                <ScoreCard label="Eligibility" value={am.eligibilityScore} color="emerald" />
                <ScoreCard
                  label="Fraud Risk"
                  value={am.fraudScore}
                  color={am.fraudScore > 40 ? "red" : am.fraudScore > 20 ? "amber" : "emerald"}
                  invertScale
                />
                <ScoreCard label="Policy Match" value={am.policyMatchScore} color="violet" />
              </div>
            </section>

            {/* ── Extracted Document Fields ── */}
            <section aria-labelledby="extracted-heading">
              <h3 id="extracted-heading" className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-[--text-muted]">
                <FileBarChart2 size={13} />
                Extracted Fields
              </h3>
              <div className="rounded-xl border border-[--border] bg-[--bg-base]/60 divide-y divide-[--border]">
                <FieldRow icon={<User size={13} />} label="Patient" value={ef.patientName} />
                <FieldRow icon={<Building2 size={13} />} label="Provider" value={ef.providerName} />
                <FieldRow icon={<Clock size={13} />} label="Service Date" value={new Date(ef.serviceDate).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })} />
                <FieldRow label="Invoice No." value={ef.invoiceNumber} mono />
                <FieldRow label="NPI" value={ef.providerNPI ?? "—"} mono />
                <FieldRow
                  label="Network Status"
                  value={ef.isInNetwork ? "In-Network ✓" : "Out-of-Network ✗"}
                  valueClass={ef.isInNetwork ? "text-emerald-400" : "text-red-400"}
                />
                <FieldRow
                  label="OCR Confidence"
                  value={`${(ef.ocrConfidence * 100).toFixed(0)}%`}
                  valueClass={ef.ocrConfidence >= 0.85 ? "text-emerald-400" : ef.ocrConfidence >= 0.75 ? "text-amber-400" : "text-red-400"}
                />
              </div>
            </section>

            {/* ── Clinical Codes ── */}
            <section aria-labelledby="codes-heading">
              <h3 id="codes-heading" className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-[--text-muted]">
                <Stethoscope size={13} />
                Clinical Codes
              </h3>
              <div className="rounded-xl border border-[--border] bg-[--bg-base]/60 divide-y divide-[--border]">
                <div className="px-4 py-3">
                  <p className="text-xs text-[--text-muted] mb-2">ICD-10 Diagnosis</p>
                  <div className="flex flex-wrap gap-2">
                    {ef.diagnosisCodes.map((code) => (
                      <span key={code} className="rounded-md bg-sky-500/15 px-2 py-0.5 font-mono text-xs text-sky-400">
                        {code}
                      </span>
                    ))}
                  </div>
                </div>
                <div className="px-4 py-3">
                  <p className="text-xs text-[--text-muted] mb-2">CPT Procedures</p>
                  <div className="flex flex-wrap gap-2">
                    {ef.procedureCodes.map((code) => (
                      <span key={code} className="rounded-md bg-violet-500/15 px-2 py-0.5 font-mono text-xs text-violet-400">
                        {code}
                      </span>
                    ))}
                  </div>
                </div>
                <div className="px-4 py-3">
                  <p className="text-xs text-[--text-muted] mb-1">Pre-Authorization</p>
                  <div className="flex items-center gap-2">
                    {am.preAuthRequired ? (
                      <>
                        <span className={`text-xs font-medium ${am.preAuthObtained ? "text-emerald-400" : "text-red-400"}`}>
                          {am.preAuthObtained ? "Required & Obtained ✓" : "Required — NOT Obtained ✗"}
                        </span>
                      </>
                    ) : (
                      <span className="text-xs text-[--text-muted]">Not required for this procedure</span>
                    )}
                  </div>
                </div>
              </div>

              {/* Annual Limit Usage */}
              <div className="mt-3 rounded-xl border border-[--border] bg-[--bg-base]/60 px-4 py-3">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs text-[--text-muted] flex items-center gap-1.5">
                    <BadgeDollarSign size={13} />
                    Annual Limit Usage
                  </p>
                  <p className="text-xs font-semibold text-white">
                    {formatCurrency(500000 - am.annualLimitAfter)} / {formatCurrency(500000)}
                  </p>
                </div>
                <div className="h-2 w-full overflow-hidden rounded-full bg-[--bg-elevated]">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-violet-600 to-cyan-500 progress-fill"
                    style={{ width: `${limitPct}%` }}
                  />
                </div>
                <p className="mt-1 text-right text-xs text-[--text-muted]">{limitPct}% consumed</p>
              </div>
            </section>

            {/* ── Rule Violations ── */}
            <section aria-labelledby="rules-heading" className="sm:col-span-2">
              <h3 id="rules-heading" className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-[--text-muted]">
                <ShieldCheck size={13} />
                Rule Adjudication Engine — Violations
                <span className="rounded-full bg-[--bg-elevated] px-2 py-0.5 text-[10px] text-[--text-muted]">
                  {ruleViolations.length} triggered
                </span>
              </h3>
              {ruleViolations.length === 0 ? (
                <div className="flex items-center gap-3 rounded-xl border border-emerald-500/20 bg-emerald-500/8 px-5 py-4">
                  <ShieldCheck size={20} className="text-emerald-400 flex-shrink-0" />
                  <div>
                    <p className="text-sm font-semibold text-emerald-400">All rules passed</p>
                    <p className="text-xs text-[--text-muted] mt-0.5">
                      No policy violations detected. Claim cleared all {15} automated adjudication rules.
                    </p>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col gap-2">
                  {ruleViolations.map((v) => {
                    const scfg = RULE_SEVERITY_CONFIG[v.severity];
                    return (
                      <div
                        key={v.code}
                        className={`rounded-xl border px-5 py-4 ${v.severity === "HARD_STOP" ? "border-red-500/25 bg-red-500/8" : v.severity === "SOFT_FLAG" ? "border-amber-500/25 bg-amber-500/8" : "border-sky-500/25 bg-sky-500/8"}`}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex items-center gap-2.5">
                            <span className={`flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg ${scfg.bg} ${scfg.text}`}>
                              {SEVERITY_ICONS[v.severity]}
                            </span>
                            <div>
                              <div className="flex items-center gap-2">
                                <span className={`text-xs font-mono font-bold ${scfg.text}`}>{v.code}</span>
                                <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${scfg.bg} ${scfg.text}`}>
                                  {scfg.label}
                                </span>
                              </div>
                              <p className="text-sm text-white mt-1 leading-snug">{v.description}</p>
                              {v.triggeredValue && (
                                <p className="text-xs text-[--text-muted] mt-1.5">
                                  Triggered by:{" "}
                                  <span className="font-mono text-[--text-secondary]">{v.triggeredValue}</span>
                                </p>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </section>

            {/* ── Audit Notes Ledger ── */}
            <section aria-labelledby="audit-heading" className="sm:col-span-2">
              <h3 id="audit-heading" className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-[--text-muted]">
                <Clock size={13} />
                Automated Notes Ledger
              </h3>
              <ol className="relative border-l border-[--border-strong] ml-4 flex flex-col gap-0">
                {auditNotes.map((note, i) => (
                  <li key={i} className="relative pl-6 pb-5">
                    {/* Timeline dot */}
                    <span className={`absolute -left-2 top-0.5 flex h-4 w-4 items-center justify-center rounded-full border border-[--border] ${ACTOR_COLORS[note.actor]}`}>
                      {ACTOR_ICONS[note.actor]}
                    </span>
                    <div className="rounded-lg border border-[--border] bg-[--bg-base]/60 px-4 py-3">
                      <div className="flex items-center justify-between gap-2 mb-1.5">
                        <span className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[10px] font-semibold ${ACTOR_COLORS[note.actor]}`}>
                          {ACTOR_ICONS[note.actor]}
                          {note.actor.replace("_", " ")}
                        </span>
                        <time className="text-xs text-[--text-muted]">
                          {new Date(note.timestamp).toLocaleString("en-IN", {
                            day: "2-digit",
                            month: "short",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </time>
                      </div>
                      <p className="text-sm text-[--text-secondary] leading-relaxed">{note.message}</p>
                    </div>
                  </li>
                ))}
              </ol>
            </section>
          </div>
        </div>

        {/* ── Footer ── */}
        <div className="border-t border-[--border] bg-[--bg-elevated]/80 px-6 py-4 backdrop-blur-xl">
          <div className="flex items-center justify-between text-xs text-[--text-muted]">
            <span>
              Engine: <span className="text-violet-400 font-mono">{am.systemVersion}</span>
              {" · "}
              Duplicate check: <span className={am.duplicateCheckPassed ? "text-emerald-400" : "text-red-400"}>
                {am.duplicateCheckPassed ? "Passed" : "Failed"}
              </span>
            </span>
            <button
              id="close-modal-footer-btn"
              onClick={() => selectClaim(null)}
              className="rounded-lg border border-[--border] px-4 py-1.5 text-[--text-secondary] hover:border-[--border-strong] hover:text-white transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes slideInRight {
          from { transform: translateX(100%); opacity: 0; }
          to { transform: translateX(0); opacity: 1; }
        }
      `}</style>
    </>
  );
}

// ─── Sub-components ─────────────────────────────────────────────────────────

function ScoreCard({
  label,
  value,
  color,
  invertScale = false,
}: {
  label: string;
  value: number;
  color: "emerald" | "violet" | "red" | "amber";
  invertScale?: boolean;
}) {
  const colorMap = {
    emerald: { bar: "from-emerald-600 to-emerald-400", text: "text-emerald-400", bg: "bg-emerald-500/10" },
    violet: { bar: "from-violet-600 to-violet-400", text: "text-violet-400", bg: "bg-violet-500/10" },
    red: { bar: "from-red-600 to-red-400", text: "text-red-400", bg: "bg-red-500/10" },
    amber: { bar: "from-amber-600 to-amber-400", text: "text-amber-400", bg: "bg-amber-500/10" },
  };
  const c = colorMap[color];
  const displayPct = invertScale ? value : value;

  return (
    <div className={`rounded-xl border border-[--border] ${c.bg} px-4 py-4 text-center`}>
      <p className={`text-2xl font-bold ${c.text}`}>{value}</p>
      <p className="text-xs text-[--text-muted] mt-0.5">{label}</p>
      <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-[--bg-elevated]">
        <div
          className={`h-full rounded-full bg-gradient-to-r ${c.bar} progress-fill`}
          style={{ width: `${displayPct}%` }}
        />
      </div>
    </div>
  );
}

function FieldRow({
  icon,
  label,
  value,
  mono = false,
  valueClass,
}: {
  icon?: React.ReactNode;
  label: string;
  value: string;
  mono?: boolean;
  valueClass?: string;
}) {
  return (
    <div className="flex items-start justify-between gap-4 px-4 py-2.5">
      <div className="flex items-center gap-1.5 min-w-0">
        {icon && <span className="text-[--text-muted] flex-shrink-0">{icon}</span>}
        <span className="text-xs text-[--text-muted] whitespace-nowrap">{label}</span>
      </div>
      <span
        className={`text-right text-xs font-medium truncate max-w-[55%] ${mono ? "font-mono" : ""} ${valueClass ?? "text-white"}`}
      >
        {value}
      </span>
    </div>
  );
}
