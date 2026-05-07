-- 029 — Add tpa_label column for manual TPA text input
-- When guide has no badge enrollment, they type TPA name manually.
-- track_id stays null, tpa_label stores the free-text name.
ALTER TABLE public.evidence_clips
  ADD COLUMN IF NOT EXISTS tpa_label TEXT;
