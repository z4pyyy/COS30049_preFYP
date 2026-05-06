-- ================================================================
-- 026_cleanup_cert_columns.sql
-- 1. Drop stripe_payment_intent + amount_cents from certs table
-- 2. Add profiles RLS: senior guides can read their group members
-- 3. Fix quiz_attempt_id population in advancement triggers
-- ================================================================


-- ── 1. Drop unused payment columns ────────────────────────────
-- Payment details live in guide_track_enrollments. Cert table
-- only needs stripe_session_id as a link back.
-- my_certifications_view uses c.* so must be dropped first.

DROP VIEW IF EXISTS public.my_certifications_view CASCADE;

ALTER TABLE public.guide_track_certifications
  DROP COLUMN IF EXISTS stripe_payment_intent,
  DROP COLUMN IF EXISTS amount_cents;

DROP FUNCTION IF EXISTS public.mark_payment_received(UUID, TEXT, TEXT, INT, TEXT);
DROP FUNCTION IF EXISTS public.mark_payment_received(UUID, TEXT, TEXT, INT);

-- Recreate the view without the dropped columns
CREATE VIEW public.my_certifications_view
  WITH (security_invoker = true)
AS
SELECT
  c.*,
  t.title          AS track_title,
  t.duration_weeks,
  p.full_name      AS guide_name
FROM public.guide_track_certifications c
JOIN public.training_tracks t ON t.id = c.track_id
JOIN public.profiles        p ON p.id = c.guide_id;


-- ── 2. Senior guides can read their group members' profiles ───
-- Without this, the interviews page can't resolve guide names
-- (profiles RLS only allowed own-read or HoD+ read-all).

DROP POLICY IF EXISTS "profiles: senior reads group members" ON public.profiles;
CREATE POLICY "profiles: senior reads group members"
  ON public.profiles FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.guide_group_members ggm
      WHERE ggm.senior_guide_id = auth.uid()
        AND ggm.guide_id = profiles.id
    )
  );


-- ── 3. Fix quiz_attempt_id in cert advancement triggers ───────
-- fn_advance_cert_on_quiz_pass (025) advances cert but doesn't
-- set quiz_attempt_id. Fix: store the triggering attempt ID.

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
          quiz_passed_at = NOW(),
          quiz_attempt_id = NEW.id
      WHERE guide_id = NEW.user_id
        AND track_id = v_track_id
        AND stage    = 'MODULES_COMPLETED';
    END IF;
  END LOOP;

  RETURN NEW;
END;
$$;


-- ── 4. Fix fn_advance_paid_cert (024) to also set quiz_attempt_id
-- When cert reaches PAID and guide already passed all quizzes,
-- grab the latest passing attempt for that track.

CREATE OR REPLACE FUNCTION public.fn_advance_paid_cert()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_total_modules   INT;
  v_done_modules    INT;
  v_total_quizzes   INT;
  v_passed_quizzes  INT;
  v_last_attempt    UUID;
BEGIN
  IF NEW.stage <> 'PAID' THEN RETURN NEW; END IF;
  IF TG_OP = 'UPDATE' AND OLD.stage = 'PAID' THEN RETURN NEW; END IF;

  SELECT COUNT(*) INTO v_total_modules
  FROM public.training_modules
  WHERE track_id = NEW.track_id
    AND is_active = TRUE
    AND is_archived = FALSE;

  IF v_total_modules = 0 THEN RETURN NEW; END IF;

  SELECT COUNT(*) INTO v_done_modules
  FROM public.guide_module_progress gmp
  JOIN public.training_modules tm ON tm.id = gmp.module_id
  WHERE gmp.guide_id = NEW.guide_id
    AND tm.track_id  = NEW.track_id
    AND tm.is_active = TRUE
    AND tm.is_archived = FALSE
    AND gmp.completed = TRUE;

  IF v_done_modules < v_total_modules THEN RETURN NEW; END IF;

  NEW.stage := 'MODULES_COMPLETED';
  NEW.modules_completed_at := COALESCE(NEW.modules_completed_at, NOW());

  SELECT COUNT(DISTINCT q.id) INTO v_total_quizzes
  FROM public.quizzes q
  JOIN public.training_modules tm ON tm.id = q.module_id
  WHERE tm.track_id = NEW.track_id
    AND tm.is_active = TRUE
    AND tm.is_archived = FALSE;

  IF v_total_quizzes = 0 THEN RETURN NEW; END IF;

  SELECT COUNT(DISTINCT qa.quiz_id) INTO v_passed_quizzes
  FROM public.quiz_attempts qa
  JOIN public.quizzes q ON q.id = qa.quiz_id
  JOIN public.training_modules tm ON tm.id = q.module_id
  WHERE qa.user_id  = NEW.guide_id
    AND tm.track_id = NEW.track_id
    AND tm.is_active = TRUE
    AND tm.is_archived = FALSE
    AND qa.passed = TRUE;

  IF v_passed_quizzes >= v_total_quizzes THEN
    -- Grab latest passing attempt for this track
    SELECT qa.id INTO v_last_attempt
    FROM public.quiz_attempts qa
    JOIN public.quizzes q ON q.id = qa.quiz_id
    JOIN public.training_modules tm ON tm.id = q.module_id
    WHERE qa.user_id  = NEW.guide_id
      AND tm.track_id = NEW.track_id
      AND qa.passed   = TRUE
    ORDER BY qa.created_at DESC
    LIMIT 1;

    NEW.stage := 'PENDING_INTERVIEW';
    NEW.quiz_passed_at := COALESCE(NEW.quiz_passed_at, NOW());
    NEW.quiz_attempt_id := v_last_attempt;
  END IF;

  RETURN NEW;
END;
$$;


-- ── 5. Backfill quiz_attempt_id for existing certs ────────────

UPDATE public.guide_track_certifications gtc
SET quiz_attempt_id = (
  SELECT qa.id
  FROM public.quiz_attempts qa
  JOIN public.quizzes q ON q.id = qa.quiz_id
  JOIN public.training_modules tm ON tm.id = q.module_id
  WHERE qa.user_id  = gtc.guide_id
    AND tm.track_id = gtc.track_id
    AND qa.passed   = TRUE
  ORDER BY qa.created_at DESC
  LIMIT 1
)
WHERE gtc.quiz_attempt_id IS NULL
  AND gtc.quiz_passed_at IS NOT NULL;


-- ================================================================
NOTIFY pgrst, 'reload schema';
-- ================================================================
