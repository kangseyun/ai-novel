-- ============================================================================
-- 001_core_users.sql
-- Core user tables: public.users (linked to auth.users), balances, inventory,
-- journey stats, activity logs, notifications, and basic settings.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- Required extensions
-- ----------------------------------------------------------------------------
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ----------------------------------------------------------------------------
-- Helper: generic updated_at trigger
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ----------------------------------------------------------------------------
-- public.users
--   - Mirrors auth.users 1:1 via id FK.
--   - Stores app-level state: tokens, subscription tier, referral, streaks,
--     onboarding flags, marketing/welcome offer flags.
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.users (
  id                          UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email                       TEXT,
  nickname                    TEXT,
  display_name                TEXT,
  profile_image               TEXT,
  avatar_url                  TEXT,
  bio                         TEXT,
  role                        TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('user', 'admin')),

  -- Currency
  tokens                      INTEGER NOT NULL DEFAULT 100,

  -- Subscription (free / standard / lumin_pass)
  subscription_tier           TEXT NOT NULL DEFAULT 'free'
                              CHECK (subscription_tier IN ('free', 'standard', 'lumin_pass')),
  is_premium                  BOOLEAN NOT NULL DEFAULT false,
  premium_expires_at          TIMESTAMPTZ,

  -- Onboarding state
  onboarding_completed        BOOLEAN NOT NULL DEFAULT false,
  initial_follows_completed   BOOLEAN NOT NULL DEFAULT false,
  preferred_target_audience   TEXT CHECK (preferred_target_audience IN ('female', 'male', 'anime')),
  first_scenario_completed    BOOLEAN NOT NULL DEFAULT false,
  current_scenario_id         TEXT,

  -- User-defined persona (for tailored responses)
  personality_type            TEXT,
  communication_style         TEXT,
  emotional_tendency          TEXT,
  interests                   TEXT[] DEFAULT '{}',
  love_language               TEXT,
  attachment_style            TEXT,

  -- Referral
  referral_code               TEXT UNIQUE,
  referred_by                 TEXT,
  referral_count              INTEGER NOT NULL DEFAULT 0,

  -- Daily streak / login
  streak_count                INTEGER NOT NULL DEFAULT 0,
  last_active_date            DATE,
  last_login_at               TIMESTAMPTZ,

  -- Welcome offer (24h post-signup)
  welcome_offer_claimed       BOOLEAN NOT NULL DEFAULT false,
  welcome_offer_claimed_at    TIMESTAMPTZ,

  -- Suggestion refresh cooldown
  last_suggestion_refresh_at  TIMESTAMPTZ,

  created_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_users_referral_code ON public.users(referral_code);
CREATE INDEX IF NOT EXISTS idx_users_subscription_tier ON public.users(subscription_tier);
CREATE INDEX IF NOT EXISTS idx_users_role ON public.users(role);
CREATE INDEX IF NOT EXISTS idx_users_last_suggestion_refresh ON public.users(last_suggestion_refresh_at);

DROP TRIGGER IF EXISTS trg_users_updated_at ON public.users;
CREATE TRIGGER trg_users_updated_at
  BEFORE UPDATE ON public.users
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Auto-create public.users row when auth.users row is created
CREATE OR REPLACE FUNCTION public.handle_new_auth_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.users (id, email, referral_code)
  VALUES (
    NEW.id,
    NEW.email,
    SUBSTRING(MD5(NEW.id::text || NOW()::text) FROM 1 FOR 8)
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_auth_user();

-- ----------------------------------------------------------------------------
-- user_balances
--   - Multi-currency virtual balances (coins, gems, hearts, …)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.user_balances (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  currency_type   TEXT NOT NULL,           -- 'coins' | 'gems' | 'hearts' | …
  balance         INTEGER NOT NULL DEFAULT 0,
  total_earned    INTEGER NOT NULL DEFAULT 0,
  total_spent     INTEGER NOT NULL DEFAULT 0,
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, currency_type)
);

CREATE INDEX IF NOT EXISTS idx_user_balances_user ON public.user_balances(user_id);

-- ----------------------------------------------------------------------------
-- user_inventory
--   - Owned items / cosmetics / unlocked content
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.user_inventory (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  item_type       TEXT NOT NULL,
  item_id         TEXT NOT NULL,
  quantity        INTEGER NOT NULL DEFAULT 1,
  acquired_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  acquired_from   TEXT,
  source_id       TEXT,
  metadata        JSONB NOT NULL DEFAULT '{}'::jsonb,
  UNIQUE (user_id, item_type, item_id)
);

CREATE INDEX IF NOT EXISTS idx_user_inventory_user ON public.user_inventory(user_id);

-- ----------------------------------------------------------------------------
-- user_journey_stats — aggregated lifetime stats per (user, persona)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.user_journey_stats (
  id                              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                         UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  persona_id                      TEXT NOT NULL,

  total_dm_sessions               INTEGER NOT NULL DEFAULT 0,
  total_dm_messages_sent          INTEGER NOT NULL DEFAULT 0,
  total_dm_messages_received      INTEGER NOT NULL DEFAULT 0,
  avg_session_length_minutes      FLOAT   NOT NULL DEFAULT 0,
  longest_session_minutes         INTEGER NOT NULL DEFAULT 0,

  total_scenarios_started         INTEGER NOT NULL DEFAULT 0,
  total_scenarios_completed       INTEGER NOT NULL DEFAULT 0,
  total_scenarios_abandoned       INTEGER NOT NULL DEFAULT 0,
  total_choices_made              INTEGER NOT NULL DEFAULT 0,
  premium_choices_made            INTEGER NOT NULL DEFAULT 0,

  total_affection_gained          INTEGER NOT NULL DEFAULT 0,
  total_affection_lost            INTEGER NOT NULL DEFAULT 0,
  max_affection_reached           INTEGER NOT NULL DEFAULT 0,
  affection_changes_count         INTEGER NOT NULL DEFAULT 0,

  total_time_spent_minutes        INTEGER NOT NULL DEFAULT 0,
  days_active                     INTEGER NOT NULL DEFAULT 0,
  current_streak_days             INTEGER NOT NULL DEFAULT 0,
  max_streak_days                 INTEGER NOT NULL DEFAULT 0,
  last_active_date                DATE,

  events_triggered                INTEGER NOT NULL DEFAULT 0,
  events_responded                INTEGER NOT NULL DEFAULT 0,

  created_at                      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at                      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, persona_id)
);

CREATE INDEX IF NOT EXISTS idx_user_journey_stats_user_persona
  ON public.user_journey_stats(user_id, persona_id);

DROP TRIGGER IF EXISTS trg_user_journey_stats_updated_at ON public.user_journey_stats;
CREATE TRIGGER trg_user_journey_stats_updated_at
  BEFORE UPDATE ON public.user_journey_stats
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ----------------------------------------------------------------------------
-- user_activity_log — generic user-level event log (UI/feature usage)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.user_activity_log (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  persona_id    TEXT,
  action_type   TEXT NOT NULL,
  action_data   JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_user_activity_log_user ON public.user_activity_log(user_id);
CREATE INDEX IF NOT EXISTS idx_user_activity_log_persona ON public.user_activity_log(user_id, persona_id);
CREATE INDEX IF NOT EXISTS idx_user_activity_log_time ON public.user_activity_log(created_at DESC);

-- ----------------------------------------------------------------------------
-- notifications — server-pushed user notifications
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.notifications (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  type        TEXT NOT NULL,
  title       TEXT,
  body        TEXT,
  metadata    JSONB NOT NULL DEFAULT '{}'::jsonb,
  is_read     BOOLEAN NOT NULL DEFAULT false,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_notifications_user ON public.notifications(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_unread ON public.notifications(user_id) WHERE is_read = false;

-- ----------------------------------------------------------------------------
-- Atomic token operations (used by checkout / referral / scenario rewards)
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.deduct_tokens(
  p_user_id UUID,
  p_amount INTEGER,
  p_min_balance INTEGER DEFAULT 0
)
RETURNS TABLE(success BOOLEAN, previous_balance INTEGER, new_balance INTEGER)
LANGUAGE plpgsql AS $$
DECLARE
  v_current INTEGER;
BEGIN
  SELECT tokens INTO v_current FROM public.users WHERE id = p_user_id FOR UPDATE;

  IF v_current IS NULL OR v_current < p_amount OR v_current - p_amount < p_min_balance THEN
    RETURN QUERY SELECT FALSE, COALESCE(v_current, 0), COALESCE(v_current, 0);
    RETURN;
  END IF;

  UPDATE public.users SET tokens = tokens - p_amount, updated_at = NOW() WHERE id = p_user_id;
  RETURN QUERY SELECT TRUE, v_current, v_current - p_amount;
END;
$$;

CREATE OR REPLACE FUNCTION public.add_tokens(
  p_user_id UUID,
  p_amount INTEGER
)
RETURNS TABLE(success BOOLEAN, previous_balance INTEGER, new_balance INTEGER)
LANGUAGE plpgsql AS $$
DECLARE
  v_current INTEGER;
BEGIN
  SELECT tokens INTO v_current FROM public.users WHERE id = p_user_id FOR UPDATE;
  IF v_current IS NULL THEN
    RETURN QUERY SELECT FALSE, 0, 0;
    RETURN;
  END IF;

  UPDATE public.users SET tokens = tokens + p_amount, updated_at = NOW() WHERE id = p_user_id;
  RETURN QUERY SELECT TRUE, v_current, v_current + p_amount;
END;
$$;

-- ----------------------------------------------------------------------------
-- Daily streak check — increments streak, resets if yesterday missed,
-- grants 50 token bonus every 7 consecutive days.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.check_daily_streak(p_user_id UUID)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_streak INTEGER;
  v_last DATE;
  v_today DATE := CURRENT_DATE;
  v_bonus INTEGER := 0;
BEGIN
  SELECT streak_count, last_active_date INTO v_streak, v_last
  FROM public.users WHERE id = p_user_id;

  IF v_last = v_today THEN
    RETURN jsonb_build_object('updated', false, 'streak', v_streak);
  END IF;

  IF v_last = v_today - 1 THEN
    v_streak := COALESCE(v_streak, 0) + 1;
  ELSE
    v_streak := 1;
  END IF;

  IF v_streak > 0 AND v_streak % 7 = 0 THEN
    v_bonus := 50;
    PERFORM public.add_tokens(p_user_id, v_bonus);
  END IF;

  UPDATE public.users
  SET streak_count = v_streak, last_active_date = v_today
  WHERE id = p_user_id;

  RETURN jsonb_build_object('updated', true, 'streak', v_streak, 'bonus', v_bonus);
END;
$$;

-- ----------------------------------------------------------------------------
-- Referral reward (atomic) — gives 50 tokens to both parties
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.claim_referral_reward(
  p_user_id UUID,
  p_code TEXT
) RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_referrer_id UUID;
  v_user_code TEXT;
  v_already_referred TEXT;
  v_reward INTEGER := 50;
BEGIN
  SELECT referral_code INTO v_user_code FROM public.users WHERE id = p_user_id;
  IF v_user_code = p_code THEN
    RETURN jsonb_build_object('success', false, 'message', 'cannot_refer_self');
  END IF;

  SELECT referred_by INTO v_already_referred FROM public.users WHERE id = p_user_id;
  IF v_already_referred IS NOT NULL THEN
    RETURN jsonb_build_object('success', false, 'message', 'already_claimed');
  END IF;

  SELECT id INTO v_referrer_id FROM public.users WHERE referral_code = p_code;
  IF v_referrer_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'message', 'invalid_code');
  END IF;

  UPDATE public.users SET referred_by = p_code WHERE id = p_user_id;
  UPDATE public.users SET referral_count = referral_count + 1 WHERE id = v_referrer_id;
  PERFORM public.add_tokens(p_user_id, v_reward);
  PERFORM public.add_tokens(v_referrer_id, v_reward);

  RETURN jsonb_build_object('success', true, 'reward_amount', v_reward, 'referrer_id', v_referrer_id);
END;
$$;

-- ----------------------------------------------------------------------------
-- Generic safe increment (used in some legacy code paths)
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.safe_increment(current_val INTEGER, increment_by INTEGER DEFAULT 1)
RETURNS INTEGER LANGUAGE plpgsql IMMUTABLE AS $$
BEGIN
  RETURN COALESCE(current_val, 0) + increment_by;
END;
$$;

-- ============================================================================
-- Row Level Security
-- ============================================================================
ALTER TABLE public.users               ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_balances       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_inventory      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_journey_stats  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_activity_log   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications       ENABLE ROW LEVEL SECURITY;

-- users: self + admin SELECT, self UPDATE
DROP POLICY IF EXISTS "users_self_select" ON public.users;
CREATE POLICY "users_self_select" ON public.users
  FOR SELECT TO authenticated
  USING (auth.uid() = id OR EXISTS (
    SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.role = 'admin'
  ));

DROP POLICY IF EXISTS "users_self_update" ON public.users;
CREATE POLICY "users_self_update" ON public.users
  FOR UPDATE TO authenticated
  USING (auth.uid() = id);

DROP POLICY IF EXISTS "users_self_insert" ON public.users;
CREATE POLICY "users_self_insert" ON public.users
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = id);

-- balances / inventory / journey_stats / activity_log / notifications: self only
DROP POLICY IF EXISTS "user_balances_self" ON public.user_balances;
CREATE POLICY "user_balances_self" ON public.user_balances
  FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "user_inventory_self" ON public.user_inventory;
CREATE POLICY "user_inventory_self" ON public.user_inventory
  FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "user_journey_stats_self" ON public.user_journey_stats;
CREATE POLICY "user_journey_stats_self" ON public.user_journey_stats
  FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "user_activity_log_self" ON public.user_activity_log;
CREATE POLICY "user_activity_log_self" ON public.user_activity_log
  FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "notifications_self" ON public.notifications;
CREATE POLICY "notifications_self" ON public.notifications
  FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
