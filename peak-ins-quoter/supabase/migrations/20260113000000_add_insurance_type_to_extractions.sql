-- Add insurance_type column to extractions table
-- This allows tracking what type of insurance the extraction is for

ALTER TABLE public.extractions
ADD COLUMN insurance_type TEXT DEFAULT 'generic' CHECK (insurance_type IN ('home', 'auto', 'both', 'generic'));

-- Add index for filtering by insurance type
CREATE INDEX idx_extractions_insurance_type ON public.extractions(insurance_type);

-- Update status check constraint to include 'quoted' status
ALTER TABLE public.extractions DROP CONSTRAINT IF EXISTS extractions_status_check;
ALTER TABLE public.extractions ADD CONSTRAINT extractions_status_check
  CHECK (status IN ('pending', 'processing', 'completed', 'failed', 'quoted'));

-- Add comment for documentation
COMMENT ON COLUMN public.extractions.insurance_type IS 'Type of insurance extraction: home, auto, both, or generic (legacy)';
