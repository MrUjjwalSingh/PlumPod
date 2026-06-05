"use client";

import Navbar from "@/components/Navbar";
import EmployeeHeader from "@/components/EmployeeHeader";
import ClaimUploadForm from "@/components/ClaimUploadForm";
import ClaimStatusTable from "@/components/ClaimStatusTable";
import AdjudicateSummary from "@/components/AdjudicateSummary";
import { useClaimsStore } from "@/store/claimsStore";

export default function EmployeeDashboardPage() {
  const { employee } = useClaimsStore();

  return (
    <div className="min-h-screen">
      <Navbar />

      {/* Page hero */}
      <div className="border-b border-[--border] bg-[--bg-surface]">
        <div className="mx-auto max-w-screen-xl px-6 py-8">
          <div className="flex items-center gap-3 mb-1">
            <span className="rounded-full bg-indigo-50 px-3 py-1 text-xs font-semibold text-indigo-600 uppercase tracking-wider border border-indigo-100">
              Employee Portal
            </span>
            <span className="text-[--text-muted] text-xs">·</span>
            <span className="text-xs text-[--text-muted]">
              Policy Year 2025–2026
            </span>
          </div>
          <h1 className="text-2xl font-bold text-[--text-primary]">
            Welcome back,{" "}
            <span className="gradient-text">{employee.name.split(" ")[0]}</span>
          </h1>
          <p className="text-sm text-[--text-secondary] mt-1">
            Submit and track your healthcare claims. Adjudication results are available in seconds.
          </p>
        </div>
      </div>

      {/* Main content */}
      <main className="mx-auto max-w-screen-xl px-6 py-8">
        <div className="flex flex-col gap-6">
          {/* Employee identity card */}
          <EmployeeHeader />

          {/* Two-column: Upload + Quick Stats */}
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
            {/* Upload (wider) */}
            <div className="lg:col-span-3">
              <ClaimUploadForm />
            </div>

            {/* Quick info panel */}
            <div className="lg:col-span-2 flex flex-col gap-4">
              {/* Adjudication Pipeline info */}
              <div className="glass-card p-5 animate-fade-in">
                <h3 className="text-sm font-semibold text-[--text-primary] mb-3">
                  How It Works
                </h3>
                <ol className="flex flex-col gap-3">
                  {[
                    { step: "1", label: "Upload Document", desc: "PDF, image, or scanned invoice" },
                    { step: "2", label: "AI Extracts Fields", desc: "OCR + NLP extracts all clinical & billing data" },
                    { step: "3", label: "Rules Engine Runs", desc: "15+ policy rules checked in <2 seconds" },
                    { step: "4", label: "Decision Issued", desc: "Auto-approved, partial, or routed for review" },
                  ].map(({ step, label, desc }) => (
                    <li key={step} className="flex items-start gap-3">
                      <span className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-indigo-50 border border-indigo-100 text-xs font-bold text-indigo-600">
                        {step}
                      </span>
                      <div>
                        <p className="text-sm font-medium text-[--text-primary] leading-tight">{label}</p>
                        <p className="text-xs text-[--text-muted] mt-0.5">{desc}</p>
                      </div>
                    </li>
                  ))}
                </ol>
              </div>

              {/* Coverage quick-ref */}
              <div className="glass-card p-5 animate-fade-in">
                <h3 className="text-sm font-semibold text-[--text-primary] mb-3">Coverage Quick-Ref</h3>
                <div className="flex flex-col gap-2.5">
                  {[
                    { label: "Inpatient Hospitalization", covered: true },
                    { label: "Day Care Procedures", covered: true },
                    { label: "Pre & Post Hospitalization", covered: true },
                    { label: "Ambulance Charges", covered: true },
                    { label: "Cosmetic Surgery", covered: false },
                    { label: "Wellness / Nutritional", covered: false },
                  ].map(({ label, covered }) => (
                    <div key={label} className="flex items-center justify-between">
                      <span className="text-xs text-[--text-secondary]">{label}</span>
                      <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold border ${covered ? "bg-emerald-50 text-emerald-700 border-emerald-100" : "bg-red-50 text-red-700 border-red-100"}`}>
                        {covered ? "Covered" : "Excluded"}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Claims history table */}
          <ClaimStatusTable employeeId={employee.id} />
        </div>
      </main>

      {/* Adjudication detail modal (portal) */}
      <AdjudicateSummary />
    </div>
  );
}
