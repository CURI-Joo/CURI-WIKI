-- MCP connector compatibility fields for public.documents
-- Existing data is preserved; only additive changes.

-- If created_by already exists in documents, reuse it as author source and do NOT add author_id.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'documents'
      AND column_name = 'created_by'
  ) THEN
    EXECUTE 'ALTER TABLE public.documents ADD COLUMN IF NOT EXISTS author_id uuid REFERENCES auth.users(id)';
  END IF;
END $$;

ALTER TABLE public.documents
  ADD COLUMN IF NOT EXISTS source_url text;

ALTER TABLE public.documents
  ADD COLUMN IF NOT EXISTS tags text[] NOT NULL DEFAULT '{}';
