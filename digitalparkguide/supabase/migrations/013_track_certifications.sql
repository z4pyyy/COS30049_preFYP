-- ================================================================
-- 012_track_certifications.sql
-- Guide Track Certification Pipeline
-- COS30049 Pre-FYP · Swinburne University of Technology
-- ================================================================
-- Implements the full certification pipeline:
--   AWAITING_PAYMENT → PAID → MODULES_COMPLETED → QUIZZES_PASSED
--   → PENDING_INTERVIEW → PENDING_BADGE_APPROVAL → BADGE_ISSUED
--   (REJECTED can occur at any stage; REVOKED tracked via revoked_at)
-- ================================================================


-- ================================================================
-- SECTION 0 — TEARDOWN (reverse dependency order)
-- DROP functions CASCADE first so dependent triggers are also dropped.
-- ================================================================

DROP VIEW  IF EXISTS public.my_certifications_view             CASCADE;
DROP FUNCTION IF EXISTS public.get_hod_approval_packet(UUID)   CASCADE;
DROP FUNCTION IF EXISTS public.start_track_certification(UUID) CASCADE;
DROP FUNCTION IF EXISTS public.mark_payment_received(UUID, TEXT, TEXT, INT) CASCADE;
DROP FUNCTION IF EXISTS public.schedule_certification_interview(UUID, DATE, TIME, TEXT) CASCADE;
DROP FUNCTION IF EXISTS public.record_interview_outcome(UUID, TEXT, TEXT) CASCADE;
DROP FUNCTION IF EXISTS public.issue_tpa_badge(UUID)           CASCADE;
DROP FUNCTION IF EXISTS public.reject_certification(UUID, TEXT) CASCADE;
DROP FUNCTION IF EXISTS public.revoke_badge(UUID, TEXT)        CASCADE;
DROP FUNCTION IF EXISTS public.fn_check_modules_completed()    CASCADE;
DROP FUNCTION IF EXISTS public.fn_check_quizzes_passed()       CASCADE;


-- ================================================================
-- SECTION 1 — guide_group_members
-- Maps each Senior Guide to the Guides they supervise.
-- Used in RLS and in get_hod_approval_packet.
-- ================================================================

CREATE TABLE IF NOT EXISTS public.guide_group_members (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  senior_guide_id UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  guide_id        UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  added_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (senior_guide_id, guide_id)
);

ALTER TABLE public.guide_group_members ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "ggm: senior guide+ manage" ON public.guide_group_members;
CREATE POLICY "ggm: senior guide+ manage"
  ON public.guide_group_members
  FOR ALL
  USING (public.role_rank(public.current_user_role()) >= public.role_rank('SENIOR_GUIDE'));


-- ================================================================
-- SECTION 2 — profiles table amendments
-- ================================================================

-- Replace badge_eligible_tracks UUID[] with a derived query from
-- guide_track_certifications WHERE stage = 'BADGE_ISSUED' AND revoked_at IS NULL.
ALTER TABLE public.profiles DROP COLUMN IF EXISTS badge_eligible_tracks;

-- Global revocation flag — set TRUE when any badge is revoked.
-- Blocks re-enrolment in all tracks per spec (Section 4, open decision 4).
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS badge_revoked BOOLEAN NOT NULL DEFAULT FALSE;


-- ================================================================
-- SECTION 3 — guide_track_certifications
-- One row per (guide_id, track_id) attempt.  A partial unique index
-- (not a table-level UNIQUE constraint) allows a new row to be
-- created after permanent rejection, while still preventing two
-- concurrent active certifications for the same guide+track.
-- ================================================================

CREATE TABLE IF NOT EXISTS public.guide_track_certifications (
  id                     UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  guide_id               UUID        NOT NULL REFERENCES auth.users(id)             ON DELETE CASCADE,
  track_id               UUID        NOT NULL REFERENCES public.training_tracks(id)  ON DELETE CASCADE,
  tpa_name               TEXT        NOT NULL,   -- denormalised from track for fast queries

  stage                  TEXT        NOT NULL DEFAULT 'AWAITING_PAYMENT'
    CHECK (stage IN (
      'AWAITING_PAYMENT',
      'PAID',
      'MODULES_COMPLETED',
      'QUIZZES_PASSED',
      'PENDING_INTERVIEW',
      'INTERVIEW_PASSED',
      'PENDING_BADGE_APPROVAL',
      'BADGE_ISSUED',
      'REJECTED'
    )),

  -- ── Payment ───────────────────────────────────────────────────
  stripe_session_id      TEXT,
  stripe_payment_intent  TEXT,
  amount_cents           INT,
  currency               TEXT        DEFAULT 'MYR',
  paid_at                TIMESTAMPTZ,

  -- ── Progress rollup ───────────────────────────────────────────
  modules_completed_at   TIMESTAMPTZ,
  quiz_attempt_id        UUID        REFERENCES public.quiz_attempts(id) ON DELETE SET NULL,
  quiz_passed_at         TIMESTAMPTZ,

  -- ── Interview (Senior Guide) ──────────────────────────────────
  interviewer_id         UUID        REFERENCES auth.users(id) ON DELETE SET NULL,
  interview_scheduled_at TIMESTAMPTZ,
  interview_date         DATE,
  interview_time         TIME,
  interview_location     TEXT,
  interview_outcome      TEXT        CHECK (interview_outcome IN ('PASSED', 'FAILED') OR interview_outcome IS NULL),
  interview_notes        TEXT,
  interview_completed_at TIMESTAMPTZ,
  resit_count            INTEGER     NOT NULL DEFAULT 0,   -- max 1 resit allowed

  -- ── HoD approval + badge issuance ────────────────────────────
  submitted_to_hod_at    TIMESTAMPTZ,
  badge_issued_at        TIMESTAMPTZ,
  badge_issued_by        UUID        REFERENCES auth.users(id) ON DELETE SET NULL,
  certificate_no         TEXT        UNIQUE,               -- SFC-BN-2026-0042
  revoked_at             TIMESTAMPTZ,
  revoked_reason         TEXT,

  -- ── Rejection ────────────────────────────────────────────────
  rejection_stage        TEXT,
  rejection_reason       TEXT,

  created_at             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at             TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- updated_at trigger
DROP TRIGGER IF EXISTS guide_track_certifications_updated_at ON public.guide_track_certifications;
CREATE TRIGGER guide_track_certifications_updated_at
  BEFORE UPDATE ON public.guide_track_certifications
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Indexes
CREATE INDEX IF NOT EXISTS idx_gtc_guide ON public.guide_track_certifications(guide_id);
CREATE INDEX IF NOT EXISTS idx_gtc_track ON public.guide_track_certifications(track_id);
CREATE INDEX IF NOT EXISTS idx_gtc_stage ON public.guide_track_certifications(stage);

-- Partial unique index: at most one non-rejected certification per guide+track.
-- Allows a new row after REJECTED so retakes create a fresh audit trail.
DROP INDEX IF EXISTS idx_gtc_unique_active;
CREATE UNIQUE INDEX idx_gtc_unique_active
  ON public.guide_track_certifications(guide_id, track_id)
  WHERE stage <> 'REJECTED';


-- ================================================================
-- SECTION 4 — RLS on guide_track_certifications
-- All writes go through SECURITY DEFINER RPCs — no direct DML for
-- Guide or Senior Guide.
-- ================================================================

ALTER TABLE public.guide_track_certifications ENABLE ROW LEVEL SECURITY;

-- Guide: read own rows only
DROP POLICY IF EXISTS "gtc: guide own read" ON public.guide_track_certifications;
CREATE POLICY "gtc: guide own read"
  ON public.guide_track_certifications FOR SELECT
  USING (auth.uid() = guide_id);

-- Senior Guide: read rows for guides assigned to their group
DROP POLICY IF EXISTS "gtc: senior guide read assigned" ON public.guide_track_certifications;
CREATE POLICY "gtc: senior guide read assigned"
  ON public.guide_track_certifications FOR SELECT
  USING (
    public.role_rank(public.current_user_role()) >= public.role_rank('SENIOR_GUIDE')
    AND public.role_rank(public.current_user_role()) <  public.role_rank('HOD')
    AND EXISTS (
      SELECT 1 FROM public.guide_group_members ggm
      WHERE ggm.senior_guide_id = auth.uid()
        AND ggm.guide_id = guide_track_certifications.guide_id
    )
  );

-- Senior Guide (assigned interviewer): update their assigned cert rows
DROP POLICY IF EXISTS "gtc: interviewer update" ON public.guide_track_certifications;
CREATE POLICY "gtc: interviewer update"
  ON public.guide_track_certifications FOR UPDATE
  USING (
    interviewer_id = auth.uid()
    AND public.role_rank(public.current_user_role()) >= public.role_rank('SENIOR_GUIDE')
    AND public.role_rank(public.current_user_role()) <  public.role_rank('HOD')
  );

-- HoD+: read and update all rows
DROP POLICY IF EXISTS "gtc: hod+ read all" ON public.guide_track_certifications;
CREATE POLICY "gtc: hod+ read all"
  ON public.guide_track_certifications FOR SELECT
  USING (public.role_rank(public.current_user_role()) >= public.role_rank('HOD'));

DROP POLICY IF EXISTS "gtc: hod+ update all" ON public.guide_track_certifications;
CREATE POLICY "gtc: hod+ update all"
  ON public.guide_track_certifications FOR UPDATE
  USING (public.role_rank(public.current_user_role()) >= public.role_rank('HOD'));


-- ================================================================
-- SECTION 5 — RPCs (all SECURITY DEFINER)
-- ================================================================

-- ── 5.1 start_track_certification ────────────────────────────────
-- Guide only. Creates a row in AWAITING_PAYMENT.
-- Fails if an active (non-REJECTED) row already exists.
-- Fails if the guide's profile has badge_revoked = TRUE.

CREATE OR REPLACE FUNCTION public.start_track_certification(p_track_id UUID)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id  UUID    := auth.uid();
  v_role     app_role;
  v_revoked  BOOLEAN;
  v_tpa_name TEXT;
  v_cert_id  UUID;
BEGIN
  SELECT role, badge_revoked
  INTO   v_role, v_revoked
  FROM   public.profiles
  WHERE  id = v_user_id;

  IF public.role_rank(v_role) < public.role_rank('GUIDE') THEN
    RAISE EXCEPTION 'Only GUIDE+ may start a track certification';
  END IF;

  IF v_revoked THEN
    RAISE EXCEPTION 'Your badge has been revoked — re-enrolment is not permitted';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.guide_track_certifications
    WHERE guide_id = v_user_id AND track_id = p_track_id AND stage <> 'REJECTED'
  ) THEN
    RAISE EXCEPTION 'An active certification for this track already exists';
  END IF;

  SELECT tpa_name INTO v_tpa_name FROM public.training_tracks WHERE id = p_track_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Track not found: %', p_track_id;
  END IF;

  INSERT INTO public.guide_track_certifications (guide_id, track_id, tpa_name, stage)
  VALUES (v_user_id, p_track_id, v_tpa_name, 'AWAITING_PAYMENT')
  RETURNING id INTO v_cert_id;

  RETURN v_cert_id;
END;
$$;


-- ── 5.2 mark_payment_received ────────────────────────────────────
-- Service role only (called from Stripe webhook, bypasses RLS).
-- Advances AWAITING_PAYMENT → PAID.

CREATE OR REPLACE FUNCTION public.mark_payment_received(
  p_cert_id               UUID,
  p_stripe_session_id     TEXT,
  p_stripe_payment_intent TEXT,
  p_amount_cents          INT
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


-- ── 5.3 schedule_certification_interview ─────────────────────────
-- Senior Guide or HoD+.
-- Idempotent: advances QUIZZES_PASSED or PENDING_INTERVIEW → PENDING_INTERVIEW.
-- Sets the caller as interviewer_id.

CREATE OR REPLACE FUNCTION public.schedule_certification_interview(
  p_cert_id  UUID,
  p_date     DATE,
  p_time     TIME,
  p_location TEXT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role app_role;
BEGIN
  SELECT role INTO v_role FROM public.profiles WHERE id = auth.uid();
  IF public.role_rank(v_role) < public.role_rank('SENIOR_GUIDE') THEN
    RAISE EXCEPTION 'Only SENIOR_GUIDE+ may schedule interviews';
  END IF;

  UPDATE public.guide_track_certifications
  SET
    stage                  = 'PENDING_INTERVIEW',
    interviewer_id         = auth.uid(),
    interview_scheduled_at = NOW(),
    interview_date         = p_date,
    interview_time         = p_time,
    interview_location     = p_location
  WHERE id = p_cert_id
    AND stage IN ('QUIZZES_PASSED', 'PENDING_INTERVIEW');

  IF NOT FOUND THEN
    RAISE EXCEPTION
      'Certification % not found or not in a schedulable stage (must be QUIZZES_PASSED or PENDING_INTERVIEW)',
      p_cert_id;
  END IF;
END;
$$;


-- ── 5.4 record_interview_outcome ─────────────────────────────────
-- Assigned Senior Guide or HoD+.
-- PASSED  → PENDING_BADGE_APPROVAL (combines INTERVIEW_PASSED step).
-- FAILED  → if resit_count = 0: allow one resit (PENDING_INTERVIEW, resit_count++).
--         → if resit_count ≥ 1: permanent REJECTED.
-- Returns the updated row.

CREATE OR REPLACE FUNCTION public.record_interview_outcome(
  p_cert_id UUID,
  p_outcome TEXT,
  p_notes   TEXT
)
RETURNS public.guide_track_certifications
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_cert public.guide_track_certifications;
  v_role app_role;
BEGIN
  IF p_outcome NOT IN ('PASSED', 'FAILED') THEN
    RAISE EXCEPTION 'outcome must be PASSED or FAILED, got: %', p_outcome;
  END IF;

  SELECT role INTO v_role FROM public.profiles WHERE id = auth.uid();
  IF public.role_rank(v_role) < public.role_rank('SENIOR_GUIDE') THEN
    RAISE EXCEPTION 'Only SENIOR_GUIDE+ may record interview outcomes';
  END IF;

  -- Lock the row; only the assigned interviewer or HoD+ may act on it
  SELECT * INTO v_cert
  FROM public.guide_track_certifications
  WHERE id = p_cert_id
    AND stage = 'PENDING_INTERVIEW'
    AND (
      interviewer_id = auth.uid()
      OR public.role_rank(v_role) >= public.role_rank('HOD')
    )
  FOR UPDATE;

  IF v_cert.id IS NULL THEN
    RAISE EXCEPTION
      'Certification % not found, not in PENDING_INTERVIEW, or caller is not the assigned interviewer',
      p_cert_id;
  END IF;

  IF p_outcome = 'PASSED' THEN
    -- Advance through INTERVIEW_PASSED → PENDING_BADGE_APPROVAL atomically
    UPDATE public.guide_track_certifications
    SET
      interview_outcome      = 'PASSED',
      interview_notes        = p_notes,
      interview_completed_at = NOW(),
      stage                  = 'PENDING_BADGE_APPROVAL',
      submitted_to_hod_at    = NOW()
    WHERE id = p_cert_id
    RETURNING * INTO v_cert;

  ELSIF v_cert.resit_count = 0 THEN
    -- First failure: grant one resit. Clear scheduling so a new interview can be booked.
    UPDATE public.guide_track_certifications
    SET
      interview_outcome      = 'FAILED',
      interview_notes        = p_notes,
      interview_completed_at = NOW(),
      stage                  = 'PENDING_INTERVIEW',
      resit_count            = resit_count + 1,
      -- Clear scheduling fields for the resit booking
      interviewer_id         = NULL,
      interview_scheduled_at = NULL,
      interview_date         = NULL,
      interview_time         = NULL,
      interview_location     = NULL
    WHERE id = p_cert_id
    RETURNING * INTO v_cert;

  ELSE
    -- resit_count ≥ 1: permanent rejection
    UPDATE public.guide_track_certifications
    SET
      interview_outcome      = 'FAILED',
      interview_notes        = p_notes,
      interview_completed_at = NOW(),
      stage                  = 'REJECTED',
      rejection_stage        = 'PENDING_INTERVIEW',
      rejection_reason       = 'Failed resit interview'
    WHERE id = p_cert_id
    RETURNING * INTO v_cert;
  END IF;

  RETURN v_cert;
END;
$$;


-- ── 5.5 issue_tpa_badge ──────────────────────────────────────────
-- HoD+ only.  Stage must be PENDING_BADGE_APPROVAL.
-- Generates certificate_no: SFC-<TPA_CODE>-<YEAR>-<SEQ>.
-- Uses an advisory lock to prevent concurrent issuance for the same
-- tpa_name+year producing duplicate sequence numbers.

CREATE OR REPLACE FUNCTION public.issue_tpa_badge(p_cert_id UUID)
RETURNS public.guide_track_certifications
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_cert     public.guide_track_certifications;
  v_role     app_role;
  v_tpa_code TEXT;
  v_year     INT;
  v_seq      INT;
  v_cert_no  TEXT;
BEGIN
  SELECT role INTO v_role FROM public.profiles WHERE id = auth.uid();
  IF public.role_rank(v_role) < public.role_rank('HOD') THEN
    RAISE EXCEPTION 'Only HOD+ may issue TPA badges';
  END IF;

  -- Lock this certification row to prevent double-issuance
  SELECT * INTO v_cert
  FROM public.guide_track_certifications
  WHERE id = p_cert_id AND stage = 'PENDING_BADGE_APPROVAL'
  FOR UPDATE;

  IF v_cert.id IS NULL THEN
    RAISE EXCEPTION 'Certification % not found or not in PENDING_BADGE_APPROVAL', p_cert_id;
  END IF;

  v_tpa_code := UPPER(LEFT(v_cert.tpa_name, 2));
  v_year     := EXTRACT(YEAR FROM NOW())::INT;

  -- Advisory lock scoped to this tpa_name+year to serialise concurrent issuance
  PERFORM pg_advisory_xact_lock(hashtext(v_cert.tpa_name || v_year::TEXT)::BIGINT);

  -- Count already-issued badges for this tpa+year to derive next sequence number
  SELECT COUNT(*) + 1 INTO v_seq
  FROM public.guide_track_certifications
  WHERE tpa_name       = v_cert.tpa_name
    AND stage          = 'BADGE_ISSUED'
    AND EXTRACT(YEAR FROM badge_issued_at) = v_year;

  v_cert_no := FORMAT('SFC-%s-%s-%s', v_tpa_code, v_year, LPAD(v_seq::TEXT, 4, '0'));

  UPDATE public.guide_track_certifications
  SET
    stage           = 'BADGE_ISSUED',
    badge_issued_at  = NOW(),
    badge_issued_by  = auth.uid(),
    certificate_no   = v_cert_no
  WHERE id = p_cert_id
  RETURNING * INTO v_cert;

  RETURN v_cert;
END;
$$;


-- ── 5.6 reject_certification ─────────────────────────────────────
-- Assigned Senior Guide or HoD+.
-- Can reject at any stage (not just PENDING_INTERVIEW).

CREATE OR REPLACE FUNCTION public.reject_certification(p_cert_id UUID, p_reason TEXT)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role          app_role;
  v_current_stage TEXT;
BEGIN
  SELECT role INTO v_role FROM public.profiles WHERE id = auth.uid();
  IF public.role_rank(v_role) < public.role_rank('SENIOR_GUIDE') THEN
    RAISE EXCEPTION 'Only SENIOR_GUIDE+ may reject certifications';
  END IF;

  SELECT stage INTO v_current_stage
  FROM public.guide_track_certifications
  WHERE id = p_cert_id
    AND stage NOT IN ('BADGE_ISSUED', 'REJECTED')
    AND (
      interviewer_id = auth.uid()
      OR public.role_rank(v_role) >= public.role_rank('HOD')
    );

  IF v_current_stage IS NULL THEN
    RAISE EXCEPTION
      'Certification % not found, already issued/rejected, or caller lacks permission',
      p_cert_id;
  END IF;

  UPDATE public.guide_track_certifications
  SET
    stage            = 'REJECTED',
    rejection_stage   = v_current_stage,
    rejection_reason  = p_reason
  WHERE id = p_cert_id;
END;
$$;


-- ── 5.7 revoke_badge ─────────────────────────────────────────────
-- HoD+ only.  Stage must be BADGE_ISSUED (and not already revoked).
-- Also sets profiles.badge_revoked = TRUE, blocking future enrolment.

CREATE OR REPLACE FUNCTION public.revoke_badge(p_cert_id UUID, p_reason TEXT)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role     app_role;
  v_guide_id UUID;
BEGIN
  SELECT role INTO v_role FROM public.profiles WHERE id = auth.uid();
  IF public.role_rank(v_role) < public.role_rank('HOD') THEN
    RAISE EXCEPTION 'Only HOD+ may revoke badges';
  END IF;

  SELECT guide_id INTO v_guide_id
  FROM public.guide_track_certifications
  WHERE id = p_cert_id
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

  -- Global block: prevents re-enrolment in any track
  UPDATE public.profiles SET badge_revoked = TRUE WHERE id = v_guide_id;
END;
$$;


-- ================================================================
-- SECTION 6 — Triggers
-- ================================================================

-- ── 6.1 All active modules completed → MODULES_COMPLETED ─────────

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
  -- Fire only when completed transitions from non-TRUE to TRUE
  IF NEW.completed IS NOT TRUE OR OLD.completed IS TRUE THEN
    RETURN NEW;
  END IF;

  SELECT track_id INTO v_track_id
  FROM public.training_modules WHERE id = NEW.module_id;
  IF v_track_id IS NULL THEN RETURN NEW; END IF;

  -- How many active modules does this track have?
  SELECT COUNT(*) INTO v_total_active
  FROM public.training_modules
  WHERE track_id = v_track_id AND is_active = TRUE;

  -- How many has this guide completed?
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
  AFTER UPDATE OF completed ON public.guide_module_progress
  FOR EACH ROW EXECUTE FUNCTION public.fn_check_modules_completed();


-- ── 6.2 All required quizzes passed → QUIZZES_PASSED → PENDING_INTERVIEW

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
  -- Only act on a passing attempt
  IF NEW.passed IS NOT TRUE THEN RETURN NEW; END IF;

  -- quiz_attempts.quiz_id → quizzes.module_id → training_modules.track_id
  SELECT q.module_id INTO v_module_id
  FROM public.quizzes q WHERE q.id = NEW.quiz_id;
  IF v_module_id IS NULL THEN RETURN NEW; END IF;   -- quiz not bound to a module

  SELECT tm.track_id INTO v_track_id
  FROM public.training_modules tm WHERE tm.id = v_module_id;
  IF v_track_id IS NULL THEN RETURN NEW; END IF;

  -- Must have an active certification at MODULES_COMPLETED for this guide+track
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
  WHERE tm.track_id = v_track_id AND tm.is_active = TRUE;

  IF v_total_quizzes = 0 THEN RETURN NEW; END IF;  -- no quizzes: manual advancement needed

  -- Count distinct quizzes the guide has passed for this track
  SELECT COUNT(DISTINCT qa.quiz_id) INTO v_passed_quizzes
  FROM public.quiz_attempts qa
  JOIN public.quizzes q       ON q.id  = qa.quiz_id
  JOIN public.training_modules tm ON tm.id = q.module_id
  WHERE qa.user_id   = NEW.user_id
    AND tm.track_id  = v_track_id
    AND tm.is_active = TRUE
    AND qa.passed    = TRUE;

  IF v_passed_quizzes >= v_total_quizzes THEN
    -- Advance MODULES_COMPLETED → QUIZZES_PASSED (with quiz record)
    UPDATE public.guide_track_certifications
    SET
      stage           = 'QUIZZES_PASSED',
      quiz_attempt_id = NEW.id,
      quiz_passed_at  = NOW()
    WHERE id = v_cert.id;

    -- Immediately advance → PENDING_INTERVIEW
    UPDATE public.guide_track_certifications
    SET stage = 'PENDING_INTERVIEW'
    WHERE id = v_cert.id;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_quizzes_passed ON public.quiz_attempts;
CREATE TRIGGER trg_quizzes_passed
  AFTER INSERT ON public.quiz_attempts
  FOR EACH ROW EXECUTE FUNCTION public.fn_check_quizzes_passed();


-- ================================================================
-- SECTION 7 — Views and approval packet function
-- ================================================================

-- ── 7.1 my_certifications_view (security_invoker — RLS filters rows)

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


-- ── 7.2 get_hod_approval_packet ──────────────────────────────────
-- Returns all information the HoD needs to make a badge-issuance
-- decision in a single JSONB document (no N+1 from the UI).
-- Documents subquery is wrapped in an inner exception handler because
-- guide_application_documents may not exist in all environments.

CREATE OR REPLACE FUNCTION public.get_hod_approval_packet(p_cert_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role   app_role;
  v_docs   JSONB := '[]'::JSONB;
  v_result JSONB;
BEGIN
  SELECT role INTO v_role FROM public.profiles WHERE id = auth.uid();
  IF public.role_rank(v_role) < public.role_rank('HOD') THEN
    RAISE EXCEPTION 'Only HOD+ may view approval packets';
  END IF;

  -- Documents: fail gracefully if guide_application_documents does not exist
  BEGIN
    SELECT COALESCE(
      jsonb_agg(jsonb_build_object(
        'id',           d.id,
        'file_name',    d.file_name,
        'storage_path', d.storage_path
      )),
      '[]'::JSONB
    )
    INTO v_docs
    FROM public.guide_application_documents d
    WHERE d.certification_id = p_cert_id;
  EXCEPTION WHEN undefined_table THEN
    v_docs := '[]'::JSONB;
  END;

  SELECT jsonb_build_object(
    'certification', to_jsonb(c),

    'guide', jsonb_build_object(
      'full_name', gp.full_name,
      'phone',     gp.phone,
      'role',      gp.role
    ),

    'track', jsonb_build_object(
      'title',          t.title,
      'tpa_name',       t.tpa_name,
      'duration_weeks', t.duration_weeks
    ),

    'interviewer', jsonb_build_object(
      'full_name', ip.full_name
    ),

    'modules_completed', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'title',        tm.title,
        'completed_at', gmp.completed_at
      ) ORDER BY tm.order_index)
      FROM public.guide_module_progress gmp
      JOIN public.training_modules tm ON tm.id = gmp.module_id
      WHERE gmp.guide_id  = c.guide_id
        AND tm.track_id   = c.track_id
        AND gmp.completed = TRUE
    ), '[]'::JSONB),

    'quiz_result', COALESCE((
      SELECT jsonb_build_object(
        'score',      qa.score,
        'passed',     qa.passed,
        'attempt_at', qa.created_at
      )
      FROM public.quiz_attempts qa WHERE qa.id = c.quiz_attempt_id
    ), 'null'::JSONB),

    'documents', v_docs
  )
  INTO v_result
  FROM  public.guide_track_certifications c
  JOIN  public.profiles        gp ON gp.id = c.guide_id
  JOIN  public.training_tracks t  ON t.id  = c.track_id
  LEFT  JOIN public.profiles   ip ON ip.id = c.interviewer_id
  WHERE c.id = p_cert_id;

  RETURN v_result;
END;
$$;


-- ================================================================
-- SECTION 8 — Optional amendments (guarded against missing tables)
-- ================================================================

-- ── 8.1 Add certification_id to guide_application_documents (Option A)

DO $$
BEGIN
  ALTER TABLE public.guide_application_documents
    ADD COLUMN IF NOT EXISTS certification_id UUID
      REFERENCES public.guide_track_certifications(id) ON DELETE SET NULL;
  RAISE NOTICE 'guide_application_documents.certification_id column ensured';
EXCEPTION WHEN undefined_table THEN
  RAISE NOTICE 'guide_application_documents does not exist — skipping certification_id column';
END $$;


-- ── 8.2 Extend email_notifications template CHECK constraint
-- Merges existing template values with the new ones so existing rows
-- are never violated by the replacement constraint.

DO $$
DECLARE
  v_existing   TEXT[];
  v_new        TEXT[] := ARRAY[
    'certification_interview_scheduled',
    'certification_interview_assigned',
    'certification_pending_hod',
    'badge_issued',
    'certification_rejected'
  ];
  v_all_values TEXT;
BEGIN
  SELECT array_agg(DISTINCT template)
  INTO   v_existing
  FROM   public.email_notifications
  WHERE  template IS NOT NULL;

  SELECT string_agg(quote_literal(v), ', ')
  INTO   v_all_values
  FROM   (
    SELECT DISTINCT unnest(COALESCE(v_existing, ARRAY[]::TEXT[]) || v_new)
  ) t(v);

  ALTER TABLE public.email_notifications
    DROP CONSTRAINT IF EXISTS email_notifications_template_check;

  EXECUTE format(
    'ALTER TABLE public.email_notifications
       ADD CONSTRAINT email_notifications_template_check
       CHECK (template IN (%s))',
    v_all_values
  );

  RAISE NOTICE 'email_notifications.template constraint updated — values: %', v_all_values;
EXCEPTION WHEN undefined_table THEN
  RAISE NOTICE 'email_notifications does not exist — skipping template constraint';
END $$;


-- ================================================================
-- END
-- ================================================================

NOTIFY pgrst, 'reload schema';
