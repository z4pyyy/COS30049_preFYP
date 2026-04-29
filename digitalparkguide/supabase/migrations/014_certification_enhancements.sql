-- ================================================================
-- Migration 012 — Certification enhancements
-- Covers:
--   Bug 9 : Module-count-based track pricing (HoD-configurable
--           price_per_module, derived total fee = count × rate).
--   Bug 10: Cross-track module equivalency so modules completed in
--           prior tracks can pre-satisfy the same-or-equivalent module
--           in a newly joined track.
--   Bug 11: Badge / certificate expiry tracking with a superadmin-
--           configurable renewal period and an expiring-badge queue.
--
-- Pure additive migration — does not drop or alter existing rows.
-- ================================================================


-- ================================================================
-- SECTION A — Bug 9: per-module pricing
-- ================================================================
-- `price_myr` from migration 008 becomes a legacy flat-price fallback.
-- New source-of-truth is `price_per_module` × count(active modules).
-- Checkout / display code falls back to price_myr only when
-- price_per_module IS NULL (e.g. during rollout / legacy tracks).

ALTER TABLE public.training_tracks
  ADD COLUMN IF NOT EXISTS price_per_module INTEGER
    CHECK (price_per_module IS NULL OR price_per_module > 0);

COMMENT ON COLUMN public.training_tracks.price_per_module IS
  'HoD-set per-module rate in whole MYR. Total activation fee = price_per_module * count of active, non-archived modules in the track.';

-- Helper: compute the derived fee for a single track.
CREATE OR REPLACE FUNCTION public.track_total_price_myr(p_track_id UUID)
RETURNS INTEGER
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_rate     INTEGER;
  v_legacy   INTEGER;
  v_count    INTEGER;
BEGIN
  SELECT price_per_module, price_myr
    INTO v_rate, v_legacy
    FROM public.training_tracks
   WHERE id = p_track_id;

  IF v_rate IS NULL THEN
    -- Legacy / unconfigured: return the flat price.
    RETURN COALESCE(v_legacy, 0);
  END IF;

  SELECT COUNT(*)::INT INTO v_count
    FROM public.training_modules
   WHERE track_id = p_track_id
     AND is_active = TRUE
     AND COALESCE(is_archived, FALSE) = FALSE;

  RETURN v_rate * COALESCE(v_count, 0);
END;
$$;

GRANT EXECUTE ON FUNCTION public.track_total_price_myr(UUID) TO anon, authenticated;


-- ================================================================
-- SECTION B — Bug 10: module equivalency + completion check
-- ================================================================
-- Modules are track-scoped, but two modules in different tracks may
-- cover the same topic. HoD declares them equivalent; then a guide
-- who has completed any member of an equivalency group counts as
-- having satisfied all other members too.

CREATE TABLE IF NOT EXISTS public.module_equivalencies (
  id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  module_a_id    UUID        NOT NULL REFERENCES public.training_modules(id) ON DELETE CASCADE,
  module_b_id    UUID        NOT NULL REFERENCES public.training_modules(id) ON DELETE CASCADE,
  notes          TEXT        NOT NULL DEFAULT '',
  created_by     UUID        REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT mod_equiv_distinct CHECK (module_a_id <> module_b_id),
  -- Store the smaller UUID in column a so (a,b) is canonical.
  CONSTRAINT mod_equiv_ordered  CHECK (module_a_id < module_b_id),
  UNIQUE (module_a_id, module_b_id)
);

ALTER TABLE public.module_equivalencies ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "mod_equiv: read"   ON public.module_equivalencies;
DROP POLICY IF EXISTS "mod_equiv: manage" ON public.module_equivalencies;

-- Everyone who can see modules can read equivalencies (read-only fact).
CREATE POLICY "mod_equiv: read"
  ON public.module_equivalencies FOR SELECT
  USING (TRUE);

-- Only HoD+ may manage them.
CREATE POLICY "mod_equiv: manage"
  ON public.module_equivalencies FOR ALL
  USING      (public.role_rank(public.current_user_role()) >= public.role_rank('HOD'))
  WITH CHECK (public.role_rank(public.current_user_role()) >= public.role_rank('HOD'));

-- ── Completion helper ────────────────────────────────────────────
-- Returns TRUE iff the guide has completed the given module OR any
-- module declared equivalent to it.
CREATE OR REPLACE FUNCTION public.guide_has_completed_module(
  p_guide_id  UUID,
  p_module_id UUID
)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH equiv AS (
    SELECT p_module_id AS id
    UNION
    SELECT CASE WHEN module_a_id = p_module_id THEN module_b_id ELSE module_a_id END
      FROM public.module_equivalencies
     WHERE module_a_id = p_module_id OR module_b_id = p_module_id
  )
  SELECT EXISTS (
    SELECT 1
      FROM public.guide_module_progress p
      JOIN equiv e ON e.id = p.module_id
     WHERE p.guide_id  = p_guide_id
       AND p.completed = TRUE
  );
$$;

GRANT EXECUTE ON FUNCTION public.guide_has_completed_module(UUID, UUID) TO authenticated;

-- Cross-track pre-satisfy: on enroll, stamp guide_module_progress rows
-- as completed for any module in the new track that the guide has
-- already cleared in another track (directly or via equivalency).
CREATE OR REPLACE FUNCTION public.presatisfy_track_modules(
  p_guide_id UUID,
  p_track_id UUID
)
RETURNS INTEGER   -- number of modules pre-satisfied
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_mod  RECORD;
  v_hits INTEGER := 0;
BEGIN
  FOR v_mod IN
    SELECT id
      FROM public.training_modules
     WHERE track_id = p_track_id
       AND is_active = TRUE
       AND COALESCE(is_archived, FALSE) = FALSE
  LOOP
    IF public.guide_has_completed_module(p_guide_id, v_mod.id) THEN
      INSERT INTO public.guide_module_progress
             (guide_id, module_id, completed, completed_at, last_accessed_at)
      VALUES (p_guide_id, v_mod.id, TRUE, NOW(), NOW())
      ON CONFLICT (guide_id, module_id) DO UPDATE
        SET completed    = TRUE,
            completed_at = COALESCE(public.guide_module_progress.completed_at, NOW());
      v_hits := v_hits + 1;
    END IF;
  END LOOP;

  RETURN v_hits;
END;
$$;

GRANT EXECUTE ON FUNCTION public.presatisfy_track_modules(UUID, UUID) TO authenticated;


-- ================================================================
-- SECTION C — Bug 11: badge expiry & renewal configuration
-- ================================================================

-- ── C1. Platform-wide settings (superadmin only) ─────────────────
CREATE TABLE IF NOT EXISTS public.app_settings (
  key         TEXT         PRIMARY KEY,
  value       JSONB        NOT NULL,
  description TEXT         NOT NULL DEFAULT '',
  updated_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_by  UUID         REFERENCES auth.users(id) ON DELETE SET NULL
);

ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "app_settings: public read"       ON public.app_settings;
DROP POLICY IF EXISTS "app_settings: superadmin write"  ON public.app_settings;

CREATE POLICY "app_settings: public read"
  ON public.app_settings FOR SELECT USING (TRUE);

CREATE POLICY "app_settings: superadmin write"
  ON public.app_settings FOR ALL
  USING      (public.current_user_role() = 'SUPERADMIN')
  WITH CHECK (public.current_user_role() = 'SUPERADMIN');

-- Default renewal period: 24 months. Superadmin can edit via /admin.
INSERT INTO public.app_settings (key, value, description)
VALUES ('badge_renewal_months', '24'::jsonb,
        'Number of months until an issued badge requires renewal. Edit via SFC Management settings.')
ON CONFLICT (key) DO NOTHING;

CREATE OR REPLACE FUNCTION public.badge_renewal_months()
RETURNS INTEGER
LANGUAGE sql
STABLE
AS $$
  SELECT COALESCE(
    (SELECT (value #>> '{}')::int FROM public.app_settings WHERE key = 'badge_renewal_months'),
    24
  );
$$;

GRANT EXECUTE ON FUNCTION public.badge_renewal_months() TO anon, authenticated;


-- ── C2. Guide badges (issued certificates) ───────────────────────
CREATE TABLE IF NOT EXISTS public.guide_badges (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  guide_id          UUID        NOT NULL REFERENCES auth.users(id)             ON DELETE CASCADE,
  track_id          UUID        NOT NULL REFERENCES public.training_tracks(id) ON DELETE CASCADE,
  issue_date        DATE        NOT NULL DEFAULT CURRENT_DATE,
  renewal_due_at  DATE        NOT NULL,
  status            TEXT        NOT NULL DEFAULT 'ACTIVE'
                    CHECK (status IN ('ACTIVE','EXPIRING','EXPIRED','RENEWED','REVOKED')),
  issued_by         UUID        REFERENCES auth.users(id) ON DELETE SET NULL,
  notes             TEXT        NOT NULL DEFAULT '',
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (guide_id, track_id)
);

CREATE INDEX IF NOT EXISTS idx_guide_badges_guide  ON public.guide_badges(guide_id);
CREATE INDEX IF NOT EXISTS idx_guide_badges_expiry ON public.guide_badges(renewal_due_at);

ALTER TABLE public.guide_badges ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "badges: owner read"      ON public.guide_badges;
DROP POLICY IF EXISTS "badges: hod+ read all"   ON public.guide_badges;
DROP POLICY IF EXISTS "badges: hod+ write"      ON public.guide_badges;

CREATE POLICY "badges: owner read"
  ON public.guide_badges FOR SELECT
  USING (auth.uid() = guide_id);

CREATE POLICY "badges: hod+ read all"
  ON public.guide_badges FOR SELECT
  USING (public.role_rank(public.current_user_role()) >= public.role_rank('SENIOR_GUIDE'));

CREATE POLICY "badges: hod+ write"
  ON public.guide_badges FOR ALL
  USING      (public.role_rank(public.current_user_role()) >= public.role_rank('HOD'))
  WITH CHECK (public.role_rank(public.current_user_role()) >= public.role_rank('HOD'));


-- ── C3. Issue-badge RPC ──────────────────────────────────────────
-- Called by the approval flow and any future auto-issuance trigger.
-- Applies the configured renewal period.
CREATE OR REPLACE FUNCTION public.issue_guide_badge(
  p_guide_id  UUID,
  p_track_id  UUID,
  p_issued_by UUID DEFAULT NULL,
  p_notes     TEXT DEFAULT ''
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_months INTEGER := public.badge_renewal_months();
  v_today  DATE    := CURRENT_DATE;
  v_id     UUID;
BEGIN
  INSERT INTO public.guide_badges
         (guide_id, track_id, issue_date, renewal_due_at, status, issued_by, notes)
  VALUES (p_guide_id, p_track_id, v_today,
          (v_today + make_interval(months => v_months))::date,
          'ACTIVE',
          COALESCE(p_issued_by, auth.uid()),
          p_notes)
  ON CONFLICT (guide_id, track_id) DO UPDATE
    SET issue_date       = EXCLUDED.issue_date,
        renewal_due_at = EXCLUDED.renewal_due_at,
        status           = 'RENEWED',
        issued_by        = EXCLUDED.issued_by,
        notes            = EXCLUDED.notes
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.issue_guide_badge(UUID, UUID, UUID, TEXT) TO authenticated;


-- ── C4. Auto-issue a badge when an application is approved ───────
-- Extends the existing approve_guide_application to stamp guide_badges.
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

  -- Upgrade role to GUIDE if still below it.
  UPDATE public.profiles
     SET role = 'GUIDE'
   WHERE id = v_applicant
     AND public.role_rank(role) < public.role_rank('GUIDE');

  -- Issue badge if a track was selected on the application.
  IF v_track IS NOT NULL THEN
    PERFORM public.issue_guide_badge(v_applicant, v_track, auth.uid(),
                                     'Auto-issued on application approval');
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.approve_guide_application(UUID, TEXT) TO authenticated;


-- ── C5. Expiry status helper & status-refresh function ───────────
-- Keeps guide_badges.status in sync with renewal_due_at.
-- Also enqueues email_notifications 30 days ahead of renewal.

-- Allow a new template value.
ALTER TABLE public.email_notifications
  DROP CONSTRAINT IF EXISTS email_notifications_template_check;
ALTER TABLE public.email_notifications
  ADD CONSTRAINT email_notifications_template_check
  CHECK (template IN (
    'application_approved',
    'application_rejected',
    'interview_scheduled',
    'badge_expiring'
  ));

CREATE OR REPLACE FUNCTION public.refresh_badge_expiry_status()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row    RECORD;
  v_email  TEXT;
  v_name   TEXT;
  v_title  TEXT;
  v_hits   INTEGER := 0;
BEGIN
  -- 1. Flip EXPIRED
  UPDATE public.guide_badges
     SET status = 'EXPIRED'
   WHERE renewal_due_at <  CURRENT_DATE
     AND status NOT IN ('EXPIRED','REVOKED');

  -- 2. Flip EXPIRING (inside 30-day warning window)
  UPDATE public.guide_badges
     SET status = 'EXPIRING'
   WHERE renewal_due_at BETWEEN CURRENT_DATE AND (CURRENT_DATE + 30)
     AND status = 'ACTIVE';

  -- 3. Enqueue a one-shot heads-up email per EXPIRING badge.
  FOR v_row IN
    SELECT gb.id, gb.guide_id, gb.track_id, gb.renewal_due_at
      FROM public.guide_badges gb
     WHERE gb.status = 'EXPIRING'
  LOOP
    SELECT au.email, pr.full_name
      INTO v_email, v_name
      FROM auth.users au
      LEFT JOIN public.profiles pr ON pr.id = au.id
     WHERE au.id = v_row.guide_id;

    SELECT title INTO v_title FROM public.training_tracks WHERE id = v_row.track_id;

    IF v_email IS NULL THEN CONTINUE; END IF;

    -- Skip if we already queued one for this badge.
    IF EXISTS (
      SELECT 1 FROM public.email_notifications
       WHERE template  = 'badge_expiring'
         AND recipient = v_email
         AND (payload ->> 'badge_id') = v_row.id::text
    ) THEN
      CONTINUE;
    END IF;

    INSERT INTO public.email_notifications (recipient, template, payload)
    VALUES (v_email, 'badge_expiring', jsonb_build_object(
      'badge_id',         v_row.id,
      'full_name',        COALESCE(v_name, ''),
      'track_title',      COALESCE(v_title, ''),
      'renewal_due_at', v_row.renewal_due_at
    ));
    v_hits := v_hits + 1;
  END LOOP;

  RETURN v_hits;
END;
$$;

GRANT EXECUTE ON FUNCTION public.refresh_badge_expiry_status() TO authenticated;


-- ── C6. Daily schedule via pg_cron (if available) ────────────────
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    PERFORM cron.unschedule('refresh_badge_expiry_status')
      WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'refresh_badge_expiry_status');
    PERFORM cron.schedule(
      'refresh_badge_expiry_status',
      '15 19 * * *',   -- 03:15 MYT
      $cron$SELECT public.refresh_badge_expiry_status();$cron$
    );
  ELSE
    RAISE NOTICE 'pg_cron not enabled - call public.refresh_badge_expiry_status() daily from an external scheduler.';
  END IF;
END $$;

-- ================================================================
-- End of migration 012
-- ================================================================
