-- 031: General Module Enrollments & Per-Track Prerequisites
-- Adds paid enrollment for general modules, per-track prerequisite mapping,
-- and replaces blanket prereq check with per-track function.

-- ═══════════════════════════════════════════════════════════════
-- 1. Add price to general_modules
-- ═══════════════════════════════════════════════════════════════
ALTER TABLE public.general_modules
  ADD COLUMN IF NOT EXISTS price_myr REAL NOT NULL DEFAULT 0;

-- ═══════════════════════════════════════════════════════════════
-- 2. General module enrollments (payment tracking)
-- ═══════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.general_module_enrollments (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  guide_id          UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  module_id         UUID        NOT NULL REFERENCES public.general_modules(id) ON DELETE CASCADE,
  status            TEXT        NOT NULL DEFAULT 'active'
                    CHECK (status IN ('active','cancelled')),
  payment_status    TEXT        NOT NULL DEFAULT 'pending'
                    CHECK (payment_status IN ('pending','paid')),
  stripe_session_id TEXT,
  paid_at           TIMESTAMPTZ,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(guide_id, module_id)
);

-- RLS
ALTER TABLE public.general_module_enrollments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Guides read own GM enrollments"
  ON public.general_module_enrollments FOR SELECT
  TO authenticated
  USING (guide_id = auth.uid());

CREATE POLICY "Guides insert own GM enrollments"
  ON public.general_module_enrollments FOR INSERT
  TO authenticated
  WITH CHECK (guide_id = auth.uid());

CREATE POLICY "HOD and SUPERADMIN read all GM enrollments"
  ON public.general_module_enrollments FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role IN ('HOD', 'SUPERADMIN')
    )
  );

CREATE POLICY "HOD and SUPERADMIN manage GM enrollments"
  ON public.general_module_enrollments FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role IN ('HOD', 'SUPERADMIN')
    )
  );

-- ═══════════════════════════════════════════════════════════════
-- 3. Per-track prerequisite GM IDs on training_tracks
-- ═══════════════════════════════════════════════════════════════
ALTER TABLE public.training_tracks
  ADD COLUMN IF NOT EXISTS prerequisite_gm_ids UUID[] NOT NULL DEFAULT '{}';

-- ═══════════════════════════════════════════════════════════════
-- 4. Per-track prerequisite check function
-- ═══════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.has_track_prerequisites_met(
  p_user_id UUID, p_track_id UUID
) RETURNS BOOLEAN AS $$
  SELECT NOT EXISTS (
    SELECT 1
    FROM unnest(
      (SELECT prerequisite_gm_ids FROM public.training_tracks WHERE id = p_track_id)
    ) AS required_gm_id
    WHERE NOT EXISTS (
      SELECT 1 FROM public.general_module_completions gmc
      WHERE gmc.module_id = required_gm_id
        AND gmc.user_id = p_user_id
    )
  );
$$ LANGUAGE sql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.has_track_prerequisites_met(UUID, UUID) TO authenticated;

-- ═══════════════════════════════════════════════════════════════
-- 5. Add general_module_id to quizzes (nullable, for GM quizzes)
-- ═══════════════════════════════════════════════════════════════
ALTER TABLE public.quizzes
  ADD COLUMN IF NOT EXISTS general_module_id UUID REFERENCES public.general_modules(id) ON DELETE CASCADE;

-- Allow module_id to be NULL when general_module_id is set
ALTER TABLE public.quizzes ALTER COLUMN module_id DROP NOT NULL;

-- Ensure exactly one of module_id or general_module_id is set
ALTER TABLE public.quizzes
  ADD CONSTRAINT quizzes_module_xor_gm
  CHECK (
    (module_id IS NOT NULL AND general_module_id IS NULL) OR
    (module_id IS NULL AND general_module_id IS NOT NULL)
  );

-- One quiz per general module
CREATE UNIQUE INDEX IF NOT EXISTS quizzes_general_module_id_unique
  ON public.quizzes(general_module_id) WHERE general_module_id IS NOT NULL;

-- ═══════════════════════════════════════════════════════════════
-- 6. Trigger: on quiz pass for GM quiz, insert general_module_completions
-- ═══════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.fn_gm_quiz_completion()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_gm_id UUID;
BEGIN
  IF NEW.passed IS NOT TRUE THEN RETURN NEW; END IF;

  SELECT q.general_module_id INTO v_gm_id
  FROM public.quizzes q WHERE q.id = NEW.quiz_id;

  IF v_gm_id IS NULL THEN RETURN NEW; END IF;

  INSERT INTO public.general_module_completions (user_id, module_id)
  VALUES (NEW.user_id, v_gm_id)
  ON CONFLICT (user_id, module_id) DO NOTHING;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_gm_quiz_completion
  AFTER INSERT OR UPDATE ON public.quiz_attempts
  FOR EACH ROW EXECUTE FUNCTION public.fn_gm_quiz_completion();
