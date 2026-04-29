-- ================================================================
-- 018_fix_user_deletion.sql
-- Fix: admin user deletion (auth.admin.deleteUser) failed with
-- "permission denied for table guide_applications" because
-- supabase_auth_admin had no grants on public tables.
--
-- Two issues fixed:
--   1. quiz_attempts.user_id FK had NO ACTION (should be CASCADE).
--   2. supabase_auth_admin needs DELETE on CASCADE tables and UPDATE
--      on SET NULL tables for FK propagation when auth.users row
--      is deleted.
--
-- Safe to re-run: all statements are idempotent.
-- ================================================================


-- ================================================================
-- SECTION 1 — Fix quiz_attempts FK delete rule
-- ================================================================

ALTER TABLE public.quiz_attempts
  DROP CONSTRAINT IF EXISTS quiz_attempts_user_id_fkey;

ALTER TABLE public.quiz_attempts
  ADD CONSTRAINT quiz_attempts_user_id_fkey
    FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


-- ================================================================
-- SECTION 2 — Grant supabase_auth_admin FK cascade permissions
-- ================================================================
-- When Supabase Auth deletes a user from auth.users, the operation
-- runs as supabase_auth_admin. FK CASCADE and SET NULL propagation
-- requires table-level privileges on the referencing tables.
-- RLS is bypassed for internal FK operations, so only GRANTs needed.

-- CASCADE tables: need DELETE
GRANT DELETE ON public.guide_applications       TO supabase_auth_admin;
GRANT DELETE ON public.guide_badges             TO supabase_auth_admin;
GRANT DELETE ON public.guide_group_members      TO supabase_auth_admin;
GRANT DELETE ON public.guide_module_progress    TO supabase_auth_admin;
GRANT DELETE ON public.guide_track_certifications TO supabase_auth_admin;
GRANT DELETE ON public.guide_track_enrollments  TO supabase_auth_admin;
GRANT DELETE ON public.profiles                 TO supabase_auth_admin;
GRANT DELETE ON public.quiz_attempts            TO supabase_auth_admin;

-- SET NULL tables: need UPDATE
GRANT UPDATE ON public.announcements            TO supabase_auth_admin;
GRANT UPDATE ON public.app_settings             TO supabase_auth_admin;
GRANT UPDATE ON public.guide_application_documents TO supabase_auth_admin;
GRANT UPDATE ON public.guide_applications       TO supabase_auth_admin;
GRANT UPDATE ON public.guide_badges             TO supabase_auth_admin;
GRANT UPDATE ON public.guide_group_members      TO supabase_auth_admin;
GRANT UPDATE ON public.guide_track_certifications TO supabase_auth_admin;
GRANT UPDATE ON public.module_equivalencies     TO supabase_auth_admin;
GRANT UPDATE ON public.training_module_assets   TO supabase_auth_admin;
GRANT UPDATE ON public.training_module_versions TO supabase_auth_admin;
GRANT UPDATE ON public.training_modules         TO supabase_auth_admin;


-- Reload PostgREST schema cache
NOTIFY pgrst, 'reload schema';
