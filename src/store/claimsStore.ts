/**
 * @file claimsStore.ts
 * @description Global state management for Plum AI Adjudicator.
 * Uses Zustand for lightweight, performant state with a mock data ledger
 * that simulates real adjudication pipeline outputs.
 */

import { create } from "zustand";
import { immer } from "zustand/middleware/immer";

// ─── Type Definitions ──────────────────────────────────────────────────────

export type ClaimStatus =
  | "APPROVED"
  | "REJECTED"
  | "PARTIAL"
  | "MANUAL_REVIEW"
  | "PROCESSING"
  | "LOW_SYSTEM_CONFIDENCE";

export type RuleCode =
  | "R001_POLICY_LIMIT_EXCEEDED"
  | "R002_NON_COVERED_PROCEDURE"
  | "R003_DUPLICATE_CLAIM"
  | "R004_MISSING_DIAGNOSIS_CODE"
  | "R005_PROVIDER_NOT_IN_NETWORK"
  | "R006_COOLING_OFF_PERIOD"
  | "R007_PRE_EXISTING_CONDITION"
  | "R008_SUBROGATION_PENDING"
  | "R009_LOW_CONFIDENCE_OCR"
  | "R010_AMOUNT_ANOMALY";

export interface RuleViolation {
  code: RuleCode;
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
  invoiceNumber: string;
  billTotal: number;
  ocrConfidence: number; // 0–1
  isInNetwork: boolean;
}

export interface AdjudicationMetrics {
  eligibilityScore: number; // 0–100
  fraudScore: number; // 0–100 (higher = more suspicious)
  policyMatchScore: number; // 0–100
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
  dependents: string[];
  avatarInitials: string;
}

// ─── Mock Data ─────────────────────────────────────────────────────────────

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
  dependents: ["Rajan Nair (Spouse)", "Arya Nair (Daughter)"],
  avatarInitials: "PN",
};

const BASE_DATE = new Date("2026-06-04");
const daysAgo = (d: number) => {
  const dt = new Date(BASE_DATE);
  dt.setDate(dt.getDate() - d);
  return dt.toISOString().split("T")[0];
};

export const INITIAL_CLAIMS: Claim[] = [
  {
    id: "CLM-00441",
    employeeId: "EMP-2891",
    patientName: "Priya Nair",
    date: daysAgo(2),
    amountRequested: 22500,
    status: "APPROVED",
    submittedBy: "Priya Nair",
    department: "Engineering",
    fileName: "Apollo_Invoice_22500.pdf",
    extractedFields: {
      patientName: "Priya Nair",
      patientId: "EMP-2891",
      providerName: "Apollo Hospitals, Bangalore",
      providerNPI: "NPI-4482901",
      diagnosisCodes: ["J06.9", "Z00.00"],
      procedureCodes: ["99213", "87880"],
      serviceDate: daysAgo(5),
      invoiceNumber: "APL-INV-88123",
      billTotal: 22500,
      ocrConfidence: 0.97,
      isInNetwork: true,
    },
    adjudicationMetrics: {
      eligibilityScore: 96,
      fraudScore: 4,
      policyMatchScore: 98,
      duplicateCheckPassed: true,
      preAuthRequired: false,
      preAuthObtained: false,
      annualLimitBefore: 126000,
      annualLimitAfter: 103500,
      approvedAmount: 22500,
      deductibleApplied: 0,
      coPayApplied: 0,
      systemVersion: "AGY-ADJ-v3.1.4",
      processingTimeMs: 1843,
    },
    ruleViolations: [],
    auditNotes: [
      {
        timestamp: new Date(BASE_DATE.getTime() - 2 * 86400000 - 3600000).toISOString(),
        actor: "AI_ENGINE",
        message: "Document ingested. OCR confidence: 97%. All fields extracted successfully.",
      },
      {
        timestamp: new Date(BASE_DATE.getTime() - 2 * 86400000 - 3500000).toISOString(),
        actor: "SYSTEM",
        message: "Policy PLM-GRP-7734-2025 verified. Employee active. No exclusions flagged.",
      },
      {
        timestamp: new Date(BASE_DATE.getTime() - 2 * 86400000 - 3400000).toISOString(),
        actor: "AI_ENGINE",
        message: "All 0 rule checks passed. Claim auto-approved. Payout authorized: ₹22,500.",
      },
    ],
  },
  {
    id: "CLM-00438",
    employeeId: "EMP-2891",
    patientName: "Arya Nair",
    date: daysAgo(7),
    amountRequested: 85000,
    status: "PARTIAL",
    submittedBy: "Priya Nair",
    department: "Engineering",
    fileName: "Fortis_Hospital_Bill_85k.pdf",
    extractedFields: {
      patientName: "Arya Nair",
      patientId: "DEP-2891-01",
      providerName: "Fortis Hospitals, Whitefield",
      providerNPI: "NPI-5591022",
      diagnosisCodes: ["K29.70", "K21.0"],
      procedureCodes: ["43239", "43235", "99232"],
      serviceDate: daysAgo(10),
      invoiceNumber: "FRT-2026-44901",
      billTotal: 85000,
      ocrConfidence: 0.91,
      isInNetwork: true,
    },
    adjudicationMetrics: {
      eligibilityScore: 82,
      fraudScore: 11,
      policyMatchScore: 74,
      duplicateCheckPassed: true,
      preAuthRequired: true,
      preAuthObtained: true,
      annualLimitBefore: 148500,
      annualLimitAfter: 126000,
      approvedAmount: 22500,
      deductibleApplied: 5000,
      coPayApplied: 2500,
      systemVersion: "AGY-ADJ-v3.1.4",
      processingTimeMs: 2210,
    },
    ruleViolations: [
      {
        code: "R002_NON_COVERED_PROCEDURE",
        description: "Procedure code 43235 (EGD with biopsy) partially covered. Lifestyle exclusion clause §4.2(b) applies.",
        severity: "SOFT_FLAG",
        triggeredValue: "43235",
      },
    ],
    auditNotes: [
      {
        timestamp: new Date(BASE_DATE.getTime() - 7 * 86400000 - 3600000).toISOString(),
        actor: "AI_ENGINE",
        message: "OCR extraction complete. Confidence: 91%. Dependent Arya Nair verified on floater policy.",
      },
      {
        timestamp: new Date(BASE_DATE.getTime() - 7 * 86400000 - 3500000).toISOString(),
        actor: "AI_ENGINE",
        message: "Rule R002 triggered: Procedure 43235 is partially excluded. Approved partial amount: ₹22,500.",
      },
      {
        timestamp: new Date(BASE_DATE.getTime() - 7 * 86400000 - 3000000).toISOString(),
        actor: "SYSTEM",
        message: "Partial approval issued. Remaining non-covered amount: ₹62,500 — employee liable.",
      },
    ],
  },
  {
    id: "CLM-00431",
    employeeId: "EMP-3412",
    patientName: "Rahul Mehta",
    date: daysAgo(14),
    amountRequested: 310000,
    status: "MANUAL_REVIEW",
    submittedBy: "Rahul Mehta",
    department: "Product",
    fileName: "Max_Hospital_Surgery_3.1L.pdf",
    extractedFields: {
      patientName: "Rahul Mehta",
      patientId: "EMP-3412",
      providerName: "Max Super Speciality Hospital, Delhi",
      providerNPI: "NPI-2230041",
      diagnosisCodes: ["M51.16", "G54.4"],
      procedureCodes: ["63047", "63048", "22612"],
      serviceDate: daysAgo(17),
      invoiceNumber: "MAX-INV-2026-9102",
      billTotal: 310000,
      ocrConfidence: 0.78,
      isInNetwork: false,
    },
    adjudicationMetrics: {
      eligibilityScore: 61,
      fraudScore: 34,
      policyMatchScore: 55,
      duplicateCheckPassed: true,
      preAuthRequired: true,
      preAuthObtained: false,
      annualLimitBefore: 500000,
      annualLimitAfter: 500000,
      approvedAmount: 0,
      deductibleApplied: 0,
      coPayApplied: 0,
      systemVersion: "AGY-ADJ-v3.1.4",
      processingTimeMs: 3891,
    },
    ruleViolations: [
      {
        code: "R005_PROVIDER_NOT_IN_NETWORK",
        description: "Max Super Speciality Hospital (Delhi) is not in the TPA-approved network for this policy group.",
        severity: "HARD_STOP",
        triggeredValue: "NPI-2230041",
      },
      {
        code: "R006_COOLING_OFF_PERIOD",
        description: "Pre-authorization was not obtained prior to surgery. Policy §7.1 mandates 72-hr pre-auth for elective procedures above ₹1,00,000.",
        severity: "HARD_STOP",
        triggeredValue: "No pre-auth record found",
      },
      {
        code: "R009_LOW_CONFIDENCE_OCR",
        description: "OCR confidence score of 0.78 is below the 0.85 auto-approval threshold. Manual verification required.",
        severity: "WARNING",
        triggeredValue: "0.78",
      },
    ],
    auditNotes: [
      {
        timestamp: new Date(BASE_DATE.getTime() - 14 * 86400000 - 3600000).toISOString(),
        actor: "AI_ENGINE",
        message: "OCR confidence below threshold (0.78). Potential document quality issue detected. Flagging for review.",
      },
      {
        timestamp: new Date(BASE_DATE.getTime() - 14 * 86400000 - 3500000).toISOString(),
        actor: "AI_ENGINE",
        message: "2 HARD_STOP violations detected (R005, R006). Auto-approval pathway blocked. Routed to MANUAL_REVIEW queue.",
      },
      {
        timestamp: new Date(BASE_DATE.getTime() - 13 * 86400000).toISOString(),
        actor: "SYSTEM",
        message: "Claim assigned to Adjuster Queue ID ADJ-Q-004. SLA timer started: 48 hours.",
      },
    ],
  },
  {
    id: "CLM-00428",
    employeeId: "EMP-4401",
    patientName: "Sneha Kapoor",
    date: daysAgo(21),
    amountRequested: 8200,
    status: "REJECTED",
    submittedBy: "Sneha Kapoor",
    department: "Design",
    fileName: "Clinic_receipt_8200.jpg",
    extractedFields: {
      patientName: "Sneha Kapoor",
      patientId: "EMP-4401",
      providerName: "LifeCare Clinic, Mumbai",
      diagnosisCodes: ["Z71.3"],
      procedureCodes: ["97110", "97530"],
      serviceDate: daysAgo(25),
      invoiceNumber: "LC-REC-20261901",
      billTotal: 8200,
      ocrConfidence: 0.94,
      isInNetwork: false,
    },
    adjudicationMetrics: {
      eligibilityScore: 45,
      fraudScore: 22,
      policyMatchScore: 30,
      duplicateCheckPassed: true,
      preAuthRequired: false,
      preAuthObtained: false,
      annualLimitBefore: 500000,
      annualLimitAfter: 500000,
      approvedAmount: 0,
      deductibleApplied: 0,
      coPayApplied: 0,
      systemVersion: "AGY-ADJ-v3.1.4",
      processingTimeMs: 1120,
    },
    ruleViolations: [
      {
        code: "R002_NON_COVERED_PROCEDURE",
        description: "Physiotherapy for nutritional counseling (Z71.3) is explicitly excluded under Wellness Exclusion §3.7.",
        severity: "HARD_STOP",
        triggeredValue: "Z71.3 + 97110",
      },
    ],
    auditNotes: [
      {
        timestamp: new Date(BASE_DATE.getTime() - 21 * 86400000 - 3600000).toISOString(),
        actor: "AI_ENGINE",
        message: "Diagnosis Z71.3 (nutritional counseling) paired with physiotherapy codes. Policy exclusion §3.7 triggered.",
      },
      {
        timestamp: new Date(BASE_DATE.getTime() - 21 * 86400000 - 3500000).toISOString(),
        actor: "AI_ENGINE",
        message: "HARD_STOP: Claim rejected. Non-covered service combination. Zero payout authorized.",
      },
    ],
  },
  {
    id: "CLM-00419",
    employeeId: "EMP-5102",
    patientName: "Arjun Sharma",
    date: daysAgo(30),
    amountRequested: 145000,
    status: "LOW_SYSTEM_CONFIDENCE",
    submittedBy: "Arjun Sharma",
    department: "Finance",
    fileName: "Narayana_ICU_Bill.pdf",
    extractedFields: {
      patientName: "Arjun Sharma",
      patientId: "EMP-5102",
      providerName: "Narayana Health, Mysore",
      providerNPI: "NPI-8812044",
      diagnosisCodes: ["I21.3", "I25.10"],
      procedureCodes: ["92928", "93458", "99291"],
      serviceDate: daysAgo(34),
      invoiceNumber: "NH-2026-ICU-4412",
      billTotal: 145000,
      ocrConfidence: 0.72,
      isInNetwork: true,
    },
    adjudicationMetrics: {
      eligibilityScore: 71,
      fraudScore: 48,
      policyMatchScore: 68,
      duplicateCheckPassed: false,
      preAuthRequired: true,
      preAuthObtained: true,
      annualLimitBefore: 500000,
      annualLimitAfter: 500000,
      approvedAmount: 0,
      deductibleApplied: 0,
      coPayApplied: 0,
      systemVersion: "AGY-ADJ-v3.1.4",
      processingTimeMs: 4200,
    },
    ruleViolations: [
      {
        code: "R003_DUPLICATE_CLAIM",
        description: "Potential duplicate detected. Similar claim (CLM-00401) filed 8 days prior for same patient and provider.",
        severity: "HARD_STOP",
        triggeredValue: "CLM-00401",
      },
      {
        code: "R009_LOW_CONFIDENCE_OCR",
        description: "OCR confidence 0.72 — significantly below the 0.85 threshold. Image quality degraded.",
        severity: "WARNING",
        triggeredValue: "0.72",
      },
      {
        code: "R010_AMOUNT_ANOMALY",
        description: "Billed amount ₹1,45,000 is 3.2σ above 90-day provider average of ₹44,200 for procedure 92928.",
        severity: "SOFT_FLAG",
        triggeredValue: "₹1,45,000 vs avg ₹44,200",
      },
    ],
    auditNotes: [
      {
        timestamp: new Date(BASE_DATE.getTime() - 30 * 86400000 - 3600000).toISOString(),
        actor: "AI_ENGINE",
        message: "OCR confidence critically low (0.72). Possible document tampering or scan degradation.",
      },
      {
        timestamp: new Date(BASE_DATE.getTime() - 30 * 86400000 - 3500000).toISOString(),
        actor: "AI_ENGINE",
        message: "Duplicate pattern match: CLM-00401 (8 days prior, same ICD-10 codes). Cross-reference flagged.",
      },
      {
        timestamp: new Date(BASE_DATE.getTime() - 30 * 86400000 - 3400000).toISOString(),
        actor: "AI_ENGINE",
        message: "Amount anomaly: 3.2σ deviation from provider billing history. Fraud risk score elevated to 48.",
      },
      {
        timestamp: new Date(BASE_DATE.getTime() - 29 * 86400000).toISOString(),
        actor: "SYSTEM",
        message: "LOW_SYSTEM_CONFIDENCE status assigned. Claim held for adjuster review. SLA: 72 hours.",
      },
    ],
  },
];

// ─── Store Interface ────────────────────────────────────────────────────────

interface ClaimsState {
  claims: Claim[];
  employee: Employee;
  selectedClaimId: string | null;
  isProcessing: boolean;

  // Actions
  selectClaim: (id: string | null) => void;
  addClaim: (claim: Claim) => void;
  updateClaimStatus: (
    id: string,
    status: ClaimStatus,
    adjusterNote?: string
  ) => void;
  setProcessing: (val: boolean) => void;
  getFilteredClaims: (
    statuses?: ClaimStatus[]
  ) => Claim[];
}

// ─── Store ─────────────────────────────────────────────────────────────────

export const useClaimsStore = create<ClaimsState>()(
  immer((set, get) => ({
    claims: INITIAL_CLAIMS,
    employee: MOCK_EMPLOYEE,
    selectedClaimId: null,
    isProcessing: false,

    selectClaim: (id) =>
      set((state) => {
        state.selectedClaimId = id;
      }),

    addClaim: (claim) =>
      set((state) => {
        state.claims.unshift(claim);
      }),

    updateClaimStatus: (id, status, adjusterNote) =>
      set((state) => {
        const claim = state.claims.find((c) => c.id === id);
        if (claim) {
          claim.status = status;
          claim.auditNotes.push({
            timestamp: new Date().toISOString(),
            actor: "ADJUSTER",
            message:
              adjusterNote ??
              `Status manually updated to ${status} by adjuster.`,
          });
          if (status === "APPROVED") {
            claim.adjudicationMetrics.approvedAmount =
              claim.amountRequested;
          } else if (status === "REJECTED") {
            claim.adjudicationMetrics.approvedAmount = 0;
          }
        }
      }),

    setProcessing: (val) =>
      set((state) => {
        state.isProcessing = val;
      }),

    getFilteredClaims: (statuses) => {
      const { claims } = get();
      if (!statuses || statuses.length === 0) return claims;
      return claims.filter((c) => statuses.includes(c.status));
    },
  }))
);

// ─── Utility Helpers ───────────────────────────────────────────────────────

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
  APPROVED: {
    label: "Approved",
    bg: "bg-emerald-500/15",
    text: "text-emerald-400",
    dot: "bg-emerald-400",
  },
  REJECTED: {
    label: "Rejected",
    bg: "bg-red-500/15",
    text: "text-red-400",
    dot: "bg-red-400",
  },
  PARTIAL: {
    label: "Partial",
    bg: "bg-amber-500/15",
    text: "text-amber-400",
    dot: "bg-amber-400",
  },
  MANUAL_REVIEW: {
    label: "Manual Review",
    bg: "bg-violet-500/15",
    text: "text-violet-400",
    dot: "bg-violet-400",
  },
  PROCESSING: {
    label: "Processing",
    bg: "bg-sky-500/15",
    text: "text-sky-400",
    dot: "bg-sky-400",
  },
  LOW_SYSTEM_CONFIDENCE: {
    label: "Low Confidence",
    bg: "bg-orange-500/15",
    text: "text-orange-400",
    dot: "bg-orange-400",
  },
};

export const RULE_SEVERITY_CONFIG = {
  HARD_STOP: { label: "Hard Stop", bg: "bg-red-500/15", text: "text-red-400", icon: "🛑" },
  SOFT_FLAG: { label: "Soft Flag", bg: "bg-amber-500/15", text: "text-amber-400", icon: "⚠️" },
  WARNING: { label: "Warning", bg: "bg-sky-500/15", text: "text-sky-400", icon: "ℹ️" },
} as const;

let claimCounter = INITIAL_CLAIMS.length + 1;
export const generateClaimId = (): string => {
  const id = `CLM-${String(400 + claimCounter++).padStart(5, "0")}`;
  return id;
};
