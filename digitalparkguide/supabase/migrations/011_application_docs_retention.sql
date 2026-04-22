-- ── Doc metadata table ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.guide_application_documents (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id  UUID        NOT NULL REFERENCES public.guide_applications(id) ON DELETE CASCADE,
  storage_path    TEXT        NOT NULL,
  file_name       TEXT        NOT NULL,
  mime_type       TEXT        NOT NULL,
  file_size       BIGINT      NOT NULL,
  uploaded_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  uploaded_by     UUID        REFERENCES auth.users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_gad_app ON public.guide_application_documents(application_id);

ALTER TABLE public.guide_application_documents ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "gad: applicant read own"   ON public.guide_application_documents;
DROP POLICY IF EXISTS "gad: applicant insert own" ON public.guide_application_documents;
DROP POLICY IF EXISTS "gad: hod+ read all"        ON public.guide_application_documents;
DROP POLICY IF EXISTS "gad: hod+ delete"          ON public.guide_application_documents;

-- Applicants can read/write docs only for their own application
CREATE POLICY "gad: applicant read own"
  ON public.guide_application_documents FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.guide_applications a
      WHERE a.id = application_id AND a.applicant_id = auth.uid()
    )
  );

CREATE POLICY "gad: applicant insert own"
  ON public.guide_application_documents FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.guide_applications a
      WHERE a.id = application_id AND a.applicant_id = auth.uid()
    )
  );

CREATE POLICY "gad: hod+ read all"
  ON public.guide_application_documents FOR SELECT
  USING (public.role_rank(public.current_user_role()) >= public.role_rank('HOD'));

CREATE POLICY "gad: hod+ delete"
  ON public.guide_application_documents FOR DELETE
  USING (public.role_rank(public.current_user_role()) >= public.role_rank('HOD'));

CREATE OR REPLACE FUNCTION public.bump_application_doc_count()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.guide_applications
       SET document_count = document_count + 1
     WHERE id = NEW.application_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.guide_applications
       SET document_count = GREATEST(document_count - 1, 0)
     WHERE id = OLD.application_id;
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS trg_bump_doc_count ON public.guide_application_documents;
CREATE TRIGGER trg_bump_doc_count
  AFTER INSERT OR DELETE ON public.guide_application_documents
  FOR EACH ROW
  EXECUTE FUNCTION public.bump_application_doc_count();


-- ── Storage bucket ────────────────────────────────────────────
INSERT INTO storage.buckets (id, name, public)
VALUES ('application-documents', 'application-documents', false)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "app-docs: applicant upload"  ON storage.objects;
DROP POLICY IF EXISTS "app-docs: applicant read"    ON storage.objects;
DROP POLICY IF EXISTS "app-docs: hod+ read"         ON storage.objects;
DROP POLICY IF EXISTS "app-docs: hod+ delete"       ON storage.objects;

CREATE POLICY "app-docs: applicant upload"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'application-documents'
    AND EXISTS (
      SELECT 1 FROM public.guide_applications a
      WHERE a.id::text = split_part(name, '/', 1)
        AND a.applicant_id = auth.uid()
    )
  );

CREATE POLICY "app-docs: applicant read"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'application-documents'
    AND EXISTS (
      SELECT 1 FROM public.guide_applications a
      WHERE a.id::text = split_part(name, '/', 1)
        AND a.applicant_id = auth.uid()
    )
  );

CREATE POLICY "app-docs: hod+ read"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'application-documents'
    AND public.role_rank(public.current_user_role()) >= public.role_rank('HOD')
  );

CREATE POLICY "app-docs: hod+ delete"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'application-documents'
    AND public.role_rank(public.current_user_role()) >= public.role_rank('HOD')
  );


-- ── 30-day retention cleanup ──────────────────────────────────
CREATE OR REPLACE FUNCTION public.purge_old_application_documents()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_doc RECORD;
BEGIN
  FOR v_doc IN
    SELECT d.id, d.storage_path
    FROM public.guide_application_documents d
    JOIN public.guide_applications a ON a.id = d.application_id
    WHERE a.status IN ('APPROVED', 'REJECTED')
      AND a.reviewed_at IS NOT NULL
      AND a.reviewed_at < NOW() - INTERVAL '30 days'
  LOOP
    -- Remove storage object first; the metadata row follows
    DELETE FROM storage.objects
     WHERE bucket_id = 'application-documents'
       AND name = v_doc.storage_path;

    DELETE FROM public.guide_application_documents
     WHERE id = v_doc.id;
  END LOOP;
END;
$$;

-- ── Schedule via pg_cron (Supabase extension) ─────────────────
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    -- Remove any previous schedule so this migration is idempotent
    PERFORM cron.unschedule('purge_old_application_docs')
      WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'purge_old_application_docs');
    PERFORM cron.schedule(
      'purge_old_application_docs',
      '0 19 * * *',  -- 19:00 UTC daily == 03:00 MYT (UTC+8)
      $cron$SELECT public.purge_old_application_documents();$cron$
    );
  ELSE
    RAISE NOTICE 'pg_cron not enabled — schedule purge_old_application_documents manually or enable pg_cron.';
  END IF;
END $$;