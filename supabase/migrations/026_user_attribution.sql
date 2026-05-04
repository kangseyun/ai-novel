-- ============================================================================
-- 026_user_attribution.sql
-- UTM / referrer columns on public.users so marketing attribution can link
-- channel spend (TikTok / X / YouTube / Reddit / influencer) to actual
-- LUMIN signups → Standard → PASS conversions.
--
-- The signup callback (app/auth/callback/page.tsx) writes these on the
-- 'users' insert when present; existing users have NULLs (untracked).
-- Insights surfaces "untracked" as its own bucket so we don't silently
-- attribute everything to direct.
-- ============================================================================

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS utm_source       TEXT,
  ADD COLUMN IF NOT EXISTS utm_medium       TEXT,
  ADD COLUMN IF NOT EXISTS utm_campaign     TEXT,
  ADD COLUMN IF NOT EXISTS utm_content      TEXT,
  ADD COLUMN IF NOT EXISTS utm_term         TEXT,
  ADD COLUMN IF NOT EXISTS landing_path     TEXT,
  ADD COLUMN IF NOT EXISTS first_referrer   TEXT;

CREATE INDEX IF NOT EXISTS idx_users_utm_source   ON public.users(utm_source);
CREATE INDEX IF NOT EXISTS idx_users_utm_campaign ON public.users(utm_campaign);
