-- ================================================================
-- DATABASE INITIALIZATION — SFC Digital Training Platform
-- COS30049 Pre-FYP Assignment · Swinburne University of Technology
-- ================================================================
-- Run this ONCE in the Supabase SQL Editor to fully initialize the
-- database from scratch. Safe to re-run — all objects are dropped
-- and recreated cleanly.
--
-- After this file, team members add feature migrations numbered:
--   002_<feature>.sql, 003_<feature>.sql, ...
--
-- Credentials seeded:
--   Superadmin: superadmin@mail.com / Admin@1234
--   ⚠ Change the password after first login in production.
-- ================================================================


-- ================================================================
-- SECTION 0 — TEARDOWN (reverse dependency order)
-- ================================================================

DROP TABLE  IF EXISTS public.page_access      CASCADE;
DROP TABLE  IF EXISTS public.training_tracks  CASCADE;
DROP TABLE  IF EXISTS public.announcements    CASCADE;
DROP TABLE  IF EXISTS public.profiles         CASCADE;

DROP FUNCTION IF EXISTS public.handle_new_user()        CASCADE;
DROP FUNCTION IF EXISTS public.sync_role_to_jwt()       CASCADE;
DROP FUNCTION IF EXISTS public.set_updated_at()         CASCADE;
DROP FUNCTION IF EXISTS public.current_user_role()      CASCADE;
DROP FUNCTION IF EXISTS public.role_rank(app_role)      CASCADE;
DROP FUNCTION IF EXISTS public.get_user_provider(TEXT)  CASCADE;

DROP TYPE IF EXISTS public.app_role CASCADE;


-- ================================================================
-- SECTION 1 — ENUMS
-- ================================================================
-- Role hierarchy (ascending privilege):
--   PUBLIC_USER(0) → GUIDE(1) → SENIOR_GUIDE(2) → HOD(3) → SUPERADMIN(4)
--
-- Mirrors ROLE_HIERARCHY in types/roles.ts — keep both in sync.

CREATE TYPE public.app_role AS ENUM (
  'SUPERADMIN',
  'HOD',
  'SENIOR_GUIDE',
  'GUIDE',
  'PUBLIC_USER'
);


-- ================================================================
-- SECTION 2 — HELPER FUNCTIONS
-- ================================================================

-- Automatically bumps updated_at on any UPDATE
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

-- Returns the auth provider ('google', 'email', etc.) for a given email.
-- Used by the frontend to show targeted errors when a social account tries
-- to log in with a password.
CREATE OR REPLACE FUNCTION public.get_user_provider(p_email TEXT)
RETURNS TEXT
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE AS $$
  SELECT raw_app_meta_data ->> 'provider'
  FROM auth.users
  WHERE email = p_email
  LIMIT 1;
$$;

-- Returns the current authenticated user's app_role.
-- Used inside RLS policies to avoid repetitive sub-selects.
CREATE OR REPLACE FUNCTION public.current_user_role()
RETURNS app_role
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
STABLE AS $$
DECLARE
  _role public.app_role;
BEGIN
  SELECT role INTO _role
  FROM public.profiles
  WHERE id = auth.uid();
  RETURN _role;
END;
$$;

-- Maps app_role → numeric rank (mirrors ROLE_HIERARCHY in types/roles.ts).
-- Used in RLS policies for range comparisons (e.g. "HOD or above").
CREATE OR REPLACE FUNCTION public.role_rank(r app_role)
RETURNS INT
LANGUAGE sql
IMMUTABLE AS $$
  SELECT CASE r
    WHEN 'SUPERADMIN'   THEN 4
    WHEN 'HOD'          THEN 3
    WHEN 'SENIOR_GUIDE' THEN 2
    WHEN 'GUIDE'        THEN 1
    ELSE 0  -- PUBLIC_USER
  END;
$$;


-- ================================================================
-- SECTION 3 — CORE TABLES
-- ================================================================

-- ── 3a. profiles ─────────────────────────────────────────────────
-- One row per auth.users record. Created automatically by trigger.
-- Never stores passwords — auth is handled by Supabase GoTrue.
CREATE TABLE public.profiles (
  id          UUID        PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name   TEXT        NOT NULL DEFAULT '',
  phone       TEXT,                                        -- optional, phone-registered users
  role        app_role    NOT NULL DEFAULT 'PUBLIC_USER',  -- always PUBLIC_USER on self-signup
  avatar_url  TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── 3b. announcements ────────────────────────────────────────────
-- Platform-wide notices created by HOD+. Public users see published only.
CREATE TABLE public.announcements (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  title        TEXT        NOT NULL,
  content      TEXT        NOT NULL DEFAULT '',   -- 'content', NOT 'body'
  category     TEXT        NOT NULL DEFAULT 'GENERAL',
  published    BOOLEAN     NOT NULL DEFAULT FALSE,
  published_at TIMESTAMPTZ,
  created_by   UUID        REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── 3c. training_tracks ──────────────────────────────────────────
-- Certification programmes defined by HOD per TPA (Totally Protected Area).
-- Each badge is park-specific and non-transferable between parks.
CREATE TABLE public.training_tracks (
  id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  title          TEXT        NOT NULL,
  track_type     app_role    NOT NULL DEFAULT 'GUIDE',
  tpa_name       TEXT        NOT NULL,
  overview       TEXT        NOT NULL DEFAULT '',
  duration_weeks INT         NOT NULL DEFAULT 1,
  eligibility    TEXT        NOT NULL DEFAULT 'Open to all SFC staff',
  is_open        BOOLEAN     NOT NULL DEFAULT TRUE,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── 3d. page_access ──────────────────────────────────────────────
-- Dynamic RBAC route table. Read by middleware on every request.
-- Superadmin can change min_role and disable/enable routes at runtime
-- without a code deploy. Locked rows (Admin Console) cannot be changed.
CREATE TABLE public.page_access (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  route       TEXT        NOT NULL UNIQUE,
  label       TEXT        NOT NULL,
  group_name  TEXT        NOT NULL DEFAULT 'General',
  min_role    app_role    NOT NULL DEFAULT 'PUBLIC_USER',
  is_locked   BOOLEAN     NOT NULL DEFAULT FALSE,  -- TRUE = superadmin cannot modify
  is_disabled BOOLEAN     NOT NULL DEFAULT FALSE,  -- TRUE = 401 for everyone except SUPERADMIN
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);


-- ================================================================
-- SECTION 4 — TRIGGERS
-- ================================================================

-- Auto-bump updated_at on all mutable tables
CREATE TRIGGER profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER announcements_updated_at
  BEFORE UPDATE ON public.announcements
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER training_tracks_updated_at
  BEFORE UPDATE ON public.training_tracks
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER page_access_updated_at
  BEFORE UPDATE ON public.page_access
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Auto-create a profile row whenever a new auth.users row is inserted.
-- full_name is read from raw_user_meta_data (set during signUp / OAuth).
-- Role is always PUBLIC_USER — SUPERADMIN override only via seed below.
-- NOTE: sync_role_to_jwt was intentionally removed. Updating auth.users
-- from inside a profiles trigger conflicts with GoTrue and causes
-- "database query error" on sign-in. Role is read from profiles instead.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public AS $$
DECLARE
  v_role app_role;
BEGIN
  v_role := CASE (NEW.raw_user_meta_data ->> 'role')
    WHEN 'SUPERADMIN' THEN 'SUPERADMIN'::app_role
    ELSE 'PUBLIC_USER'::app_role
  END;

  INSERT INTO public.profiles (id, full_name, role)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data ->> 'full_name', ''),
    v_role
  )
  ON CONFLICT (id) DO NOTHING;

  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();


-- ================================================================
-- SECTION 5 — ROW LEVEL SECURITY
-- ================================================================

-- ── profiles ─────────────────────────────────────────────────────
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Every user can read and update their own profile
CREATE POLICY "profiles: own read"
  ON public.profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "profiles: own update"
  ON public.profiles FOR UPDATE
  USING  (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- HOD+ can read all profiles (for reporting and group management)
CREATE POLICY "profiles: hod+ read all"
  ON public.profiles FOR SELECT
  USING (public.role_rank(public.current_user_role()) >= 3);

-- SUPERADMIN can update any profile (role reassignment via /admin/users)
CREATE POLICY "profiles: superadmin update all"
  ON public.profiles FOR UPDATE
  USING (public.current_user_role() = 'SUPERADMIN');


-- ── announcements ────────────────────────────────────────────────
ALTER TABLE public.announcements ENABLE ROW LEVEL SECURITY;

-- Unauthenticated visitors and PUBLIC_USER can read published announcements
CREATE POLICY "announcements: public read published"
  ON public.announcements FOR SELECT
  USING (published = TRUE);

-- HOD+ can read all announcements including drafts
CREATE POLICY "announcements: hod+ read all"
  ON public.announcements FOR SELECT
  USING (public.role_rank(public.current_user_role()) >= 3);

-- HOD+ can create and update announcements
CREATE POLICY "announcements: hod+ insert"
  ON public.announcements FOR INSERT
  WITH CHECK (public.role_rank(public.current_user_role()) >= 3);

CREATE POLICY "announcements: hod+ update"
  ON public.announcements FOR UPDATE
  USING (public.role_rank(public.current_user_role()) >= 3);

-- Only SUPERADMIN can delete announcements
CREATE POLICY "announcements: superadmin delete"
  ON public.announcements FOR DELETE
  USING (public.current_user_role() = 'SUPERADMIN');


-- ── training_tracks ──────────────────────────────────────────────
ALTER TABLE public.training_tracks ENABLE ROW LEVEL SECURITY;

-- Anyone (including unauthenticated) can browse available tracks
CREATE POLICY "training_tracks: public read"
  ON public.training_tracks FOR SELECT
  USING (TRUE);

-- HOD+ can create and update training tracks
CREATE POLICY "training_tracks: hod+ insert"
  ON public.training_tracks FOR INSERT
  WITH CHECK (public.role_rank(public.current_user_role()) >= 3);

CREATE POLICY "training_tracks: hod+ update"
  ON public.training_tracks FOR UPDATE
  USING (public.role_rank(public.current_user_role()) >= 3);

-- Only SUPERADMIN can delete training tracks
CREATE POLICY "training_tracks: superadmin delete"
  ON public.training_tracks FOR DELETE
  USING (public.current_user_role() = 'SUPERADMIN');


-- ── page_access ──────────────────────────────────────────────────
ALTER TABLE public.page_access ENABLE ROW LEVEL SECURITY;

-- Anyone can read (middleware reads this table even for unauthenticated requests)
CREATE POLICY "page_access: public read"
  ON public.page_access FOR SELECT
  USING (TRUE);

-- Only SUPERADMIN can update, and only non-locked rows
CREATE POLICY "page_access: superadmin update"
  ON public.page_access FOR UPDATE
  USING  (public.current_user_role() = 'SUPERADMIN' AND is_locked = FALSE)
  WITH CHECK (public.current_user_role() = 'SUPERADMIN' AND is_locked = FALSE);


-- ================================================================
-- SECTION 6 — SEED DATA
-- ================================================================

-- ── 6a. Superadmin account ───────────────────────────────────────
-- Hardcoded initial credentials. Change password after first login.
-- Uses extensions.crypt / extensions.gen_salt (Supabase pgcrypto schema).
-- DELETE + re-insert pattern ensures a clean hash on every migration run.
DO $$
DECLARE
  v_email    TEXT := 'superadmin@mail.com';
  v_password TEXT := 'Admin@1234';
  v_name     TEXT := 'SFC Superadmin';
  v_uid      UUID;
BEGIN
  DELETE FROM auth.users WHERE email = v_email;

  v_uid := gen_random_uuid();

  INSERT INTO auth.users (
    id, instance_id, aud, role,
    email, encrypted_password, email_confirmed_at,
    raw_app_meta_data, raw_user_meta_data,
    confirmation_token, recovery_token,
    email_change_token_new, email_change,
    phone, phone_change, phone_change_token,
    email_change_token_current, reauthentication_token,
    created_at, updated_at
  ) VALUES (
    v_uid,
    '00000000-0000-0000-0000-000000000000',
    'authenticated',
    'authenticated',
    v_email,
    extensions.crypt(v_password, extensions.gen_salt('bf')),
    NOW(),
    '{"provider":"email","providers":["email"]}',
    jsonb_build_object('full_name', v_name, 'role', 'SUPERADMIN'),
    '', '', '', '', '', '', '', '', '',
    NOW(), NOW()
  );

  INSERT INTO public.profiles (id, full_name, role)
  VALUES (v_uid, v_name, 'SUPERADMIN')
  ON CONFLICT (id) DO UPDATE
    SET role = 'SUPERADMIN', full_name = EXCLUDED.full_name;

  RAISE NOTICE 'Superadmin seeded — email: % | password: %', v_email, v_password;
END $$;


-- ── 6b. Page access rules ────────────────────────────────────────
-- Admin Console routes are locked (superadmin cannot accidentally disable them).
-- All other routes can be reconfigured at runtime via /admin/rbac.
INSERT INTO public.page_access (route, label, group_name, min_role, is_locked) VALUES
  ('/admin',         'Dashboard',       'Admin Console',   'SUPERADMIN',  TRUE),
  ('/admin/users',   'User Management', 'Admin Console',   'SUPERADMIN',  TRUE),
  ('/admin/rbac',    'RBAC Settings',   'Admin Console',   'SUPERADMIN',  TRUE),
  ('/dashboard',     'Dashboard',       'Staff Dashboard', 'GUIDE',       FALSE),
  ('/dashboard/hod', 'HoD Panel',       'Staff Dashboard', 'HOD',         FALSE),
  ('/training',      'Training',        'Training',        'PUBLIC_USER', FALSE),
  ('/announcements', 'Announcements',   'Public',          'PUBLIC_USER', FALSE)
ON CONFLICT (route) DO NOTHING;


-- ── 6c. Sample announcements (uncomment for local dev/demo) ──────
/*
INSERT INTO public.announcements (title, content, category, published, published_at) VALUES
  (
    'Miri Rainforest World Music Festival — Ranger Briefing',
    'All certified guides assigned to RWNF 2025 must attend the pre-event safety briefing on 10 July at 0900 hrs, Marudi District Office.',
    'OPERATIONS', TRUE, NOW()
  ),
  (
    'New Certification Track: Mangrove Ecosystem Management',
    'SFC is launching a new 8-week mangrove specialist track. Eligible: GUIDE rank and above. Registration opens 1 August 2025.',
    'TRAINING', TRUE, NOW() - INTERVAL '2 days'
  ),
  (
    'Wildlife Corridor Survey — Volunteer Call',
    'The Biodiversity Unit is calling for volunteer guides to assist with the Q3 wildlife corridor survey in Batang Ai NP.',
    'GENERAL', TRUE, NOW() - INTERVAL '5 days'
  );
*/


-- ================================================================
-- END OF INITIALIZATION
-- ================================================================
-- Next migrations should be named:
--   002_<feature_name>.sql
--   003_<feature_name>.sql
--   ...
-- Do NOT modify this file after the database is live.
-- To reset: re-run this file in full (it drops and rebuilds everything).
-- ================================================================
