-- ============================================================================
-- 023_moderation_flags.sql
-- Moderation flag queue for Hard Rules violations.
--
-- The runtime detector (lib/moderation.ts) writes a row whenever a user
-- message or AI response matches a forbidden pattern (19+, real idol names,
-- drugs/alcohol glorification, politics/religion, extreme violence).
--
-- Admins triage via /admin/moderation: ack | dismiss | escalate.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.moderation_flags (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID REFERENCES public.users(id) ON DELETE SET NULL,
  persona_id      TEXT REFERENCES public.persona_core(id) ON DELETE SET NULL,
  session_id      UUID,
  source          TEXT NOT NULL CHECK (source IN ('user_message','ai_response','scenario','other')),
  category        TEXT NOT NULL,                    -- 'sexual','real_idol','drugs','violence','politics','other'
  severity        TEXT NOT NULL DEFAULT 'medium' CHECK (severity IN ('low','medium','high','critical')),
  matched_terms   TEXT[] NOT NULL DEFAULT '{}',
  excerpt         TEXT NOT NULL,                    -- ~280 chars max, sanitized
  status          TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open','acknowledged','dismissed','escalated')),
  reviewer_id     UUID REFERENCES public.users(id) ON DELETE SET NULL,
  reviewer_note   TEXT,
  metadata        JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  reviewed_at     TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_moderation_flags_status     ON public.moderation_flags(status);
CREATE INDEX IF NOT EXISTS idx_moderation_flags_category   ON public.moderation_flags(category);
CREATE INDEX IF NOT EXISTS idx_moderation_flags_severity   ON public.moderation_flags(severity);
CREATE INDEX IF NOT EXISTS idx_moderation_flags_user_id    ON public.moderation_flags(user_id);
CREATE INDEX IF NOT EXISTS idx_moderation_flags_created_at ON public.moderation_flags(created_at DESC);

ALTER TABLE public.moderation_flags ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "moderation_flags_admin_read" ON public.moderation_flags;
CREATE POLICY "moderation_flags_admin_read" ON public.moderation_flags
  FOR SELECT TO authenticated
  USING (private.is_admin(auth.uid()));

DROP POLICY IF EXISTS "moderation_flags_admin_write" ON public.moderation_flags;
CREATE POLICY "moderation_flags_admin_write" ON public.moderation_flags
  FOR UPDATE TO authenticated
  USING (private.is_admin(auth.uid()))
  WITH CHECK (private.is_admin(auth.uid()));
