-- 030: General Modules — park-agnostic prerequisite training
-- Guides/Senior Guides must complete all general modules before enrolling in any TPA track.
-- A general module can apply to specific TPAs (tpa_ids) or all TPAs (empty array = universal).

CREATE TABLE public.general_modules (
  id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  title          TEXT        NOT NULL,
  description    TEXT        NOT NULL DEFAULT '',
  content        TEXT        NOT NULL DEFAULT '',
  tpa_ids        UUID[]      NOT NULL DEFAULT '{}',
  order_index    INTEGER     NOT NULL DEFAULT 0,
  duration_hours REAL        NOT NULL DEFAULT 1,
  is_active      BOOLEAN     NOT NULL DEFAULT true,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.general_module_completions (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  module_id    UUID        NOT NULL REFERENCES public.general_modules(id) ON DELETE CASCADE,
  completed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, module_id)
);

-- RLS — general_modules
ALTER TABLE public.general_modules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read general modules"
  ON public.general_modules FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "HOD and SUPERADMIN can manage general modules"
  ON public.general_modules FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role IN ('HOD', 'SUPERADMIN')
    )
  );

-- RLS — general_module_completions
ALTER TABLE public.general_module_completions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own completions"
  ON public.general_module_completions FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users can insert own completions"
  ON public.general_module_completions FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "HOD and SUPERADMIN can read all completions"
  ON public.general_module_completions FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role IN ('HOD', 'SUPERADMIN')
    )
  );

-- Helper: returns TRUE when user has completed every general module
-- that applies to them (universal modules + modules matching their enrolled TPAs)
CREATE OR REPLACE FUNCTION public.has_completed_all_general_modules(p_user_id UUID)
RETURNS BOOLEAN AS $$
  SELECT NOT EXISTS (
    SELECT 1 FROM public.general_modules gm
    WHERE gm.is_active = true
      AND NOT EXISTS (
        SELECT 1 FROM public.general_module_completions gmc
        WHERE gmc.module_id = gm.id
          AND gmc.user_id = p_user_id
      )
  );
$$ LANGUAGE sql SECURITY DEFINER;
