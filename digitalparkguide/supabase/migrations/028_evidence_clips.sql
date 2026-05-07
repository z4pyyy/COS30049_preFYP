-- ================================================================
-- 028 — Evidence Clips: table, RLS, storage bucket + policies
-- ================================================================
-- Stores metadata for AI-detected violation clips captured by guides
-- in the /monitor page. Clips are recorded via MediaRecorder in-browser,
-- queued offline in IndexedDB, then synced to Supabase Storage.
-- ================================================================

-- ── Table ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.evidence_clips (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  guide_id          UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  track_id          UUID        REFERENCES public.training_tracks(id) ON DELETE SET NULL,
  clip_url          TEXT,
  thumbnail_url     TEXT,
  detected_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  duration_seconds  NUMERIC(5,2) NOT NULL,
  detection_type    TEXT        NOT NULL,
  confidence_score  NUMERIC(4,3) NOT NULL,
  status            TEXT        NOT NULL DEFAULT 'pending_review'
                    CHECK (status IN ('pending_review', 'reviewed', 'flagged', 'dismissed')),
  sync_status       TEXT        NOT NULL DEFAULT 'pending'
                    CHECK (sync_status IN ('pending', 'uploading', 'synced', 'failed')),
  local_queue_id    TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_evidence_clips_guide_id    ON public.evidence_clips(guide_id);
CREATE INDEX IF NOT EXISTS idx_evidence_clips_track_id    ON public.evidence_clips(track_id);
CREATE INDEX IF NOT EXISTS idx_evidence_clips_detected_at ON public.evidence_clips(detected_at DESC);
CREATE INDEX IF NOT EXISTS idx_evidence_clips_status      ON public.evidence_clips(status);

CREATE TRIGGER evidence_clips_updated_at
  BEFORE UPDATE ON public.evidence_clips
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ── RLS ────────────────────────────────────────────────────────
ALTER TABLE public.evidence_clips ENABLE ROW LEVEL SECURITY;

-- Guide: full access to own clips only
CREATE POLICY "ec: guide owns clips"
  ON public.evidence_clips
  FOR ALL
  USING (
    auth.uid() = guide_id
    AND public.role_rank(public.current_user_role()) >= public.role_rank('GUIDE')
  );

-- Senior Guide: read clips of guides in their group
CREATE POLICY "ec: senior reads group clips"
  ON public.evidence_clips
  FOR SELECT
  USING (
    public.current_user_role() = 'SENIOR_GUIDE'
    AND (
      guide_id = auth.uid()
      OR guide_id IN (
        SELECT m.guide_id FROM public.guide_group_members m
        WHERE m.senior_guide_id = auth.uid()
      )
    )
  );

-- Senior Guide: update status on group clips
CREATE POLICY "ec: senior updates group clip status"
  ON public.evidence_clips
  FOR UPDATE
  USING (
    public.current_user_role() = 'SENIOR_GUIDE'
    AND (
      guide_id = auth.uid()
      OR guide_id IN (
        SELECT m.guide_id FROM public.guide_group_members m
        WHERE m.senior_guide_id = auth.uid()
      )
    )
  );

-- HoD: read + update all clips
CREATE POLICY "ec: hod all clips"
  ON public.evidence_clips
  FOR SELECT
  USING (public.role_rank(public.current_user_role()) >= public.role_rank('HOD'));

CREATE POLICY "ec: hod updates clips"
  ON public.evidence_clips
  FOR UPDATE
  USING (public.role_rank(public.current_user_role()) >= public.role_rank('HOD'));

-- Superadmin: full access
CREATE POLICY "ec: superadmin full"
  ON public.evidence_clips
  FOR ALL
  USING (public.current_user_role() = 'SUPERADMIN');


-- ── Storage Bucket ─────────────────────────────────────────────
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'evidence-clips',
  'evidence-clips',
  false,
  52428800,
  ARRAY['video/mp4', 'video/webm', 'image/webp', 'image/jpeg']
)
ON CONFLICT (id) DO NOTHING;

-- Guide: upload to own folder
CREATE POLICY "ev-storage: guide upload own"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'evidence-clips'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- Guide: read own folder
CREATE POLICY "ev-storage: guide read own"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'evidence-clips'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- Senior Guide: read group folders
CREATE POLICY "ev-storage: senior read group"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'evidence-clips'
    AND (storage.foldername(name))[1] IN (
      SELECT m.guide_id::text FROM public.guide_group_members m
      WHERE m.senior_guide_id = auth.uid()
    )
  );

-- HoD + Superadmin: read all
CREATE POLICY "ev-storage: hod_sa read all"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'evidence-clips'
    AND public.role_rank(public.current_user_role()) >= public.role_rank('HOD')
  );
