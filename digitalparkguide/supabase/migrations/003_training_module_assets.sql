-- Migration: Add training_module_assets table
-- This table tracks uploaded media files (videos, PDFs, images) for training modules

CREATE TABLE public.training_module_assets (
  id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  module_id      UUID        NOT NULL REFERENCES public.training_modules(id) ON DELETE CASCADE,
  file_name      TEXT        NOT NULL,
  file_type      TEXT        NOT NULL,  -- 'video' | 'pdf' | 'image'
  mime_type      TEXT        NOT NULL,   -- e.g., 'video/mp4', 'application/pdf', 'image/png'
  file_size      INT         NOT NULL,   -- size in bytes
  storage_path   TEXT        NOT NULL UNIQUE,  -- path in Supabase storage
  storage_url    TEXT,                   -- public URL if bucket is public
  duration_seconds INT,                  -- for videos
  uploaded_by    UUID        REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Add updated_at trigger
CREATE TRIGGER training_module_assets_updated_at
  BEFORE UPDATE ON public.training_module_assets
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- RLS policies
ALTER TABLE public.training_module_assets ENABLE ROW LEVEL SECURITY;

-- HOD and above can manage assets
CREATE POLICY "HOD can manage training module assets" ON public.training_module_assets
  FOR ALL USING (public.role_rank(public.current_user_role()) >= public.role_rank('HOD'));

-- Guides and above can view assets for active modules
CREATE POLICY "Users can view training module assets" ON public.training_module_assets
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.training_modules
      WHERE training_modules.id = training_module_assets.module_id
      AND (
        training_modules.is_active = true OR
        public.role_rank(public.current_user_role()) >= public.role_rank('HOD')
      )
    )
    AND public.role_rank(public.current_user_role()) >= public.role_rank('GUIDE')
  );