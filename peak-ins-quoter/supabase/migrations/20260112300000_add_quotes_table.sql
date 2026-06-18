-- Create quotes table for storing submitted quote requests
-- These are prepared for RPA execution to carrier sites

CREATE TABLE IF NOT EXISTS quotes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  extraction_id uuid NOT NULL REFERENCES extractions(id) ON DELETE CASCADE,
  quote_type text NOT NULL CHECK (quote_type IN ('home', 'auto', 'both')),
  quote_data jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),

  -- RPA execution tracking
  rpa_job_id text,
  rpa_started_at timestamptz,
  rpa_completed_at timestamptz,
  rpa_error text,

  -- Results from carrier quotes
  carrier_quotes jsonb DEFAULT '[]'::jsonb,

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE quotes ENABLE ROW LEVEL SECURITY;

-- Users can only see their own quotes
CREATE POLICY "Users can view own quotes"
  ON quotes FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- Users can insert their own quotes
CREATE POLICY "Users can insert own quotes"
  ON quotes FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Users can update their own quotes
CREATE POLICY "Users can update own quotes"
  ON quotes FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS quotes_user_id_idx ON quotes(user_id);
CREATE INDEX IF NOT EXISTS quotes_extraction_id_idx ON quotes(extraction_id);
CREATE INDEX IF NOT EXISTS quotes_status_idx ON quotes(status);
CREATE INDEX IF NOT EXISTS quotes_created_at_idx ON quotes(created_at DESC);

-- Add 'quoted' status to extractions table
ALTER TABLE extractions
DROP CONSTRAINT IF EXISTS extractions_status_check;

ALTER TABLE extractions
ADD CONSTRAINT extractions_status_check
CHECK (status IN ('pending', 'processing', 'completed', 'failed', 'quoted'));
