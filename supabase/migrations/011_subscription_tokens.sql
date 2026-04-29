-- ============================================================================
-- 011_subscription_tokens.sql
-- Stripe subscriptions, purchase history, welcome offer tracking.
-- Token operations and daily streak live in 001 (core_users) since they
-- mutate public.users directly.
--
-- Consolidates legacy migrations: 060 (welcome offer) plus the implicit
-- 'subscriptions' / 'purchases' tables referenced by webhooks/route.ts.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- subscriptions — one row per (user, active subscription)
-- LUMIN tiers: standard ($19) | lumin_pass ($99). 'free' is the absence of a row.
-- The plan_id is the Stripe lookup_key, the subscription_tier on public.users
-- is denormalized to make UI checks fast.
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.subscriptions (
  id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                     UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,

  stripe_subscription_id      TEXT UNIQUE,
  stripe_customer_id          TEXT,

  plan_id                     TEXT NOT NULL,            -- Stripe lookup_key
  status                      TEXT NOT NULL,            -- 'active','trialing','past_due','canceled',...
  current_period_start        TIMESTAMPTZ,
  current_period_end          TIMESTAMPTZ,

  cancel_at_period_end        BOOLEAN NOT NULL DEFAULT false,

  created_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id)
);

CREATE INDEX IF NOT EXISTS idx_subscriptions_user_id      ON public.subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_status       ON public.subscriptions(status);
CREATE INDEX IF NOT EXISTS idx_subscriptions_period_end   ON public.subscriptions(current_period_end);

DROP TRIGGER IF EXISTS trg_subscriptions_updated_at ON public.subscriptions;
CREATE TRIGGER trg_subscriptions_updated_at
  BEFORE UPDATE ON public.subscriptions
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ----------------------------------------------------------------------------
-- purchases — token packs, persona unlocks, subscription credit grants
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.purchases (
  id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                     UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,

  type                        TEXT NOT NULL,    -- 'token','persona','subscription_credit',…
  amount                      INTEGER NOT NULL DEFAULT 0,
  price                       NUMERIC(12,2) NOT NULL DEFAULT 0,
  currency                    TEXT NOT NULL DEFAULT 'usd',

  -- Loose persona reference for persona unlock purchases
  persona_id                  TEXT,

  metadata                    JSONB NOT NULL DEFAULT '{}'::jsonb,

  stripe_session_id           TEXT,
  stripe_payment_intent_id    TEXT,

  created_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_purchases_user_id  ON public.purchases(user_id);
CREATE INDEX IF NOT EXISTS idx_purchases_type     ON public.purchases(type);
CREATE INDEX IF NOT EXISTS idx_purchases_created  ON public.purchases(created_at DESC);

-- ----------------------------------------------------------------------------
-- welcome_offer_purchases — 24h-after-signup discounted purchases
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.welcome_offer_purchases (
  id                              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                         UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  plan_type                       VARCHAR(20) NOT NULL CHECK (plan_type IN ('monthly','yearly')),
  original_price                  INTEGER NOT NULL,    -- cents
  paid_price                      INTEGER NOT NULL,    -- cents
  discount_percent                INTEGER NOT NULL,
  bonus_credits                   INTEGER NOT NULL,
  stripe_subscription_id          VARCHAR(255),
  stripe_payment_intent_id        VARCHAR(255),
  offer_expires_at                TIMESTAMPTZ NOT NULL,
  purchased_at                    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at                      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_welcome_offer_purchases_user_id
  ON public.welcome_offer_purchases(user_id);
CREATE INDEX IF NOT EXISTS idx_welcome_offer_purchases_created_at
  ON public.welcome_offer_purchases(created_at DESC);

-- ----------------------------------------------------------------------------
-- LLM usage tracking & per-user budget (cost guardrails)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.llm_usage_records (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  model_id          TEXT NOT NULL,
  prompt_tokens     INTEGER NOT NULL DEFAULT 0,
  completion_tokens INTEGER NOT NULL DEFAULT 0,
  total_tokens      INTEGER NOT NULL DEFAULT 0,
  estimated_cost    DECIMAL(10,8) NOT NULL DEFAULT 0,    -- USD
  task_type         TEXT NOT NULL,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_llm_usage_user_id      ON public.llm_usage_records(user_id);
CREATE INDEX IF NOT EXISTS idx_llm_usage_created_at   ON public.llm_usage_records(created_at);
CREATE INDEX IF NOT EXISTS idx_llm_usage_user_created ON public.llm_usage_records(user_id, created_at);

CREATE TABLE IF NOT EXISTS public.user_llm_budgets (
  user_id                   UUID PRIMARY KEY REFERENCES public.users(id) ON DELETE CASCADE,
  monthly_budget_usd        DECIMAL(10,4) NOT NULL DEFAULT 0.50,
  daily_budget_usd          DECIMAL(10,4) NOT NULL DEFAULT 0.05,
  current_month_usage_usd   DECIMAL(10,8) NOT NULL DEFAULT 0,
  current_day_usage_usd     DECIMAL(10,8) NOT NULL DEFAULT 0,
  last_reset_date           DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at                TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at                TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

DROP TRIGGER IF EXISTS trg_user_llm_budgets_updated_at ON public.user_llm_budgets;
CREATE TRIGGER trg_user_llm_budgets_updated_at
  BEFORE UPDATE ON public.user_llm_budgets
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE OR REPLACE FUNCTION public.increment_user_usage(
  p_user_id UUID,
  p_cost    DECIMAL(10,8)
) RETURNS void
LANGUAGE plpgsql AS $$
DECLARE
  v_today           DATE := CURRENT_DATE;
  v_current_month   TEXT := TO_CHAR(CURRENT_DATE, 'YYYY-MM');
  v_last_reset_date DATE;
  v_last_reset_mon  TEXT;
BEGIN
  INSERT INTO public.user_llm_budgets (user_id, last_reset_date)
  VALUES (p_user_id, v_today)
  ON CONFLICT (user_id) DO NOTHING;

  SELECT last_reset_date INTO v_last_reset_date
    FROM public.user_llm_budgets WHERE user_id = p_user_id;
  v_last_reset_mon := TO_CHAR(v_last_reset_date, 'YYYY-MM');

  IF v_last_reset_date < v_today THEN
    UPDATE public.user_llm_budgets
       SET current_day_usage_usd   = p_cost,
           current_month_usage_usd = CASE
             WHEN v_last_reset_mon < v_current_month THEN p_cost
             ELSE current_month_usage_usd + p_cost
           END,
           last_reset_date         = v_today,
           updated_at              = NOW()
     WHERE user_id = p_user_id;
  ELSE
    UPDATE public.user_llm_budgets
       SET current_day_usage_usd   = current_day_usage_usd   + p_cost,
           current_month_usage_usd = current_month_usage_usd + p_cost,
           updated_at              = NOW()
     WHERE user_id = p_user_id;
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.cleanup_old_usage_records()
RETURNS void
LANGUAGE plpgsql AS $$
BEGIN
  DELETE FROM public.llm_usage_records WHERE created_at < NOW() - INTERVAL '90 days';
END;
$$;

CREATE OR REPLACE VIEW public.user_monthly_usage AS
SELECT
  user_id,
  DATE_TRUNC('month', created_at) AS month,
  SUM(total_tokens)               AS total_tokens,
  SUM(estimated_cost)             AS total_cost_usd,
  COUNT(*)                        AS total_calls
FROM public.llm_usage_records
GROUP BY user_id, DATE_TRUNC('month', created_at);

CREATE OR REPLACE VIEW public.user_daily_usage AS
SELECT
  user_id,
  DATE(created_at)    AS date,
  SUM(total_tokens)   AS total_tokens,
  SUM(estimated_cost) AS total_cost_usd,
  COUNT(*)            AS total_calls
FROM public.llm_usage_records
WHERE created_at >= CURRENT_DATE - INTERVAL '30 days'
GROUP BY user_id, DATE(created_at);

-- ============================================================================
-- Row Level Security
-- ============================================================================
ALTER TABLE public.subscriptions             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.purchases                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.welcome_offer_purchases   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.llm_usage_records         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_llm_budgets          ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "subscriptions_self_read" ON public.subscriptions;
CREATE POLICY "subscriptions_self_read" ON public.subscriptions
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "purchases_self_read" ON public.purchases;
CREATE POLICY "purchases_self_read" ON public.purchases
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "welcome_offer_purchases_self_read" ON public.welcome_offer_purchases;
CREATE POLICY "welcome_offer_purchases_self_read" ON public.welcome_offer_purchases
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "llm_usage_self_read" ON public.llm_usage_records;
CREATE POLICY "llm_usage_self_read" ON public.llm_usage_records
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "llm_budgets_self_read" ON public.user_llm_budgets;
CREATE POLICY "llm_budgets_self_read" ON public.user_llm_budgets
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

-- All write operations on these tables happen from the service role (Stripe
-- webhook handler etc.); no INSERT/UPDATE policies for authenticated users.
