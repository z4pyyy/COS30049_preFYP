-- B4.1: Guide track enrollment
-- A guide must explicitly activate a training track before its modules unlock.

CREATE TABLE IF NOT EXISTS public.guide_track_enrollments (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  guide_id    UUID        NOT NULL REFERENCES auth.users(id)             ON DELETE CASCADE,
  track_id    UUID        NOT NULL REFERENCES public.training_tracks(id) ON DELETE CASCADE,
  enrolled_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  status      TEXT        NOT NULL DEFAULT 'active'
                          CHECK (status IN ('active', 'completed', 'paused')),
  UNIQUE (guide_id, track_id)
);

ALTER TABLE public.guide_track_enrollments ENABLE ROW LEVEL SECURITY;

-- Guides can read and manage their own enrollments
CREATE POLICY "guides_own_enrollments"
  ON public.guide_track_enrollments
  FOR ALL
  USING (auth.uid() = guide_id);

-- Senior Guides, HoD, and Superadmin can view all enrollments (progress review)
CREATE POLICY "senior_guides_view_enrollments"
  ON public.guide_track_enrollments
  FOR SELECT
  USING (public.role_rank(public.current_user_role()) >= public.role_rank('SENIOR_GUIDE'));
