-- ============================================================
-- Model:
--   * One Senior Guide can lead many Guides within a single TPA.
--   * A Guide belongs to AT MOST ONE Senior at a time.
--   * When a new guide is approved (profile.role flips to GUIDE),
--     the trigger assigns them to whichever Senior in the same TPA
--     currently has the FEWEST active guides (balanced load).
--   * HoD can manually reassign via the API in this reply.
-- ============================================================

-- ── Table ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.guide_group_members (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  senior_guide_id UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  guide_id        UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  tpa_name        TEXT        NOT NULL,
  assigned_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  assigned_by     UUID        REFERENCES auth.users(id) ON DELETE SET NULL,
  -- 'auto' = balance trigger; 'manual' = HoD reassigned
  assignment_type TEXT        NOT NULL DEFAULT 'auto'
                              CHECK (assignment_type IN ('auto', 'manual')),
  -- A guide can only belong to one group at a time
  UNIQUE (guide_id)
);

CREATE INDEX IF NOT EXISTS idx_ggm_senior ON public.guide_group_members(senior_guide_id);
CREATE INDEX IF NOT EXISTS idx_ggm_tpa    ON public.guide_group_members(tpa_name);


-- ── RLS ───────────────────────────────────────────────────────
ALTER TABLE public.guide_group_members ENABLE ROW LEVEL SECURITY;

-- Senior Guides can see the rows where they are the leader
CREATE POLICY "ggm: senior reads own group"
  ON public.guide_group_members FOR SELECT
  USING (auth.uid() = senior_guide_id);

-- Guides can see their own membership row
CREATE POLICY "ggm: guide reads own row"
  ON public.guide_group_members FOR SELECT
  USING (auth.uid() = guide_id);

-- HoD+ can read, insert, update, delete everything
CREATE POLICY "ggm: hod+ full access"
  ON public.guide_group_members FOR ALL
  USING  (public.role_rank(public.current_user_role()) >= public.role_rank('HOD'))
  WITH CHECK (public.role_rank(public.current_user_role()) >= public.role_rank('HOD'));


-- ── Helper: pick the least-loaded senior in a given TPA ──────
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
      SELECT DISTINCT ga.applicant_id
      FROM public.guide_applications ga
      WHERE ga.tpa_name = p_tpa_name
        AND ga.status = 'APPROVED'
    )
  GROUP BY p.id
  ORDER BY COUNT(m.id) ASC, p.id ASC
  LIMIT 1;

  RETURN v_senior_id;
END;
$$;

-- ── Trigger: auto-assign on new GUIDE role ───────────────────
CREATE OR REPLACE FUNCTION public.auto_assign_guide_to_group()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tpa      TEXT;
  v_senior   UUID;
BEGIN
  -- Only act when the role transitions from non-GUIDE to GUIDE
  IF NEW.role <> 'GUIDE' OR OLD.role = 'GUIDE' THEN
    RETURN NEW;
  END IF;

  -- Don't clobber an existing assignment (e.g. rollback + re-approve)
  IF EXISTS (SELECT 1 FROM public.guide_group_members WHERE guide_id = NEW.id) THEN
    RETURN NEW;
  END IF;

  -- Find the TPA this guide applied for (most recent approved app)
  SELECT tpa_name
    INTO v_tpa
  FROM public.guide_applications
  WHERE applicant_id = NEW.id
    AND status = 'APPROVED'
  ORDER BY reviewed_at DESC NULLS LAST, submitted_at DESC
  LIMIT 1;

  IF v_tpa IS NULL THEN
    RETURN NEW;  -- cannot group without a TPA; HoD will assign manually
  END IF;

  v_senior := public.pick_least_loaded_senior(v_tpa);

  IF v_senior IS NOT NULL THEN
    INSERT INTO public.guide_group_members
      (senior_guide_id, guide_id, tpa_name, assigned_by, assignment_type)
    VALUES
      (v_senior, NEW.id, v_tpa, NEW.id, 'auto');
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_auto_assign_guide ON public.profiles;
CREATE TRIGGER trg_auto_assign_guide
  AFTER UPDATE OF role ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_assign_guide_to_group();


-- ── View: group roster with progress rollup ──────────────────
DROP VIEW IF EXISTS public.senior_group_roster CASCADE;
CREATE VIEW public.senior_group_roster
WITH (security_invoker = true) AS
SELECT
  m.senior_guide_id,
  m.guide_id,
  m.tpa_name,
  m.assigned_at,
  m.assignment_type,
  p.full_name        AS guide_name,
  p.phone            AS guide_phone,
  -- Average completion across all their active tracks (0 if none)
  COALESCE(ROUND(AVG(gps.completion_pct))::int, 0) AS avg_completion_pct,
  COUNT(gps.track_id)                              AS active_tracks,
  MAX(gps.last_activity_at)                        AS last_activity_at
FROM public.guide_group_members m
JOIN public.profiles p ON p.id = m.guide_id
LEFT JOIN public.guide_progress_summary gps
       ON gps.guide_id = m.guide_id
      AND gps.enrollment_status = 'active'
GROUP BY m.senior_guide_id, m.guide_id, m.tpa_name, m.assigned_at,
         m.assignment_type, p.full_name, p.phone;

GRANT SELECT ON public.senior_group_roster TO authenticated;