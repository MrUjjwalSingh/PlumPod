"use client";

import { useClaimsStore, formatCurrency } from "@/store/claimsStore";
import { Users, Shield, TrendingUp, BadgeDollarSign, CalendarCheck } from "lucide-react";

export default function EmployeeHeader() {
  const { employee, claims } = useClaimsStore();

  const myClaims = claims.filter((c) => c.employeeId === employee.id);
  const approvedTotal = myClaims
    .filter((c) => c.status === "APPROVED" || c.status === "PARTIAL")
    .reduce((sum, c) => sum + c.adjudicationMetrics.approvedAmount, 0);
  const remaining = employee.annualLimit - employee.usedLimit;
  const usedPct = Math.round((employee.usedLimit / employee.annualLimit) * 100);

  return (
    <div className="glass-card p-6 animate-fade-in">
      {/* Top Row: Employee Identity */}
      <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-center gap-4">
          {/* Avatar */}
          <div className="relative flex-shrink-0">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-600 to-indigo-700 text-lg font-bold text-white shadow-md shadow-indigo-200">
              {employee.avatarInitials}
            </div>
            <span className="absolute -bottom-1 -right-1 h-4 w-4 rounded-full border-2 border-[--bg-surface] bg-emerald-500" />
          </div>

          {/* Info */}
          <div>
            <h1 className="text-xl font-bold text-[--text-primary]">{employee.name}</h1>
            <p className="text-sm text-[--text-secondary]">
              {employee.department} · {employee.employeeCode}
            </p>
            <p className="text-xs text-[--text-muted] mt-0.5">{employee.email}</p>
          </div>
        </div>

        {/* Policy Pill */}
        <div className="rounded-xl border border-indigo-100 bg-indigo-50 px-4 py-3">
          <div className="flex items-center gap-2 mb-1">
            <Shield size={14} className="text-indigo-600" />
            <p className="text-xs font-semibold text-indigo-600 uppercase tracking-wider">Active Policy</p>
          </div>
          <p className="font-mono text-sm font-bold text-[--text-primary]">{employee.policyNumber}</p>
          <p className="text-xs text-[--text-muted] mt-0.5">{employee.policyType}</p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {employee.dependents.map((dep) => (
              <span
                key={dep}
                className="rounded-full bg-indigo-100 border border-indigo-200 px-2 py-0.5 text-[10px] font-medium text-indigo-700"
              >
                {dep}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* Stats Row */}
      <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard
          icon={<BadgeDollarSign size={16} />}
          label="Annual Limit"
          value={formatCurrency(employee.annualLimit)}
          color="indigo"
        />
        <StatCard
          icon={<TrendingUp size={16} />}
          label="Utilised"
          value={formatCurrency(employee.usedLimit)}
          sub={`${usedPct}% of limit`}
          color="amber"
        />
        <StatCard
          icon={<CalendarCheck size={16} />}
          label="Remaining Balance"
          value={formatCurrency(remaining)}
          sub={remaining < 100000 ? "⚠ Running low" : "Available"}
          color={remaining < 100000 ? "red" : "emerald"}
        />
        <StatCard
          icon={<Users size={16} />}
          label="Claims Filed"
          value={String(myClaims.length)}
          sub={`${formatCurrency(approvedTotal)} paid out`}
          color="sky"
        />
      </div>

      {/* Annual limit progress bar */}
      <div className="mt-5">
        <div className="flex justify-between text-xs text-[--text-muted] mb-2">
          <span>Annual Outpatient Limit</span>
          <span>
            {formatCurrency(employee.usedLimit)} used of {formatCurrency(employee.annualLimit)}
          </span>
        </div>
        <div className="h-2 w-full overflow-hidden rounded-full bg-[--bg-elevated]">
          <div
            className={`h-full rounded-full progress-fill ${usedPct > 75 ? "bg-red-500" : usedPct > 50 ? "bg-amber-500" : "bg-indigo-500"}`}
            style={{ width: `${usedPct}%` }}
          />
        </div>
        <p className="text-right text-xs text-[--text-muted] mt-1">{usedPct}% consumed</p>
      </div>
    </div>
  );
}

function StatCard({
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
  color: "indigo" | "emerald" | "amber" | "red" | "sky";
}) {
  const colorMap = {
    indigo:  "text-indigo-600 bg-indigo-50 border-indigo-100",
    emerald: "text-emerald-700 bg-emerald-50 border-emerald-100",
    amber:   "text-amber-700 bg-amber-50 border-amber-100",
    red:     "text-red-700 bg-red-50 border-red-100",
    sky:     "text-sky-700 bg-sky-50 border-sky-100",
  };
  const c = colorMap[color];
  const [textCls] = c.split(" ");

  return (
    <div className="rounded-xl border border-[--border] bg-[--bg-surface] px-4 py-3 shadow-sm">
      <div className={`mb-2 inline-flex h-8 w-8 items-center justify-center rounded-lg border ${c}`}>
        {icon}
      </div>
      <p className="text-lg font-bold text-[--text-primary] leading-tight">{value}</p>
      <p className="text-xs text-[--text-muted] mt-0.5">{label}</p>
      {sub && <p className={`text-[10px] mt-1 ${textCls}`}>{sub}</p>}
    </div>
  );
}
