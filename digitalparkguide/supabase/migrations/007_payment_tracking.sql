-- B6.1: Add payment tracking columns to guide_track_enrollments
-- Guides must pay RM 7,800 to activate a track. No refunds on deactivation.

ALTER TABLE public.guide_track_enrollments
  ADD COLUMN IF NOT EXISTS payment_status TEXT NOT NULL DEFAULT 'unpaid'
    CHECK (payment_status IN ('unpaid', 'paid')),
  ADD COLUMN IF NOT EXISTS stripe_session_id TEXT,
  ADD COLUMN IF NOT EXISTS paid_at TIMESTAMPTZ;

-- Prevent duplicate session processing in webhook
ALTER TABLE public.guide_track_enrollments
  ADD CONSTRAINT IF NOT EXISTS unique_stripe_session UNIQUE (stripe_session_id);
