-- ============================================================================
-- 027_influencer_crm.sql
-- Lightweight CRM for influencer seeding (STRATEGY.md channel mix: 5–10
-- creators @ $300–1000/each). Joins users.utm_campaign so attribution is
-- automatic once their links are tagged.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.influencers (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name            TEXT NOT NULL,
  handle          TEXT,                                   -- @username
  platform        TEXT NOT NULL CHECK (platform IN
                    ('tiktok','instagram','youtube','x','reddit','twitch','other')),
  tier            TEXT NOT NULL DEFAULT 'micro' CHECK (tier IN ('nano','micro','mid','macro')),
  follower_count  INTEGER,
  payout_usd      NUMERIC(10,2) NOT NULL DEFAULT 0,
  utm_campaign    TEXT UNIQUE,                            -- joins users.utm_campaign
  contact         TEXT,
  notes           TEXT,
  status          TEXT NOT NULL DEFAULT 'prospect' CHECK (status IN
                    ('prospect','active','paused','dropped','completed')),
  seeded_at       TIMESTAMPTZ,
  ended_at        TIMESTAMPTZ,
  metadata        JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_influencers_platform     ON public.influencers(platform);
CREATE INDEX IF NOT EXISTS idx_influencers_status       ON public.influencers(status);
CREATE INDEX IF NOT EXISTS idx_influencers_utm_campaign ON public.influencers(utm_campaign);

DROP TRIGGER IF EXISTS trg_influencers_updated_at ON public.influencers;
CREATE TRIGGER trg_influencers_updated_at
  BEFORE UPDATE ON public.influencers
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

ALTER TABLE public.influencers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "influencers_admin_all" ON public.influencers;
CREATE POLICY "influencers_admin_all" ON public.influencers
  FOR ALL TO authenticated
  USING (private.is_admin(auth.uid()))
  WITH CHECK (private.is_admin(auth.uid()));
