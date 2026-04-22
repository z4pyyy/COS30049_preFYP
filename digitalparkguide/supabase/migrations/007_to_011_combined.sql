-- ================================================================
-- COMBINED MIGRATION 007 → 011
-- ================================================================
-- Bundles the following feature migrations into a single file so
-- they can be applied in one shot in the Supabase SQL Editor:
--
--   007_dashboard_progress_analytics.sql
--   008_guide_groups.sql
--   009_quiz_attempts_server_side.sql
--   010_guide_applications.sql
--   011_application_docs_retention.sql
--
-- Order matters. 008 defines a function (pick_least_loaded_senior)
-- that references public.guide_applications — the table is created
-- in 010. plpgsql defers name resolution to call time, so creation
-- in this order is safe, and the auto-assign trigger only fires
-- after 010 has run within this same script.
-- ================================================================


-- ================================================================
-- 007 — DASHBOARD PROGRESS ANALYTICS
-- ================================================================
-- Adds a view that rolls up per-guide training progress so the
-- HoD dashboard can show aggregates without hammering the client
-- with N+1 queries.
--
-- Consumed by:
--   /api/training-progress/me        (guide's own rows)
--   /api/training-progress/summary   (HoD aggregate)
-- ================================================================

-- Drop & recreate so reruns stay clean
DROP VIEW IF EXISTS public.guide_progress_summary CASCADE;

-- One row per (guide, track) combo. Only counts non-archived active
-- modules — an archived module shouldn't lower anyone's completion %.
CREATE VIEW public.guide_progress_summary
WITH (security_invoker = true)  -- honour caller's RLS, not the view owner's
AS
SELECT
  e.guide_id,
  e.track_id,
  t.title            AS track_title,
  t.tpa_name,
  t.track_type,
  p.full_name        AS guide_name,
  -- total active modules in the track
  COUNT(m.id)                                              AS total_modules,
  -- modules the guide has completed
  COUNT(gmp.id) FILTER (WHERE gmp.completed = TRUE)        AS completed_modules,
  -- modules touched but not finished
  COUNT(gmp.id) FILTER (
    WHERE gmp.completed = FALSE
      AND array_length(gmp.assets_consumed, 1) > 0
  )                                                        AS in_progress_modules,
  -- percent complete, clamped to 0 when track has no modules yet
  CASE
    WHEN COUNT(m.id) = 0 THEN 0
    ELSE ROUND(
      (COUNT(gmp.id) FILTER (WHERE gmp.completed = TRUE)::numeric
       / COUNT(m.id)::numeric) * 100
    )
  END                                                      AS completion_pct,
  MAX(gmp.last_accessed_at)                                AS last_activity_at,
  e.status                                                 AS enrollment_status
FROM public.guide_track_enrollments e
JOIN public.training_tracks t   ON t.id = e.track_id
JOIN public.profiles p          ON p.id = e.guide_id
LEFT JOIN public.training_modules m
       ON m.track_id = e.track_id
      AND m.is_active   = TRUE
      AND m.is_archived = FALSE
LEFT JOIN public.guide_module_progress gmp
       ON gmp.module_id = m.id
      AND gmp.guide_id  = e.guide_id
WHERE t.is_archived = FALSE
GROUP BY e.guide_id, e.track_id, t.title, t.tpa_name,
         t.track_type, p.full_name, e.status;

COMMENT ON VIEW public.guide_progress_summary IS
  'Per-guide/per-track rollup of module progress. RLS is inherited from '
  'guide_track_enrollments + guide_module_progress (security_invoker).';

-- Give authenticated users SELECT — the underlying table RLS still decides
-- which rows they actually see.
GRANT SELECT ON public.guide_progress_summary TO authenticated;


-- ================================================================
-- 008 — GUIDE GROUPS
-- ================================================================
-- Model:
--   * One Senior Guide can lead many Guides within a single TPA.
--   * A Guide belongs to AT MOST ONE Senior at a time.
--   * When a new guide is approved (profile.role flips to GUIDE),
--     the trigger assigns them to whichever Senior in the same TPA
--     currently has the FEWEST active guides (balanced load).
--   * HoD can manually reassign via the API in this reply.
-- ================================================================

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

DROP POLICY IF EXISTS "ggm: senior reads own group" ON public.guide_group_members;
DROP POLICY IF EXISTS "ggm: guide reads own row"    ON public.guide_group_members;
DROP POLICY IF EXISTS "ggm: hod+ full access"       ON public.guide_group_members;

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


-- ================================================================
-- 009 — QUIZ ATTEMPTS (SERVER-SIDE TIMER + RLS)
-- ================================================================

-- ── quizzes: optional time limit (NULL = no limit) ─────────────
ALTER TABLE public.quizzes
  ADD COLUMN IF NOT EXISTS time_limit_seconds INT;

-- Keep existing default max_attempts from migration 005 (3)
-- Enforce a sensible lower bound
ALTER TABLE public.quizzes
  DROP CONSTRAINT IF EXISTS quizzes_max_attempts_positive;
ALTER TABLE public.quizzes
  ADD CONSTRAINT quizzes_max_attempts_positive
  CHECK (max_attempts IS NULL OR max_attempts >= 1);

-- Guard against silly values
ALTER TABLE public.quizzes
  DROP CONSTRAINT IF EXISTS quizzes_time_limit_reasonable;
ALTER TABLE public.quizzes
  ADD CONSTRAINT quizzes_time_limit_reasonable
  CHECK (time_limit_seconds IS NULL OR (time_limit_seconds BETWEEN 60 AND 14400));


-- ── quiz_attempts: server-authoritative timer fields ─────────
ALTER TABLE public.quiz_attempts
  ADD COLUMN IF NOT EXISTS started_at   TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE public.quiz_attempts
  ADD COLUMN IF NOT EXISTS expires_at   TIMESTAMPTZ;
ALTER TABLE public.quiz_attempts
  ADD COLUMN IF NOT EXISTS submitted_at TIMESTAMPTZ;
ALTER TABLE public.quiz_attempts
  ADD COLUMN IF NOT EXISTS status       TEXT DEFAULT 'submitted'
    CHECK (status IN ('in_progress', 'submitted', 'expired'));

UPDATE public.quiz_attempts
SET status = 'submitted'
WHERE status IS NULL;


-- ── RLS on quiz_attempts ─────────────────────────────────────
ALTER TABLE public.quiz_attempts ENABLE ROW LEVEL SECURITY;

-- Clear any previous ad-hoc policies so this migration is idempotent
DROP POLICY IF EXISTS "qa: own read"        ON public.quiz_attempts;
DROP POLICY IF EXISTS "qa: own insert"      ON public.quiz_attempts;
DROP POLICY IF EXISTS "qa: own update"      ON public.quiz_attempts;
DROP POLICY IF EXISTS "qa: senior read"     ON public.quiz_attempts;
DROP POLICY IF EXISTS "qa: hod+ read"       ON public.quiz_attempts;

-- Guide reads their own attempts
CREATE POLICY "qa: own read"
  ON public.quiz_attempts FOR SELECT
  USING (auth.uid() = user_id);

-- Guide inserts only their own attempt rows (start endpoint uses
-- the user's own auth, so user_id must match)
CREATE POLICY "qa: own insert"
  ON public.quiz_attempts FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Guide updates only their own attempts (used by submit endpoint)
CREATE POLICY "qa: own update"
  ON public.quiz_attempts FOR UPDATE
  USING  (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Senior Guide reads attempts of guides in their group.
CREATE POLICY "qa: senior read"
  ON public.quiz_attempts FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM public.guide_group_members m
      WHERE m.senior_guide_id = auth.uid()
        AND m.guide_id        = public.quiz_attempts.user_id
    )
  );

-- HoD+ reads everything (for the quiz-result dashboard)
CREATE POLICY "qa: hod+ read"
  ON public.quiz_attempts FOR SELECT
  USING (public.role_rank(public.current_user_role()) >= public.role_rank('HOD'));


-- ── Helper: do we still have attempts left? ──────────────────
CREATE OR REPLACE FUNCTION public.remaining_quiz_attempts(p_quiz_id UUID, p_user UUID)
RETURNS INT
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE AS $$
  SELECT GREATEST(
    COALESCE(q.max_attempts, 3) - COUNT(a.id)::int,
    0
  )
  FROM public.quizzes q
  LEFT JOIN public.quiz_attempts a
         ON a.quiz_id = q.id
        AND a.user_id = p_user
        AND a.status <> 'in_progress'
  WHERE q.id = p_quiz_id
  GROUP BY q.max_attempts;
$$;


-- ================================================================
-- 010 — GUIDE APPLICATIONS
-- ================================================================

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

-- Backfill columns for any pre-existing table (CREATE TABLE IF NOT EXISTS
-- above is a no-op if the table was partially created by an earlier run).
ALTER TABLE public.guide_applications
  ADD COLUMN IF NOT EXISTS applicant_id   UUID REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE public.guide_applications
  ADD COLUMN IF NOT EXISTS full_name      TEXT;
ALTER TABLE public.guide_applications
  ADD COLUMN IF NOT EXISTS email          TEXT;
ALTER TABLE public.guide_applications
  ADD COLUMN IF NOT EXISTS phone          TEXT;
ALTER TABLE public.guide_applications
  ADD COLUMN IF NOT EXISTS tpa_name       TEXT;
ALTER TABLE public.guide_applications
  ADD COLUMN IF NOT EXISTS track_id       UUID REFERENCES public.training_tracks(id) ON DELETE SET NULL;
ALTER TABLE public.guide_applications
  ADD COLUMN IF NOT EXISTS motivation     TEXT NOT NULL DEFAULT '';
ALTER TABLE public.guide_applications
  ADD COLUMN IF NOT EXISTS experience     TEXT NOT NULL DEFAULT '';
ALTER TABLE public.guide_applications
  ADD COLUMN IF NOT EXISTS status         TEXT NOT NULL DEFAULT 'PENDING';
ALTER TABLE public.guide_applications
  ADD COLUMN IF NOT EXISTS reviewer_notes TEXT NOT NULL DEFAULT '';
ALTER TABLE public.guide_applications
  ADD COLUMN IF NOT EXISTS submitted_at   TIMESTAMPTZ NOT NULL DEFAULT NOW();
ALTER TABLE public.guide_applications
  ADD COLUMN IF NOT EXISTS reviewed_at    TIMESTAMPTZ;
ALTER TABLE public.guide_applications
  ADD COLUMN IF NOT EXISTS reviewed_by    UUID REFERENCES auth.users(id) ON DELETE SET NULL;

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

DROP POLICY IF EXISTS "email_notifications: hod+ read" ON public.email_notifications;

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


-- ================================================================
-- 011 — APPLICATION DOCS + RETENTION
-- ================================================================

-- ── Doc metadata table ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.guide_application_documents (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id  UUID        NOT NULL REFERENCES public.guide_applications(id) ON DELETE CASCADE,
  storage_path    TEXT        NOT NULL,
  file_name       TEXT        NOT NULL,
  mime_type       TEXT        NOT NULL,
  file_size       BIGINT      NOT NULL,
  uploaded_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  uploaded_by     UUID        REFERENCES auth.users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_gad_app ON public.guide_application_documents(application_id);

ALTER TABLE public.guide_application_documents ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "gad: applicant read own"   ON public.guide_application_documents;
DROP POLICY IF EXISTS "gad: applicant insert own" ON public.guide_application_documents;
DROP POLICY IF EXISTS "gad: hod+ read all"        ON public.guide_application_documents;
DROP POLICY IF EXISTS "gad: hod+ delete"          ON public.guide_application_documents;

-- Applicants can read/write docs only for their own application
CREATE POLICY "gad: applicant read own"
  ON public.guide_application_documents FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.guide_applications a
      WHERE a.id = application_id AND a.applicant_id = auth.uid()
    )
  );

CREATE POLICY "gad: applicant insert own"
  ON public.guide_application_documents FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.guide_applications a
      WHERE a.id = application_id AND a.applicant_id = auth.uid()
    )
  );

CREATE POLICY "gad: hod+ read all"
  ON public.guide_application_documents FOR SELECT
  USING (public.role_rank(public.current_user_role()) >= public.role_rank('HOD'));

CREATE POLICY "gad: hod+ delete"
  ON public.guide_application_documents FOR DELETE
  USING (public.role_rank(public.current_user_role()) >= public.role_rank('HOD'));

CREATE OR REPLACE FUNCTION public.bump_application_doc_count()
RETURNS TRIGGER
LANGUAGE plpgsql
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

DROP TRIGGER IF EXISTS trg_bump_doc_count ON public.guide_application_documents;
CREATE TRIGGER trg_bump_doc_count
  AFTER INSERT OR DELETE ON public.guide_application_documents
  FOR EACH ROW
  EXECUTE FUNCTION public.bump_application_doc_count();


-- ── Storage bucket ────────────────────────────────────────────
INSERT INTO storage.buckets (id, name, public)
VALUES ('application-documents', 'application-documents', false)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "app-docs: applicant upload"  ON storage.objects;
DROP POLICY IF EXISTS "app-docs: applicant read"    ON storage.objects;
DROP POLICY IF EXISTS "app-docs: hod+ read"         ON storage.objects;
DROP POLICY IF EXISTS "app-docs: hod+ delete"       ON storage.objects;

CREATE POLICY "app-docs: applicant upload"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'application-documents'
    AND EXISTS (
      SELECT 1 FROM public.guide_applications a
      WHERE a.id::text = split_part(name, '/', 1)
        AND a.applicant_id = auth.uid()
    )
  );

CREATE POLICY "app-docs: applicant read"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'application-documents'
    AND EXISTS (
      SELECT 1 FROM public.guide_applications a
      WHERE a.id::text = split_part(name, '/', 1)
        AND a.applicant_id = auth.uid()
    )
  );

CREATE POLICY "app-docs: hod+ read"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'application-documents'
    AND public.role_rank(public.current_user_role()) >= public.role_rank('HOD')
  );

CREATE POLICY "app-docs: hod+ delete"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'application-documents'
    AND public.role_rank(public.current_user_role()) >= public.role_rank('HOD')
  );


-- ── 30-day retention cleanup ──────────────────────────────────
CREATE OR REPLACE FUNCTION public.purge_old_application_documents()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_doc RECORD;
BEGIN
  FOR v_doc IN
    SELECT d.id, d.storage_path
    FROM public.guide_application_documents d
    JOIN public.guide_applications a ON a.id = d.application_id
    WHERE a.status IN ('APPROVED', 'REJECTED')
      AND a.reviewed_at IS NOT NULL
      AND a.reviewed_at < NOW() - INTERVAL '30 days'
  LOOP
    -- Remove storage object first; the metadata row follows
    DELETE FROM storage.objects
     WHERE bucket_id = 'application-documents'
       AND name = v_doc.storage_path;

    DELETE FROM public.guide_application_documents
     WHERE id = v_doc.id;
  END LOOP;
END;
$$;

-- ── Schedule via pg_cron (Supabase extension) ─────────────────
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    -- Remove any previous schedule so this migration is idempotent
    IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'purge_old_application_docs') THEN
      PERFORM cron.unschedule('purge_old_application_docs');
    END IF;
    PERFORM cron.schedule(
      'purge_old_application_docs',
      '0 19 * * *',  -- 19:00 UTC daily == 03:00 MYT (UTC+8)
      $cron$SELECT public.purge_old_application_documents();$cron$
    );
  ELSE
    RAISE NOTICE 'pg_cron not enabled — schedule purge_old_application_documents manually or enable pg_cron.';
  END IF;
END $$;


-- ================================================================
-- Tell PostgREST (Supabase's REST layer) to reload its cached schema
-- so newly-added columns are visible to the JS client immediately.
-- ================================================================
NOTIFY pgrst, 'reload schema';
