"use client";

import { useState, useCallback, useRef } from "react";
import { Upload, FileText, CheckCircle2, AlertCircle } from "lucide-react";
import { useClaimsStore, generateClaimId, type Claim } from "@/store/claimsStore";

interface UploadState {
  stage:
    | "idle"
    | "dragging"
    | "uploading"
    | "extracting"
    | "checking"
    | "coverage"
    | "medical"
    | "done"
    | "error";
  file: File | null;
  progress: number;
  errorMsg: string;
}

const PROCESSING_STAGES = [
  { stage: "uploading",  label: "Uploading & validating document…",           activeStep: 0, duration: 700  },
  { stage: "extracting", label: "OCR Extraction — reading all fields…",        activeStep: 0, duration: 1400 },
  { stage: "checking",   label: "Step 1–2: Eligibility & Document Check…",    activeStep: 2, duration: 900  },
  { stage: "coverage",   label: "Step 3–4: Coverage & Limit Validation…",     activeStep: 4, duration: 900  },
  { stage: "medical",    label: "Step 5–6: Medical Necessity & Fraud Check…", activeStep: 5, duration: 800  },
] as const;

const PIPELINE_STEPS = [
  { num: 1, name: "Eligibility" },
  { num: 2, name: "Documents" },
  { num: 3, name: "Coverage" },
  { num: 4, name: "Limits" },
  { num: 5, name: "Medical" },
];

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

      let progressInterval: NodeJS.Timeout;
      try {
        // Simulate UI progress while waiting for the backend
        progressInterval = setInterval(() => {
          setState((s) => {
            const nextProgress = Math.min(s.progress + 5, 90);
            let nextStage = s.stage;
            if (nextProgress < 30) nextStage = "uploading";
            else if (nextProgress < 60) nextStage = "extracting";
            else if (nextProgress < 80) nextStage = "checking";
            else nextStage = "medical";
            
            return { ...s, stage: nextStage, progress: nextProgress };
          });
        }, 600);

        const formData = new FormData();
        formData.append("file", file);
        formData.append("employeeId", employee.id);
        formData.append("employeeName", employee.name);
        formData.append("department", employee.department);

        const response = await fetch("/api/adjudicate", {
          method: "POST",
          body: formData,
        });

        clearInterval(progressInterval);

        if (!response.ok) {
          throw new Error("Adjudication API failed");
        }

        const claimRecord = await response.json();
        
        addClaim(claimRecord);
        setState((s) => ({ ...s, stage: "done", progress: 100 }));
      } catch (err) {
        if (progressInterval!) clearInterval(progressInterval);
        setState((s) => ({
          ...s,
          stage: "error",
          errorMsg: err instanceof Error ? err.message : "Network error processing claim.",
        }));
      } finally {
        setProcessing(false);
        setTimeout(() => {
          setState((s) => s.stage === "done" ? { stage: "idle", file: null, progress: 0, errorMsg: "" } : s);
        }, 3500);
      }
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

  const isProcessing = ["uploading", "extracting", "checking", "coverage", "medical"].includes(
    state.stage
  );
  const isDone = state.stage === "done";
  const isError = state.stage === "error";

  const activeStepCount =
    PROCESSING_STAGES.find((s) => s.stage === state.stage)?.activeStep ?? 0;

  return (
    <div className="glass-card p-6 animate-fade-in">
      <div className="mb-5 flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-[--text-primary]">Submit New Claim</h2>
          <p className="text-sm text-[--text-secondary] mt-0.5">
            Upload your hospital invoice or receipt for automated adjudication
          </p>
        </div>
        <span className="rounded-lg bg-indigo-50 border border-indigo-100 px-3 py-1 text-xs font-medium text-indigo-600">
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
              ? "border-indigo-400 bg-indigo-50 scale-[1.01]"
              : "border-[--border-strong] bg-[--bg-base] hover:border-indigo-300 hover:bg-indigo-50/40"
          }`}
          onDragOver={(e) => {
            e.preventDefault();
            setState((s) => ({ ...s, stage: "dragging" }));
          }}
          onDragLeave={() => setState((s) => ({ ...s, stage: "idle" }))}
          onDrop={onDrop}
        >
          <div
            className={`flex h-14 w-14 items-center justify-center rounded-2xl transition-all duration-300 ${
              state.stage === "dragging"
                ? "bg-indigo-100 text-indigo-600"
                : "bg-[--bg-elevated] text-[--text-secondary] group-hover:bg-indigo-50 group-hover:text-indigo-600"
            }`}
          >
            <Upload size={26} strokeWidth={1.75} />
          </div>
          <div className="text-center">
            <p className="font-medium text-[--text-primary]">
              {state.stage === "dragging" ? "Drop file here" : "Drop your document here"}
            </p>
            <p className="mt-1 text-sm text-[--text-secondary]">
              or{" "}
              <span className="font-medium text-indigo-600 underline underline-offset-2">
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
        <div className="flex min-h-[210px] flex-col items-center justify-center gap-5 rounded-xl border border-[--border] bg-[--bg-base] px-6 py-6 animate-fade-in">
          {/* Spinner */}
          <div className="relative h-16 w-16">
            <div className="absolute inset-0 rounded-full border-2 border-[--bg-elevated]" />
            <div className="absolute inset-0 rounded-full border-2 border-transparent border-t-indigo-500 spin-ring" />
            <div className="absolute inset-2 flex items-center justify-center">
              <FileText size={20} className="text-indigo-600" />
            </div>
          </div>

          <div className="w-full max-w-xs text-center">
            <p className="font-medium text-[--text-primary]">
              {PROCESSING_STAGES.find((s) => s.stage === state.stage)?.label ?? "Processing…"}
            </p>
            {state.file && (
              <p className="mt-0.5 text-xs text-[--text-secondary] truncate">{state.file.name}</p>
            )}

            {/* 5-step pipeline indicator */}
            <div className="mt-4 flex items-end justify-center gap-2">
              {PIPELINE_STEPS.map((step) => {
                const done = activeStepCount >= step.num;
                const active = activeStepCount === step.num - 1;
                return (
                  <div key={step.num} className="flex flex-col items-center gap-1.5">
                    <div
                      className={`flex h-6 w-6 items-center justify-center rounded-full text-[10px] font-bold transition-all duration-300 ${
                        done
                          ? "bg-indigo-600 text-white scale-105"
                          : active
                          ? "bg-indigo-100 border border-indigo-300 text-indigo-600 animate-pulse"
                          : "bg-[--bg-elevated] border border-[--border] text-[--text-muted]"
                      }`}
                    >
                      {done ? <CheckCircle2 size={12} /> : step.num}
                    </div>
                    <span className="text-[8px] text-[--text-muted] leading-none whitespace-nowrap">
                      {step.name}
                    </span>
                  </div>
                );
              })}
            </div>

            {/* Progress bar */}
            <div className="mt-4 h-1.5 w-full overflow-hidden rounded-full bg-[--bg-elevated]">
              <div
                className="h-full rounded-full bg-gradient-to-r from-indigo-600 to-teal-500 progress-fill"
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
        <div className="flex min-h-[180px] flex-col items-center justify-center gap-3 rounded-xl border border-emerald-200 bg-emerald-50 animate-fade-in">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
            <CheckCircle2 size={28} />
          </div>
          <div className="text-center">
            <p className="font-semibold text-emerald-700">Claim Submitted!</p>
            <p className="text-sm text-[--text-secondary] mt-1">
              All 5 adjudication steps complete. Check the table below for status.
            </p>
          </div>
        </div>
      )}

      {/* Error State */}
      {isError && (
        <div className="flex min-h-[180px] flex-col items-center justify-center gap-3 rounded-xl border border-red-200 bg-red-50 animate-fade-in">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-red-100 text-red-600">
            <AlertCircle size={28} />
          </div>
          <div className="text-center">
            <p className="font-semibold text-red-700">Upload Failed</p>
            <p className="text-sm text-[--text-secondary] mt-1">{state.errorMsg}</p>
          </div>
          <button
            id="retry-upload-btn"
            onClick={() => setState({ stage: "idle", file: null, progress: 0, errorMsg: "" })}
            className="mt-1 rounded-lg border border-red-200 px-4 py-1.5 text-sm text-red-700 hover:bg-red-100 transition-colors"
          >
            Try Again
          </button>
        </div>
      )}

      {/* Accepted formats row */}
      {state.stage === "idle" && (
        <div className="mt-4 flex items-center gap-3 text-xs text-[--text-muted]">
          <span className="flex items-center gap-1.5">
            <span className="h-1.5 w-1.5 rounded-full bg-indigo-500" />
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
