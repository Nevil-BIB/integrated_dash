-- Create extractions table
CREATE TABLE public.extractions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  filename TEXT NOT NULL,
  storage_path TEXT NOT NULL,
  extracted_data JSONB,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create index for user lookups
CREATE INDEX idx_extractions_user_id ON public.extractions(user_id);
CREATE INDEX idx_extractions_status ON public.extractions(status);

-- Enable RLS
ALTER TABLE public.extractions ENABLE ROW LEVEL SECURITY;

-- RLS Policies: Users can only access their own extractions
CREATE POLICY "Users can view own extractions"
  ON public.extractions FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own extractions"
  ON public.extractions FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own extractions"
  ON public.extractions FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own extractions"
  ON public.extractions FOR DELETE
  USING (auth.uid() = user_id);

-- Create updated_at trigger
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_extractions_updated_at
  BEFORE UPDATE ON public.extractions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Storage bucket setup instructions (run in Supabase dashboard or via API):
-- INSERT INTO storage.buckets (id, name, public) VALUES ('fact-finders', 'fact-finders', false);

-- Storage RLS policies
-- CREATE POLICY "Users can upload own PDFs" ON storage.objects FOR INSERT
--   WITH CHECK (bucket_id = 'fact-finders' AND auth.uid()::text = (storage.foldername(name))[1]);
-- CREATE POLICY "Users can view own PDFs" ON storage.objects FOR SELECT
--   USING (bucket_id = 'fact-finders' AND auth.uid()::text = (storage.foldername(name))[1]);
-- CREATE POLICY "Users can delete own PDFs" ON storage.objects FOR DELETE
--   USING (bucket_id = 'fact-finders' AND auth.uid()::text = (storage.foldername(name))[1]);
