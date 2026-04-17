-- Migration: Add training_modules table
-- This table stores individual training modules within training tracks

CREATE TABLE public.training_modules (
  id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  track_id       UUID        NOT NULL REFERENCES public.training_tracks(id) ON DELETE CASCADE,
  title          TEXT        NOT NULL,
  description    TEXT        NOT NULL DEFAULT '',
  content        TEXT        NOT NULL DEFAULT '',  -- module content or instructions
  order_index    INT         NOT NULL DEFAULT 0,   -- for ordering modules within a track
  duration_hours DECIMAL(4,2),                     -- estimated duration
  is_active      BOOLEAN     NOT NULL DEFAULT TRUE,
  created_by     UUID        REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Add updated_at trigger
CREATE TRIGGER training_modules_updated_at
  BEFORE UPDATE ON public.training_modules
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- RLS policies
ALTER TABLE public.training_modules ENABLE ROW LEVEL SECURITY;

-- HOD and above can manage modules
CREATE POLICY "HOD can manage training modules" ON public.training_modules
  FOR ALL USING (public.role_rank(public.current_user_role()) >= public.role_rank('HOD'));

-- Guides and above can view active modules
CREATE POLICY "Users can view active training modules" ON public.training_modules
  FOR SELECT USING (
    is_active = true AND
    public.role_rank(public.current_user_role()) >= public.role_rank('GUIDE')
  );