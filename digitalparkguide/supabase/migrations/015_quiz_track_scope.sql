-- ================================================================
-- 012 - QUIZ TRACK SCOPING
-- ================================================================
-- Bugs 1/3: quizzes were linked to a single module via quizzes.module_id.
-- Spec requires quizzes to be track-scoped and unlock only when the guide
-- has completed EVERY active module in that track.
--
-- NOTE FOR QUIZ LIST PAGES:
--   quizzes now has an extra column track_id UUID (nullable FK to
--   training_tracks). module_id is kept for backward compatibility so
--   existing rows keep working. Prefer joining on track_id -> training_tracks
--   when rendering the HoD quiz list.
-- ================================================================

ALTER TABLE public.quizzes
  ADD COLUMN IF NOT EXISTS track_id UUID
  REFERENCES public.training_tracks(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS quizzes_track_id_idx ON public.quizzes(track_id);

-- Backfill legacy rows from their module's track
UPDATE public.quizzes q
SET    track_id = m.track_id
FROM   public.training_modules m
WHERE  q.module_id = m.id
  AND  q.track_id IS NULL;

-- Canonical unlock predicate - used by both the module page and the
-- quiz-start endpoint so guide-side and server-side stay in lockstep.
CREATE OR REPLACE FUNCTION public.track_quiz_unlocked(p_track UUID, p_user UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE AS $$
  WITH track_modules AS (
    SELECT id FROM public.training_modules
    WHERE track_id = p_track AND is_active = TRUE AND is_archived = FALSE
  )
  SELECT EXISTS (SELECT 1 FROM track_modules)
    AND NOT EXISTS (
      SELECT 1 FROM track_modules tm
      WHERE NOT EXISTS (
        SELECT 1 FROM public.guide_module_progress gmp
        WHERE gmp.guide_id = p_user
          AND gmp.module_id = tm.id
          AND gmp.completed = TRUE
      )
    );
$$;
GRANT EXECUTE ON FUNCTION public.track_quiz_unlocked(UUID, UUID) TO authenticated;

-- Bug 2 helper: earliest passing attempt (NULL = not yet passed).
CREATE OR REPLACE FUNCTION public.guide_quiz_passed(p_quiz UUID, p_user UUID)
RETURNS TIMESTAMPTZ
LANGUAGE sql SECURITY DEFINER SET search_path = public STABLE AS $$
  SELECT MIN(submitted_at)
  FROM public.quiz_attempts
  WHERE quiz_id = p_quiz AND user_id = p_user
    AND passed = TRUE AND status = 'submitted';
$$;
GRANT EXECUTE ON FUNCTION public.guide_quiz_passed(UUID, UUID) TO authenticated;
