-- ================================================================
-- 022_fix_module_completion_trigger.sql
-- Fix: trg_modules_completed only fires on UPDATE, but first
-- module completion can be an INSERT with completed=true.
-- Change trigger to AFTER INSERT OR UPDATE and handle both ops.
-- ================================================================

CREATE OR REPLACE FUNCTION public.fn_check_modules_completed()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_track_id           UUID;
  v_total_active       INT;
  v_completed_by_guide INT;
BEGIN
  -- Only act when completed becomes TRUE
  IF NEW.completed IS NOT TRUE THEN RETURN NEW; END IF;
  -- On UPDATE, skip if already was completed
  IF TG_OP = 'UPDATE' AND OLD.completed IS TRUE THEN RETURN NEW; END IF;

  SELECT track_id INTO v_track_id
  FROM public.training_modules WHERE id = NEW.module_id;
  IF v_track_id IS NULL THEN RETURN NEW; END IF;

  SELECT COUNT(*) INTO v_total_active
  FROM public.training_modules
  WHERE track_id = v_track_id AND is_active = TRUE;

  SELECT COUNT(*) INTO v_completed_by_guide
  FROM public.guide_module_progress gmp
  JOIN public.training_modules tm ON tm.id = gmp.module_id
  WHERE gmp.guide_id  = NEW.guide_id
    AND tm.track_id   = v_track_id
    AND tm.is_active  = TRUE
    AND gmp.completed = TRUE;

  IF v_total_active > 0 AND v_completed_by_guide >= v_total_active THEN
    UPDATE public.guide_track_certifications
    SET
      stage                = 'MODULES_COMPLETED',
      modules_completed_at = NOW()
    WHERE guide_id = NEW.guide_id
      AND track_id = v_track_id
      AND stage    = 'PAID';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_modules_completed ON public.guide_module_progress;
CREATE TRIGGER trg_modules_completed
  AFTER INSERT OR UPDATE OF completed ON public.guide_module_progress
  FOR EACH ROW EXECUTE FUNCTION public.fn_check_modules_completed();

-- ================================================================
-- Backfill: For guides who already completed all modules but stage
-- is stuck at PAID, advance them now.
-- ================================================================
WITH completed_guides AS (
  SELECT gtc.id AS cert_id, gtc.guide_id, gtc.track_id
  FROM public.guide_track_certifications gtc
  WHERE gtc.stage = 'PAID'
    AND NOT EXISTS (
      SELECT 1
      FROM public.training_modules tm
      WHERE tm.track_id = gtc.track_id
        AND tm.is_active = TRUE
        AND NOT EXISTS (
          SELECT 1
          FROM public.guide_module_progress gmp
          WHERE gmp.guide_id  = gtc.guide_id
            AND gmp.module_id = tm.id
            AND gmp.completed = TRUE
        )
    )
    -- Make sure track actually has active modules
    AND EXISTS (
      SELECT 1 FROM public.training_modules tm
      WHERE tm.track_id = gtc.track_id AND tm.is_active = TRUE
    )
)
UPDATE public.guide_track_certifications
SET stage = 'MODULES_COMPLETED', modules_completed_at = NOW()
FROM completed_guides
WHERE guide_track_certifications.id = completed_guides.cert_id;

-- ================================================================
-- Backfill: For guides at MODULES_COMPLETED who already passed all
-- quizzes, advance to QUIZZES_PASSED → PENDING_INTERVIEW.
-- ================================================================
WITH quiz_done_guides AS (
  SELECT gtc.id AS cert_id, gtc.guide_id, gtc.track_id
  FROM public.guide_track_certifications gtc
  WHERE gtc.stage = 'MODULES_COMPLETED'
    AND (
      SELECT COUNT(DISTINCT q.id)
      FROM public.quizzes q
      JOIN public.training_modules tm ON tm.id = q.module_id
      WHERE tm.track_id = gtc.track_id AND tm.is_active = TRUE
    ) > 0
    AND (
      SELECT COUNT(DISTINCT qa.quiz_id)
      FROM public.quiz_attempts qa
      JOIN public.quizzes q ON q.id = qa.quiz_id
      JOIN public.training_modules tm ON tm.id = q.module_id
      WHERE qa.user_id = gtc.guide_id
        AND tm.track_id = gtc.track_id
        AND tm.is_active = TRUE
        AND qa.passed = TRUE
    ) >= (
      SELECT COUNT(DISTINCT q.id)
      FROM public.quizzes q
      JOIN public.training_modules tm ON tm.id = q.module_id
      WHERE tm.track_id = gtc.track_id AND tm.is_active = TRUE
    )
)
UPDATE public.guide_track_certifications
SET stage = 'PENDING_INTERVIEW', quiz_passed_at = NOW()
FROM quiz_done_guides
WHERE guide_track_certifications.id = quiz_done_guides.cert_id;

-- ================================================================
NOTIFY pgrst, 'reload schema';
-- ================================================================
