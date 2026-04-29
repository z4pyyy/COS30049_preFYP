-- ================================================================
-- 019 - QUIZ MODULE SCOPING
-- ================================================================
-- Change quizzes from track-scoped (015) back to module-scoped.
-- Each module can optionally have one quiz. Quiz unlocks when
-- that specific module is marked complete (not whole track).
-- ================================================================

-- Backfill module_id for any rows that only have track_id:
-- pick the first active module in that track so no quiz is orphaned.
UPDATE public.quizzes q
SET    module_id = (
  SELECT tm.id FROM public.training_modules tm
  WHERE  tm.track_id = q.track_id
    AND  tm.is_active = TRUE AND tm.is_archived = FALSE
  ORDER BY tm.order_index ASC
  LIMIT  1
)
WHERE  q.module_id IS NULL
  AND  q.track_id IS NOT NULL;

-- Make module_id NOT NULL going forward
ALTER TABLE public.quizzes ALTER COLUMN module_id SET NOT NULL;

-- Index for module_id lookups
CREATE INDEX IF NOT EXISTS quizzes_module_id_idx ON public.quizzes(module_id);

-- Unique: one quiz per module
CREATE UNIQUE INDEX IF NOT EXISTS quizzes_module_id_unique ON public.quizzes(module_id);


-- ================================================================
-- New unlock predicate: quiz unlocks when THIS module is complete
-- ================================================================
CREATE OR REPLACE FUNCTION public.module_quiz_unlocked(p_module UUID, p_user UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.guide_module_progress gmp
    WHERE gmp.guide_id  = p_user
      AND gmp.module_id = p_module
      AND gmp.completed = TRUE
  );
$$;
GRANT EXECUTE ON FUNCTION public.module_quiz_unlocked(UUID, UUID) TO authenticated;


-- ================================================================
-- Update certification trigger: count module-scoped quizzes in track
-- ================================================================
CREATE OR REPLACE FUNCTION public.fn_check_quizzes_passed()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_module_id      UUID;
  v_track_id       UUID;
  v_total_quizzes  INT;
  v_passed_quizzes INT;
  v_cert           public.guide_track_certifications;
BEGIN
  IF NEW.passed IS NOT TRUE THEN RETURN NEW; END IF;

  -- quiz_attempts.quiz_id → quizzes.module_id → training_modules.track_id
  SELECT q.module_id INTO v_module_id
  FROM public.quizzes q WHERE q.id = NEW.quiz_id;
  IF v_module_id IS NULL THEN RETURN NEW; END IF;

  SELECT tm.track_id INTO v_track_id
  FROM public.training_modules tm WHERE tm.id = v_module_id;
  IF v_track_id IS NULL THEN RETURN NEW; END IF;

  SELECT * INTO v_cert
  FROM public.guide_track_certifications
  WHERE guide_id = NEW.user_id
    AND track_id = v_track_id
    AND stage    = 'MODULES_COMPLETED';
  IF v_cert.id IS NULL THEN RETURN NEW; END IF;

  -- Count quizzes bound to active modules in this track
  SELECT COUNT(*) INTO v_total_quizzes
  FROM public.quizzes q
  JOIN public.training_modules tm ON tm.id = q.module_id
  WHERE tm.track_id = v_track_id AND tm.is_active = TRUE AND tm.is_archived = FALSE;

  IF v_total_quizzes = 0 THEN RETURN NEW; END IF;

  -- Count distinct quizzes the guide has passed for this track
  SELECT COUNT(DISTINCT qa.quiz_id) INTO v_passed_quizzes
  FROM public.quiz_attempts qa
  JOIN public.quizzes q            ON q.id  = qa.quiz_id
  JOIN public.training_modules tm  ON tm.id = q.module_id
  WHERE qa.user_id   = NEW.user_id
    AND tm.track_id  = v_track_id
    AND tm.is_active = TRUE
    AND tm.is_archived = FALSE
    AND qa.passed    = TRUE;

  IF v_passed_quizzes >= v_total_quizzes THEN
    UPDATE public.guide_track_certifications
    SET stage           = 'QUIZZES_PASSED',
        quiz_attempt_id = NEW.id,
        quiz_passed_at  = NOW()
    WHERE id = v_cert.id;

    UPDATE public.guide_track_certifications
    SET stage = 'PENDING_INTERVIEW'
    WHERE id = v_cert.id;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_quizzes_passed ON public.quiz_attempts;
CREATE TRIGGER trg_quizzes_passed
  AFTER INSERT OR UPDATE ON public.quiz_attempts
  FOR EACH ROW EXECUTE FUNCTION public.fn_check_quizzes_passed();
