import { createClient } from "@supabase/supabase-js";
import type { Claim } from "@/store/claimsStore";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";

// We use service role key if available for backend operations, otherwise anon key
export const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: { persistSession: false },
});

export async function uploadDocument(file: File, claimId: string): Promise<string> {
  if (!supabaseUrl || !supabaseKey) {
    console.warn("Supabase not configured. Skipping upload.");
    return `mock-url-${claimId}`;
  }

  const fileExt = file.name.split(".").pop();
  const fileName = `${claimId}.${fileExt}`;
  const filePath = `${fileName}`;

  const { data, error } = await supabase.storage.from("claim_documents").upload(filePath, file);

  if (error) {
    console.error("Error uploading to Supabase Storage:", error);
    throw new Error("Failed to upload document");
  }

  const { data: publicUrlData } = supabase.storage.from("claim_documents").getPublicUrl(filePath);

  return publicUrlData.publicUrl;
}

export async function saveClaimToDb(claim: Claim, fileUrl?: string): Promise<void> {
  if (!supabaseUrl || !supabaseKey) {
    console.warn("Supabase not configured. Skipping DB save.");
    return;
  }

  const dbRecord = {
    claim_id: claim.id,
    employee_id: claim.employeeId,
    patient_name: claim.patientName,
    amount_requested: claim.amountRequested,
    status: claim.status,
    department: claim.department,
    file_name: claim.fileName,
    file_url: fileUrl || null,
    extracted_fields: claim.extractedFields,
    adjudication_metrics: claim.adjudicationMetrics,
    rule_violations: claim.ruleViolations,
    decision_output: claim.decisionOutput,
    audit_notes: claim.auditNotes,
  };

  const { error } = await supabase.from("claims").insert([dbRecord]);

  if (error) {
    console.error("Error saving claim to Supabase DB:", error);
    throw new Error("Failed to save claim record");
  }
}
