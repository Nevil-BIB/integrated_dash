-- Add storage policies for the fact-finders bucket
-- These policies ensure users can only access their own PDFs

-- Policy: Users can upload their own PDFs
-- Files must be stored in a folder named after their user ID
CREATE POLICY "Users can upload own PDFs"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'fact-finders'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- Policy: Users can view their own PDFs
CREATE POLICY "Users can view own PDFs"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'fact-finders'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- Policy: Users can delete their own PDFs
CREATE POLICY "Users can delete own PDFs"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'fact-finders'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- Ensure RLS is enabled on the extractions table (idempotent)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'extractions' AND policyname = 'Users can view own extractions'
  ) THEN
    CREATE POLICY "Users can view own extractions"
      ON public.extractions FOR SELECT
      USING (auth.uid() = user_id);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'extractions' AND policyname = 'Users can insert own extractions'
  ) THEN
    CREATE POLICY "Users can insert own extractions"
      ON public.extractions FOR INSERT
      WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'extractions' AND policyname = 'Users can update own extractions'
  ) THEN
    CREATE POLICY "Users can update own extractions"
      ON public.extractions FOR UPDATE
      USING (auth.uid() = user_id);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'extractions' AND policyname = 'Users can delete own extractions'
  ) THEN
    CREATE POLICY "Users can delete own extractions"
      ON public.extractions FOR DELETE
      USING (auth.uid() = user_id);
  END IF;
END $$;
