-- ================================================================
-- 020_notifications_and_promotions.sql
-- In-app notifications, auto-promotion, HoD manual nomination
-- ================================================================

-- ── SECTION 1: Notifications table ──────────────────────────────

CREATE TABLE IF NOT EXISTS public.notifications (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title       TEXT        NOT NULL,
  body        TEXT        NOT NULL DEFAULT '',
  link        TEXT,                -- optional deep-link path e.g. /senior-guide/interviews
  read_at     TIMESTAMPTZ,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_notifications_user    ON public.notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_unread  ON public.notifications(user_id) WHERE read_at IS NULL;

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "notif: own read"  ON public.notifications;
DROP POLICY IF EXISTS "notif: own update" ON public.notifications;

CREATE POLICY "notif: own read"
  ON public.notifications FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "notif: own update"
  ON public.notifications FOR UPDATE
  USING (auth.uid() = user_id);

-- Service-role inserts bypass RLS; triggers use SECURITY DEFINER.

-- ── SECTION 2: Mark-read RPC ────────────────────────────────────

CREATE OR REPLACE FUNCTION public.mark_notifications_read(p_ids UUID[])
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count INTEGER;
BEGIN
  UPDATE public.notifications
  SET read_at = NOW()
  WHERE id = ANY(p_ids)
    AND user_id = auth.uid()
    AND read_at IS NULL;

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

GRANT EXECUTE ON FUNCTION public.mark_notifications_read(UUID[]) TO authenticated;

-- ── SECTION 3: Cert stage-change notification trigger ───────────

CREATE OR REPLACE FUNCTION public.fn_notify_on_cert_stage_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_guide_name  TEXT;
  v_track_title TEXT;
  v_senior_id   UUID;
BEGIN
  -- Only fire when stage actually changes
  IF OLD.stage = NEW.stage THEN RETURN NEW; END IF;

  SELECT full_name INTO v_guide_name FROM public.profiles WHERE id = NEW.guide_id;
  SELECT title INTO v_track_title FROM public.training_tracks WHERE id = NEW.track_id;
  v_guide_name  := COALESCE(v_guide_name, 'A guide');
  v_track_title := COALESCE(v_track_title, 'a track');

  -- PENDING_INTERVIEW: notify the assigned Senior Guide
  IF NEW.stage = 'PENDING_INTERVIEW' AND OLD.stage IN ('QUIZZES_PASSED', 'MODULES_COMPLETED') THEN
    -- Find the Senior Guide responsible for this guide
    SELECT senior_guide_id INTO v_senior_id
    FROM public.guide_group_members
    WHERE guide_id = NEW.guide_id
    LIMIT 1;

    IF v_senior_id IS NOT NULL THEN
      INSERT INTO public.notifications (user_id, title, body, link)
      VALUES (
        v_senior_id,
        'Interview Ready',
        v_guide_name || ' has completed all requirements for ' || v_track_title || ' and is ready for their certification interview.',
        '/senior-guide/interviews'
      );
    END IF;
  END IF;

  -- PENDING_BADGE_APPROVAL: notify all HoDs
  IF NEW.stage = 'PENDING_BADGE_APPROVAL' THEN
    INSERT INTO public.notifications (user_id, title, body, link)
    SELECT p.id,
           'Badge Approval Required',
           v_guide_name || ' has passed their interview for ' || v_track_title || '. Review and issue badge.',
           '/dashboard/hod/certifications'
    FROM public.profiles p
    WHERE public.role_rank(p.role) >= public.role_rank('HOD');
  END IF;

  -- Interview scheduled: notify the Guide
  IF NEW.stage = 'PENDING_INTERVIEW' AND NEW.interview_date IS NOT NULL AND (OLD.interview_date IS NULL OR OLD.interview_date <> NEW.interview_date) THEN
    INSERT INTO public.notifications (user_id, title, body, link)
    VALUES (
      NEW.guide_id,
      'Interview Scheduled',
      'Your certification interview for ' || v_track_title || ' has been scheduled for ' || NEW.interview_date::TEXT || '.',
      '/training/modules'
    );
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_cert_stage_notify ON public.guide_track_certifications;
CREATE TRIGGER trg_cert_stage_notify
  AFTER UPDATE ON public.guide_track_certifications
  FOR EACH ROW EXECUTE FUNCTION public.fn_notify_on_cert_stage_change();

-- ── SECTION 4: New application notification ─────────────────────

CREATE OR REPLACE FUNCTION public.fn_notify_on_new_application()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_applicant_name TEXT;
BEGIN
  SELECT full_name INTO v_applicant_name FROM public.profiles WHERE id = NEW.applicant_id;
  v_applicant_name := COALESCE(v_applicant_name, 'A new applicant');

  INSERT INTO public.notifications (user_id, title, body, link)
  SELECT p.id,
         'New Guide Application',
         v_applicant_name || ' has submitted a guide application for review.',
         '/dashboard?action=applications'
  FROM public.profiles p
  WHERE public.role_rank(p.role) >= public.role_rank('HOD');

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_new_application_notify ON public.guide_applications;
CREATE TRIGGER trg_new_application_notify
  AFTER INSERT ON public.guide_applications
  FOR EACH ROW EXECUTE FUNCTION public.fn_notify_on_new_application();

-- ── SECTION 5: Auto-promote to Senior Guide after 2 renewals ────

CREATE OR REPLACE FUNCTION public.fn_auto_promote_senior_guide()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_renewal_count INTEGER;
  v_current_role  app_role;
BEGIN
  -- Only act on RENEWED status
  IF NEW.status <> 'RENEWED' THEN RETURN NEW; END IF;

  -- Count how many distinct tracks this guide has renewed badges for
  SELECT COUNT(*) INTO v_renewal_count
  FROM public.guide_badges
  WHERE guide_id = NEW.guide_id
    AND status IN ('RENEWED', 'ACTIVE');

  IF v_renewal_count < 2 THEN RETURN NEW; END IF;

  -- Check current role — only promote if currently GUIDE
  SELECT role INTO v_current_role
  FROM public.profiles WHERE id = NEW.guide_id;

  IF v_current_role = 'GUIDE' THEN
    -- Remove from any group as member before promoting
    DELETE FROM public.guide_group_members WHERE guide_id = NEW.guide_id;

    UPDATE public.profiles
    SET role = 'SENIOR_GUIDE'
    WHERE id = NEW.guide_id;

    INSERT INTO public.notifications (user_id, title, body, link)
    VALUES (
      NEW.guide_id,
      'Promoted to Senior Guide',
      'Congratulations! You have been promoted to Senior Guide after renewing your TPA badge for the 2nd time.',
      '/dashboard'
    );
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_auto_promote_senior ON public.guide_badges;
CREATE TRIGGER trg_auto_promote_senior
  AFTER INSERT OR UPDATE OF status ON public.guide_badges
  FOR EACH ROW EXECUTE FUNCTION public.fn_auto_promote_senior_guide();

-- ── SECTION 6: HoD manual nomination to Senior Guide ────────────

CREATE OR REPLACE FUNCTION public.nominate_senior_guide(p_guide_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role      app_role;
  v_target    app_role;
  v_name      TEXT;
BEGIN
  SELECT role INTO v_role FROM public.profiles WHERE id = auth.uid();
  IF public.role_rank(v_role) < public.role_rank('HOD') THEN
    RAISE EXCEPTION 'Only HOD+ may nominate Senior Guides';
  END IF;

  SELECT role INTO v_target FROM public.profiles WHERE id = p_guide_id;
  IF v_target IS NULL THEN
    RAISE EXCEPTION 'User not found';
  END IF;
  IF v_target <> 'GUIDE' THEN
    RAISE EXCEPTION 'User is already % — can only nominate GUIDE role', v_target;
  END IF;

  -- Remove from any group as member before promoting
  DELETE FROM public.guide_group_members WHERE guide_id = p_guide_id;

  UPDATE public.profiles SET role = 'SENIOR_GUIDE' WHERE id = p_guide_id;

  SELECT full_name INTO v_name FROM public.profiles WHERE id = p_guide_id;

  INSERT INTO public.notifications (user_id, title, body, link)
  VALUES (
    p_guide_id,
    'Promoted to Senior Guide',
    'You have been nominated as a Senior Guide by the Head of Department.',
    '/dashboard'
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.nominate_senior_guide(UUID) TO authenticated;

-- ================================================================
-- END
-- ================================================================

NOTIFY pgrst, 'reload schema';
