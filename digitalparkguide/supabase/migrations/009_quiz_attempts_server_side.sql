-- ============================================================
-- Task 4/5 — quiz restructure + server-side timer.
--
-- Schema changes:
--  • quizzes.time_limit_seconds  — HoD-configurable duration
--  • quiz_attempts.started_at    — when the server issued the attempt
--  • quiz_attempts.expires_at    — started_at + time_limit_seconds
--  • quiz_attempts.submitted_at  — when the submit endpoint ran
--  • quiz_attempts.status        — in_progress / submitted / expired
--
-- The timer is now authoritative on the server: the client polls
-- expires_at and cannot gain time by hiding its tab or reloading.
--
-- RLS additions:
--  • Guides read their own attempts
--  • Senior Guides read attempts of guides in their group
--    (via guide_group_members — added in migration 008)
--  • HoD+ read everything
-- ============================================================

-- ── quizzes: optional time limit (NULL = no limit) ─────────────
ALTER TABLE public.quizzes
  ADD COLUMN IF NOT EXISTS time_limit_seconds INT;

-- Keep existing default max_attempts from migration 005 (3)
-- Enforce a sensible lower bound
ALTER TABLE public.quizzes
  ADD CONSTRAINT quizzes_max_attempts_positive
  CHECK (max_attempts IS NULL OR max_attempts >= 1);

-- Guard against silly values (5 seconds, 30 days, etc.)
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

-- Existing rows (if any) predate this schema — mark them submitted
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
-- Task 3/5: results must be visible to the leading senior for monitoring.
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
-- Used by the /api/quiz-attempts/start endpoint to avoid race
-- conditions between multiple tabs opening the same quiz.
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
        AND a.status <> 'in_progress'  -- in-progress doesn't burn an attempt yet
  WHERE q.id = p_quiz_id
  GROUP BY q.max_attempts;
$$;