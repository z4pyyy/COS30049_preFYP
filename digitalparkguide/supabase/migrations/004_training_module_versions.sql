-- Migration: Add training_module_versions table
-- Stores historical snapshots of training modules for audit and rollback.

CREATE TABLE public.training_module_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  module_id UUID NOT NULL REFERENCES public.training_modules(id) ON DELETE CASCADE,
  version_number INT NOT NULL,
  change_type TEXT NOT NULL DEFAULT 'update',
  source_version_id UUID REFERENCES public.training_module_versions(id) ON DELETE SET NULL,
  track_id UUID NOT NULL REFERENCES public.training_tracks(id),
  title TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  content TEXT NOT NULL DEFAULT '',
  order_index INT NOT NULL DEFAULT 0,
  duration_hours DECIMAL(4,2),
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  edited_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  editor_name TEXT NOT NULL DEFAULT '',
  editor_role app_role NOT NULL DEFAULT 'HOD',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS training_module_versions_module_id_idx
  ON public.training_module_versions(module_id, version_number DESC);

ALTER TABLE public.training_module_versions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "HOD can select training module versions"
  ON public.training_module_versions
  FOR SELECT
  USING (public.role_rank(public.current_user_role()) >= public.role_rank('HOD'));

CREATE POLICY "HOD can insert training module versions"
  ON public.training_module_versions
  FOR INSERT
  WITH CHECK (public.role_rank(public.current_user_role()) >= public.role_rank('HOD'));

CREATE POLICY "HOD can update training module versions"
  ON public.training_module_versions
  FOR UPDATE
  USING (public.role_rank(public.current_user_role()) >= public.role_rank('HOD'));

CREATE POLICY "SUPERADMIN can delete training module versions"
  ON public.training_module_versions
  FOR DELETE
  USING (public.role_rank(public.current_user_role()) >= public.role_rank('SUPERADMIN'));
