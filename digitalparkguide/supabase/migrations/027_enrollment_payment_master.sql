-- ================================================================
-- 027_enrollment_payment_master.sql
-- Make guide_track_enrollments the master for Stripe payment details.
-- Add amount_cents, currency, stripe_payment_intent columns.
-- ================================================================

ALTER TABLE public.guide_track_enrollments
  ADD COLUMN IF NOT EXISTS amount_cents          INT,
  ADD COLUMN IF NOT EXISTS currency              TEXT DEFAULT 'MYR',
  ADD COLUMN IF NOT EXISTS stripe_payment_intent TEXT;


-- ================================================================
NOTIFY pgrst, 'reload schema';
-- ================================================================
