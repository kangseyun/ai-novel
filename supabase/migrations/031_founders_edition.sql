-- Migration 031: Founders Edition foundation
-- Adds the 'founders_edition' subscription tier + atomic founders_number claim (1-100).
-- Strategy: docs/STRATEGY.md (3rd Pivot — All-Digital Hybrid).
--
-- Card system / voice letter / custom scenario tables are intentionally NOT included here.
-- Those will land in subsequent migrations alongside their feature implementations to avoid
-- premature abstraction (CLAUDE.md: don't add features beyond what the task requires).

BEGIN;

-- 1. Extend users.subscription_tier CHECK constraint
ALTER TABLE public.users DROP CONSTRAINT IF EXISTS users_subscription_tier_check;
ALTER TABLE public.users ADD CONSTRAINT users_subscription_tier_check
  CHECK (subscription_tier IN ('free', 'standard', 'lumin_pass', 'founders_edition'));

-- 2. founders_number column (1-100, unique, sparse)
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS founders_number INT;

ALTER TABLE public.users DROP CONSTRAINT IF EXISTS users_founders_number_range;
ALTER TABLE public.users ADD CONSTRAINT users_founders_number_range
  CHECK (founders_number IS NULL OR (founders_number BETWEEN 1 AND 100));

CREATE UNIQUE INDEX IF NOT EXISTS idx_users_founders_number
  ON public.users(founders_number)
  WHERE founders_number IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_users_subscription_tier_founders
  ON public.users(subscription_tier)
  WHERE subscription_tier = 'founders_edition';

-- 3. Atomic claim function — assigns the lowest unclaimed number to a user.
-- Uses an advisory lock to serialize concurrent claims at the webhook layer.
CREATE OR REPLACE FUNCTION public.claim_founders_number(p_user_id UUID)
RETURNS INT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_existing INT;
  v_next INT;
BEGIN
  -- If this user already has a number, return it (idempotent for webhook retries).
  SELECT founders_number INTO v_existing FROM public.users WHERE id = p_user_id;
  IF v_existing IS NOT NULL THEN
    RETURN v_existing;
  END IF;

  -- Serialize concurrent claims so two webhooks can't grab the same number.
  PERFORM pg_advisory_xact_lock(hashtext('founders_number_claim'));

  SELECT MIN(n) INTO v_next
  FROM generate_series(1, 100) AS n
  WHERE NOT EXISTS (
    SELECT 1 FROM public.users WHERE founders_number = n
  );

  IF v_next IS NULL THEN
    RAISE EXCEPTION 'All Founders Edition slots (1-100) are claimed' USING ERRCODE = 'P0001';
  END IF;

  UPDATE public.users
     SET founders_number = v_next,
         subscription_tier = 'founders_edition',
         is_premium = true,
         premium_expires_at = NOW() + INTERVAL '365 days'
   WHERE id = p_user_id;

  RETURN v_next;
END;
$$;

-- Lock down — only service_role (webhook) may execute.
REVOKE ALL ON FUNCTION public.claim_founders_number(UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_founders_number(UUID) TO service_role;

COMMENT ON FUNCTION public.claim_founders_number(UUID) IS
  'Atomically claim the next available Founders Edition number (1-100) for a user. ' ||
  'Idempotent: returns existing number if already claimed. ' ||
  'Sets subscription_tier=founders_edition, is_premium=true, premium_expires_at=NOW+365d. ' ||
  'Webhook-only (service_role).';

COMMIT;
