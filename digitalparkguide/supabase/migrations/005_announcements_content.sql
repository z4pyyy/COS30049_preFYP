-- Migration: Rich-content announcements
-- Adds structured body (headings/paragraphs/attachments), allows HOD+ to delete,
-- and provisions the announcement-attachments storage bucket.

-- ── blocks column ────────────────────────────────────────────────
-- JSONB array. Each element is one of:
--   { "type":"h1"|"h2"|"h3", "text":"..." }
--   { "type":"paragraph",    "text":"..." }
--   { "type":"attachment",   "name":"...", "url":"...", "path":"...", "size":123, "mime":"..." }
ALTER TABLE public.announcements
  ADD COLUMN IF NOT EXISTS blocks JSONB NOT NULL DEFAULT '[]'::jsonb;


-- ── relax delete policy so HOD+ can delete ───────────────────────
DROP POLICY IF EXISTS "announcements: superadmin delete" ON public.announcements;

CREATE POLICY "announcements: hod+ delete"
  ON public.announcements FOR DELETE
  USING (public.role_rank(public.current_user_role()) >= 3);


-- ── attachment storage bucket ────────────────────────────────────
INSERT INTO storage.buckets (id, name, public)
VALUES ('announcement-attachments', 'announcement-attachments', TRUE)
ON CONFLICT (id) DO UPDATE SET public = TRUE;

-- Public read (published announcements are public)
DROP POLICY IF EXISTS "announcement-attachments: public read" ON storage.objects;
CREATE POLICY "announcement-attachments: public read"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'announcement-attachments');

-- HOD+ can upload/update/delete
DROP POLICY IF EXISTS "announcement-attachments: hod+ insert" ON storage.objects;
CREATE POLICY "announcement-attachments: hod+ insert"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'announcement-attachments'
    AND public.role_rank(public.current_user_role()) >= 3
  );

DROP POLICY IF EXISTS "announcement-attachments: hod+ delete" ON storage.objects;
CREATE POLICY "announcement-attachments: hod+ delete"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'announcement-attachments'
    AND public.role_rank(public.current_user_role()) >= 3
  );
