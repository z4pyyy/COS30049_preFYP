-- ================================================================
-- 017_schema_hardening.sql
-- Post-audit remediation: security, performance, and hygiene fixes
-- identified by full schema audit against Supabase advisors.
--
-- Safe to re-run: every block is idempotent.
-- Must be applied AFTER 016_schema_remediation.sql.
--
-- Fixes:
--   Section 1 — Pin search_path on 4 INVOKER functions flagged by
--               Supabase security advisor. role_rank() is the most
--               critical (used in nearly all RLS policies).
--   Section 2 — Add missing FK indexes on high-traffic columns to
--               prevent sequential scans in JOINs and triggers.
--   Section 3 — Remove duplicate RLS policies on guide_applications
--               (old 010 policies overlap with newer 013 policies).
-- ================================================================


-- ================================================================
-- SECTION 1 — Pin search_path on INVOKER functions
-- ================================================================
-- Supabase advisor flags these as mutable search_path. While INVOKER
-- functions are lower risk than SECURITY DEFINER, role_rank() is
-- called inside RLS policies — a search_path manipulation could
-- shadow it to escalate privileges.

-- 1a. role_rank — used in nearly all RLS policies
CREATE OR REPLACE FUNCTION public.role_rank(r app_role)
RETURNS INTEGER
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT CASE r
    WHEN 'SUPERADMIN'   THEN 4
    WHEN 'HOD'          THEN 3
    WHEN 'SENIOR_GUIDE' THEN 2
    WHEN 'GUIDE'        THEN 1
    ELSE 0  -- PUBLIC_USER
  END;
$$;

-- 1b. badge_renewal_months — reads app_settings
CREATE OR REPLACE FUNCTION public.badge_renewal_months()
RETURNS INTEGER
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT (value #>> '{}')::int FROM public.app_settings WHERE key = 'badge_renewal_months'),
    24
  );
$$;

GRANT EXECUTE ON FUNCTION public.badge_renewal_months() TO anon, authenticated;

-- 1c. bump_application_doc_count — trigger on guide_application_documents
CREATE OR REPLACE FUNCTION public.bump_application_doc_count()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.guide_applications
       SET document_count = document_count + 1
     WHERE id = NEW.application_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.guide_applications
       SET document_count = GREATEST(document_count - 1, 0)
     WHERE id = OLD.application_id;
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$;

-- 1d. set_updated_at — generic updated_at trigger
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;


-- ================================================================
-- SECTION 2 — Missing FK indexes (high-traffic columns)
-- ================================================================
-- FK columns without indexes cause sequential scans on DELETE of
-- the referenced row and slow down JOINs in views/triggers.
-- Only adding indexes for columns that appear in active queries.

-- training_modules.track_id — used in many JOINs (progress views,
-- certification triggers, module listing)
CREATE INDEX IF NOT EXISTS idx_training_modules_track
  ON public.training_modules(track_id);

-- quiz_attempts.quiz_id — used in fn_check_quizzes_passed trigger
CREATE INDEX IF NOT EXISTS idx_quiz_attempts_quiz
  ON public.quiz_attempts(quiz_id);

-- quiz_attempts.user_id — used in fn_check_quizzes_passed + RLS
CREATE INDEX IF NOT EXISTS idx_quiz_attempts_user
  ON public.quiz_attempts(user_id);

-- questions.quiz_id — used in quiz rendering queries
CREATE INDEX IF NOT EXISTS idx_questions_quiz
  ON public.questions(quiz_id);

-- guide_applications.track_id — used in certification pipeline
CREATE INDEX IF NOT EXISTS idx_guide_applications_track
  ON public.guide_applications(track_id);

-- training_module_assets.module_id — used in module detail pages
CREATE INDEX IF NOT EXISTS idx_training_module_assets_module
  ON public.training_module_assets(module_id);


-- ================================================================
-- SECTION 3 — Remove duplicate RLS policies on guide_applications
-- ================================================================
-- Migration 010 created: guide_applications: own read/own insert/hod+ read all
-- Migration 013 created: ga: applicant reads own/applicant inserts own/hod+ read all
-- Both sets are PERMISSIVE with identical conditions — the old set
-- adds unnecessary policy evaluation overhead.

DROP POLICY IF EXISTS "guide_applications: own read"     ON public.guide_applications;
DROP POLICY IF EXISTS "guide_applications: own insert"   ON public.guide_applications;
DROP POLICY IF EXISTS "guide_applications: hod+ read all" ON public.guide_applications;


-- ================================================================
-- END — reload PostgREST schema cache
-- ================================================================

NOTIFY pgrst, 'reload schema';
