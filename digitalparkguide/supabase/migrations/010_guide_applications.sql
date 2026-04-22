CREATE TABLE IF NOT EXISTS public.guide_applications (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  applicant_id    UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name       TEXT        NOT NULL,
  email           TEXT        NOT NULL,
  phone           TEXT,
  tpa_name        TEXT        NOT NULL,
  track_id        UUID        REFERENCES public.training_tracks(id) ON DELETE SET NULL,
  motivation      TEXT        NOT NULL DEFAULT '',
  experience      TEXT        NOT NULL DEFAULT '',
  status          TEXT        NOT NULL DEFAULT 'PENDING',
  reviewer_notes  TEXT        NOT NULL DEFAULT '',
  submitted_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  reviewed_at     TIMESTAMPTZ,
  reviewed_by     UUID        REFERENCES auth.users(id) ON DELETE SET NULL
);

ALTER TABLE public.guide_applications
  DROP CONSTRAINT IF EXISTS guide_applications_status_check;
ALTER TABLE public.guide_applications
  ADD CONSTRAINT guide_applications_status_check
  CHECK (status IN ('PENDING', 'UNDER_REVIEW', 'INTERVIEW_SCHEDULED', 'APPROVED', 'REJECTED'));

ALTER TABLE public.guide_applications
  ADD COLUMN IF NOT EXISTS interview_date       DATE;
ALTER TABLE public.guide_applications
  ADD COLUMN IF NOT EXISTS interview_time       TIME;
ALTER TABLE public.guide_applications
  ADD COLUMN IF NOT EXISTS interview_location   TEXT;
ALTER TABLE public.guide_applications
  ADD COLUMN IF NOT EXISTS interview_scheduled_at TIMESTAMPTZ;

ALTER TABLE public.guide_applications
  ADD COLUMN IF NOT EXISTS document_count INT NOT NULL DEFAULT 0;


-- ── RLS ───────────────────────────────────────────────────────
ALTER TABLE public.guide_applications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "ga: applicant reads own"  ON public.guide_applications;
DROP POLICY IF EXISTS "ga: applicant inserts own" ON public.guide_applications;
DROP POLICY IF EXISTS "ga: hod+ read all"        ON public.guide_applications;
DROP POLICY IF EXISTS "ga: hod+ update"          ON public.guide_applications;

CREATE POLICY "ga: applicant reads own"
  ON public.guide_applications FOR SELECT
  USING (auth.uid() = applicant_id);

CREATE POLICY "ga: applicant inserts own"
  ON public.guide_applications FOR INSERT
  WITH CHECK (auth.uid() = applicant_id);

CREATE POLICY "ga: hod+ read all"
  ON public.guide_applications FOR SELECT
  USING (public.role_rank(public.current_user_role()) >= public.role_rank('HOD'));

CREATE POLICY "ga: hod+ update"
  ON public.guide_applications FOR UPDATE
  USING  (public.role_rank(public.current_user_role()) >= public.role_rank('HOD'))
  WITH CHECK (public.role_rank(public.current_user_role()) >= public.role_rank('HOD'));


-- ── Review RPCs ───────────────────────────────────────────────
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
  v_role      app_role;
BEGIN
  -- Only HoD+ may call
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
   RETURNING applicant_id INTO v_applicant;

  IF v_applicant IS NULL THEN
    RAISE EXCEPTION 'Application not found';
  END IF;

  -- Upgrade role to GUIDE if they're still below it.
  UPDATE public.profiles
     SET role = 'GUIDE'
   WHERE id = v_applicant
     AND public.role_rank(role) < public.role_rank('GUIDE');
END;
$$;

CREATE OR REPLACE FUNCTION public.reject_guide_application(
  p_app_id UUID,
  p_notes  TEXT
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
  IF v_role IS NULL OR public.role_rank(v_role) < public.role_rank('HOD') THEN
    RAISE EXCEPTION 'Only HoD or above may reject applications';
  END IF;

  IF p_notes IS NULL OR length(trim(p_notes)) = 0 THEN
    RAISE EXCEPTION 'Rejection notes are required';
  END IF;

  UPDATE public.guide_applications
     SET status         = 'REJECTED',
         reviewer_notes = p_notes,
         reviewed_at    = NOW(),
         reviewed_by    = auth.uid()
   WHERE id = p_app_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.approve_guide_application(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.reject_guide_application(UUID, TEXT)  TO authenticated;


-- ── Notification queue (read by Supabase email edge function) ─
CREATE TABLE IF NOT EXISTS public.email_notifications (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  recipient    TEXT        NOT NULL,
  template     TEXT        NOT NULL
               CHECK (template IN (
                 'application_approved',
                 'application_rejected',
                 'interview_scheduled'
               )),
  payload      JSONB       NOT NULL DEFAULT '{}'::jsonb,
  sent_at      TIMESTAMPTZ,
  error        TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.email_notifications ENABLE ROW LEVEL SECURITY;

-- Only HoD+ can read the queue; service role (edge function) bypasses RLS
CREATE POLICY "email_notifications: hod+ read"
  ON public.email_notifications FOR SELECT
  USING (public.role_rank(public.current_user_role()) >= public.role_rank('HOD'));


-- ── Triggers that enqueue emails on status change ────────────
CREATE OR REPLACE FUNCTION public.queue_application_email()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Only act on genuine status transitions
  IF TG_OP = 'UPDATE' AND OLD.status IS NOT DISTINCT FROM NEW.status THEN
    RETURN NEW;
  END IF;

  IF NEW.status = 'APPROVED' THEN
    INSERT INTO public.email_notifications (recipient, template, payload)
    VALUES (NEW.email, 'application_approved', jsonb_build_object(
      'full_name',      NEW.full_name,
      'tpa_name',       NEW.tpa_name,
      'reviewer_notes', NEW.reviewer_notes
    ));
  ELSIF NEW.status = 'REJECTED' THEN
    INSERT INTO public.email_notifications (recipient, template, payload)
    VALUES (NEW.email, 'application_rejected', jsonb_build_object(
      'full_name',      NEW.full_name,
      'tpa_name',       NEW.tpa_name,
      'reviewer_notes', NEW.reviewer_notes
    ));
  ELSIF NEW.status = 'INTERVIEW_SCHEDULED' THEN
    INSERT INTO public.email_notifications (recipient, template, payload)
    VALUES (NEW.email, 'interview_scheduled', jsonb_build_object(
      'full_name',         NEW.full_name,
      'tpa_name',          NEW.tpa_name,
      'interview_date',    NEW.interview_date,
      'interview_time',    NEW.interview_time,
      'interview_location', NEW.interview_location
    ));
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_queue_app_email ON public.guide_applications;
CREATE TRIGGER trg_queue_app_email
  AFTER UPDATE OF status ON public.guide_applications
  FOR EACH ROW
  EXECUTE FUNCTION public.queue_application_email();