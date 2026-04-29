-- ============================================================================
-- 015_misc.sql
-- Cross-cutting infrastructure that does not belong with a single feature:
--   - error_logs (operational)
--   - admin grants on dependent helper views
--   - last-mile cleanup of policies introduced by earlier files
--
-- Consolidates legacy migrations: 018_error_logs.sql,
-- 019_performance_indexes.sql (the indexes already live alongside their
-- table definitions in the new series — the file is recorded here only
-- in the mapping table for traceability).
-- ============================================================================

-- ----------------------------------------------------------------------------
-- error_logs — async-job failure tracking
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.error_logs (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  error_type      TEXT NOT NULL,
  error_message   TEXT,
  error_stack     TEXT,
  context         JSONB NOT NULL DEFAULT '{}'::jsonb,
  resolved        BOOLEAN NOT NULL DEFAULT false,
  resolved_at     TIMESTAMPTZ,
  resolved_by     UUID REFERENCES public.users(id) ON DELETE SET NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_error_logs_type        ON public.error_logs(error_type);
CREATE INDEX IF NOT EXISTS idx_error_logs_created     ON public.error_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_error_logs_unresolved
  ON public.error_logs(resolved) WHERE resolved = false;

-- ----------------------------------------------------------------------------
-- user_persona_full_state view — convenient denormalized read
-- (uses tables defined in 003 + 008 + 005)
-- ----------------------------------------------------------------------------
CREATE OR REPLACE VIEW public.user_persona_full_state AS
SELECT
  upr.user_id,
  upr.persona_id,
  upr.affection,
  upr.relationship_stage,
  upr.trust_level,
  upr.intimacy_level,
  upr.is_unlocked,
  upr.total_messages,
  upr.first_interaction_at,
  upr.last_interaction_at,
  upr.user_nickname,
  upr.persona_nickname,
  upr.story_flags,
  ujs.total_dm_sessions,
  ujs.total_scenarios_completed,
  ujs.current_streak_days,
  ujs.max_streak_days,
  ujs.total_time_spent_minutes,
  ues.last_dm_event_at,
  ues.events_today,
  ues.consecutive_days_active,
  (SELECT COUNT(*) FROM public.persona_memories pm
    WHERE pm.user_id = upr.user_id AND pm.persona_id = upr.persona_id AND pm.is_active = true)
    AS active_memories_count,
  (SELECT COUNT(*) FROM public.relationship_milestones rm
    WHERE rm.user_id = upr.user_id AND rm.persona_id = upr.persona_id)
    AS milestones_achieved
FROM public.user_persona_relationships upr
LEFT JOIN public.user_journey_stats   ujs ON ujs.user_id = upr.user_id AND ujs.persona_id = upr.persona_id
LEFT JOIN public.user_event_state     ues ON ues.user_id = upr.user_id AND ues.persona_id = upr.persona_id;

-- ============================================================================
-- Row Level Security
-- ============================================================================
ALTER TABLE public.error_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "error_logs_admin" ON public.error_logs;
CREATE POLICY "error_logs_admin" ON public.error_logs
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.role = 'admin'));
