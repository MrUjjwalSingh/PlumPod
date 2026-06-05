/**
 * @file claimsStore.ts
 * @description Global state management for Plum AI Adjudicator.
 * Uses Zustand + Immer. Mock ledger seeded with realistic OPD claims
 * reflecting the full 5-step adjudication rule engine output.
 */

import { create } from "zustand";
import { immer } from "zustand/middleware/immer";
import type { AdjudicationDecision, RejectionCode, SubLimitCategory } from "@/lib/adjudicationEngine";

// ─── Re-export engine types used widely in UI ──────────────────────────────
export type { AdjudicationDecision, RejectionCode, SubLimitCategory };

// ─── Claim Status ──────────────────────────────────────────────────────────

export type ClaimStatus =
  | "APPROVED"
  | "REJECTED"
  | "PARTIAL"
  | "MANUAL_REVIEW"
  | "PROCESSING"
  | "LOW_SYSTEM_CONFIDENCE";

// Legacy rule-code type — kept for backward compat; new code uses RejectionCode
export type RuleCode = RejectionCode;

export interface RuleViolation {
  code: RejectionCode;
  category: string;
  description: string;
  severity: "HARD_STOP" | "SOFT_FLAG" | "WARNING";
  triggeredValue?: string;
}

export interface ExtractedFields {
  patientName: string;
  patientId: string;
  providerName: string;
  providerNPI?: string;
  diagnosisCodes: string[];
  procedureCodes: string[];
  serviceDate: string;
  submissionDate: string;
  invoiceNumber: string;
  billTotal: number;
  ocrConfidence: number;
  isInNetwork: boolean;
  doctorRegNumber?: string;
  hasPrescription: boolean;
  serviceCategory: SubLimitCategory;
  waitingPeriodSatisfied: boolean;
}

export interface AdjudicationMetrics {
  eligibilityScore: number;
  fraudScore: number;
  policyMatchScore: number;
  duplicateCheckPassed: boolean;
  preAuthRequired: boolean;
  preAuthObtained: boolean;
  annualLimitBefore: number;
  annualLimitAfter: number;
  approvedAmount: number;
  deductibleApplied: number;
  coPayApplied: number;
  systemVersion: string;
  processingTimeMs: number;
}

export interface AuditNote {
  timestamp: string;
  actor: "SYSTEM" | "ADJUSTER" | "AI_ENGINE";
  message: string;
}

export interface Claim {
  id: string;
  employeeId: string;
  patientName: string;
  date: string;
  amountRequested: number;
  status: ClaimStatus;
  extractedFields: ExtractedFields;
  adjudicationMetrics: AdjudicationMetrics;
  ruleViolations: RuleViolation[];
  auditNotes: AuditNote[];
  decisionOutput?: AdjudicationDecision;
  fileName?: string;
  submittedBy: string;
  department: string;
}

export interface Employee {
  id: string;
  name: string;
  email: string;
  department: string;
  employeeCode: string;
  policyNumber: string;
  policyType: string;
  annualLimit: number;
  usedLimit: number;
  perClaimLimit: number;
  coPayPercent: number;
  dependents: string[];
  avatarInitials: string;
  policyStartDate: string;
}

// ─── Mock Employee ─────────────────────────────────────────────────────────

export const MOCK_EMPLOYEE: Employee = {
  id: "EMP-2891",
  name: "Priya Nair",
  email: "priya.nair@techcorp.in",
  department: "Engineering",
  employeeCode: "TC-EMP-2891",
  policyNumber: "PLM-GRP-7734-2025",
  policyType: "Group Mediclaim — Floater Family",
  annualLimit: 500000,
  usedLimit: 148500,
  perClaimLimit: 100000,
  coPayPercent: 10,
  dependents: ["Rajan Nair (Spouse)", "Arya Nair (Daughter)"],
  avatarInitials: "PN",
  policyStartDate: "2025-04-01",
};

// ─── Mock Claims (seeded with new rule codes & richer fields) ──────────────

const BASE_DATE = new Date("2026-06-04");
const daysAgo = (d: number) => {
  const dt = new Date(BASE_DATE);
  dt.setDate(dt.getDate() - d);
  return dt.toISOString().split("T")[0];
};

export const INITIAL_CLAIMS: Claim[] = [];

// ─── Store Interface ────────────────────────────────────────────────────────

interface ClaimsState {
  claims: Claim[];
  employee: Employee;
  selectedClaimId: string | null;
  isProcessing: boolean;

  selectClaim: (id: string | null) => void;
  addClaim: (claim: Claim) => void;
  updateClaimStatus: (id: string, status: ClaimStatus, adjusterNote?: string) => void;
  setProcessing: (val: boolean) => void;
  getFilteredClaims: (statuses?: ClaimStatus[]) => Claim[];
}

// ─── Store ─────────────────────────────────────────────────────────────────

export const useClaimsStore = create<ClaimsState>()(
  immer((set, get) => ({
    claims: INITIAL_CLAIMS,
    employee: MOCK_EMPLOYEE,
    selectedClaimId: null,
    isProcessing: false,

    selectClaim: (id) => set((s) => { s.selectedClaimId = id; }),

    addClaim: (claim) => set((s) => { s.claims.unshift(claim); }),

    updateClaimStatus: (id, status, adjusterNote) =>
      set((s) => {
        const claim = s.claims.find((c) => c.id === id);
        if (!claim) return;
        claim.status = status;
        claim.auditNotes.push({
          timestamp: new Date().toISOString(),
          actor: "ADJUSTER",
          message: adjusterNote ?? `Status manually updated to ${status} by adjuster.`,
        });
        if (claim.decisionOutput) {
          claim.decisionOutput.decision =
            status === "APPROVED" ? "APPROVED"
            : status === "REJECTED" ? "REJECTED"
            : claim.decisionOutput.decision;
        }
        if (status === "APPROVED") {
          claim.adjudicationMetrics.approvedAmount = claim.amountRequested;
          if (claim.decisionOutput) claim.decisionOutput.approved_amount = claim.amountRequested;
        } else if (status === "REJECTED") {
          claim.adjudicationMetrics.approvedAmount = 0;
          if (claim.decisionOutput) claim.decisionOutput.approved_amount = 0;
        }
      }),

    setProcessing: (val) => set((s) => { s.isProcessing = val; }),

    getFilteredClaims: (statuses) => {
      const { claims } = get();
      if (!statuses || statuses.length === 0) return claims;
      return claims.filter((c) => statuses.includes(c.status));
    },
  }))
);

// ─── Helpers ───────────────────────────────────────────────────────────────

export const formatCurrency = (amount: number): string =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(amount);

export const STATUS_CONFIG: Record<
  ClaimStatus,
  { label: string; bg: string; text: string; dot: string }
> = {
  APPROVED:              { label: "Approved",       bg: "bg-emerald-50",  text: "text-emerald-700", dot: "bg-emerald-500" },
  REJECTED:              { label: "Rejected",       bg: "bg-red-50",      text: "text-red-700",     dot: "bg-red-500"     },
  PARTIAL:               { label: "Partial",        bg: "bg-amber-50",    text: "text-amber-700",   dot: "bg-amber-500"   },
  MANUAL_REVIEW:         { label: "Manual Review",  bg: "bg-indigo-50",   text: "text-indigo-700",  dot: "bg-indigo-500"  },
  PROCESSING:            { label: "Processing",     bg: "bg-sky-50",      text: "text-sky-700",     dot: "bg-sky-500"     },
  LOW_SYSTEM_CONFIDENCE: { label: "Low Confidence", bg: "bg-orange-50",   text: "text-orange-700",  dot: "bg-orange-500"  },
};

export const RULE_SEVERITY_CONFIG = {
  HARD_STOP: { label: "Hard Stop", bg: "bg-red-50",    text: "text-red-700",    icon: "🛑" },
  SOFT_FLAG: { label: "Soft Flag", bg: "bg-amber-50",  text: "text-amber-700",  icon: "⚠️" },
  WARNING:   { label: "Warning",   bg: "bg-sky-50",    text: "text-sky-700",    icon: "ℹ️" },
} as const;

export const REJECTION_CATEGORY_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  Eligibility:   { bg: "bg-red-50",    text: "text-red-700",    border: "border-red-200"    },
  Documentation: { bg: "bg-amber-50",  text: "text-amber-700",  border: "border-amber-200"  },
  Coverage:      { bg: "bg-orange-50", text: "text-orange-700", border: "border-orange-200" },
  Limits:        { bg: "bg-yellow-50", text: "text-yellow-700", border: "border-yellow-200" },
  Medical:       { bg: "bg-rose-50",   text: "text-rose-700",   border: "border-rose-200"   },
  Process:       { bg: "bg-indigo-50", text: "text-indigo-700", border: "border-indigo-200" },
};

let claimCounter = INITIAL_CLAIMS.length + 1;
export const generateClaimId = (): string =>
  `CLM-${String(400 + claimCounter++).padStart(5, "0")}`;
