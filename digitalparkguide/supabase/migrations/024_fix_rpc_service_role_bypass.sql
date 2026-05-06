-- ================================================================
-- 024_fix_rpc_service_role_bypass.sql
-- Fix: issue_tpa_badge, reject_certification, revoke_badge all use
-- auth.uid() for role checks.  When called via service-role (admin
-- client from server actions), auth.uid() is NULL → role check
-- fails.  Fix: skip role check when auth.uid() IS NULL (service-
-- role caller).  Server actions enforce authorization separately.
-- ================================================================

-- ── 1. issue_tpa_badge ─────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.issue_tpa_badge(p_cert_id UUID)
RETURNS public.guide_track_certifications
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_cert     public.guide_track_certifications;
  v_caller   UUID;
  v_role     app_role;
  v_tpa_code TEXT;
  v_year     INT;
  v_seq      INT;
  v_cert_no  TEXT;
BEGIN
  v_caller := auth.uid();

  -- Service-role calls have NULL auth.uid(); skip role check.
  -- Server actions enforce HoD authorization before calling this.
  IF v_caller IS NOT NULL THEN
    SELECT role INTO v_role FROM public.profiles WHERE id = v_caller;
    IF public.role_rank(v_role) < public.role_rank('HOD') THEN
      RAISE EXCEPTION 'Only HOD+ may issue TPA badges';
    END IF;
  END IF;

  SELECT * INTO v_cert
  FROM public.guide_track_certifications
  WHERE id = p_cert_id AND stage = 'PENDING_BADGE_APPROVAL'
  FOR UPDATE;

  IF v_cert.id IS NULL THEN
    RAISE EXCEPTION 'Certification % not found or not in PENDING_BADGE_APPROVAL', p_cert_id;
  END IF;

  v_tpa_code := UPPER(LEFT(v_cert.tpa_name, 2));
  v_year     := EXTRACT(YEAR FROM NOW())::INT;

  PERFORM pg_advisory_xact_lock(hashtext(v_cert.tpa_name || v_year::TEXT)::BIGINT);

  SELECT COUNT(*) + 1 INTO v_seq
  FROM public.guide_track_certifications
  WHERE tpa_name = v_cert.tpa_name
    AND stage    = 'BADGE_ISSUED'
    AND EXTRACT(YEAR FROM badge_issued_at) = v_year;

  v_cert_no := FORMAT('SFC-%s-%s-%s', v_tpa_code, v_year, LPAD(v_seq::TEXT, 4, '0'));

  UPDATE public.guide_track_certifications
  SET
    stage           = 'BADGE_ISSUED',
    badge_issued_at  = NOW(),
    badge_issued_by  = v_caller,
    certificate_no   = v_cert_no
  WHERE id = p_cert_id
  RETURNING * INTO v_cert;

  PERFORM public.issue_guide_badge(
    v_cert.guide_id,
    v_cert.track_id,
    v_caller,
    FORMAT('Certificate %s issued via certification pipeline', v_cert_no)
  );

  RETURN v_cert;
END;
$$;


-- ── 2. reject_certification ────────────────────────────────────

CREATE OR REPLACE FUNCTION public.reject_certification(p_cert_id UUID, p_reason TEXT)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller        UUID;
  v_role          app_role;
  v_current_stage TEXT;
BEGIN
  v_caller := auth.uid();

  IF v_caller IS NOT NULL THEN
    SELECT role INTO v_role FROM public.profiles WHERE id = v_caller;
    IF public.role_rank(v_role) < public.role_rank('SENIOR_GUIDE') THEN
      RAISE EXCEPTION 'Only SENIOR_GUIDE+ may reject certifications';
    END IF;
  END IF;

  SELECT stage INTO v_current_stage
  FROM public.guide_track_certifications
  WHERE id = p_cert_id
    AND stage NOT IN ('BADGE_ISSUED', 'REJECTED')
    AND (
      v_caller IS NULL  -- service-role: allow any
      OR interviewer_id = v_caller
      OR public.role_rank(v_role) >= public.role_rank('HOD')
    );

  IF v_current_stage IS NULL THEN
    RAISE EXCEPTION 'Certification % not found or cannot be rejected in current state', p_cert_id;
  END IF;

  UPDATE public.guide_track_certifications
  SET
    stage           = 'REJECTED',
    interview_outcome = 'REJECTED',
    interview_notes   = COALESCE(interview_notes || E'\n', '') || 'Rejected: ' || p_reason,
    interview_completed_at = COALESCE(interview_completed_at, NOW())
  WHERE id = p_cert_id;
END;
$$;


-- ── 3. revoke_badge ────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.revoke_badge(p_cert_id UUID, p_reason TEXT)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller   UUID;
  v_role     app_role;
  v_guide_id UUID;
  v_track_id UUID;
BEGIN
  v_caller := auth.uid();

  IF v_caller IS NOT NULL THEN
    SELECT role INTO v_role FROM public.profiles WHERE id = v_caller;
    IF public.role_rank(v_role) < public.role_rank('HOD') THEN
      RAISE EXCEPTION 'Only HOD+ may revoke badges';
    END IF;
  END IF;

  SELECT guide_id, track_id INTO v_guide_id, v_track_id
  FROM public.guide_track_certifications
  WHERE id         = p_cert_id
    AND stage      = 'BADGE_ISSUED'
    AND revoked_at IS NULL;

  IF v_guide_id IS NULL THEN
    RAISE EXCEPTION
      'Certification % not found, badge not yet issued, or already revoked',
      p_cert_id;
  END IF;

  UPDATE public.guide_track_certifications
  SET revoked_at = NOW(), revoked_reason = p_reason
  WHERE id = p_cert_id;

  UPDATE public.profiles
  SET badge_revoked = TRUE
  WHERE id = v_guide_id;

  UPDATE public.guide_badges
  SET status = 'REVOKED'
  WHERE guide_id = v_guide_id
    AND track_id  = v_track_id;
END;
$$;


-- ── 4. approve_guide_application — remove cert creation ─────────
-- Migration 023 added cert row creation on approval. Wrong: cert
-- row should be created at checkout time (when guide picks TPA and
-- pays). Undecided users have no track_id → no cert row → no noise.
-- Revert to 021 behavior: approval only upgrades role to GUIDE.

CREATE OR REPLACE FUNCTION public.approve_guide_application(
  p_app_id UUID,
  p_notes  TEXT DEFAULT ''
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_applicant UUID;
  v_track     UUID;
  v_role      app_role;
BEGIN
  SELECT role INTO v_role FROM public.profiles WHERE id = auth.uid();
  IF v_role IS NULL OR public.role_rank(v_role) < public.role_rank('HOD') THEN
    RAISE EXCEPTION 'Only HoD or above may approve applications';
  END IF;

  UPDATE public.guide_applications
     SET status         = 'APPROVED',
         reviewer_notes = p_notes,
         reviewed_at    = NOW(),
         reviewed_by    = auth.uid()
   WHERE id = p_app_id
   RETURNING applicant_id, track_id INTO v_applicant, v_track;

  IF v_applicant IS NULL THEN
    RAISE EXCEPTION 'Application not found';
  END IF;

  UPDATE public.profiles
     SET role = 'GUIDE'
   WHERE id = v_applicant
     AND public.role_rank(role) < public.role_rank('GUIDE');
END;
$$;


-- ── 5. mark_payment_received — add p_currency param ────────────
-- Webhook calls with 5 params but original function only has 4.
-- Recreate with optional p_currency to match webhook caller.

DROP FUNCTION IF EXISTS public.mark_payment_received(UUID, TEXT, TEXT, INT);
DROP FUNCTION IF EXISTS public.mark_payment_received(UUID, TEXT, TEXT, INT, TEXT);

CREATE OR REPLACE FUNCTION public.mark_payment_received(
  p_cert_id               UUID,
  p_stripe_session_id     TEXT,
  p_stripe_payment_intent TEXT,
  p_amount_cents          INT,
  p_currency              TEXT DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.guide_track_certifications
  SET
    stage                 = 'PAID',
    stripe_session_id     = p_stripe_session_id,
    stripe_payment_intent = p_stripe_payment_intent,
    amount_cents          = p_amount_cents,
    paid_at               = NOW()
  WHERE id = p_cert_id AND stage = 'AWAITING_PAYMENT';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Certification % not found or not in AWAITING_PAYMENT stage', p_cert_id;
  END IF;
END;
$$;


-- ── 5. Trigger: sync enrollment payment → cert table ───────────
-- When guide_track_enrollments gets payment_status='paid', find
-- matching cert row (by guide_id + track_id) at AWAITING_PAYMENT
-- and advance it to PAID. Handles the race where enrollment is
-- paid before cert row exists (backfill creates cert later).

CREATE OR REPLACE FUNCTION public.fn_sync_enrollment_payment()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.payment_status = 'paid' THEN
    UPDATE public.guide_track_certifications
    SET
      stage             = 'PAID',
      stripe_session_id = NEW.stripe_session_id,
      paid_at           = COALESCE(NEW.paid_at, NOW())
    WHERE guide_id = NEW.guide_id
      AND track_id = NEW.track_id
      AND stage    = 'AWAITING_PAYMENT';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_enrollment_payment ON public.guide_track_enrollments;
CREATE TRIGGER trg_sync_enrollment_payment
  AFTER INSERT OR UPDATE OF payment_status ON public.guide_track_enrollments
  FOR EACH ROW EXECUTE FUNCTION public.fn_sync_enrollment_payment();


-- ── 6. Trigger: auto-advance cert when reaching PAID ───────────
-- When cert becomes PAID, check if guide already completed all
-- modules and quizzes for that track. If so, advance through
-- MODULES_COMPLETED → PENDING_INTERVIEW in one shot.
-- Solves: guide completes everything before cert row exists.

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
BEGIN
  IF NEW.stage <> 'PAID' THEN RETURN NEW; END IF;
  IF TG_OP = 'UPDATE' AND OLD.stage = 'PAID' THEN RETURN NEW; END IF;

  -- Count active non-archived modules (must match guide_progress_summary view)
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
    NEW.stage := 'PENDING_INTERVIEW';
    NEW.quiz_passed_at := COALESCE(NEW.quiz_passed_at, NOW());
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_advance_paid_cert ON public.guide_track_certifications;
CREATE TRIGGER trg_advance_paid_cert
  BEFORE INSERT OR UPDATE OF stage ON public.guide_track_certifications
  FOR EACH ROW EXECUTE FUNCTION public.fn_advance_paid_cert();


-- ── 7. Backfill: sync all existing paid enrollments to certs ───
-- For any cert stuck at AWAITING_PAYMENT where enrollment is paid.

UPDATE public.guide_track_certifications gtc
SET
  stage             = 'PAID',
  stripe_session_id = gte.stripe_session_id,
  paid_at           = COALESCE(gte.paid_at, NOW())
FROM public.guide_track_enrollments gte
WHERE gte.guide_id       = gtc.guide_id
  AND gte.track_id       = gtc.track_id
  AND gte.payment_status = 'paid'
  AND gtc.stage          = 'AWAITING_PAYMENT';


-- ── 7. Re-run downstream advancement for newly PAID certs ──────
-- Advance PAID → MODULES_COMPLETED where all modules done.

WITH completed_guides AS (
  SELECT gtc.id AS cert_id
  FROM public.guide_track_certifications gtc
  WHERE gtc.stage = 'PAID'
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
    AND EXISTS (
      SELECT 1 FROM public.training_modules tm
      WHERE tm.track_id = gtc.track_id
        AND tm.is_active = TRUE
        AND tm.is_archived = FALSE
    )
)
UPDATE public.guide_track_certifications
SET stage = 'MODULES_COMPLETED', modules_completed_at = NOW()
FROM completed_guides
WHERE guide_track_certifications.id = completed_guides.cert_id;

-- Advance MODULES_COMPLETED → PENDING_INTERVIEW where all quizzes passed.

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
      WHERE qa.user_id = gtc.guide_id
        AND tm.track_id = gtc.track_id
        AND tm.is_active = TRUE
        AND tm.is_archived = FALSE
        AND qa.passed = TRUE
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


-- ── 8. Backfill NULL timestamps for certs already past those stages ─
-- Certs that advanced before triggers existed have NULL timestamps.

UPDATE public.guide_track_certifications
SET modules_completed_at = COALESCE(modules_completed_at, NOW())
WHERE modules_completed_at IS NULL
  AND stage IN ('MODULES_COMPLETED', 'PENDING_INTERVIEW', 'PENDING_BADGE_APPROVAL', 'BADGE_ISSUED');

UPDATE public.guide_track_certifications
SET quiz_passed_at = COALESCE(quiz_passed_at, NOW())
WHERE quiz_passed_at IS NULL
  AND stage IN ('PENDING_INTERVIEW', 'PENDING_BADGE_APPROVAL', 'BADGE_ISSUED');

UPDATE public.guide_track_certifications
SET paid_at = COALESCE(paid_at, NOW())
WHERE paid_at IS NULL
  AND stage NOT IN ('AWAITING_PAYMENT');


-- ================================================================
NOTIFY pgrst, 'reload schema';
-- ================================================================
