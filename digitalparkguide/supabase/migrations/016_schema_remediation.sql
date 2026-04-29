-- ================================================================
-- 016_schema_remediation.sql
-- Reconciles the schema conflicts introduced by the out-of-band
-- 012_guide_badges.sql and 014_certification_enhancements.sql with
-- the canonical 013_track_certifications.sql pipeline.
--
-- Safe to re-run: every block is idempotent.
-- Must be applied AFTER 012, 013, 014, 015 have all run.
--
-- Fixes:
--   Bug 7  (Section 1) — 014 C5 destroyed 013's email template
--                         constraint additions; rebuild merged set.
--   Option B composition (Sections 2 & 3) — issue_tpa_badge() and
--                         revoke_badge() now write to guide_badges so
--                         014's expiry/renewal pipeline stays in sync.
--   Bug 5  (Section 4) — fn_check_quizzes_passed() bailed on quizzes
--                         with module_id IS NULL after 015 added
--                         quizzes.track_id; now resolves both paths.
--   Bug 8  (Section 5) — guide_badges.renewal_due_at was TIMESTAMPTZ
--                         on existing DBs (from 012) but DATE on fresh
--                         installs (from 014 C2); normalise to DATE.
-- ================================================================


-- ================================================================
-- SECTION 1 — Rebuild email_notifications constraint (full merged set)
-- ================================================================
-- 014 C5 hardcoded only 4 template values, silently dropping the 5
-- certification templates that 013 Section 8.2 had added.
-- This DO block re-merges the canonical set and absorbs any additional
-- values already present in the table so no existing rows break.

DO $$
DECLARE
  v_existing   TEXT[];
  v_canonical  TEXT[] := ARRAY[
    'application_approved',
    'application_rejected',
    'interview_scheduled',
    'badge_expiring',
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
  FROM (
    SELECT DISTINCT unnest(
      COALESCE(v_existing, ARRAY[]::TEXT[]) || v_canonical
    )
  ) t(v);

  ALTER TABLE public.email_notifications
    DROP CONSTRAINT IF EXISTS email_notifications_template_check;

  EXECUTE format(
    'ALTER TABLE public.email_notifications
       ADD CONSTRAINT email_notifications_template_check
       CHECK (template IN (%s))',
    v_all_values
  );

  RAISE NOTICE 'Section 1: email_notifications constraint rebuilt — values: %', v_all_values;
EXCEPTION WHEN undefined_table THEN
  RAISE NOTICE 'Section 1: email_notifications does not exist — skipping';
END $$;


-- ================================================================
-- SECTION 2 — Compose issue_tpa_badge() → also stamps guide_badges
-- ================================================================
-- When the HoD issues a TPA badge via the certification pipeline,
-- we also write a guide_badges row so 014's expiry cron and
-- MyBadgesWidget have something to read from.
-- issue_guide_badge() is defined by 014_certification_enhancements;
-- ON CONFLICT in that function handles the renewal-reissue case.

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

  -- Lock the certification row to prevent double-issuance.
  SELECT * INTO v_cert
  FROM public.guide_track_certifications
  WHERE id = p_cert_id AND stage = 'PENDING_BADGE_APPROVAL'
  FOR UPDATE;

  IF v_cert.id IS NULL THEN
    RAISE EXCEPTION 'Certification % not found or not in PENDING_BADGE_APPROVAL', p_cert_id;
  END IF;

  v_tpa_code := UPPER(LEFT(v_cert.tpa_name, 2));
  v_year     := EXTRACT(YEAR FROM NOW())::INT;

  -- Advisory lock: serialises concurrent issuance for the same tpa_name + year.
  PERFORM pg_advisory_xact_lock(hashtext(v_cert.tpa_name || v_year::TEXT)::BIGINT);

  -- Derive next certificate sequence number.
  SELECT COUNT(*) + 1 INTO v_seq
  FROM public.guide_track_certifications
  WHERE tpa_name = v_cert.tpa_name
    AND stage    = 'BADGE_ISSUED'
    AND EXTRACT(YEAR FROM badge_issued_at) = v_year;

  v_cert_no := FORMAT('SFC-%s-%s-%s', v_tpa_code, v_year, LPAD(v_seq::TEXT, 4, '0'));

  UPDATE public.guide_track_certifications
  SET
    stage          = 'BADGE_ISSUED',
    badge_issued_at = NOW(),
    badge_issued_by = auth.uid(),
    certificate_no  = v_cert_no
  WHERE id = p_cert_id
  RETURNING * INTO v_cert;

  -- ── COMPOSITION: stamp guide_badges for expiry/renewal tracking ──
  -- issue_guide_badge (defined in 014) writes the physical badge record.
  -- ON CONFLICT (guide_id, track_id) in that function handles re-issuance
  -- by flipping status to 'RENEWED'.
  PERFORM public.issue_guide_badge(
    v_cert.guide_id,
    v_cert.track_id,
    auth.uid(),
    FORMAT('Certificate %s issued via certification pipeline', v_cert_no)
  );

  RETURN v_cert;
END;
$$;


-- ================================================================
-- SECTION 3 — Compose revoke_badge() → also updates guide_badges
-- ================================================================
-- When a pipeline badge is revoked, mirror the status change on the
-- guide_badges row so the expiry cron and MyBadgesWidget stay accurate.

CREATE OR REPLACE FUNCTION public.revoke_badge(p_cert_id UUID, p_reason TEXT)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role     app_role;
  v_guide_id UUID;
  v_track_id UUID;
BEGIN
  SELECT role INTO v_role FROM public.profiles WHERE id = auth.uid();
  IF public.role_rank(v_role) < public.role_rank('HOD') THEN
    RAISE EXCEPTION 'Only HOD+ may revoke badges';
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

  -- Mark pipeline record as revoked.
  UPDATE public.guide_track_certifications
  SET revoked_at = NOW(), revoked_reason = p_reason
  WHERE id = p_cert_id;

  -- Global re-enrolment block (per spec: open decision 4).
  UPDATE public.profiles
  SET badge_revoked = TRUE
  WHERE id = v_guide_id;

  -- ── COMPOSITION: mirror revocation on guide_badges ──
  -- Keeps MyBadgesWidget and the expiry cron consistent.
  -- Uses a DO-nothing on no match (badge row may not exist on old data).
  UPDATE public.guide_badges
  SET status = 'REVOKED'
  WHERE guide_id = v_guide_id
    AND track_id  = v_track_id;
END;
$$;


-- ================================================================
-- SECTION 4 — Fix fn_check_quizzes_passed for track_id-only quizzes
-- ================================================================
-- 013's original trigger resolved tracks exclusively via:
--   quiz_attempts.quiz_id → quizzes.module_id → training_modules.track_id
-- After 015 added quizzes.track_id, a quiz created with track_id set
-- but no module_id caused the trigger to bail early (module_id IS NULL),
-- meaning stage never advanced from MODULES_COMPLETED to QUIZZES_PASSED.
--
-- Fix: try module_id path first; if module_id IS NULL, use quizzes.track_id
-- directly. Both quiz count queries now join on either path.
--
-- Note: the trigger binding (trg_quizzes_passed) was created in 013
-- with CREATE TRIGGER. CREATE OR REPLACE on the function is sufficient —
-- no need to drop/recreate the trigger itself.

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
  -- Only act on a passing attempt.
  IF NEW.passed IS NOT TRUE THEN RETURN NEW; END IF;

  -- ── Dual-path track resolution ──────────────────────────────────
  -- Fetch both module_id and track_id from the quiz row.
  SELECT q.module_id, q.track_id
  INTO   v_module_id, v_track_id
  FROM   public.quizzes q
  WHERE  q.id = NEW.quiz_id;

  IF v_module_id IS NOT NULL THEN
    -- Module-scoped quiz (pre-015 path): resolve track via the module.
    SELECT tm.track_id INTO v_track_id
    FROM   public.training_modules tm
    WHERE  tm.id = v_module_id;
  END IF;
  -- If v_module_id IS NULL, v_track_id holds the direct FK added by 015.

  IF v_track_id IS NULL THEN RETURN NEW; END IF;  -- quiz bound to neither

  -- Must have an active certification at MODULES_COMPLETED for this guide+track.
  SELECT * INTO v_cert
  FROM public.guide_track_certifications
  WHERE guide_id = NEW.user_id
    AND track_id = v_track_id
    AND stage    = 'MODULES_COMPLETED';
  IF v_cert.id IS NULL THEN RETURN NEW; END IF;

  -- ── Count total quizzes for this track (both binding modes) ──────
  SELECT COUNT(*) INTO v_total_quizzes
  FROM   public.quizzes q
  LEFT   JOIN public.training_modules tm ON tm.id = q.module_id
  WHERE  (q.track_id = v_track_id OR tm.track_id = v_track_id)
    AND  COALESCE(tm.is_active, TRUE) = TRUE;

  IF v_total_quizzes = 0 THEN RETURN NEW; END IF;  -- no quizzes: manual advancement needed

  -- ── Count distinct quizzes this guide has passed for this track ──
  SELECT COUNT(DISTINCT qa.quiz_id) INTO v_passed_quizzes
  FROM   public.quiz_attempts qa
  JOIN   public.quizzes q ON q.id = qa.quiz_id
  LEFT   JOIN public.training_modules tm ON tm.id = q.module_id
  WHERE  qa.user_id  = NEW.user_id
    AND  (q.track_id = v_track_id OR tm.track_id = v_track_id)
    AND  COALESCE(tm.is_active, TRUE) = TRUE
    AND  qa.passed   = TRUE;

  IF v_passed_quizzes >= v_total_quizzes THEN
    -- Advance MODULES_COMPLETED → QUIZZES_PASSED (store the passing attempt).
    UPDATE public.guide_track_certifications
    SET
      stage           = 'QUIZZES_PASSED',
      quiz_attempt_id = NEW.id,
      quiz_passed_at  = NOW()
    WHERE id = v_cert.id;

    -- Immediately auto-advance → PENDING_INTERVIEW (per spec Section 4.1).
    UPDATE public.guide_track_certifications
    SET stage = 'PENDING_INTERVIEW'
    WHERE id = v_cert.id;
  END IF;

  RETURN NEW;
END;
$$;


-- ================================================================
-- SECTION 5 — Normalise guide_badges.renewal_due_at to DATE
-- ================================================================
-- 012_guide_badges.sql declared renewal_due_at as TIMESTAMPTZ.
-- 014_certification_enhancements.sql C2 declares it as DATE.
-- On existing DBs the column was never type-altered (C1.5 only adds
-- columns and relaxes NOT NULL), so it remains TIMESTAMPTZ.
-- All downstream logic (comparisons with CURRENT_DATE, +30 interval,
-- issue_guide_badge's make_interval cast) expects DATE.
-- Casting TIMESTAMPTZ → DATE is lossless for this data (only calendar
-- dates were ever stored) and safe to run on a live table.

DO $$
DECLARE
  v_type TEXT;
BEGIN
  SELECT data_type INTO v_type
  FROM   information_schema.columns
  WHERE  table_schema = 'public'
    AND  table_name   = 'guide_badges'
    AND  column_name  = 'renewal_due_at';

  IF v_type IS NULL THEN
    RAISE NOTICE 'Section 5: guide_badges.renewal_due_at not found — table may not exist yet, skipping';
    RETURN;
  END IF;

  IF v_type = 'timestamp with time zone' THEN
    -- Drop the expiry index first (it references the column being altered).
    DROP INDEX IF EXISTS public.idx_guide_badges_expiry;

    ALTER TABLE public.guide_badges
      ALTER COLUMN renewal_due_at TYPE DATE
      USING renewal_due_at::date;

    -- Recreate the index (014 creates it as IF NOT EXISTS, but it was just dropped).
    CREATE INDEX IF NOT EXISTS idx_guide_badges_expiry
      ON public.guide_badges(renewal_due_at);

    RAISE NOTICE 'Section 5: guide_badges.renewal_due_at converted TIMESTAMPTZ → DATE';
  ELSE
    RAISE NOTICE 'Section 5: guide_badges.renewal_due_at is already % — no change needed', v_type;
  END IF;
END $$;


-- ================================================================
-- END — reload PostgREST schema cache
-- ================================================================

NOTIFY pgrst, 'reload schema';