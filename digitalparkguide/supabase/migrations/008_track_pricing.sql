-- B6.2: Per-track pricing set by HoD
-- Price stored in whole MYR; checkout route converts to sen (* 100) for Stripe.

ALTER TABLE public.training_tracks
  ADD COLUMN IF NOT EXISTS price_myr INTEGER NOT NULL DEFAULT 7800
    CHECK (price_myr > 0);
