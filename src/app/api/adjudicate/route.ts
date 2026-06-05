import { NextRequest, NextResponse } from "next/server";
import { parseMedicalBill } from "@/lib/ai";
import { uploadDocument, saveClaimToDb } from "@/lib/db";
import { runAdjudication, AdjudicationInput } from "@/lib/adjudicationEngine";
import { generateClaimId } from "@/store/claimsStore";

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    const employeeId = formData.get("employeeId") as string;
    const employeeName = formData.get("employeeName") as string;
    const department = formData.get("department") as string;

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    const claimId = generateClaimId();
    const today = new Date().toISOString().split("T")[0];

    // 1. Upload to Supabase Storage (async)
    // We can await this right away, or do it concurrently with Gemini if we don't need the URL immediately.
    // For simplicity, we upload it now to get the URL to save later.
    let fileUrl = "";
    try {
      fileUrl = await uploadDocument(file, claimId);
    } catch (e) {
      console.warn("Storage upload failed, continuing without saving file...", e);
    }

    // 2. Parse with Gemini AI
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const mimeType = file.type;

    const extractedData = await parseMedicalBill(buffer, mimeType);

    // 3. Construct Adjudication Input
    // In a real system, `policy` limits would be fetched from the DB using `employeeId`.
    // Here we use realistic mock policy data.
    const input: AdjudicationInput = {
      claimId,
      memberId: employeeId,
      memberName: employeeName,
      billTotal: extractedData.billTotal,
      policy: {
        annualLimit: 500000,
        usedToDate: 148500,
        perClaimLimit: 100000,
        subLimits: {
          consultation: { limit: 5000, used: 1200 },
          pharmacy: { limit: 15000, used: 4800 },
          diagnostics: { limit: 10000, used: 2200 },
        },
        coPayPercent: 20,
        networkCoPayPercent: 10,
        minClaimAmount: 500,
        waitingPeriodSatisfied: true,
        policyActiveOnServiceDate: true,
      },
      documents: {
        ...extractedData.document,
        submissionDate: today,
        patientNameOnPolicy: employeeName,
        ageOnDoc: 30, // Mocked
        ageOnPolicy: 30, // Mocked
      },
      coverage: {
        ...extractedData.coverage,
        providerIsInNetwork: extractedData.document.ocrConfidence > 0.88,
        providerIsBlacklisted: false,
        preAuthRequired: extractedData.billTotal > 25000,
        preAuthObtained: extractedData.billTotal > 25000 && extractedData.billTotal < 60000,
      },
      medical: extractedData.medical,
      fraud: {
        isDuplicate: false,
        providerClaimsOnSameDay: 0,
        unusualFrequency: false,
        documentAlterationSuspected: false,
        amountDeviationSigma: extractedData.billTotal > 50000 ? 1.8 : 0.6,
      },
    };

    // 4. Run Deterministic Engine
    const decision = runAdjudication(input);

    // 5. Build final Claim object
    const decisionToStatus = {
      APPROVED: "APPROVED",
      REJECTED: "REJECTED",
      PARTIAL: "PARTIAL",
      MANUAL_REVIEW: "MANUAL_REVIEW",
    } as const;

    const claimRecord = {
      id: claimId,
      employeeId,
      patientName: employeeName,
      date: today,
      amountRequested: extractedData.billTotal,
      status: decisionToStatus[decision.decision],
      submittedBy: employeeName,
      department,
      fileName: file.name,
      extractedFields: {
        patientName: extractedData.document.patientNameOnDoc,
        patientId: employeeId,
        providerName: "Extracted Provider",
        diagnosisCodes: extractedData.coverage.diagnosisCodes,
        procedureCodes: extractedData.coverage.procedureCodes,
        serviceDate: extractedData.document.serviceDate,
        submissionDate: today,
        invoiceNumber: `INV-${Date.now()}`,
        billTotal: extractedData.billTotal,
        ocrConfidence: extractedData.document.ocrConfidence,
        isInNetwork: input.coverage.providerIsInNetwork,
        doctorRegNumber: extractedData.document.doctorRegNumber,
        hasPrescription: extractedData.document.hasPrescription,
        serviceCategory: extractedData.coverage.serviceCategory,
        waitingPeriodSatisfied: input.policy.waitingPeriodSatisfied,
      },
      adjudicationMetrics: {
        eligibilityScore: input.policy.policyActiveOnServiceDate
          ? Math.round(80 + extractedData.document.ocrConfidence * 20)
          : 40,
        fraudScore: decision.fraud_score,
        policyMatchScore: Math.round(decision.confidence_score * 100),
        duplicateCheckPassed: !input.fraud.isDuplicate,
        preAuthRequired: input.coverage.preAuthRequired,
        preAuthObtained: input.coverage.preAuthObtained,
        annualLimitBefore: input.policy.annualLimit,
        annualLimitAfter: input.policy.annualLimit - decision.approved_amount,
        approvedAmount: decision.approved_amount,
        deductibleApplied: decision.deductible_applied,
        coPayApplied: decision.copay_applied,
        systemVersion: "AGY-ADJ-v3.2.0",
        processingTimeMs: decision.processing_time_ms,
      },
      ruleViolations: decision.rejection_reasons.map((r) => ({
        code: r.code,
        category: r.category,
        description: r.detail,
        severity: r.isHardStop ? "HARD_STOP" : "SOFT_FLAG",
        triggeredValue: r.code,
      })),
      auditNotes: [
        {
          timestamp: new Date().toISOString(),
          actor: "AI_ENGINE",
          message: `Document "${file.name}" ingested. OCR: ${(extractedData.document.ocrConfidence * 100).toFixed(0)}%. Service: ${extractedData.coverage.serviceCategory}. Bill total: ₹${extractedData.billTotal.toLocaleString("en-IN")}.`,
        },
        ...decision.step_results.map((s) => ({
          timestamp: new Date().toISOString(),
          actor: "AI_ENGINE",
          message: `Step ${s.step} — ${s.name}: ${s.passed ? "✓ PASSED" : "✗ FAILED"} — ${s.detail}`,
        })),
        {
          timestamp: new Date().toISOString(),
          actor: "SYSTEM",
          message: `Adjudication complete. Decision: ${decision.decision}. Approved: ₹${decision.approved_amount.toLocaleString("en-IN")}. Confidence: ${(decision.confidence_score * 100).toFixed(0)}%. Fraud score: ${decision.fraud_score}/100.`,
        },
      ],
      decisionOutput: decision,
    };

    // 6. Save to Supabase DB
    try {
      // @ts-ignore - store types match exactly
      await saveClaimToDb(claimRecord, fileUrl);
    } catch (e) {
      console.warn("Failed to save to Supabase DB, returning data to UI anyway.", e);
    }

    // 7. Return 200 OK to UI
    return NextResponse.json(claimRecord, { status: 200 });

  } catch (error) {
    console.error("Adjudication API error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
