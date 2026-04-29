-- ============================================================================
-- 008_events.sql
-- Event trigger system + emotional state tracking + conflict cooldown.
-- Uses public.users / public.persona_core defined earlier.
--
-- Consolidates legacy migrations: 014 (event_trigger_rules + scheduled_events
-- + logs + user_event_state), 020 (emotional_states + conflict_records),
-- 054 (action_type / scenario_config + user_trigger_history + RPCs).
-- ============================================================================

-- ----------------------------------------------------------------------------
-- event_trigger_rules — content-team-defined triggers
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.event_trigger_rules (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  persona_id              TEXT,    -- nullable: a NULL rule applies globally

  name                    TEXT NOT NULL,
  description             TEXT,

  event_type              TEXT NOT NULL CHECK (event_type IN (
                            'dm_message','feed_post','story_update',
                            'special_event','notification','scenario_trigger'
                          )),

  -- v2: action vs event distinction
  action_type             TEXT NOT NULL DEFAULT 'dm_message'
                          CHECK (action_type IN (
                            'dm_message','feed_post','start_scenario',
                            'unlock_content','grant_reward','update_relationship'
                          )),

  conditions              JSONB NOT NULL DEFAULT '{}'::jsonb,
  base_probability        FLOAT  NOT NULL DEFAULT 0.3,
  probability_modifiers   JSONB NOT NULL DEFAULT '{}'::jsonb,
  event_template          JSONB NOT NULL DEFAULT '{}'::jsonb,
  scenario_config         JSONB,

  cooldown_hours          INTEGER NOT NULL DEFAULT 24,
  priority                INTEGER NOT NULL DEFAULT 0,

  is_active               BOOLEAN NOT NULL DEFAULT true,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_event_trigger_rules_persona  ON public.event_trigger_rules(persona_id);
CREATE INDEX IF NOT EXISTS idx_event_trigger_rules_type     ON public.event_trigger_rules(event_type);
CREATE INDEX IF NOT EXISTS idx_event_trigger_rules_active   ON public.event_trigger_rules(is_active);

DROP TRIGGER IF EXISTS trg_event_trigger_rules_updated_at ON public.event_trigger_rules;
CREATE TRIGGER trg_event_trigger_rules_updated_at
  BEFORE UPDATE ON public.event_trigger_rules
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Now that the table exists, hook the FK from dynamic_scenario_templates (007).
DO $$ BEGIN
  ALTER TABLE public.dynamic_scenario_templates
    ADD CONSTRAINT dynamic_scenario_templates_trigger_rule_fkey
    FOREIGN KEY (trigger_rule_id)
    REFERENCES public.event_trigger_rules(id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ----------------------------------------------------------------------------
-- scheduled_events — per-user materialized events queued for delivery
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.scheduled_events (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id               UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  persona_id            TEXT NOT NULL,
  trigger_rule_id       UUID REFERENCES public.event_trigger_rules(id) ON DELETE SET NULL,
  event_type            TEXT NOT NULL,
  event_data            JSONB NOT NULL DEFAULT '{}'::jsonb,
  scheduled_for         TIMESTAMPTZ NOT NULL,
  status                TEXT NOT NULL DEFAULT 'pending'
                        CHECK (status IN ('pending','delivered','cancelled','expired')),
  delivery_conditions   JSONB NOT NULL DEFAULT '{}'::jsonb,
  delivered_at          TIMESTAMPTZ,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_scheduled_events_user_persona
  ON public.scheduled_events(user_id, persona_id);
CREATE INDEX IF NOT EXISTS idx_scheduled_events_status
  ON public.scheduled_events(status);
CREATE INDEX IF NOT EXISTS idx_scheduled_events_scheduled_for
  ON public.scheduled_events(scheduled_for);
CREATE INDEX IF NOT EXISTS idx_scheduled_events_pending
  ON public.scheduled_events(status, scheduled_for) WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS idx_scheduled_events_user_persona_status
  ON public.scheduled_events(user_id, persona_id, status);

-- ----------------------------------------------------------------------------
-- event_trigger_logs — analytics for trigger evaluation
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.event_trigger_logs (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                 UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  persona_id              TEXT NOT NULL,
  trigger_rule_id         UUID REFERENCES public.event_trigger_rules(id) ON DELETE SET NULL,
  event_type              TEXT NOT NULL,
  user_state_snapshot     JSONB NOT NULL DEFAULT '{}'::jsonb,
  calculated_probability  FLOAT,
  random_value            FLOAT,
  was_triggered           BOOLEAN NOT NULL,
  result_event_id         UUID REFERENCES public.scheduled_events(id) ON DELETE SET NULL,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_event_trigger_logs_user_persona
  ON public.event_trigger_logs(user_id, persona_id);
CREATE INDEX IF NOT EXISTS idx_event_trigger_logs_time
  ON public.event_trigger_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_event_trigger_logs_user_time
  ON public.event_trigger_logs(user_id, persona_id, created_at DESC);

-- ----------------------------------------------------------------------------
-- user_event_state — last event time per (user, persona)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.user_event_state (
  id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                     UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  persona_id                  TEXT NOT NULL,
  last_dm_event_at            TIMESTAMPTZ,
  last_feed_event_at          TIMESTAMPTZ,
  last_story_event_at         TIMESTAMPTZ,
  last_notification_at        TIMESTAMPTZ,
  events_today                INTEGER NOT NULL DEFAULT 0,
  events_today_reset_at       DATE NOT NULL DEFAULT CURRENT_DATE,
  consecutive_days_active     INTEGER NOT NULL DEFAULT 0,
  last_active_date            DATE,
  created_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, persona_id)
);

CREATE INDEX IF NOT EXISTS idx_user_event_state_user_persona
  ON public.user_event_state(user_id, persona_id);

DROP TRIGGER IF EXISTS trg_user_event_state_updated_at ON public.user_event_state;
CREATE TRIGGER trg_user_event_state_updated_at
  BEFORE UPDATE ON public.user_event_state
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE OR REPLACE FUNCTION public.increment_events_today(
  p_user_id UUID, p_persona_id TEXT
) RETURNS void
LANGUAGE plpgsql AS $$
BEGIN
  UPDATE public.user_event_state
     SET events_today = CASE
                          WHEN events_today_reset_at = CURRENT_DATE THEN events_today + 1
                          ELSE 1
                        END,
         events_today_reset_at = CURRENT_DATE,
         updated_at            = NOW()
   WHERE user_id = p_user_id AND persona_id = p_persona_id;

  IF NOT FOUND THEN
    INSERT INTO public.user_event_state (user_id, persona_id, events_today, events_today_reset_at)
    VALUES (p_user_id, p_persona_id, 1, CURRENT_DATE);
  END IF;
END;
$$;

-- ----------------------------------------------------------------------------
-- user_trigger_history — every actual trigger firing (audit + cooldowns)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.user_trigger_history (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  trigger_rule_id UUID NOT NULL REFERENCES public.event_trigger_rules(id) ON DELETE CASCADE,
  persona_id      TEXT,
  triggered_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  context         JSONB NOT NULL DEFAULT '{}'::jsonb,
  action_type     TEXT NOT NULL,
  action_result   JSONB NOT NULL DEFAULT '{}'::jsonb,
  success         BOOLEAN NOT NULL DEFAULT true,
  error_message   TEXT
);

CREATE INDEX IF NOT EXISTS idx_user_trigger_history_user
  ON public.user_trigger_history(user_id);
CREATE INDEX IF NOT EXISTS idx_user_trigger_history_trigger
  ON public.user_trigger_history(trigger_rule_id);
CREATE INDEX IF NOT EXISTS idx_user_trigger_history_triggered_at
  ON public.user_trigger_history(triggered_at);

-- ----------------------------------------------------------------------------
-- Trigger evaluation RPCs
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.evaluate_trigger_conditions(
  p_trigger_id UUID,
  p_user_id    UUID,
  p_persona_id TEXT,
  p_context    JSONB
) RETURNS BOOLEAN
LANGUAGE plpgsql STABLE AS $$
DECLARE
  v_rule           RECORD;
  v_conditions     JSONB;
  v_last_triggered TIMESTAMPTZ;
BEGIN
  SELECT * INTO v_rule FROM public.event_trigger_rules
   WHERE id = p_trigger_id AND is_active = true;
  IF NOT FOUND THEN RETURN false; END IF;

  v_conditions := v_rule.conditions;

  SELECT triggered_at INTO v_last_triggered
    FROM public.user_trigger_history
   WHERE user_id = p_user_id AND trigger_rule_id = p_trigger_id
   ORDER BY triggered_at DESC LIMIT 1;

  IF v_last_triggered IS NOT NULL AND
     v_last_triggered > NOW() - (v_rule.cooldown_hours || ' hours')::INTERVAL THEN
    RETURN false;
  END IF;

  IF v_conditions ? 'minAffection' AND
     (p_context->>'affection')::INT < (v_conditions->>'minAffection')::INT THEN
    RETURN false;
  END IF;

  IF v_conditions ? 'maxAffection' AND
     (p_context->>'affection')::INT > (v_conditions->>'maxAffection')::INT THEN
    RETURN false;
  END IF;

  IF v_conditions ? 'relationshipStage' THEN
    IF NOT (p_context->>'relationship_stage') = ANY (
      SELECT jsonb_array_elements_text(v_conditions->'relationshipStage')
    ) THEN
      RETURN false;
    END IF;
  END IF;

  IF v_conditions ? 'hoursSinceLastActivity' THEN
    IF v_conditions->'hoursSinceLastActivity' ? 'min' AND
       (p_context->>'hours_since_last_activity')::INT <
       (v_conditions->'hoursSinceLastActivity'->>'min')::INT THEN
      RETURN false;
    END IF;
    IF v_conditions->'hoursSinceLastActivity' ? 'max' AND
       (p_context->>'hours_since_last_activity')::INT >
       (v_conditions->'hoursSinceLastActivity'->>'max')::INT THEN
      RETURN false;
    END IF;
  END IF;

  RETURN true;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_active_triggers_for_context(
  p_user_id    UUID,
  p_persona_id TEXT,
  p_context    JSONB
) RETURNS TABLE (
  trigger_id      UUID,
  trigger_name    TEXT,
  action_type     TEXT,
  priority        INTEGER,
  scenario_config JSONB
)
LANGUAGE plpgsql STABLE AS $$
BEGIN
  RETURN QUERY
  SELECT etr.id, etr.name, etr.action_type, etr.priority, etr.scenario_config
    FROM public.event_trigger_rules etr
   WHERE etr.is_active = true
     AND (etr.persona_id = p_persona_id OR etr.persona_id IS NULL)
     AND public.evaluate_trigger_conditions(etr.id, p_user_id, p_persona_id, p_context)
   ORDER BY etr.priority DESC;
END;
$$;

-- ============================================================================
-- Emotional state tracking & conflict cooldown
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.emotional_states (
  id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                     UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  persona_id                  TEXT NOT NULL REFERENCES public.persona_core(id) ON DELETE CASCADE,

  mood                        VARCHAR(20) NOT NULL DEFAULT 'neutral',
  tension_level               INTEGER NOT NULL DEFAULT 5
                              CHECK (tension_level BETWEEN 0 AND 10),
  warmth_level                INTEGER NOT NULL DEFAULT 5
                              CHECK (warmth_level BETWEEN 0 AND 10),

  unresolved_conflict         BOOLEAN NOT NULL DEFAULT false,
  conflict_context            TEXT,

  last_positive_interaction   TIMESTAMPTZ,
  last_negative_interaction   TIMESTAMPTZ,
  consecutive_negative_count  INTEGER NOT NULL DEFAULT 0,

  recent_emotional_events     JSONB NOT NULL DEFAULT '[]'::jsonb,

  created_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, persona_id)
);

CREATE INDEX IF NOT EXISTS idx_emotional_states_user_persona
  ON public.emotional_states(user_id, persona_id);
CREATE INDEX IF NOT EXISTS idx_emotional_states_unresolved
  ON public.emotional_states(user_id, persona_id) WHERE unresolved_conflict = true;

DROP TRIGGER IF EXISTS trg_emotional_states_updated_at ON public.emotional_states;
CREATE TRIGGER trg_emotional_states_updated_at
  BEFORE UPDATE ON public.emotional_states
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE IF NOT EXISTS public.conflict_records (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  persona_id          TEXT NOT NULL REFERENCES public.persona_core(id) ON DELETE CASCADE,

  conflict_type       VARCHAR(30) NOT NULL,
  severity            INTEGER NOT NULL DEFAULT 5 CHECK (severity BETWEEN 1 AND 10),
  cause               TEXT NOT NULL,
  persona_feeling     VARCHAR(20) NOT NULL,

  is_resolved         BOOLEAN NOT NULL DEFAULT false,
  resolved_at         TIMESTAMPTZ,
  resolution_type     VARCHAR(30),

  cooldown_hours      DECIMAL(5,2) NOT NULL DEFAULT 1,
  affection_impact    INTEGER NOT NULL DEFAULT 0,

  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_conflict_records_user_persona
  ON public.conflict_records(user_id, persona_id);
CREATE INDEX IF NOT EXISTS idx_conflict_records_unresolved
  ON public.conflict_records(user_id, persona_id, is_resolved) WHERE is_resolved = false;
CREATE INDEX IF NOT EXISTS idx_conflict_records_created
  ON public.conflict_records(created_at DESC);

CREATE OR REPLACE FUNCTION public.check_conflict_cooldown(
  p_user_id    UUID,
  p_persona_id TEXT
)
RETURNS TABLE (
  conflict_id      UUID,
  conflict_type    VARCHAR(30),
  hours_remaining  DECIMAL(5,2),
  is_cooling_down  BOOLEAN
)
LANGUAGE plpgsql STABLE AS $$
BEGIN
  RETURN QUERY
  SELECT cr.id,
         cr.conflict_type,
         GREATEST(0, cr.cooldown_hours - EXTRACT(EPOCH FROM (NOW() - cr.created_at)) / 3600)::DECIMAL(5,2),
         (cr.cooldown_hours > EXTRACT(EPOCH FROM (NOW() - cr.created_at)) / 3600)
    FROM public.conflict_records cr
   WHERE cr.user_id    = p_user_id
     AND cr.persona_id = p_persona_id
     AND cr.is_resolved = false;
END;
$$;

-- ============================================================================
-- Row Level Security
-- ============================================================================
ALTER TABLE public.event_trigger_rules    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.scheduled_events       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_trigger_logs     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_event_state       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_trigger_history   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.emotional_states       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conflict_records       ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "event_trigger_rules_read" ON public.event_trigger_rules;
CREATE POLICY "event_trigger_rules_read" ON public.event_trigger_rules FOR SELECT USING (true);

DROP POLICY IF EXISTS "event_trigger_rules_admin_write" ON public.event_trigger_rules;
CREATE POLICY "event_trigger_rules_admin_write" ON public.event_trigger_rules
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.role = 'admin'));

DROP POLICY IF EXISTS "scheduled_events_self" ON public.scheduled_events;
CREATE POLICY "scheduled_events_self" ON public.scheduled_events
  FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "event_trigger_logs_self" ON public.event_trigger_logs;
CREATE POLICY "event_trigger_logs_self" ON public.event_trigger_logs
  FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "user_event_state_self" ON public.user_event_state;
CREATE POLICY "user_event_state_self" ON public.user_event_state
  FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "user_trigger_history_self" ON public.user_trigger_history;
CREATE POLICY "user_trigger_history_self" ON public.user_trigger_history
  FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "emotional_states_self" ON public.emotional_states;
CREATE POLICY "emotional_states_self" ON public.emotional_states
  FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "conflict_records_self" ON public.conflict_records;
CREATE POLICY "conflict_records_self" ON public.conflict_records
  FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
