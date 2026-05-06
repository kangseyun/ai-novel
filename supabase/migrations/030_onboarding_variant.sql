-- ============================================================================
-- 030_onboarding_variant.sql
-- Backfill the onboarding_variant column the app already tries to write to
-- (app/api/user/onboarding/complete/route.ts:24). Without it the endpoint
-- silently drops the field and admin/onboarding/analytics has no A/B signal.
-- ============================================================================

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS onboarding_variant TEXT;

CREATE INDEX IF NOT EXISTS idx_users_onboarding_variant ON public.users(onboarding_variant);
