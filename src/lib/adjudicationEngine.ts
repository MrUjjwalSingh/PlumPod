/**
 * @file adjudicationEngine.ts
 * @description OPD Claim Adjudication Rules Engine — Plum AI Adjudicator
 *
 * Implements the full 5-step adjudication pipeline from the OPD rules specification:
 *   Step 1 — Basic Eligibility Check
 *   Step 2 — Document Validation
 *   Step 3 — Coverage Verification
 *   Step 4 — Limit Validation
 *   Step 5 — Medical Necessity Review
 *   Step 6 — Fraud & Process Checks (runs in parallel with all steps)
 *
 * All rules are deterministic and run synchronously. The engine returns
 * a structured decision output matching the spec's Decision Output Format.
 */

// ─── Rejection Codes (all 21 from spec) ───────────────────────────────────

export type RejectionCode =
  // Category 1: Eligibility
  | "POLICY_INACTIVE"
  | "WAITING_PERIOD"
  | "MEMBER_NOT_COVERED"
  // Category 2: Documentation
  | "MISSING_DOCUMENTS"
  | "ILLEGIBLE_DOCUMENTS"
  | "INVALID_PRESCRIPTION"
  | "DOCTOR_REG_INVALID"
  | "DATE_MISMATCH"
  | "PATIENT_MISMATCH"
  // Category 3: Coverage
  | "SERVICE_NOT_COVERED"
  | "EXCLUDED_CONDITION"
  | "PRE_AUTH_MISSING"
  // Category 4: Limits
  | "ANNUAL_LIMIT_EXCEEDED"
  | "SUB_LIMIT_EXCEEDED"
  | "PER_CLAIM_EXCEEDED"
  // Category 5: Medical
  | "NOT_MEDICALLY_NECESSARY"
  | "EXPERIMENTAL_TREATMENT"
  | "COSMETIC_PROCEDURE"
  // Category 6: Process
  | "LATE_SUBMISSION"
  | "DUPLICATE_CLAIM"
  | "BELOW_MIN_AMOUNT";

export const REJECTION_CATEGORIES: Record<RejectionCode, { category: string; label: string; hardStop: boolean }> = {
  POLICY_INACTIVE:        { category: "Eligibility",    label: "Policy Not Active",               hardStop: true  },
  WAITING_PERIOD:         { category: "Eligibility",    label: "Waiting Period Not Satisfied",     hardStop: true  },
  MEMBER_NOT_COVERED:     { category: "Eligibility",    label: "Member Not in Policy Records",     hardStop: true  },
  MISSING_DOCUMENTS:      { category: "Documentation",  label: "Required Documents Missing",       hardStop: true  },
  ILLEGIBLE_DOCUMENTS:    { category: "Documentation",  label: "Documents Not Readable",           hardStop: false },
  INVALID_PRESCRIPTION:   { category: "Documentation",  label: "Prescription Missing / Invalid",   hardStop: true  },
  DOCTOR_REG_INVALID:     { category: "Documentation",  label: "Doctor Registration Invalid",      hardStop: false },
  DATE_MISMATCH:          { category: "Documentation",  label: "Document Date Inconsistency",      hardStop: false },
  PATIENT_MISMATCH:       { category: "Documentation",  label: "Patient Details Don't Match",      hardStop: false },
  SERVICE_NOT_COVERED:    { category: "Coverage",       label: "Service Not Covered",              hardStop: true  },
  EXCLUDED_CONDITION:     { category: "Coverage",       label: "Excluded Condition / Procedure",   hardStop: true  },
  PRE_AUTH_MISSING:       { category: "Coverage",       label: "Pre-Authorization Not Obtained",   hardStop: true  },
  ANNUAL_LIMIT_EXCEEDED:  { category: "Limits",         label: "Annual OPD Limit Exhausted",       hardStop: true  },
  SUB_LIMIT_EXCEEDED:     { category: "Limits",         label: "Category Sub-Limit Exceeded",      hardStop: false },
  PER_CLAIM_EXCEEDED:     { category: "Limits",         label: "Per-Claim Limit Exceeded",         hardStop: false },
  NOT_MEDICALLY_NECESSARY:{ category: "Medical",        label: "Not Medically Necessary",          hardStop: true  },
  EXPERIMENTAL_TREATMENT: { category: "Medical",        label: "Experimental / Unproven Treatment",hardStop: true  },
  COSMETIC_PROCEDURE:     { category: "Medical",        label: "Cosmetic / Aesthetic Procedure",   hardStop: true  },
  LATE_SUBMISSION:        { category: "Process",        label: "Submitted After 30-Day Deadline",  hardStop: true  },
  DUPLICATE_CLAIM:        { category: "Process",        label: "Duplicate Claim Detected",         hardStop: true  },
  BELOW_MIN_AMOUNT:       { category: "Process",        label: "Below Minimum Claim Amount (₹500)",hardStop: true  },
};

// ─── Input / Output Types ──────────────────────────────────────────────────

export type SubLimitCategory =
  | "consultation"
  | "pharmacy"
  | "diagnostics"
  | "physiotherapy"
  | "dental"
  | "vision"
  | "emergency"
  | "specialist"
  | "surgery"
  | "other";

export interface PolicyLimits {
  annualLimit: number;
  usedToDate: number;
  perClaimLimit: number;
  subLimits: Partial<Record<SubLimitCategory, { limit: number; used: number }>>;
  coPayPercent: number;         // 0–100
  networkCoPayPercent: number;  // 0–100 (for in-network)
  minClaimAmount: number;       // default 500
  waitingPeriodSatisfied: boolean;
  policyActiveOnServiceDate: boolean;
}

export interface DocumentData {
  ocrConfidence: number;          // 0–1
  hasPrescription: boolean;
  prescriptionIsValid: boolean;
  doctorRegNumber?: string;       // format: [StateCode]/[Number]/[Year] e.g. "MH/12345/2018"
  hasStampAndHeader: boolean;
  serviceDate: string;            // ISO date
  documentDates: string[];        // all dates found on all docs
  patientNameOnDoc: string;
  patientNameOnPolicy: string;
  ageOnDoc?: number;
  ageOnPolicy?: number;
  submissionDate: string;         // when claim was filed
}

export interface CoverageData {
  diagnosisCodes: string[];       // ICD-10
  procedureCodes: string[];       // CPT/procedure codes
  providerIsInNetwork: boolean;
  providerIsBlacklisted: boolean;
  preAuthRequired: boolean;
  preAuthObtained: boolean;
  serviceCategory: SubLimitCategory;
}

export interface MedicalData {
  diagnosisJustifiesTreatment: boolean;
  prescriptionMatchesDiagnosis: boolean;
  followsStandardProtocol: boolean;
  isExperimental: boolean;
  isCosmetic: boolean;
}

export interface FraudSignals {
  isDuplicate: boolean;
  duplicateClaimId?: string;
  providerClaimsOnSameDay: number;  // how many other claims same provider today
  unusualFrequency: boolean;        // many claims in short window
  documentAlterationSuspected: boolean;
  amountDeviationSigma: number;     // σ above provider average; >2.5 = flag
}

export interface AdjudicationInput {
  claimId: string;
  memberId: string;
  memberName: string;
  billTotal: number;
  policy: PolicyLimits;
  documents: DocumentData;
  coverage: CoverageData;
  medical: MedicalData;
  fraud: FraudSignals;
}

// Spec-aligned decision output format
export interface RejectionReason {
  code: RejectionCode;
  category: string;
  label: string;
  isHardStop: boolean;
  detail: string;
}

export interface StepResult {
  step: number;
  name: string;
  passed: boolean;
  issues: RejectionCode[];
  detail: string;
}

export interface AdjudicationDecision {
  claim_id: string;
  decision: "APPROVED" | "REJECTED" | "PARTIAL" | "MANUAL_REVIEW";
  approved_amount: number;
  deductible_applied: number;
  copay_applied: number;
  rejection_reasons: RejectionReason[];
  confidence_score: number;             // 0–1
  fraud_score: number;                  // 0–100
  notes: string;
  next_steps: string;
  step_results: StepResult[];
  processing_time_ms: number;
}

// ─── Sub-limit Lookup ──────────────────────────────────────────────────────

const DEFAULT_SUB_LIMITS: Partial<Record<SubLimitCategory, number>> = {
  consultation:    5000,
  pharmacy:        15000,
  diagnostics:     10000,
  physiotherapy:   8000,
  dental:          5000,
  vision:          3000,
  specialist:      12000,
  surgery:         200000,
};

// Excluded ICD-10 prefixes / conditions
const EXCLUDED_ICD10_PREFIXES = [
  "Z71",   // counseling
  "L70",   // acne
  "L63",   // alopecia
  "Q",     // congenital (usually pre-existing)
];

// Procedures that always require pre-auth above ₹25,000
const PRE_AUTH_THRESHOLD = 25000;

// High-value threshold for manual review
const HIGH_VALUE_THRESHOLD = 25000;

// ─── Core Engine ──────────────────────────────────────────────────────────

export function runAdjudication(input: AdjudicationInput): AdjudicationDecision {
  const start = Date.now();
  const rejections: RejectionReason[] = [];
  const stepResults: StepResult[] = [];

  const addRejection = (code: RejectionCode, detail: string) => {
    const meta = REJECTION_CATEGORIES[code];
    rejections.push({ code, category: meta.category, label: meta.label, isHardStop: meta.hardStop, detail });
  };

  // ── STEP 1: Basic Eligibility ─────────────────────────────────────────
  const step1Issues: RejectionCode[] = [];

  if (!input.policy.policyActiveOnServiceDate) {
    addRejection("POLICY_INACTIVE", `Policy was not active on ${input.documents.serviceDate}.`);
    step1Issues.push("POLICY_INACTIVE");
  }
  if (!input.policy.waitingPeriodSatisfied) {
    addRejection("WAITING_PERIOD", "Treatment falls within the mandatory 30-day waiting period for OPD coverage.");
    step1Issues.push("WAITING_PERIOD");
  }
  // Member verification is implicit (memberId lookup); if fraudSignal says duplicate it's caught later
  // but we can use member-not-covered if memberId doesn't resolve
  if (!input.memberId || input.memberId.trim() === "") {
    addRejection("MEMBER_NOT_COVERED", "Claimant could not be matched to any covered member or dependent.");
    step1Issues.push("MEMBER_NOT_COVERED");
  }

  stepResults.push({
    step: 1, name: "Eligibility Check",
    passed: step1Issues.length === 0,
    issues: step1Issues,
    detail: step1Issues.length === 0
      ? "Policy active, waiting period satisfied, member verified."
      : `${step1Issues.length} eligibility issue(s) found.`,
  });

  // If hard-stop in step 1, we can still continue to collect all issues
  // (per spec: "when multiple rules conflict, collect all, then apply priority")

  // ── STEP 2: Document Validation ───────────────────────────────────────
  const step2Issues: RejectionCode[] = [];

  if (input.documents.ocrConfidence < 0.40) {
    addRejection("MISSING_DOCUMENTS", `OCR confidence critically low (${(input.documents.ocrConfidence * 100).toFixed(0)}%). Document may be blank or unreadable.`);
    step2Issues.push("MISSING_DOCUMENTS");
  } else if (input.documents.ocrConfidence < 0.65) {
    addRejection("ILLEGIBLE_DOCUMENTS", `Document legibility score ${(input.documents.ocrConfidence * 100).toFixed(0)}% is below the 65% readability threshold.`);
    step2Issues.push("ILLEGIBLE_DOCUMENTS");
  }

  if (!input.documents.hasPrescription) {
    addRejection("INVALID_PRESCRIPTION", "No valid prescription was found in the submitted documents.");
    step2Issues.push("INVALID_PRESCRIPTION");
  } else if (!input.documents.prescriptionIsValid) {
    addRejection("INVALID_PRESCRIPTION", "Prescription present but missing doctor signature, date, or registration number.");
    step2Issues.push("INVALID_PRESCRIPTION");
  }

  if (!input.documents.hasStampAndHeader) {
    addRejection("MISSING_DOCUMENTS", "Bill is missing required header or official stamp. Resubmit with a properly stamped bill from the provider.");
    step2Issues.push("MISSING_DOCUMENTS");
  }

  if (input.documents.doctorRegNumber !== undefined) {
    // Validate format: [StateCode]/[Number]/[Year]
    const regPattern = /^[A-Z]{2,3}\/\d{4,6}\/\d{4}$/;
    if (!regPattern.test(input.documents.doctorRegNumber)) {
      addRejection("DOCTOR_REG_INVALID", `Doctor registration number "${input.documents.doctorRegNumber}" does not match the required format [StateCode]/[Number]/[Year].`);
      step2Issues.push("DOCTOR_REG_INVALID");
    }
  }

  // Date consistency check
  const serviceDateStr = input.documents.serviceDate;
  const dateMismatch = input.documents.documentDates.some(
    (d) => d !== serviceDateStr && Math.abs(new Date(d).getTime() - new Date(serviceDateStr).getTime()) > 3 * 86400000
  );
  if (dateMismatch) {
    addRejection("DATE_MISMATCH", `Document dates (${input.documents.documentDates.join(", ")}) don't match the service date (${serviceDateStr}) by more than 3 days.`);
    step2Issues.push("DATE_MISMATCH");
  }

  // Patient name match (allow minor variation — check length similarity)
  const nameSimilarity = levenshteinSimilarity(
    input.documents.patientNameOnDoc.toLowerCase(),
    input.documents.patientNameOnPolicy.toLowerCase()
  );
  if (nameSimilarity < 0.75) {
    addRejection("PATIENT_MISMATCH", `Patient name on document ("${input.documents.patientNameOnDoc}") does not match policy records ("${input.documents.patientNameOnPolicy}"). Similarity: ${(nameSimilarity * 100).toFixed(0)}%.`);
    step2Issues.push("PATIENT_MISMATCH");
  }

  stepResults.push({
    step: 2, name: "Document Validation",
    passed: step2Issues.length === 0,
    issues: step2Issues,
    detail: step2Issues.length === 0
      ? `All documents valid. OCR confidence: ${(input.documents.ocrConfidence * 100).toFixed(0)}%.`
      : `${step2Issues.length} document issue(s) detected.`,
  });

  // ── STEP 3: Coverage Verification ────────────────────────────────────
  const step3Issues: RejectionCode[] = [];

  if (input.coverage.providerIsBlacklisted) {
    addRejection("SERVICE_NOT_COVERED", "Provider is on the TPA blacklist. Claims from blacklisted providers cannot be processed.");
    step3Issues.push("SERVICE_NOT_COVERED");
  }

  // Check excluded ICD-10 codes
  const excludedDx = input.coverage.diagnosisCodes.filter(
    (code) => EXCLUDED_ICD10_PREFIXES.some((prefix) => code.startsWith(prefix))
  );
  if (excludedDx.length > 0) {
    addRejection("EXCLUDED_CONDITION", `Diagnosis code(s) ${excludedDx.join(", ")} fall under policy exclusions (cosmetic/counseling/congenital conditions).`);
    step3Issues.push("EXCLUDED_CONDITION");
  }

  // Pre-auth check
  if (input.coverage.preAuthRequired && !input.coverage.preAuthObtained) {
    addRejection("PRE_AUTH_MISSING", `Pre-authorization was required for this procedure (amount ₹${input.billTotal.toLocaleString("en-IN")} > ₹${PRE_AUTH_THRESHOLD.toLocaleString("en-IN")}) but was not obtained before treatment.`);
    step3Issues.push("PRE_AUTH_MISSING");
  }

  // For non-network, flag it but don't hard-stop — it affects co-pay
  const networkNote = !input.coverage.providerIsInNetwork
    ? "Provider is out-of-network. Standard reimbursement applies; cashless not available."
    : "In-network provider confirmed.";

  stepResults.push({
    step: 3, name: "Coverage Verification",
    passed: step3Issues.length === 0,
    issues: step3Issues,
    detail: step3Issues.length === 0
      ? `Service covered. ${networkNote}`
      : `${step3Issues.length} coverage issue(s). ${networkNote}`,
  });

  // ── STEP 4: Limit Validation ──────────────────────────────────────────
  const step4Issues: RejectionCode[] = [];
  let approvedBeforeCopay = input.billTotal;

  // Minimum claim amount
  if (input.billTotal < input.policy.minClaimAmount) {
    addRejection("BELOW_MIN_AMOUNT", `Claim amount ₹${input.billTotal} is below the minimum claim amount of ₹${input.policy.minClaimAmount}.`);
    step4Issues.push("BELOW_MIN_AMOUNT");
  }

  // Annual limit
  const remainingAnnual = input.policy.annualLimit - input.policy.usedToDate;
  if (remainingAnnual <= 0) {
    addRejection("ANNUAL_LIMIT_EXCEEDED", `Annual OPD limit of ₹${input.policy.annualLimit.toLocaleString("en-IN")} has been fully exhausted. YTD usage: ₹${input.policy.usedToDate.toLocaleString("en-IN")}.`);
    step4Issues.push("ANNUAL_LIMIT_EXCEEDED");
    approvedBeforeCopay = 0;
  } else if (input.billTotal > remainingAnnual) {
    // Partial — can only approve up to remaining
    approvedBeforeCopay = remainingAnnual;
  }

  // Per-claim limit
  if (input.billTotal > input.policy.perClaimLimit) {
    addRejection("PER_CLAIM_EXCEEDED", `Single claim of ₹${input.billTotal.toLocaleString("en-IN")} exceeds the per-claim limit of ₹${input.policy.perClaimLimit.toLocaleString("en-IN")}. Eligible amount capped at ₹${input.policy.perClaimLimit.toLocaleString("en-IN")}.`);
    step4Issues.push("PER_CLAIM_EXCEEDED");
    approvedBeforeCopay = Math.min(approvedBeforeCopay, input.policy.perClaimLimit);
  }

  // Sub-limit check
  const cat = input.coverage.serviceCategory;
  const subLimitDef = DEFAULT_SUB_LIMITS[cat];
  const subLimitData = input.policy.subLimits[cat];
  if (subLimitDef !== undefined) {
    const effectiveSubLimit = subLimitDef;
    const subUsed = subLimitData?.used ?? 0;
    const subRemaining = effectiveSubLimit - subUsed;
    if (subRemaining <= 0) {
      addRejection("SUB_LIMIT_EXCEEDED", `The ${cat} sub-limit of ₹${effectiveSubLimit.toLocaleString("en-IN")} has been exhausted for this policy year.`);
      step4Issues.push("SUB_LIMIT_EXCEEDED");
      approvedBeforeCopay = 0;
    } else if (approvedBeforeCopay > subRemaining) {
      approvedBeforeCopay = subRemaining;
    }
  }

  // Co-pay
  const coPayRate = input.coverage.providerIsInNetwork
    ? input.policy.networkCoPayPercent / 100
    : input.policy.coPayPercent / 100;
  const copayAmount = Math.round(approvedBeforeCopay * coPayRate);
  const finalApprovedAmount = Math.max(0, approvedBeforeCopay - copayAmount);

  stepResults.push({
    step: 4, name: "Limit Validation",
    passed: step4Issues.length === 0,
    issues: step4Issues,
    detail: step4Issues.length === 0
      ? `Within all limits. Annual remaining: ₹${remainingAnnual.toLocaleString("en-IN")}. Co-pay: ${(coPayRate * 100).toFixed(0)}%.`
      : `${step4Issues.length} limit issue(s). Approved amount adjusted to ₹${finalApprovedAmount.toLocaleString("en-IN")}.`,
  });

  // ── STEP 5: Medical Necessity ─────────────────────────────────────────
  const step5Issues: RejectionCode[] = [];

  if (!input.medical.diagnosisJustifiesTreatment) {
    addRejection("NOT_MEDICALLY_NECESSARY", "The prescribed treatment does not align with the stated diagnosis codes. Medical necessity not established.");
    step5Issues.push("NOT_MEDICALLY_NECESSARY");
  }
  if (!input.medical.prescriptionMatchesDiagnosis) {
    addRejection("NOT_MEDICALLY_NECESSARY", "Prescription medications/procedures do not match the ICD-10 diagnosis codes per standard clinical protocols.");
    step5Issues.push("NOT_MEDICALLY_NECESSARY");
  }
  if (input.medical.isExperimental) {
    addRejection("EXPERIMENTAL_TREATMENT", "Treatment is classified as experimental or investigational. Not covered under standard OPD policy.");
    step5Issues.push("EXPERIMENTAL_TREATMENT");
  }
  if (input.medical.isCosmetic) {
    addRejection("COSMETIC_PROCEDURE", "Procedure is classified as cosmetic/aesthetic and is explicitly excluded under all OPD policy variants.");
    step5Issues.push("COSMETIC_PROCEDURE");
  }
  if (!input.medical.followsStandardProtocol) {
    addRejection("NOT_MEDICALLY_NECESSARY", "Treatment does not follow standard medical protocols for the stated diagnosis.");
    step5Issues.push("NOT_MEDICALLY_NECESSARY");
  }

  stepResults.push({
    step: 5, name: "Medical Necessity Review",
    passed: step5Issues.length === 0,
    issues: step5Issues,
    detail: step5Issues.length === 0
      ? "Diagnosis justifies treatment. Prescription aligns with clinical protocols."
      : `${step5Issues.length} medical necessity issue(s) flagged.`,
  });

  // ── Fraud & Process Checks (parallel) ────────────────────────────────
  const fraudIssues: RejectionCode[] = [];

  if (input.fraud.isDuplicate) {
    addRejection("DUPLICATE_CLAIM", `Potential duplicate claim detected. Matches ${input.fraud.duplicateClaimId ?? "a prior claim"} for same patient, provider, and diagnosis within 30 days.`);
    fraudIssues.push("DUPLICATE_CLAIM");
  }

  // Late submission: > 30 days after service date
  const daysSinceService = Math.floor(
    (new Date(input.documents.submissionDate).getTime() - new Date(input.documents.serviceDate).getTime()) / 86400000
  );
  if (daysSinceService > 30) {
    addRejection("LATE_SUBMISSION", `Claim submitted ${daysSinceService} days after the service date. The maximum submission window is 30 days per policy §9.2.`);
    fraudIssues.push("LATE_SUBMISSION");
  }

  stepResults.push({
    step: 6, name: "Fraud & Process Checks",
    passed: fraudIssues.length === 0,
    issues: fraudIssues,
    detail: fraudIssues.length === 0
      ? `No fraud indicators. Submission latency: ${daysSinceService} day(s). Amount deviation: ${input.fraud.amountDeviationSigma.toFixed(1)}σ.`
      : `${fraudIssues.length} fraud/process issue(s) detected.`,
  });

  // ── Compute Fraud Score ───────────────────────────────────────────────
  let fraudScore = 0;
  if (input.fraud.isDuplicate)                     fraudScore += 35;
  if (input.fraud.documentAlterationSuspected)     fraudScore += 30;
  if (input.fraud.amountDeviationSigma > 2.5)      fraudScore += Math.min(20, input.fraud.amountDeviationSigma * 6);
  if (input.fraud.providerClaimsOnSameDay > 3)     fraudScore += 10;
  if (input.fraud.unusualFrequency)                fraudScore += 10;
  if (input.documents.ocrConfidence < 0.70)        fraudScore += 8;
  fraudScore = Math.min(100, Math.round(fraudScore));

  // ── Final Decision Logic ──────────────────────────────────────────────
  const hardStops = rejections.filter((r) => r.isHardStop);
  const softFlags = rejections.filter((r) => !r.isHardStop);
  const isHighValue = input.billTotal > HIGH_VALUE_THRESHOLD;
  const isLowConfidence = input.documents.ocrConfidence < 0.70;
  const hasFraudSignals = fraudScore >= 30 || input.fraud.documentAlterationSuspected;

  let decision: AdjudicationDecision["decision"];
  let approvedFinal: number;
  let notes: string;
  let nextSteps: string;

  // Priority 1: Safety — suspicious/fraud claims go to MANUAL_REVIEW
  if (hasFraudSignals && hardStops.length === 0) {
    decision = "MANUAL_REVIEW";
    approvedFinal = 0;
    notes = `Fraud indicators detected (score: ${fraudScore}/100). ${input.fraud.documentAlterationSuspected ? "Document alteration suspected. " : ""}Claim routed to senior adjuster queue.`;
    nextSteps = "Your claim has been escalated to a human adjuster for manual verification. You may be contacted for additional documentation. Expected resolution: 3–5 business days.";
  }
  // Priority 2: Hard stops → REJECTED or MANUAL_REVIEW depending on low confidence
  else if (hardStops.length > 0) {
    if (isLowConfidence && hardStops.length <= 2) {
      // Borderline — send for manual review instead of outright reject
      decision = "MANUAL_REVIEW";
      approvedFinal = 0;
      notes = `${hardStops.length} hard-stop violation(s) combined with low OCR confidence (${(input.documents.ocrConfidence * 100).toFixed(0)}%). Manual review required before rejection.`;
      nextSteps = "Your claim requires manual adjuster review. Please ensure all original documents are available if requested. You may also upload clearer scans via the portal.";
    } else {
      decision = "REJECTED";
      approvedFinal = 0;
      notes = `${hardStops.length} hard-stop rule(s) triggered: ${hardStops.map((r) => r.code).join(", ")}. Claim cannot be processed.`;
      nextSteps = `Your claim has been rejected. ${hardStops[0].detail} If you believe this is an error, please raise an appeal within 15 days with supporting documentation.`;
    }
  }
  // Priority 3: High-value with no hard stops → MANUAL_REVIEW
  else if (isHighValue) {
    decision = "MANUAL_REVIEW";
    approvedFinal = finalApprovedAmount;
    notes = `High-value claim (₹${input.billTotal.toLocaleString("en-IN")} > ₹${HIGH_VALUE_THRESHOLD.toLocaleString("en-IN")}) with ${softFlags.length} soft flag(s). Routed for adjuster review.`;
    nextSteps = "High-value claims with flags require a human adjuster review. Expected resolution: 2–3 business days. No action needed from your side.";
  }
  // Priority 4: Partial approval when limits apply
  else if (finalApprovedAmount < input.billTotal && finalApprovedAmount > 0 && softFlags.length > 0) {
    decision = "PARTIAL";
    approvedFinal = finalApprovedAmount;
    notes = `Partial approval. Covered amount: ₹${finalApprovedAmount.toLocaleString("en-IN")} of ₹${input.billTotal.toLocaleString("en-IN")} claimed. Non-covered balance: ₹${(input.billTotal - finalApprovedAmount).toLocaleString("en-IN")} is member-liable.`;
    nextSteps = `₹${finalApprovedAmount.toLocaleString("en-IN")} will be reimbursed to your registered account within 5–7 business days. The remaining ₹${(input.billTotal - finalApprovedAmount).toLocaleString("en-IN")} must be paid out-of-pocket.`;
  }
  // Priority 5: All good → APPROVED
  else {
    decision = "APPROVED";
    approvedFinal = finalApprovedAmount > 0 ? finalApprovedAmount : input.billTotal;
    notes = `All ${stepResults.filter(s => s.step <= 5).length} adjudication steps passed. ${softFlags.length > 0 ? `${softFlags.length} soft flag(s) noted but not blocking.` : "No flags detected."}`;
    nextSteps = `₹${approvedFinal.toLocaleString("en-IN")} will be reimbursed to your registered bank account within 5–7 business days. You will receive an SMS and email confirmation.`;
  }

  // Confidence score: weighted composite
  const confidenceScore = computeConfidence(input, rejections, fraudScore);

  // Override to LOW_SYSTEM_CONFIDENCE in store if confidence < 0.55 but not already in MANUAL_REVIEW
  // (this is returned as a flag, the store maps it)

  return {
    claim_id: input.claimId,
    decision,
    approved_amount: Math.round(approvedFinal),
    deductible_applied: 0,
    copay_applied: copayAmount,
    rejection_reasons: rejections,
    confidence_score: parseFloat(confidenceScore.toFixed(2)),
    fraud_score: fraudScore,
    notes,
    next_steps: nextSteps,
    step_results: stepResults,
    processing_time_ms: Date.now() - start,
  };
}

// ─── Helpers ───────────────────────────────────────────────────────────────

function computeConfidence(
  input: AdjudicationInput,
  rejections: RejectionReason[],
  fraudScore: number
): number {
  let score = input.documents.ocrConfidence * 0.30;
  score += (input.fraud.documentAlterationSuspected ? 0 : 0.20);
  score += (fraudScore < 20 ? 0.20 : fraudScore < 40 ? 0.12 : 0.04);
  score += (rejections.filter((r) => r.isHardStop).length === 0 ? 0.15 : 0.04);
  score += (input.medical.diagnosisJustifiesTreatment ? 0.10 : 0.02);
  score += (input.documents.hasPrescription && input.documents.prescriptionIsValid ? 0.05 : 0);
  return Math.min(1, Math.max(0, score));
}

function levenshteinSimilarity(a: string, b: string): number {
  const m = a.length, n = b.length;
  if (m === 0 || n === 0) return 0;
  const dp: number[][] = Array.from({ length: m + 1 }, (_, i) =>
    Array.from({ length: n + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0))
  );
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] = a[i - 1] === b[j - 1]
        ? dp[i - 1][j - 1]
        : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
    }
  }
  return 1 - dp[m][n] / Math.max(m, n);
}

// ─── Mock Input Builders ────────────────────────────────────────────────────
// Used by ClaimUploadForm to construct a realistic input from an uploaded file

export function buildMockAdjudicationInput(
  claimId: string,
  memberId: string,
  memberName: string,
  billTotal: number,
  fileName: string,
  annualLimitUsed: number,
  annualLimit: number
): AdjudicationInput {
  const ocrConfidence = fileName.toLowerCase().endsWith(".jpg") ? 0.82 : 0.93;
  const today = new Date().toISOString().split("T")[0];
  const serviceDate = new Date(Date.now() - 3 * 86400000).toISOString().split("T")[0];

  return {
    claimId,
    memberId,
    memberName,
    billTotal,
    policy: {
      annualLimit,
      usedToDate: annualLimitUsed,
      perClaimLimit: 100000,
      subLimits: {
        consultation: { limit: 5000, used: 1200 },
        pharmacy:     { limit: 15000, used: 4800 },
        diagnostics:  { limit: 10000, used: 2200 },
      },
      coPayPercent: 20,
      networkCoPayPercent: 10,
      minClaimAmount: 500,
      waitingPeriodSatisfied: true,
      policyActiveOnServiceDate: true,
    },
    documents: {
      ocrConfidence,
      hasPrescription: true,
      prescriptionIsValid: true,
      doctorRegNumber: "MH/45821/2019",
      hasStampAndHeader: true,
      serviceDate,
      documentDates: [serviceDate],
      patientNameOnDoc: memberName,
      patientNameOnPolicy: memberName,
      submissionDate: today,
    },
    coverage: {
      diagnosisCodes: ["J06.9"],
      procedureCodes: ["99213"],
      providerIsInNetwork: ocrConfidence > 0.88,
      providerIsBlacklisted: false,
      preAuthRequired: billTotal > 25000,
      preAuthObtained: billTotal > 25000 && billTotal < 60000,
      serviceCategory: billTotal < 2000 ? "consultation" : billTotal < 8000 ? "diagnostics" : "specialist",
    },
    medical: {
      diagnosisJustifiesTreatment: true,
      prescriptionMatchesDiagnosis: true,
      followsStandardProtocol: true,
      isExperimental: false,
      isCosmetic: false,
    },
    fraud: {
      isDuplicate: false,
      providerClaimsOnSameDay: 0,
      unusualFrequency: false,
      documentAlterationSuspected: false,
      amountDeviationSigma: billTotal > 50000 ? 1.8 : 0.6,
    },
  };
}
