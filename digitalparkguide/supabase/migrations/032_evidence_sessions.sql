-- ================================================================
-- 032 — Evidence clips: session grouping + pre-roll support
-- ================================================================
-- Adds session_id to group violation clips from the same monitoring
-- session, and pre_clip_url for the pre-violation recording.
-- ================================================================

ALTER TABLE public.evidence_clips
  ADD COLUMN IF NOT EXISTS session_id  TEXT,
  ADD COLUMN IF NOT EXISTS pre_clip_url TEXT;

CREATE INDEX IF NOT EXISTS idx_evidence_clips_session_id
  ON public.evidence_clips(session_id);
