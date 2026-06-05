# Supabase Setup Script
# Run this in your Supabase SQL Editor

-- Create claims table
CREATE TABLE IF NOT EXISTS public.claims (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  claim_id text NOT NULL UNIQUE,
  employee_id text NOT NULL,
  patient_name text NOT NULL,
  amount_requested numeric NOT NULL,
  status text NOT NULL,
  department text,
  file_name text,
  file_url text,
  extracted_fields jsonb,
  adjudication_metrics jsonb,
  rule_violations jsonb,
  decision_output jsonb,
  audit_notes jsonb,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Setup Row Level Security (RLS) - For demo, we allow all
ALTER TABLE public.claims ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Enable read access for all users" ON public.claims
    FOR SELECT USING (true);

CREATE POLICY "Enable insert for all users" ON public.claims
    FOR INSERT WITH CHECK (true);

-- Create storage bucket for claim documents
INSERT INTO storage.buckets (id, name, public) 
VALUES ('claim_documents', 'claim_documents', true)
ON CONFLICT (id) DO NOTHING;

-- Storage policies for the bucket
CREATE POLICY "Public Access" ON storage.objects
    FOR SELECT USING (bucket_id = 'claim_documents');

CREATE POLICY "Insert Access" ON storage.objects
    FOR INSERT WITH CHECK (bucket_id = 'claim_documents');
