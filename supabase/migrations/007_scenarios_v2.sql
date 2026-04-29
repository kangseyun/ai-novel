-- ============================================================================
-- 007_scenarios_v2.sql
-- Scenario engine v2: guided plots, dynamic templates, sessions, generation
-- audit log. Extends 006 (scenario_templates already has generation_mode).
--
-- Consolidates legacy migrations: 054 (scenario_system_v2),
-- 055 (guided/dynamic sessions, scenario_completion_rewards).
-- ============================================================================

-- ----------------------------------------------------------------------------
-- guided_scenario_plots — plot points + LLM generation rules
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.guided_scenario_plots (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  scenario_id             TEXT NOT NULL REFERENCES public.scenario_templates(id) ON DELETE CASCADE,
  plot_points             JSONB NOT NULL DEFAULT '[]'::jsonb,
  generation_rules        JSONB NOT NULL DEFAULT '{}'::jsonb,
  character_guidelines    JSONB NOT NULL DEFAULT '{}'::jsonb,
  scenario_context        JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (scenario_id)
);

CREATE INDEX IF NOT EXISTS idx_guided_plots_scenario
  ON public.guided_scenario_plots(scenario_id);

DROP TRIGGER IF EXISTS trg_guided_plots_updated_at ON public.guided_scenario_plots;
CREATE TRIGGER trg_guided_plots_updated_at
  BEFORE UPDATE ON public.guided_scenario_plots
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ----------------------------------------------------------------------------
-- dynamic_scenario_templates — fully AI-driven scenarios
-- (TEXT primary key matches legacy 055 expectations; sessions FK to id)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.dynamic_scenario_templates (
  id                      TEXT PRIMARY KEY,
  persona_id              TEXT NOT NULL REFERENCES public.persona_core(id),

  name                    TEXT NOT NULL,
  description             TEXT,

  scenario_category       TEXT NOT NULL CHECK (scenario_category IN (
                            'daily_event','emotional_moment','special_date','conflict',
                            'intimacy','surprise','callback','milestone',
                            -- LUMIN-flavoured categories
                            'comeback_season','birthday_event','group_interaction',
                            'concert_aftermath'
                          )),

  system_prompt_template  TEXT NOT NULL,
  context_variables       TEXT[] NOT NULL DEFAULT ARRAY[
                            'persona_name','user_name','relationship_stage',
                            'affection_level','conversation_summary','time_of_day',
                            'scenario_context','scenario_goal','character_guidelines'
                          ],
  goals                   JSONB NOT NULL DEFAULT '[]'::jsonb,
  end_conditions          JSONB NOT NULL DEFAULT '{}'::jsonb,
  quality_gates           JSONB NOT NULL DEFAULT '{}'::jsonb,

  trigger_rule_id         UUID,    -- FK added in 008 once rules table exists

  is_active               BOOLEAN NOT NULL DEFAULT true,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_dynamic_templates_persona
  ON public.dynamic_scenario_templates(persona_id);
CREATE INDEX IF NOT EXISTS idx_dynamic_templates_category
  ON public.dynamic_scenario_templates(scenario_category);
CREATE INDEX IF NOT EXISTS idx_dynamic_templates_trigger
  ON public.dynamic_scenario_templates(trigger_rule_id);

DROP TRIGGER IF EXISTS trg_dynamic_templates_updated_at ON public.dynamic_scenario_templates;
CREATE TRIGGER trg_dynamic_templates_updated_at
  BEFORE UPDATE ON public.dynamic_scenario_templates
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ----------------------------------------------------------------------------
-- guided_scenario_sessions
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.guided_scenario_sessions (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  scenario_id             TEXT NOT NULL REFERENCES public.scenario_templates(id) ON DELETE CASCADE,
  user_id                 UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  persona_id              TEXT NOT NULL REFERENCES public.persona_core(id) ON DELETE CASCADE,

  current_plot_index      INTEGER NOT NULL DEFAULT 0,
  current_exchange_count  INTEGER NOT NULL DEFAULT 0,
  session_state           TEXT NOT NULL DEFAULT 'active'
                          CHECK (session_state IN ('active','paused','completed','abandoned')),

  plot_progress           JSONB NOT NULL DEFAULT '[]'::jsonb,
  context                 JSONB NOT NULL DEFAULT
                            '{"affection":0,"relationshipStage":"stranger","sessionMemory":[]}'::jsonb,

  created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_activity_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at            TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_guided_sessions_user_persona
  ON public.guided_scenario_sessions(user_id, persona_id);
CREATE INDEX IF NOT EXISTS idx_guided_sessions_state
  ON public.guided_scenario_sessions(session_state);
CREATE INDEX IF NOT EXISTS idx_guided_sessions_scenario
  ON public.guided_scenario_sessions(scenario_id);

CREATE UNIQUE INDEX IF NOT EXISTS uq_active_guided_session
  ON public.guided_scenario_sessions(user_id, persona_id)
  WHERE session_state = 'active';

-- ----------------------------------------------------------------------------
-- dynamic_scenario_sessions
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.dynamic_scenario_sessions (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id             TEXT NOT NULL REFERENCES public.dynamic_scenario_templates(id) ON DELETE CASCADE,
  user_id                 UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  persona_id              TEXT NOT NULL REFERENCES public.persona_core(id) ON DELETE CASCADE,

  turn_count              INTEGER NOT NULL DEFAULT 0,
  exchange_count          INTEGER NOT NULL DEFAULT 0,
  session_state           TEXT NOT NULL DEFAULT 'active'
                          CHECK (session_state IN ('active','paused','completed','abandoned','failed')),

  trigger_context         JSONB NOT NULL DEFAULT '{}'::jsonb,
  goals_achieved          JSONB NOT NULL DEFAULT '{}'::jsonb,
  current_narrative       JSONB NOT NULL DEFAULT
                            '{"situation":"","emotionalTone":"","storyDirection":""}'::jsonb,
  conversation_history    JSONB NOT NULL DEFAULT '[]'::jsonb,
  context                 JSONB NOT NULL DEFAULT
                            '{"affection":0,"relationshipStage":"stranger","triggeredBy":"","sessionMemory":[]}'::jsonb,
  quality_stats           JSONB NOT NULL DEFAULT '{}'::jsonb,
  guardrail_violations    INTEGER NOT NULL DEFAULT 0,

  completion_reason       TEXT,
  end_reason              TEXT,

  created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_activity_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at            TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_dynamic_sessions_user_persona
  ON public.dynamic_scenario_sessions(user_id, persona_id);
CREATE INDEX IF NOT EXISTS idx_dynamic_sessions_state
  ON public.dynamic_scenario_sessions(session_state);
CREATE INDEX IF NOT EXISTS idx_dynamic_sessions_template
  ON public.dynamic_scenario_sessions(template_id);

CREATE UNIQUE INDEX IF NOT EXISTS uq_active_dynamic_session
  ON public.dynamic_scenario_sessions(user_id, persona_id)
  WHERE session_state = 'active';

-- ----------------------------------------------------------------------------
-- scenario_completion_rewards — denormalized reward grant log
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.scenario_completion_rewards (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id               UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  persona_id            TEXT NOT NULL REFERENCES public.persona_core(id) ON DELETE CASCADE,
  scenario_session_id   TEXT NOT NULL,
  scenario_mode         TEXT NOT NULL CHECK (scenario_mode IN ('static','guided','dynamic')),
  affection_earned      INTEGER NOT NULL DEFAULT 0,
  coins_earned          INTEGER NOT NULL DEFAULT 0,
  special_rewards       JSONB NOT NULL DEFAULT '[]'::jsonb,
  completed_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_completion_rewards_user
  ON public.scenario_completion_rewards(user_id);
CREATE INDEX IF NOT EXISTS idx_completion_rewards_persona
  ON public.scenario_completion_rewards(persona_id);

-- ----------------------------------------------------------------------------
-- scenario_generation_logs — admin AI generation audit trail
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.scenario_generation_logs (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  requested_by          UUID NOT NULL REFERENCES public.users(id),
  persona_id            TEXT NOT NULL REFERENCES public.persona_core(id),
  generation_mode       TEXT NOT NULL CHECK (generation_mode IN ('static','guided','dynamic')),
  request_params        JSONB NOT NULL,
  generated_content     JSONB,
  result_scenario_id    TEXT REFERENCES public.scenario_templates(id),
  status                TEXT NOT NULL DEFAULT 'pending'
                        CHECK (status IN ('pending','generating','review','published','failed','cancelled')),
  revision_history      JSONB NOT NULL DEFAULT '[]'::jsonb,
  error_info            JSONB,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_generation_logs_persona ON public.scenario_generation_logs(persona_id);
CREATE INDEX IF NOT EXISTS idx_generation_logs_status  ON public.scenario_generation_logs(status);

DROP TRIGGER IF EXISTS trg_generation_logs_updated_at ON public.scenario_generation_logs;
CREATE TRIGGER trg_generation_logs_updated_at
  BEFORE UPDATE ON public.scenario_generation_logs
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ============================================================================
-- Row Level Security
-- ============================================================================
ALTER TABLE public.guided_scenario_plots         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dynamic_scenario_templates    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.guided_scenario_sessions      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dynamic_scenario_sessions     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.scenario_completion_rewards   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.scenario_generation_logs      ENABLE ROW LEVEL SECURITY;

-- Plots / dynamic templates: public read, admin write
DROP POLICY IF EXISTS "guided_plots_read" ON public.guided_scenario_plots;
CREATE POLICY "guided_plots_read" ON public.guided_scenario_plots FOR SELECT USING (true);

DROP POLICY IF EXISTS "guided_plots_admin_write" ON public.guided_scenario_plots;
CREATE POLICY "guided_plots_admin_write" ON public.guided_scenario_plots
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.role = 'admin'));

DROP POLICY IF EXISTS "dynamic_templates_read" ON public.dynamic_scenario_templates;
CREATE POLICY "dynamic_templates_read" ON public.dynamic_scenario_templates
  FOR SELECT USING (is_active = true);

DROP POLICY IF EXISTS "dynamic_templates_admin_write" ON public.dynamic_scenario_templates;
CREATE POLICY "dynamic_templates_admin_write" ON public.dynamic_scenario_templates
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.role = 'admin'));

-- User sessions: self only
DROP POLICY IF EXISTS "guided_sessions_self" ON public.guided_scenario_sessions;
CREATE POLICY "guided_sessions_self" ON public.guided_scenario_sessions
  FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "dynamic_sessions_self" ON public.dynamic_scenario_sessions;
CREATE POLICY "dynamic_sessions_self" ON public.dynamic_scenario_sessions
  FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "completion_rewards_self" ON public.scenario_completion_rewards;
CREATE POLICY "completion_rewards_self" ON public.scenario_completion_rewards
  FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Generation logs: admin only
DROP POLICY IF EXISTS "generation_logs_admin" ON public.scenario_generation_logs;
CREATE POLICY "generation_logs_admin" ON public.scenario_generation_logs
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.role = 'admin'));
