-- ================================================================
-- 025_advance_cert_on_progress.sql
-- Fix: fn_advance_paid_cert only fires when cert reaches PAID.
-- Normal flow is pay → complete modules → pass quizzes, so cert
-- is already at PAID when guide finishes.  Need triggers on
-- guide_module_progress and quiz_attempts to advance cert forward.
--
-- IMPORTANT: module counts must match guide_progress_summary view
-- which uses  is_active = TRUE AND is_archived = FALSE.
-- ================================================================


-- ── 1. Advance cert when guide completes a module ──────────────

CREATE OR REPLACE FUNCTION public.fn_advance_cert_on_module_complete()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_track_id       UUID;
  v_total_modules  INT;
  v_done_modules   INT;
BEGIN
  IF NOT NEW.completed THEN RETURN NEW; END IF;

  FOR v_track_id IN
    SELECT DISTINCT tm.track_id
    FROM public.training_modules tm
    WHERE tm.id = NEW.module_id
      AND tm.is_active = TRUE
      AND tm.is_archived = FALSE
  LOOP
    SELECT COUNT(*) INTO v_total_modules
    FROM public.training_modules
    WHERE track_id = v_track_id
      AND is_active = TRUE
      AND is_archived = FALSE;

    SELECT COUNT(*) INTO v_done_modules
    FROM public.guide_module_progress gmp
    JOIN public.training_modules tm ON tm.id = gmp.module_id
    WHERE gmp.guide_id = NEW.guide_id
      AND tm.track_id  = v_track_id
      AND tm.is_active  = TRUE
      AND tm.is_archived = FALSE
      AND gmp.completed = TRUE;

    IF v_done_modules >= v_total_modules AND v_total_modules > 0 THEN
      UPDATE public.guide_track_certifications
      SET stage = 'MODULES_COMPLETED',
          modules_completed_at = NOW()
      WHERE guide_id = NEW.guide_id
        AND track_id = v_track_id
        AND stage    = 'PAID';
    END IF;
  END LOOP;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_advance_cert_on_module_complete ON public.guide_module_progress;
CREATE TRIGGER trg_advance_cert_on_module_complete
  AFTER INSERT OR UPDATE OF completed ON public.guide_module_progress
  FOR EACH ROW EXECUTE FUNCTION public.fn_advance_cert_on_module_complete();


-- ── 2. Advance cert when guide passes a quiz ───────────────────

CREATE OR REPLACE FUNCTION public.fn_advance_cert_on_quiz_pass()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_track_id       UUID;
  v_total_quizzes  INT;
  v_passed_quizzes INT;
BEGIN
  IF NOT NEW.passed THEN RETURN NEW; END IF;

  FOR v_track_id IN
    SELECT DISTINCT tm.track_id
    FROM public.quizzes q
    JOIN public.training_modules tm ON tm.id = q.module_id
    WHERE q.id = NEW.quiz_id
      AND tm.is_active = TRUE
      AND tm.is_archived = FALSE
  LOOP
    SELECT COUNT(DISTINCT q.id) INTO v_total_quizzes
    FROM public.quizzes q
    JOIN public.training_modules tm ON tm.id = q.module_id
    WHERE tm.track_id = v_track_id
      AND tm.is_active = TRUE
      AND tm.is_archived = FALSE;

    SELECT COUNT(DISTINCT qa.quiz_id) INTO v_passed_quizzes
    FROM public.quiz_attempts qa
    JOIN public.quizzes q ON q.id = qa.quiz_id
    JOIN public.training_modules tm ON tm.id = q.module_id
    WHERE qa.user_id  = NEW.user_id
      AND tm.track_id = v_track_id
      AND tm.is_active = TRUE
      AND tm.is_archived = FALSE
      AND qa.passed    = TRUE;

    IF v_passed_quizzes >= v_total_quizzes AND v_total_quizzes > 0 THEN
      UPDATE public.guide_track_certifications
      SET stage = 'PENDING_INTERVIEW',
          quiz_passed_at = NOW()
      WHERE guide_id = NEW.user_id
        AND track_id = v_track_id
        AND stage    = 'MODULES_COMPLETED';
    END IF;
  END LOOP;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_advance_cert_on_quiz_pass ON public.quiz_attempts;
CREATE TRIGGER trg_advance_cert_on_quiz_pass
  AFTER INSERT OR UPDATE OF passed ON public.quiz_attempts
  FOR EACH ROW EXECUTE FUNCTION public.fn_advance_cert_on_quiz_pass();


-- ── 3. Backfill: advance existing PAID certs where modules done ─

WITH completed AS (
  SELECT gtc.id AS cert_id
  FROM public.guide_track_certifications gtc
  WHERE gtc.stage = 'PAID'
    AND EXISTS (
      SELECT 1 FROM public.training_modules tm
      WHERE tm.track_id = gtc.track_id
        AND tm.is_active = TRUE
        AND tm.is_archived = FALSE
    )
    AND NOT EXISTS (
      SELECT 1
      FROM public.training_modules tm
      WHERE tm.track_id = gtc.track_id
        AND tm.is_active = TRUE
        AND tm.is_archived = FALSE
        AND NOT EXISTS (
          SELECT 1
          FROM public.guide_module_progress gmp
          WHERE gmp.guide_id  = gtc.guide_id
            AND gmp.module_id = tm.id
            AND gmp.completed = TRUE
        )
    )
)
UPDATE public.guide_track_certifications
SET stage = 'MODULES_COMPLETED', modules_completed_at = NOW()
FROM completed
WHERE guide_track_certifications.id = completed.cert_id;


-- ── 4. Backfill: advance MODULES_COMPLETED → PENDING_INTERVIEW ─

WITH quiz_done AS (
  SELECT gtc.id AS cert_id
  FROM public.guide_track_certifications gtc
  WHERE gtc.stage = 'MODULES_COMPLETED'
    AND (
      SELECT COUNT(DISTINCT q.id)
      FROM public.quizzes q
      JOIN public.training_modules tm ON tm.id = q.module_id
      WHERE tm.track_id = gtc.track_id
        AND tm.is_active = TRUE
        AND tm.is_archived = FALSE
    ) > 0
    AND (
      SELECT COUNT(DISTINCT qa.quiz_id)
      FROM public.quiz_attempts qa
      JOIN public.quizzes q ON q.id = qa.quiz_id
      JOIN public.training_modules tm ON tm.id = q.module_id
      WHERE qa.user_id  = gtc.guide_id
        AND tm.track_id = gtc.track_id
        AND tm.is_active = TRUE
        AND tm.is_archived = FALSE
        AND qa.passed    = TRUE
    ) >= (
      SELECT COUNT(DISTINCT q.id)
      FROM public.quizzes q
      JOIN public.training_modules tm ON tm.id = q.module_id
      WHERE tm.track_id = gtc.track_id
        AND tm.is_active = TRUE
        AND tm.is_archived = FALSE
    )
)
UPDATE public.guide_track_certifications
SET stage = 'PENDING_INTERVIEW', quiz_passed_at = NOW()
FROM quiz_done
WHERE guide_track_certifications.id = quiz_done.cert_id;


-- ================================================================
NOTIFY pgrst, 'reload schema';
-- ================================================================
