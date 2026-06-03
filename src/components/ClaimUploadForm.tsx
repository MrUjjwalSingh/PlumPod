"use client";

import { useState, useCallback, useRef } from "react";
import { Upload, FileText, X, CheckCircle2, Loader2, AlertCircle } from "lucide-react";
import { useClaimsStore, generateClaimId, type Claim } from "@/store/claimsStore";

interface UploadState {
  stage: "idle" | "dragging" | "uploading" | "extracting" | "adjudicating" | "done" | "error";
  file: File | null;
  progress: number;
  errorMsg: string;
}

const PROCESSING_STAGES = [
  { stage: "uploading", label: "Uploading document…", duration: 1000 },
  { stage: "extracting", label: "AI extracting fields (OCR)…", duration: 1800 },
  { stage: "adjudicating", label: "Running adjudication rules…", duration: 2200 },
  { stage: "done", label: "Claim submitted successfully", duration: 0 },
] as const;

export default function ClaimUploadForm() {
  const { addClaim, employee, setProcessing } = useClaimsStore();
  const [state, setState] = useState<UploadState>({
    stage: "idle",
    file: null,
    progress: 0,
    errorMsg: "",
  });
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFile = useCallback(
    async (file: File) => {
      const validTypes = ["application/pdf", "image/jpeg", "image/png", "image/webp"];
      if (!validTypes.includes(file.type)) {
        setState((s) => ({
          ...s,
          stage: "error",
          errorMsg: "Unsupported file type. Please upload PDF or image files.",
        }));
        return;
      }
      if (file.size > 20 * 1024 * 1024) {
        setState((s) => ({
          ...s,
          stage: "error",
          errorMsg: "File too large. Maximum size is 20 MB.",
        }));
        return;
      }

      setState({ stage: "uploading", file, progress: 0, errorMsg: "" });
      setProcessing(true);

      // Simulate multi-stage processing pipeline
      for (let i = 0; i < PROCESSING_STAGES.length; i++) {
        const { stage, duration } = PROCESSING_STAGES[i];
        setState((s) => ({ ...s, stage: stage as UploadState["stage"], progress: Math.round(((i + 1) / PROCESSING_STAGES.length) * 100) }));
        if (duration > 0) await sleep(duration);
      }

      // Generate mock claim from the uploaded file
      const mockClaim: Claim = buildMockClaim(file, employee.id, employee.name, employee.department);
      addClaim(mockClaim);
      setProcessing(false);

      setTimeout(() => {
        setState({ stage: "idle", file: null, progress: 0, errorMsg: "" });
      }, 3500);
    },
    [addClaim, employee, setProcessing]
  );

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setState((s) => ({ ...s, stage: "idle" }));
      const file = e.dataTransfer.files[0];
      if (file) handleFile(file);
    },
    [handleFile]
  );

  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const isProcessing = ["uploading", "extracting", "adjudicating"].includes(state.stage);
  const isDone = state.stage === "done";
  const isError = state.stage === "error";

  return (
    <div className="glass-card p-6 animate-fade-in">
      <div className="mb-5 flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-white">Submit New Claim</h2>
          <p className="text-sm text-[--text-secondary] mt-0.5">
            Upload your hospital invoice or receipt for automated adjudication
          </p>
        </div>
        <span className="rounded-lg bg-violet-500/10 border border-violet-500/20 px-3 py-1 text-xs font-medium text-violet-400">
          AI-Powered
        </span>
      </div>

      {/* Drop Zone */}
      {!isProcessing && !isDone && !isError && (
        <label
          htmlFor="claim-file-input"
          id="claim-dropzone"
          className={`group relative flex min-h-[180px] cursor-pointer flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed transition-all duration-300 ${
            state.stage === "dragging"
              ? "border-violet-400 bg-violet-500/10 scale-[1.01]"
              : "border-[--border-strong] bg-[--bg-surface] hover:border-violet-500/50 hover:bg-violet-500/5"
          }`}
          onDragOver={(e) => { e.preventDefault(); setState((s) => ({ ...s, stage: "dragging" })); }}
          onDragLeave={() => setState((s) => ({ ...s, stage: "idle" }))}
          onDrop={onDrop}
        >
          <div className={`flex h-14 w-14 items-center justify-center rounded-2xl transition-all duration-300 ${
            state.stage === "dragging"
              ? "bg-violet-500/30 text-violet-300"
              : "bg-[--bg-elevated] text-[--text-secondary] group-hover:bg-violet-500/20 group-hover:text-violet-400"
          }`}>
            <Upload size={26} strokeWidth={1.75} />
          </div>
          <div className="text-center">
            <p className="font-medium text-white">
              {state.stage === "dragging" ? "Drop file here" : "Drop your document here"}
            </p>
            <p className="mt-1 text-sm text-[--text-secondary]">
              or{" "}
              <span className="font-medium text-violet-400 underline underline-offset-2">
                browse to upload
              </span>
            </p>
            <p className="mt-2 text-xs text-[--text-muted]">PDF · JPG · PNG · WebP — max 20 MB</p>
          </div>
          <input
            ref={fileInputRef}
            id="claim-file-input"
            type="file"
            className="sr-only"
            accept=".pdf,.jpg,.jpeg,.png,.webp"
            onChange={onFileChange}
          />
        </label>
      )}

      {/* Processing State */}
      {isProcessing && (
        <div className="flex min-h-[180px] flex-col items-center justify-center gap-5 rounded-xl border border-[--border] bg-[--bg-surface] px-6 animate-fade-in">
          {/* Relative spinner ring */}
          <div className="relative h-16 w-16">
            <div className="absolute inset-0 rounded-full border-2 border-[--bg-elevated]" />
            <div
              className="absolute inset-0 rounded-full border-2 border-transparent border-t-violet-500 spin-ring"
            />
            <div className="absolute inset-2 flex items-center justify-center">
              <FileText size={20} className="text-violet-400" />
            </div>
          </div>
          <div className="w-full max-w-xs text-center">
            <p className="font-medium text-white">
              {PROCESSING_STAGES.find((s) => s.stage === state.stage)?.label}
            </p>
            {state.file && (
              <p className="mt-0.5 text-xs text-[--text-secondary] truncate">
                {state.file.name}
              </p>
            )}
            {/* Progress bar */}
            <div className="mt-4 h-1.5 w-full overflow-hidden rounded-full bg-[--bg-elevated]">
              <div
                className="h-full rounded-full bg-gradient-to-r from-violet-600 to-cyan-500 progress-fill"
                style={{ width: `${state.progress}%` }}
              />
            </div>
            <div className="mt-2 flex justify-between text-xs text-[--text-muted]">
              <span>OCR · Rules Engine · Fraud Check</span>
              <span>{state.progress}%</span>
            </div>
          </div>
        </div>
      )}

      {/* Done State */}
      {isDone && (
        <div className="flex min-h-[180px] flex-col items-center justify-center gap-3 rounded-xl border border-emerald-500/30 bg-emerald-500/5 animate-fade-in">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-emerald-500/20 text-emerald-400">
            <CheckCircle2 size={28} />
          </div>
          <div className="text-center">
            <p className="font-semibold text-emerald-400">Claim Submitted!</p>
            <p className="text-sm text-[--text-secondary] mt-1">
              Your claim has been queued for adjudication. Check the table below for status.
            </p>
          </div>
        </div>
      )}

      {/* Error State */}
      {isError && (
        <div className="flex min-h-[180px] flex-col items-center justify-center gap-3 rounded-xl border border-red-500/30 bg-red-500/5 animate-fade-in">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-red-500/20 text-red-400">
            <AlertCircle size={28} />
          </div>
          <div className="text-center">
            <p className="font-semibold text-red-400">Upload Failed</p>
            <p className="text-sm text-[--text-secondary] mt-1">{state.errorMsg}</p>
          </div>
          <button
            id="retry-upload-btn"
            onClick={() => setState({ stage: "idle", file: null, progress: 0, errorMsg: "" })}
            className="mt-1 rounded-lg border border-red-500/30 px-4 py-1.5 text-sm text-red-400 hover:bg-red-500/10 transition-colors"
          >
            Try Again
          </button>
        </div>
      )}

      {/* Accepted formats row */}
      {state.stage === "idle" && (
        <div className="mt-4 flex items-center gap-3 text-xs text-[--text-muted]">
          <span className="flex items-center gap-1.5">
            <span className="h-1.5 w-1.5 rounded-full bg-violet-500" />
            Hospital Invoices
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-1.5 w-1.5 rounded-full bg-cyan-500" />
            Lab Reports
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
            Pharmacy Bills
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
            Discharge Summaries
          </span>
        </div>
      )}
    </div>
  );
}

// ─── Helpers ───────────────────────────────────────────────────────────────

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

function buildMockClaim(file: File, empId: string, empName: string, dept: string): Claim {
  const amount = Math.floor(Math.random() * 45000) + 5000;
  const confidence = Math.random() * 0.3 + 0.7;
  const statuses = ["APPROVED", "MANUAL_REVIEW", "PARTIAL"] as const;
  const status = statuses[Math.floor(Math.random() * statuses.length)];
  const today = new Date().toISOString().split("T")[0];

  return {
    id: generateClaimId(),
    employeeId: empId,
    patientName: empName,
    date: today,
    amountRequested: amount,
    status,
    submittedBy: empName,
    department: dept,
    fileName: file.name,
    extractedFields: {
      patientName: empName,
      patientId: empId,
      providerName: "Uploaded Hospital",
      diagnosisCodes: ["J06.9"],
      procedureCodes: ["99213"],
      serviceDate: today,
      invoiceNumber: `INV-${Date.now()}`,
      billTotal: amount,
      ocrConfidence: confidence,
      isInNetwork: confidence > 0.8,
    },
    adjudicationMetrics: {
      eligibilityScore: Math.round(confidence * 100),
      fraudScore: Math.round((1 - confidence) * 50),
      policyMatchScore: Math.round(confidence * 90),
      duplicateCheckPassed: true,
      preAuthRequired: false,
      preAuthObtained: false,
      annualLimitBefore: 351500,
      annualLimitAfter: 351500 - (status === "APPROVED" ? amount : 0),
      approvedAmount: status === "APPROVED" ? amount : status === "PARTIAL" ? Math.floor(amount * 0.6) : 0,
      deductibleApplied: 0,
      coPayApplied: 0,
      systemVersion: "AGY-ADJ-v3.1.4",
      processingTimeMs: Math.floor(Math.random() * 3000) + 1000,
    },
    ruleViolations: confidence < 0.82
      ? [{
          code: "R009_LOW_CONFIDENCE_OCR",
          description: `OCR confidence ${(confidence * 100).toFixed(0)}% below 85% threshold.`,
          severity: "WARNING",
          triggeredValue: confidence.toFixed(2),
        }]
      : [],
    auditNotes: [
      {
        timestamp: new Date().toISOString(),
        actor: "AI_ENGINE",
        message: `Document "${file.name}" ingested. OCR confidence: ${(confidence * 100).toFixed(0)}%.`,
      },
      {
        timestamp: new Date().toISOString(),
        actor: "SYSTEM",
        message: `Adjudication complete. Status: ${status}. Approved: ₹${status === "APPROVED" ? amount.toLocaleString("en-IN") : 0}.`,
      },
    ],
  };
}
