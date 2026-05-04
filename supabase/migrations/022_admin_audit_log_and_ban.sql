-- ============================================================================
-- 022_admin_audit_log_and_ban.sql
-- Admin audit log + user ban support.
--
-- audit log: every admin write (token adjust, ban, refund, etc.) records who
-- did what to whom, why, and the before/after snapshot. Required for refund
-- disputes and CS handovers once PASS payments start flowing.
--
-- ban support: users.is_banned / banned_at / banned_reason. Banned users
-- still exist (so we keep history) but server middleware/policies can deny
-- access. Enforcement happens in app layer; this migration only adds the
-- columns and an admin_audit_log row schema.
-- ============================================================================

-- 1) admin_audit_log
CREATE TABLE IF NOT EXISTS public.admin_audit_log (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_user_id   UUID NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
  admin_email     TEXT NOT NULL,
  action          TEXT NOT NULL,                          -- 'token_adjust', 'ban', 'unban', 'refund', ...
  target_type     TEXT NOT NULL,                          -- 'user', 'subscription', ...
  target_id       TEXT NOT NULL,                          -- string so it works with uuid + non-uuid ids
  reason          TEXT,
  before_state    JSONB NOT NULL DEFAULT '{}'::jsonb,
  after_state     JSONB NOT NULL DEFAULT '{}'::jsonb,
  metadata        JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_admin_audit_log_admin_id   ON public.admin_audit_log(admin_user_id);
CREATE INDEX IF NOT EXISTS idx_admin_audit_log_target     ON public.admin_audit_log(target_type, target_id);
CREATE INDEX IF NOT EXISTS idx_admin_audit_log_action     ON public.admin_audit_log(action);
CREATE INDEX IF NOT EXISTS idx_admin_audit_log_created_at ON public.admin_audit_log(created_at DESC);

ALTER TABLE public.admin_audit_log ENABLE ROW LEVEL SECURITY;

-- Only admins can read; only service_role writes.
DROP POLICY IF EXISTS "admin_audit_log_admin_read" ON public.admin_audit_log;
CREATE POLICY "admin_audit_log_admin_read" ON public.admin_audit_log
  FOR SELECT TO authenticated
  USING (private.is_admin(auth.uid()));

-- 2) Ban columns on users
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS is_banned     BOOLEAN     NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS banned_at     TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS banned_reason TEXT;

CREATE INDEX IF NOT EXISTS idx_users_is_banned ON public.users(is_banned) WHERE is_banned = true;
