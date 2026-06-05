"use client";

import { useEffect, useRef, useState } from "react";
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
  ChevronDown,
  ChevronRight,
} from "lucide-react";
import {
  useClaimsStore,
  formatCurrency,
  STATUS_CONFIG,
  RULE_SEVERITY_CONFIG,
  REJECTION_CATEGORY_COLORS,
  type AuditNote,
} from "@/store/claimsStore";

const SEVERITY_ICONS = {
  HARD_STOP: <ShieldX size={14} />,
  SOFT_FLAG: <AlertTriangle size={14} />,
  WARNING: <Info size={14} />,
};

const ACTOR_ICONS: Record<AuditNote["actor"], React.ReactNode> = {
  AI_ENGINE: <Bot size={13} />,
  SYSTEM: <Cpu size={13} />,
  ADJUSTER: <Wrench size={13} />,
};

const ACTOR_COLORS: Record<AuditNote["actor"], string> = {
  AI_ENGINE: "text-indigo-600 bg-indigo-50",
  SYSTEM: "text-sky-600 bg-sky-50",
  ADJUSTER: "text-amber-700 bg-amber-50",
};

export default function AdjudicationSummary() {
  const { claims, selectedClaimId, selectClaim } = useClaimsStore();
  const panelRef = useRef<HTMLDivElement>(null);
  const [traceOpen, setTraceOpen] = useState(true);

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
    return () => {
      document.body.style.overflow = "";
    };
  }, [claim]);

  if (!claim) return null;

  const { extractedFields: ef, adjudicationMetrics: am, ruleViolations, auditNotes, status } =
    claim;
  const cfg = STATUS_CONFIG[status];
  const do_ = claim.decisionOutput;

  const limitPct = Math.min(
    100,
    Math.round(((500000 - am.annualLimitAfter) / 500000) * 100)
  );

  // Confidence from decisionOutput
  const confScore = do_?.confidence_score;
  const confPct = confScore !== undefined ? Math.round(confScore * 100) : null;
  const confColor =
    confScore === undefined
      ? { text: "text-[--text-muted]", bar: "from-[--border] to-[--border]" }
      : confScore >= 0.85
      ? { text: "text-emerald-700", bar: "from-emerald-600 to-emerald-400" }
      : confScore >= 0.7
      ? { text: "text-amber-700", bar: "from-amber-600 to-amber-400" }
      : { text: "text-red-700", bar: "from-red-600 to-red-400" };

  const confLabel =
    confScore === undefined
      ? ""
      : confScore >= 0.85
      ? "High confidence"
      : confScore >= 0.7
      ? "Medium confidence"
      : "Low confidence";

  // Group rejection reasons by category
  const rejByCategory =
    do_?.rejection_reasons.reduce<
      Record<string, typeof do_.rejection_reasons>
    >((acc, r) => {
      (acc[r.category] ??= []).push(r);
      return acc;
    }, {}) ?? {};

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
        className="fixed inset-y-0 right-0 z-50 flex w-full max-w-2xl flex-col border-l border-[--border] bg-[--bg-surface] overflow-hidden shadow-2xl"
        style={{ animation: "slideInRight 0.3s ease-out" }}
      >
        {/* ── Header ── */}
        <div className="flex items-start justify-between gap-4 border-b border-[--border] bg-[--bg-elevated]/80 px-6 py-5 backdrop-blur-xl">
          <div className="min-w-0">
            <div className="flex items-center gap-3 flex-wrap">
              <h2 className="font-mono text-xl font-bold text-[--text-primary]">{claim.id}</h2>
              <span
                className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${cfg.bg} ${cfg.text}`}
              >
                <span className={`h-1.5 w-1.5 rounded-full ${cfg.dot}`} />
                {cfg.label}
              </span>
              {confPct !== null && (
                <span
                  className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-semibold ${
                    confScore !== undefined && confScore >= 0.85
                      ? "border-emerald-200 bg-emerald-500/10 text-emerald-700"
                      : confScore !== undefined && confScore >= 0.7
                      ? "border-amber-500/30 bg-amber-50 text-amber-700"
                      : "border-red-200 bg-red-500/10 text-red-700"
                  }`}
                >
                  <Activity size={10} />
                  {confPct}% confidence
                </span>
              )}
            </div>
            <p className="mt-1 text-sm text-[--text-secondary] truncate">
              {claim.patientName} · {ef.providerName}
            </p>
            <p className="text-xs text-[--text-muted] mt-0.5">
              Submitted{" "}
              {new Date(claim.date).toLocaleDateString("en-IN", {
                day: "2-digit",
                month: "long",
                year: "numeric",
              })}
              {" · "}
              Processed in {(am.processingTimeMs / 1000).toFixed(1)}s by {am.systemVersion}
            </p>
          </div>
          <button
            id="close-adjudication-modal"
            onClick={() => selectClaim(null)}
            className="flex-shrink-0 flex h-9 w-9 items-center justify-center rounded-lg border border-[--border] text-[--text-muted] hover:border-[--border-strong] hover:text-[--text-primary] transition-colors"
            aria-label="Close"
          >
            <X size={17} />
          </button>
        </div>

        {/* ── Scrollable body ── */}
        <div className="flex-1 overflow-y-auto">
          {/* Payout Summary Banner */}
          <div
            className={`mx-6 mt-5 rounded-xl border px-5 py-4 ${
              am.approvedAmount > 0
                ? "border-emerald-200 bg-emerald-50"
                : "border-red-200 bg-red-50"
            }`}
          >
            <div className="flex items-center justify-between flex-wrap gap-3">
              <div>
                <p className="text-xs text-[--text-secondary] uppercase tracking-wider">
                  Approved Payout
                </p>
                <p
                  className={`text-2xl font-bold mt-0.5 ${
                    am.approvedAmount > 0 ? "text-emerald-700" : "text-red-700"
                  }`}
                >
                  {formatCurrency(am.approvedAmount)}
                </p>
                <p className="text-xs text-[--text-muted] mt-0.5">
                  of {formatCurrency(claim.amountRequested)} requested
                  {am.deductibleApplied > 0 &&
                    ` · Deductible: ${formatCurrency(am.deductibleApplied)}`}
                  {am.coPayApplied > 0 && ` · Co-pay: ${formatCurrency(am.coPayApplied)}`}
                </p>
              </div>
              <div
                className={`flex h-12 w-12 items-center justify-center rounded-full ${
                  am.approvedAmount > 0
                    ? "bg-emerald-100 text-emerald-700"
                    : "bg-red-100 text-red-700"
                }`}
              >
                {am.approvedAmount > 0 ? <CheckCircle2 size={22} /> : <XCircle size={22} />}
              </div>
            </div>
          </div>

          {/* ── Decision Output Section ── */}
          {do_ && (
            <div className="mx-6 mt-4">
              <h3 className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-[--text-muted]">
                <FileBarChart2 size={13} />
                Decision Output
              </h3>
              <div className="rounded-xl border border-[--border] bg-[--bg-base]/60 overflow-hidden">
                {/* Confidence + Notes row */}
                <div className="grid grid-cols-1 divide-y divide-[--border] sm:grid-cols-2 sm:divide-x sm:divide-y-0">
                  {/* Confidence Score */}
                  <div className="px-4 py-4">
                    <p className="text-xs text-[--text-muted] uppercase tracking-wider mb-2">
                      Confidence Score
                    </p>
                    <div className="flex items-end gap-3 mb-3">
                      <span className={`text-3xl font-bold tabular-nums ${confColor.text}`}>
                        {confPct ?? "—"}%
                      </span>
                      <span className={`mb-1 text-xs font-medium ${confColor.text}`}>
                        {confLabel}
                      </span>
                    </div>
                    <div className="h-2 w-full overflow-hidden rounded-full bg-[--bg-elevated]">
                      <div
                        className={`h-full rounded-full bg-gradient-to-r ${confColor.bar} progress-fill`}
                        style={{ width: `${confPct ?? 0}%` }}
                      />
                    </div>
                    <div className="mt-3 grid grid-cols-2 gap-2">
                      <div className="rounded-lg bg-[--bg-elevated]/60 px-2 py-1.5 text-center">
                        <p className="text-[10px] text-[--text-muted]">Fraud Score</p>
                        <p
                          className={`text-sm font-bold ${
                            do_.fraud_score > 40
                              ? "text-red-700"
                              : do_.fraud_score > 20
                              ? "text-amber-700"
                              : "text-emerald-700"
                          }`}
                        >
                          {do_.fraud_score}/100
                        </p>
                      </div>
                      <div className="rounded-lg bg-[--bg-elevated]/60 px-2 py-1.5 text-center">
                        <p className="text-[10px] text-[--text-muted]">Processing</p>
                        <p className="text-sm font-bold text-indigo-600">
                          {(do_.processing_time_ms / 1000).toFixed(2)}s
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Engine Notes */}
                  <div className="px-4 py-4">
                    <p className="text-xs text-[--text-muted] uppercase tracking-wider mb-2">
                      Engine Notes
                    </p>
                    <p className="text-xs text-[--text-secondary] leading-relaxed">{do_.notes}</p>
                  </div>
                </div>

                {/* Next Steps */}
                <div className="border-t border-[--border] px-4 py-3 bg-sky-500/5">
                  <div className="flex items-start gap-2.5">
                    <div className="flex-shrink-0 mt-0.5 flex h-5 w-5 items-center justify-center rounded-full bg-sky-100 text-sky-600">
                      <ChevronRight size={12} />
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-sky-600 mb-0.5">Next Steps</p>
                      <p className="text-xs text-[--text-secondary] leading-relaxed">
                        {do_.next_steps}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Rejection codes list */}
                {do_.rejection_reasons.length > 0 && (
                  <div className="border-t border-[--border] px-4 py-3">
                    <p className="text-xs text-[--text-muted] uppercase tracking-wider mb-2">
                      Rejection Codes
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {do_.rejection_reasons.map((r) => (
                        <span
                          key={r.code}
                          className={`inline-flex items-center gap-1 rounded-md border px-2 py-0.5 font-mono text-[10px] font-semibold ${
                            r.isHardStop
                              ? "border-red-500/20 bg-red-500/10 text-red-700"
                              : "border-amber-500/20 bg-amber-50 text-amber-700"
                          }`}
                        >
                          {r.isHardStop ? "🛑" : "⚠️"} {r.code}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 gap-5 p-6 sm:grid-cols-2">
            {/* ── AI Confidence Scores ── */}
            <section aria-labelledby="scores-heading" className="sm:col-span-2">
              <h3
                id="scores-heading"
                className="section-label mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-[--text-muted]"
              >
                <Activity size={13} />
                AI Decision Metrics
              </h3>
              <div className="grid grid-cols-3 gap-3">
                <ScoreCard label="Eligibility" value={am.eligibilityScore} color="emerald" />
                <ScoreCard
                  label="Fraud Risk"
                  value={am.fraudScore}
                  color={
                    am.fraudScore > 40 ? "red" : am.fraudScore > 20 ? "amber" : "emerald"
                  }
                  invertScale
                />
                <ScoreCard label="Policy Match" value={am.policyMatchScore} color="violet" />
              </div>
            </section>

            {/* ── Extracted Document Fields ── */}
            <section aria-labelledby="extracted-heading">
              <h3
                id="extracted-heading"
                className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-[--text-muted]"
              >
                <FileBarChart2 size={13} />
                Extracted Fields
              </h3>
              <div className="rounded-xl border border-[--border] bg-[--bg-base]/60 divide-y divide-[--border]">
                <FieldRow icon={<User size={13} />} label="Patient" value={ef.patientName} />
                <FieldRow
                  icon={<Building2 size={13} />}
                  label="Provider"
                  value={ef.providerName}
                />
                <FieldRow
                  icon={<Clock size={13} />}
                  label="Service Date"
                  value={new Date(ef.serviceDate).toLocaleDateString("en-IN", {
                    day: "2-digit",
                    month: "short",
                    year: "numeric",
                  })}
                />
                <FieldRow label="Invoice No." value={ef.invoiceNumber} mono />
                <FieldRow label="NPI" value={ef.providerNPI ?? "—"} mono />
                <FieldRow
                  label="Network Status"
                  value={ef.isInNetwork ? "In-Network ✓" : "Out-of-Network ✗"}
                  valueClass={ef.isInNetwork ? "text-emerald-700" : "text-red-700"}
                />
                <FieldRow
                  label="OCR Confidence"
                  value={`${(ef.ocrConfidence * 100).toFixed(0)}%`}
                  valueClass={
                    ef.ocrConfidence >= 0.85
                      ? "text-emerald-700"
                      : ef.ocrConfidence >= 0.75
                      ? "text-amber-700"
                      : "text-red-700"
                  }
                />
              </div>
            </section>

            {/* ── Clinical Codes ── */}
            <section aria-labelledby="codes-heading">
              <h3
                id="codes-heading"
                className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-[--text-muted]"
              >
                <Stethoscope size={13} />
                Clinical Codes
              </h3>
              <div className="rounded-xl border border-[--border] bg-[--bg-base]/60 divide-y divide-[--border]">
                <div className="px-4 py-3">
                  <p className="text-xs text-[--text-muted] mb-2">ICD-10 Diagnosis</p>
                  <div className="flex flex-wrap gap-2">
                    {ef.diagnosisCodes.map((code) => (
                      <span
                        key={code}
                        className="rounded-md bg-sky-50 px-2 py-0.5 font-mono text-xs text-sky-600"
                      >
                        {code}
                      </span>
                    ))}
                  </div>
                </div>
                <div className="px-4 py-3">
                  <p className="text-xs text-[--text-muted] mb-2">CPT Procedures</p>
                  <div className="flex flex-wrap gap-2">
                    {ef.procedureCodes.map((code) => (
                      <span
                        key={code}
                        className="rounded-md bg-indigo-50 px-2 py-0.5 font-mono text-xs text-indigo-600"
                      >
                        {code}
                      </span>
                    ))}
                  </div>
                </div>
                <div className="px-4 py-3">
                  <p className="text-xs text-[--text-muted] mb-1">Pre-Authorization</p>
                  <div className="flex items-center gap-2">
                    {am.preAuthRequired ? (
                      <span
                        className={`text-xs font-medium ${
                          am.preAuthObtained ? "text-emerald-700" : "text-red-700"
                        }`}
                      >
                        {am.preAuthObtained ? "Required & Obtained ✓" : "Required — NOT Obtained ✗"}
                      </span>
                    ) : (
                      <span className="text-xs text-[--text-muted]">
                        Not required for this procedure
                      </span>
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
                  <p className="text-xs font-semibold text-[--text-primary]">
                    {formatCurrency(500000 - am.annualLimitAfter)} / {formatCurrency(500000)}
                  </p>
                </div>
                <div className="h-2 w-full overflow-hidden rounded-full bg-[--bg-elevated]">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-violet-600 to-cyan-500 progress-fill"
                    style={{ width: `${limitPct}%` }}
                  />
                </div>
                <p className="mt-1 text-right text-xs text-[--text-muted]">
                  {limitPct}% consumed
                </p>
              </div>
            </section>

            {/* ── Rule Engine Trace (accordion) ── */}
            {do_?.step_results && do_.step_results.length > 0 && (
              <section aria-labelledby="pipeline-heading" className="sm:col-span-2">
                <button
                  id="toggle-pipeline-trace"
                  onClick={() => setTraceOpen((v) => !v)}
                  className="w-full mb-3 flex items-center justify-between"
                >
                  <h3
                    id="pipeline-heading"
                    className="flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-[--text-muted]"
                  >
                    <Cpu size={13} />
                    Rule Engine Trace
                    <span className="rounded-full bg-[--bg-elevated] px-2 py-0.5 text-[10px] normal-case font-normal text-[--text-muted]">
                      {do_.step_results.filter((s) => s.passed).length}/
                      {do_.step_results.length} passed
                    </span>
                  </h3>
                  <ChevronDown
                    size={14}
                    className={`text-[--text-muted] transition-transform duration-200 ${
                      traceOpen ? "rotate-180" : ""
                    }`}
                  />
                </button>
                {traceOpen && (
                  <div className="rounded-xl border border-[--border] bg-[--bg-base]/60 divide-y divide-[--border] overflow-hidden animate-fade-in">
                    {do_.step_results.map((step) => (
                      <div
                        key={step.step}
                        className={`flex items-start gap-3 px-4 py-3 ${
                          !step.passed ? "bg-red-500/5" : ""
                        }`}
                      >
                        <span
                          className={`flex-shrink-0 flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold mt-0.5 ${
                            step.passed
                              ? "bg-emerald-100 text-emerald-700"
                              : "bg-red-100 text-red-700"
                          }`}
                        >
                          {step.passed ? "✓" : "✗"}
                        </span>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-xs font-mono font-semibold text-[--text-muted]">
                              Step {step.step}
                            </span>
                            <span className="text-xs font-semibold text-[--text-primary]">{step.name}</span>
                            {!step.passed && step.issues.length > 0 && (
                              <div className="flex flex-wrap gap-1">
                                {step.issues.map((code) => (
                                  <span
                                    key={code}
                                    className="rounded bg-red-50 px-1.5 py-0.5 text-[9px] font-mono font-bold text-red-700"
                                  >
                                    {code}
                                  </span>
                                ))}
                              </div>
                            )}
                          </div>
                          <p className="text-xs text-[--text-muted] mt-0.5 leading-relaxed">
                            {step.detail}
                          </p>
                        </div>
                        <span
                          className={`flex-shrink-0 text-[10px] font-bold uppercase tracking-wider mt-0.5 ${
                            step.passed ? "text-emerald-700" : "text-red-700"
                          }`}
                        >
                          {step.passed ? "PASS" : "FAIL"}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </section>
            )}

            {/* ── Rule Violations — grouped by category ── */}
            <section aria-labelledby="rules-heading" className="sm:col-span-2">
              <h3
                id="rules-heading"
                className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-[--text-muted]"
              >
                <ShieldCheck size={13} />
                Rule Adjudication Engine — Violations
                <span className="rounded-full bg-[--bg-elevated] px-2 py-0.5 text-[10px] normal-case font-normal text-[--text-muted]">
                  {ruleViolations.length} triggered
                </span>
              </h3>

              {/* Prefer decisionOutput grouped view; fallback to ruleViolations list */}
              {do_ && do_.rejection_reasons.length > 0 ? (
                <div className="flex flex-col gap-3">
                  {Object.entries(rejByCategory).map(([category, reasons]) => {
                    const catColors = REJECTION_CATEGORY_COLORS[category] ?? {
                      bg: "bg-[--bg-elevated]",
                      text: "text-[--text-secondary]",
                      border: "border-[--border]",
                    };
                    return (
                      <div
                        key={category}
                        className={`rounded-xl border ${catColors.border} overflow-hidden`}
                      >
                        {/* Category header */}
                        <div
                          className={`${catColors.bg} px-4 py-2 flex items-center justify-between`}
                        >
                          <span
                            className={`text-xs font-bold uppercase tracking-wider ${catColors.text}`}
                          >
                            {category}
                          </span>
                          <span
                            className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold ${catColors.bg} ${catColors.text} ${catColors.border}`}
                          >
                            {reasons.length} rule{reasons.length > 1 ? "s" : ""}
                          </span>
                        </div>
                        {/* Reasons list */}
                        <div className="divide-y divide-[--border]/50 bg-[--bg-base]/40">
                          {reasons.map((r) => {
                            const matched = ruleViolations.find((v) => v.code === r.code);
                            const sev = matched?.severity ?? (r.isHardStop ? "HARD_STOP" : "SOFT_FLAG");
                            const scfg = RULE_SEVERITY_CONFIG[sev];
                            return (
                              <div key={r.code} className="px-4 py-3">
                                <div className="flex items-start gap-2.5">
                                  <span
                                    className={`flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-lg ${scfg.bg} ${scfg.text} mt-0.5`}
                                  >
                                    {SEVERITY_ICONS[sev]}
                                  </span>
                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 flex-wrap">
                                      <span
                                        className={`text-xs font-mono font-bold ${scfg.text}`}
                                      >
                                        {r.code}
                                      </span>
                                      <span
                                        className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${scfg.bg} ${scfg.text}`}
                                      >
                                        {r.isHardStop ? "Hard Stop" : "Soft Flag"}
                                      </span>
                                    </div>
                                    <p className="text-xs font-medium text-[--text-primary] mt-1">
                                      {r.label}
                                    </p>
                                    <p className="text-xs text-[--text-muted] mt-0.5 leading-relaxed">
                                      {r.detail}
                                    </p>
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : ruleViolations.length === 0 ? (
                <div className="flex items-center gap-3 rounded-xl border border-emerald-500/20 bg-emerald-50 px-5 py-4">
                  <ShieldCheck size={20} className="text-emerald-700 flex-shrink-0" />
                  <div>
                    <p className="text-sm font-semibold text-emerald-700">All rules passed</p>
                    <p className="text-xs text-[--text-muted] mt-0.5">
                      No policy violations detected. Claim cleared all 21 automated adjudication
                      rules.
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
                        className={`rounded-xl border px-5 py-4 ${
                          v.severity === "HARD_STOP"
                            ? "border-red-200 bg-red-50"
                            : v.severity === "SOFT_FLAG"
                            ? "border-amber-200 bg-amber-50"
                            : "border-sky-200 bg-sky-50"
                        }`}
                      >
                        <div className="flex items-start gap-2.5">
                          <span
                            className={`flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg ${scfg.bg} ${scfg.text}`}
                          >
                            {SEVERITY_ICONS[v.severity]}
                          </span>
                          <div>
                            <div className="flex items-center gap-2">
                              <span className={`text-xs font-mono font-bold ${scfg.text}`}>
                                {v.code}
                              </span>
                              <span
                                className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${scfg.bg} ${scfg.text}`}
                              >
                                {scfg.label}
                              </span>
                            </div>
                            <p className="text-sm text-[--text-primary] mt-1 leading-snug">{v.description}</p>
                            {v.triggeredValue && (
                              <p className="text-xs text-[--text-muted] mt-1.5">
                                Triggered by:{" "}
                                <span className="font-mono text-[--text-secondary]">
                                  {v.triggeredValue}
                                </span>
                              </p>
                            )}
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
              <h3
                id="audit-heading"
                className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-[--text-muted]"
              >
                <Clock size={13} />
                Automated Notes Ledger
              </h3>
              <ol className="relative border-l border-[--border-strong] ml-4 flex flex-col gap-0">
                {auditNotes.map((note, i) => (
                  <li key={i} className="relative pl-6 pb-5">
                    {/* Timeline dot */}
                    <span
                      className={`absolute -left-2 top-0.5 flex h-4 w-4 items-center justify-center rounded-full border border-[--border] ${ACTOR_COLORS[note.actor]}`}
                    >
                      {ACTOR_ICONS[note.actor]}
                    </span>
                    <div className="rounded-lg border border-[--border] bg-[--bg-base]/60 px-4 py-3">
                      <div className="flex items-center justify-between gap-2 mb-1.5">
                        <span
                          className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[10px] font-semibold ${ACTOR_COLORS[note.actor]}`}
                        >
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
                      <p className="text-sm text-[--text-secondary] leading-relaxed">
                        {note.message}
                      </p>
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
              Engine:{" "}
              <span className="text-indigo-600 font-mono">{am.systemVersion}</span>
              {" · "}
              Duplicate check:{" "}
              <span className={am.duplicateCheckPassed ? "text-emerald-700" : "text-red-700"}>
                {am.duplicateCheckPassed ? "Passed" : "Failed"}
              </span>
              {do_ && (
                <>
                  {" · "}
                  Fraud:{" "}
                  <span
                    className={`font-semibold ${
                      do_.fraud_score > 40
                        ? "text-red-700"
                        : do_.fraud_score > 20
                        ? "text-amber-700"
                        : "text-emerald-700"
                    }`}
                  >
                    {do_.fraud_score}/100
                  </span>
                </>
              )}
            </span>
            <button
              id="close-modal-footer-btn"
              onClick={() => selectClaim(null)}
              className="rounded-lg border border-[--border] px-4 py-1.5 text-[--text-secondary] hover:border-[--border-strong] hover:text-[--text-primary] transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes slideInRight {
          from { transform: translateX(100%); opacity: 0; }
          to   { transform: translateX(0);    opacity: 1; }
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
    emerald: { bar: "from-emerald-600 to-emerald-400", text: "text-emerald-700", bg: "bg-emerald-500/10" },
    violet:  { bar: "from-violet-600 to-violet-400",  text: "text-indigo-600",  bg: "bg-indigo-50"  },
    red:     { bar: "from-red-600 to-red-400",         text: "text-red-700",     bg: "bg-red-500/10"     },
    amber:   { bar: "from-amber-600 to-amber-400",     text: "text-amber-700",   bg: "bg-amber-50"   },
  };
  const c = colorMap[color];
  void invertScale; // kept for API compat

  return (
    <div className={`rounded-xl border border-[--border] ${c.bg} px-4 py-4 text-center`}>
      <p className={`text-2xl font-bold ${c.text}`}>{value}</p>
      <p className="text-xs text-[--text-muted] mt-0.5">{label}</p>
      <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-[--bg-elevated]">
        <div
          className={`h-full rounded-full bg-gradient-to-r ${c.bar} progress-fill`}
          style={{ width: `${value}%` }}
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
        className={`text-right text-xs font-medium truncate max-w-[55%] ${mono ? "font-mono" : ""} ${valueClass ?? "text-[--text-primary]"}`}
      >
        {value}
      </span>
    </div>
  );
}
