-- ================================================================
-- 021_fix_certification_pipeline.sql
-- Fix badge issuance to follow correct certification pipeline:
--   Public → GUIDE (0 badges) → pay TPA → modules → quiz →
--   interview → HoD issues badge
-- ================================================================

-- ── FIX 1: Remove auto badge issuance from approve_guide_application ──
-- Approval only upgrades role to GUIDE. No badge until full pipeline done.

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

-- ── FIX 2: Fix pick_least_loaded_senior to use guide_track_certifications ──
-- Finds senior guide with BADGE_ISSUED for given TPA, with fewest group members.

CREATE OR REPLACE FUNCTION public.pick_least_loaded_senior(p_tpa_name TEXT)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_senior_id UUID;
BEGIN
  SELECT p.id
    INTO v_senior_id
  FROM public.profiles p
  LEFT JOIN public.guide_group_members m ON m.senior_guide_id = p.id
  WHERE p.role = 'SENIOR_GUIDE'
    AND p.id IN (
      SELECT DISTINCT gtc.guide_id
      FROM public.guide_track_certifications gtc
      WHERE gtc.tpa_name = p_tpa_name
        AND gtc.stage = 'BADGE_ISSUED'
        AND gtc.revoked_at IS NULL
    )
  GROUP BY p.id
  ORDER BY COUNT(m.id) ASC, p.id ASC
  LIMIT 1;

  RETURN v_senior_id;
END;
$$;

-- ── FIX 3: Move auto-grouping trigger to guide_track_certifications ──
-- Old trigger: fired on profiles UPDATE (role → GUIDE). Wrong timing.
-- New trigger: fires when guide pays for TPA (row enters PAID stage).
-- This way guide is grouped under senior who has BADGE_ISSUED for same TPA.

-- Drop old trigger on profiles
DROP TRIGGER IF EXISTS trg_auto_assign_guide ON public.profiles;

-- Replace trigger function: now reads TPA from certification row
CREATE OR REPLACE FUNCTION public.auto_assign_guide_to_group()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_senior UUID;
BEGIN
  -- Only fire when stage becomes PAID (guide enrolled and paid for TPA)
  IF TG_OP = 'INSERT' THEN
    IF NEW.stage <> 'PAID' THEN RETURN NEW; END IF;
  ELSIF TG_OP = 'UPDATE' THEN
    IF NEW.stage <> 'PAID' OR OLD.stage = 'PAID' THEN RETURN NEW; END IF;
  END IF;

  -- Skip if guide already in a group for this TPA
  IF EXISTS (
    SELECT 1 FROM public.guide_group_members
    WHERE guide_id = NEW.guide_id
      AND tpa_name = NEW.tpa_name
  ) THEN
    RETURN NEW;
  END IF;

  -- Find least-loaded senior with BADGE_ISSUED for this TPA
  v_senior := public.pick_least_loaded_senior(NEW.tpa_name);

  IF v_senior IS NOT NULL THEN
    INSERT INTO public.guide_group_members
      (senior_guide_id, guide_id, tpa_name, assigned_by, assignment_type)
    VALUES
      (v_senior, NEW.guide_id, NEW.tpa_name, NEW.guide_id, 'auto');
  END IF;

  RETURN NEW;
END;
$$;

-- New trigger on guide_track_certifications
DROP TRIGGER IF EXISTS trg_auto_assign_guide ON public.guide_track_certifications;
CREATE TRIGGER trg_auto_assign_guide
  AFTER INSERT OR UPDATE OF stage ON public.guide_track_certifications
  FOR EACH ROW EXECUTE FUNCTION public.auto_assign_guide_to_group();

-- ── FIX 4: Clean up incorrectly issued badges ──
-- These were auto-issued on application approval (skipping pipeline).
-- Delete all badges with note 'Auto-issued on application approval'.
DELETE FROM public.guide_badges
WHERE notes = 'Auto-issued on application approval';

-- ================================================================
NOTIFY pgrst, 'reload schema';
-- ================================================================
