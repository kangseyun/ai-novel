-- ============================================================================
-- 006_scenarios.sql
-- Scenario engine v1: scenario_templates, user_scenario_progress, sessions,
-- scene/choice/daily statistics, reward grant pipeline.
--
-- Consolidates legacy migrations: 012 (scenario_templates),
-- 050 (onboarding scenario_type), 051 (FK to persona_core),
-- 052 (rewards/balances/inventory grant), 053 (sessions, metrics, RPCs).
-- v2 (guided/dynamic) lives in 007_scenarios_v2.sql.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- scenario_templates — master catalog of scenarios
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.scenario_templates (
  id                       TEXT PRIMARY KEY,
  persona_id               TEXT NOT NULL REFERENCES public.persona_core(id) ON DELETE CASCADE,

  title                    TEXT NOT NULL,
  description              TEXT,

  scenario_type            TEXT NOT NULL CHECK (scenario_type IN (
                            'first_meeting', 'story_episode', 'dm_triggered',
                            'scheduled_event', 'milestone', 'onboarding'
                          )),

  -- v2 generation mode (filled later by 007 migration when guided/dynamic used)
  generation_mode          TEXT NOT NULL DEFAULT 'static'
                          CHECK (generation_mode IN ('static','guided','dynamic')),

  trigger_conditions       JSONB NOT NULL DEFAULT '{}'::jsonb,
  content                  JSONB NOT NULL DEFAULT '{}'::jsonb,
  reward_summary           JSONB NOT NULL DEFAULT '{}'::jsonb,

  sort_order               INTEGER NOT NULL DEFAULT 0,
  min_affection            INTEGER NOT NULL DEFAULT 0,
  min_relationship_stage   TEXT    NOT NULL DEFAULT 'stranger',
  prerequisite_scenarios   TEXT[]  NOT NULL DEFAULT '{}',

  is_active                BOOLEAN NOT NULL DEFAULT true,
  created_at               TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at               TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_scenario_templates_persona
  ON public.scenario_templates(persona_id);
CREATE INDEX IF NOT EXISTS idx_scenario_templates_type
  ON public.scenario_templates(scenario_type);
CREATE INDEX IF NOT EXISTS idx_scenario_templates_generation_mode
  ON public.scenario_templates(generation_mode);
CREATE INDEX IF NOT EXISTS idx_scenario_templates_active
  ON public.scenario_templates(is_active) WHERE is_active = true;

DROP TRIGGER IF EXISTS trg_scenario_templates_updated_at ON public.scenario_templates;
CREATE TRIGGER trg_scenario_templates_updated_at
  BEFORE UPDATE ON public.scenario_templates
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ----------------------------------------------------------------------------
-- user_scenario_progress — per-user lifetime progress per scenario
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.user_scenario_progress (
  id                        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                   UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  scenario_id               TEXT NOT NULL,
  persona_id                TEXT,

  status                    TEXT NOT NULL DEFAULT 'not_started'
                            CHECK (status IN ('not_started','in_progress','completed','abandoned')),
  is_completed              BOOLEAN NOT NULL DEFAULT false,
  completion_count          INTEGER NOT NULL DEFAULT 0,
  best_progress_percent     NUMERIC(5,2) NOT NULL DEFAULT 0,

  current_position          JSONB NOT NULL DEFAULT '{}'::jsonb,
  choices_made              JSONB NOT NULL DEFAULT '[]'::jsonb,
  last_choices_made         JSONB NOT NULL DEFAULT '[]'::jsonb,
  rewards_claimed           JSONB NOT NULL DEFAULT '[]'::jsonb,

  first_started_at          TIMESTAMPTZ,
  first_completed_at        TIMESTAMPTZ,
  last_played_at            TIMESTAMPTZ,
  total_play_time_seconds   INTEGER NOT NULL DEFAULT 0,

  started_at                TIMESTAMPTZ,
  completed_at              TIMESTAMPTZ,

  created_at                TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at                TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, scenario_id)
);

CREATE INDEX IF NOT EXISTS idx_user_scenario_progress_user
  ON public.user_scenario_progress(user_id);
CREATE INDEX IF NOT EXISTS idx_user_scenario_progress_scenario
  ON public.user_scenario_progress(scenario_id);
CREATE INDEX IF NOT EXISTS idx_user_scenario_progress_user_persona
  ON public.user_scenario_progress(user_id, persona_id);
CREATE INDEX IF NOT EXISTS idx_user_scenario_progress_active
  ON public.user_scenario_progress(user_id, persona_id, status) WHERE status = 'in_progress';

DROP TRIGGER IF EXISTS trg_user_scenario_progress_updated_at ON public.user_scenario_progress;
CREATE TRIGGER trg_user_scenario_progress_updated_at
  BEFORE UPDATE ON public.user_scenario_progress
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ----------------------------------------------------------------------------
-- scenario_sessions — individual play sessions (for analytics)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.scenario_sessions (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  scenario_id         TEXT NOT NULL,
  persona_id          TEXT,

  status              TEXT NOT NULL DEFAULT 'started'
                      CHECK (status IN ('started','in_progress','completed','abandoned')),
  started_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_activity_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at        TIMESTAMPTZ,

  current_scene_id    TEXT,
  current_scene_index INTEGER NOT NULL DEFAULT 0,
  total_scenes        INTEGER,

  choices_made        JSONB NOT NULL DEFAULT '[]'::jsonb,
  metadata            JSONB NOT NULL DEFAULT '{}'::jsonb,

  user_agent          TEXT,
  platform            TEXT,
  duration_seconds    INTEGER
);

CREATE INDEX IF NOT EXISTS idx_scenario_sessions_user     ON public.scenario_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_scenario_sessions_scenario ON public.scenario_sessions(scenario_id);
CREATE INDEX IF NOT EXISTS idx_scenario_sessions_status   ON public.scenario_sessions(status);
CREATE INDEX IF NOT EXISTS idx_scenario_sessions_started  ON public.scenario_sessions(started_at);

-- ----------------------------------------------------------------------------
-- Per-scene / per-choice / daily aggregate stats
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.scenario_scene_stats (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  scenario_id         TEXT NOT NULL,
  scene_id            TEXT NOT NULL,
  scene_index         INTEGER NOT NULL,
  view_count          INTEGER NOT NULL DEFAULT 0,
  unique_user_count   INTEGER NOT NULL DEFAULT 0,
  avg_time_spent_ms   INTEGER NOT NULL DEFAULT 0,
  total_time_spent_ms BIGINT  NOT NULL DEFAULT 0,
  drop_off_count      INTEGER NOT NULL DEFAULT 0,
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (scenario_id, scene_id)
);

CREATE TABLE IF NOT EXISTS public.scenario_choice_stats (
  id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  scenario_id                 TEXT NOT NULL,
  scene_id                    TEXT NOT NULL,
  choice_id                   TEXT NOT NULL,
  choice_text                 TEXT,
  selection_count             INTEGER NOT NULL DEFAULT 0,
  unique_user_count           INTEGER NOT NULL DEFAULT 0,
  is_premium                  BOOLEAN NOT NULL DEFAULT false,
  premium_conversion_count    INTEGER NOT NULL DEFAULT 0,
  affection_change            INTEGER NOT NULL DEFAULT 0,
  updated_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (scenario_id, scene_id, choice_id)
);

CREATE TABLE IF NOT EXISTS public.scenario_daily_stats (
  id                            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  scenario_id                   TEXT NOT NULL,
  stat_date                     DATE NOT NULL DEFAULT CURRENT_DATE,
  total_sessions                INTEGER NOT NULL DEFAULT 0,
  unique_users                  INTEGER NOT NULL DEFAULT 0,
  completed_sessions            INTEGER NOT NULL DEFAULT 0,
  abandoned_sessions            INTEGER NOT NULL DEFAULT 0,
  avg_progress_percent          NUMERIC(5,2) NOT NULL DEFAULT 0,
  avg_completion_time_seconds   INTEGER NOT NULL DEFAULT 0,
  total_choices_made            INTEGER NOT NULL DEFAULT 0,
  premium_choices_made          INTEGER NOT NULL DEFAULT 0,
  total_rewards_granted         INTEGER NOT NULL DEFAULT 0,
  total_affection_gained        INTEGER NOT NULL DEFAULT 0,
  updated_at                    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (scenario_id, stat_date)
);

CREATE INDEX IF NOT EXISTS idx_scenario_daily_stats_date
  ON public.scenario_daily_stats(stat_date);
CREATE INDEX IF NOT EXISTS idx_scenario_daily_stats_scenario
  ON public.scenario_daily_stats(scenario_id);

-- ----------------------------------------------------------------------------
-- Reward catalog and per-scenario reward configuration
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.reward_types (
  id          TEXT PRIMARY KEY,
  name        TEXT NOT NULL,
  description TEXT,
  icon        TEXT,
  category    TEXT NOT NULL CHECK (category IN (
                'currency','content','cosmetic','boost','special'
              )),
  is_active   BOOLEAN NOT NULL DEFAULT true,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO public.reward_types (id, name, description, icon, category) VALUES
  ('coins',            '코인',              '기본 게임 화폐',                  'coins',     'currency'),
  ('gems',             '젬',                '프리미엄 화폐',                  'gem',       'currency'),
  ('hearts',           '하트',              '호감도 부스터',                  'heart',     'currency'),
  ('story_unlock',     '스토리 잠금해제',   '특별 스토리 콘텐츠 해금',        'book-open', 'content'),
  ('chat_theme',       '채팅 테마',         '채팅 배경 테마',                 'palette',   'cosmetic'),
  ('profile_frame',    '프로필 프레임',     '프로필 꾸미기 프레임',           'frame',     'cosmetic'),
  ('affection_boost',  '호감도 부스터',     '일정 시간 호감도 획득량 증가',   'zap',       'boost'),
  ('exclusive_photo',  '포토카드',          '캐릭터 포토카드',                'image',     'special'),
  ('voice_message',    '음성 메시지',       '특별 음성 메시지 해금',          'mic',       'special')
ON CONFLICT (id) DO NOTHING;

CREATE TABLE IF NOT EXISTS public.scenario_rewards (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  scenario_id           TEXT NOT NULL REFERENCES public.scenario_templates(id) ON DELETE CASCADE,
  reward_type_id        TEXT NOT NULL REFERENCES public.reward_types(id) ON DELETE CASCADE,
  condition_type        TEXT NOT NULL DEFAULT 'completion'
                        CHECK (condition_type IN (
                          'completion','first_completion','choice_based','perfect_run','speed_run'
                        )),
  required_choice_ids   TEXT[] NOT NULL DEFAULT '{}',
  amount                INTEGER NOT NULL DEFAULT 1,
  metadata              JSONB NOT NULL DEFAULT '{}'::jsonb,
  display_order         INTEGER NOT NULL DEFAULT 0,
  is_active             BOOLEAN NOT NULL DEFAULT true,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_scenario_rewards_scenario
  ON public.scenario_rewards(scenario_id);

CREATE TABLE IF NOT EXISTS public.user_reward_claims (
  id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                     UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  scenario_id                 TEXT NOT NULL,
  scenario_reward_id          UUID NOT NULL REFERENCES public.scenario_rewards(id) ON DELETE CASCADE,
  reward_type_id              TEXT NOT NULL,
  amount                      INTEGER NOT NULL DEFAULT 1,
  claimed_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  choices_made                JSONB NOT NULL DEFAULT '[]'::jsonb,
  completion_time_seconds     INTEGER,
  UNIQUE (user_id, scenario_reward_id)
);

CREATE INDEX IF NOT EXISTS idx_user_reward_claims_user
  ON public.user_reward_claims(user_id);

-- ----------------------------------------------------------------------------
-- Session lifecycle RPCs (used by app/api/scenario routes + service code)
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.start_scenario_session(
  p_user_id      UUID,
  p_scenario_id  TEXT,
  p_persona_id   TEXT DEFAULT NULL,
  p_total_scenes INTEGER DEFAULT NULL,
  p_user_agent   TEXT DEFAULT NULL,
  p_platform     TEXT DEFAULT NULL
) RETURNS UUID
LANGUAGE plpgsql AS $$
DECLARE v_session_id UUID;
BEGIN
  INSERT INTO public.scenario_sessions
    (user_id, scenario_id, persona_id, total_scenes, user_agent, platform)
  VALUES (p_user_id, p_scenario_id, p_persona_id, p_total_scenes, p_user_agent, p_platform)
  RETURNING id INTO v_session_id;

  INSERT INTO public.user_scenario_progress
    (user_id, scenario_id, persona_id, status, first_started_at, last_played_at)
  VALUES (p_user_id, p_scenario_id, p_persona_id, 'in_progress', NOW(), NOW())
  ON CONFLICT (user_id, scenario_id) DO UPDATE SET
    last_played_at = NOW(),
    persona_id     = COALESCE(p_persona_id, public.user_scenario_progress.persona_id),
    status         = CASE WHEN public.user_scenario_progress.is_completed
                          THEN public.user_scenario_progress.status
                          ELSE 'in_progress' END;

  INSERT INTO public.scenario_daily_stats (scenario_id, stat_date, total_sessions, unique_users)
  VALUES (p_scenario_id, CURRENT_DATE, 1, 1)
  ON CONFLICT (scenario_id, stat_date) DO UPDATE SET
    total_sessions = public.scenario_daily_stats.total_sessions + 1,
    unique_users   = (
      SELECT COUNT(DISTINCT user_id) FROM public.scenario_sessions
       WHERE scenario_id = p_scenario_id AND started_at::date = CURRENT_DATE
    ),
    updated_at     = NOW();

  RETURN v_session_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.record_scene_view(
  p_session_id    UUID,
  p_scene_id      TEXT,
  p_scene_index   INTEGER,
  p_time_spent_ms INTEGER DEFAULT 0
) RETURNS void
LANGUAGE plpgsql AS $$
DECLARE v_scenario_id TEXT;
BEGIN
  SELECT scenario_id INTO v_scenario_id FROM public.scenario_sessions WHERE id = p_session_id;
  IF v_scenario_id IS NULL THEN RETURN; END IF;

  UPDATE public.scenario_sessions
     SET current_scene_id    = p_scene_id,
         current_scene_index = p_scene_index,
         last_activity_at    = NOW(),
         status              = 'in_progress'
   WHERE id = p_session_id;

  INSERT INTO public.scenario_scene_stats
    (scenario_id, scene_id, scene_index, view_count, unique_user_count,
     total_time_spent_ms, avg_time_spent_ms)
  VALUES (v_scenario_id, p_scene_id, p_scene_index, 1, 1, p_time_spent_ms, p_time_spent_ms)
  ON CONFLICT (scenario_id, scene_id) DO UPDATE SET
    view_count          = public.scenario_scene_stats.view_count + 1,
    total_time_spent_ms = public.scenario_scene_stats.total_time_spent_ms + p_time_spent_ms,
    avg_time_spent_ms   = (public.scenario_scene_stats.total_time_spent_ms + p_time_spent_ms)
                          / (public.scenario_scene_stats.view_count + 1),
    updated_at          = NOW();
END;
$$;

CREATE OR REPLACE FUNCTION public.record_choice_made(
  p_session_id        UUID,
  p_scene_id          TEXT,
  p_choice_id         TEXT,
  p_choice_text       TEXT DEFAULT NULL,
  p_is_premium        BOOLEAN DEFAULT false,
  p_affection_change  INTEGER DEFAULT 0
) RETURNS void
LANGUAGE plpgsql AS $$
DECLARE
  v_scenario_id TEXT;
  v_choices     JSONB;
BEGIN
  SELECT scenario_id, choices_made INTO v_scenario_id, v_choices
    FROM public.scenario_sessions WHERE id = p_session_id;
  IF v_scenario_id IS NULL THEN RETURN; END IF;

  v_choices := v_choices || jsonb_build_object(
    'scene_id', p_scene_id,
    'choice_id', p_choice_id,
    'choice_text', p_choice_text,
    'is_premium', p_is_premium,
    'affection_change', p_affection_change,
    'timestamp', NOW()
  );

  UPDATE public.scenario_sessions
     SET choices_made     = v_choices,
         last_activity_at = NOW()
   WHERE id = p_session_id;

  INSERT INTO public.scenario_choice_stats
    (scenario_id, scene_id, choice_id, choice_text,
     selection_count, unique_user_count, is_premium,
     premium_conversion_count, affection_change)
  VALUES (
    v_scenario_id, p_scene_id, p_choice_id, p_choice_text, 1, 1,
    p_is_premium, CASE WHEN p_is_premium THEN 1 ELSE 0 END, p_affection_change
  )
  ON CONFLICT (scenario_id, scene_id, choice_id) DO UPDATE SET
    selection_count          = public.scenario_choice_stats.selection_count + 1,
    premium_conversion_count = public.scenario_choice_stats.premium_conversion_count
                                + CASE WHEN p_is_premium THEN 1 ELSE 0 END,
    updated_at               = NOW();

  UPDATE public.scenario_daily_stats
     SET total_choices_made     = total_choices_made + 1,
         premium_choices_made   = premium_choices_made + CASE WHEN p_is_premium THEN 1 ELSE 0 END,
         total_affection_gained = total_affection_gained + COALESCE(p_affection_change, 0),
         updated_at             = NOW()
   WHERE scenario_id = v_scenario_id AND stat_date = CURRENT_DATE;
END;
$$;

CREATE OR REPLACE FUNCTION public.complete_scenario_session(p_session_id UUID)
RETURNS void
LANGUAGE plpgsql AS $$
DECLARE
  v_scenario_id TEXT;
  v_user_id     UUID;
  v_started_at  TIMESTAMPTZ;
  v_choices     JSONB;
  v_duration    INTEGER;
BEGIN
  SELECT scenario_id, user_id, started_at, choices_made
    INTO v_scenario_id, v_user_id, v_started_at, v_choices
    FROM public.scenario_sessions WHERE id = p_session_id;
  IF v_scenario_id IS NULL THEN RETURN; END IF;

  v_duration := EXTRACT(EPOCH FROM (NOW() - v_started_at))::INTEGER;

  UPDATE public.scenario_sessions
     SET status           = 'completed',
         completed_at     = NOW(),
         duration_seconds = v_duration
   WHERE id = p_session_id;

  UPDATE public.user_scenario_progress
     SET status                  = 'completed',
         is_completed            = true,
         completion_count        = completion_count + 1,
         best_progress_percent   = 100,
         first_completed_at      = COALESCE(first_completed_at, NOW()),
         last_played_at          = NOW(),
         total_play_time_seconds = total_play_time_seconds + v_duration,
         last_choices_made       = v_choices,
         completed_at            = NOW()
   WHERE user_id = v_user_id AND scenario_id = v_scenario_id;

  UPDATE public.scenario_daily_stats
     SET completed_sessions          = completed_sessions + 1,
         avg_completion_time_seconds = CASE
            WHEN completed_sessions = 0 THEN v_duration
            ELSE (avg_completion_time_seconds * (completed_sessions - 1) + v_duration) / completed_sessions
         END,
         updated_at                  = NOW()
   WHERE scenario_id = v_scenario_id AND stat_date = CURRENT_DATE;
END;
$$;

CREATE OR REPLACE FUNCTION public.abandon_scenario_session(p_session_id UUID)
RETURNS void
LANGUAGE plpgsql AS $$
DECLARE
  v_scenario_id    TEXT;
  v_user_id        UUID;
  v_started_at     TIMESTAMPTZ;
  v_duration       INTEGER;
  v_progress       NUMERIC;
  v_current_scene  TEXT;
  v_current_index  INTEGER;
  v_total_scenes   INTEGER;
BEGIN
  SELECT scenario_id, user_id, started_at,
         current_scene_id, current_scene_index, total_scenes
    INTO v_scenario_id, v_user_id, v_started_at,
         v_current_scene, v_current_index, v_total_scenes
    FROM public.scenario_sessions WHERE id = p_session_id;
  IF v_scenario_id IS NULL THEN RETURN; END IF;

  v_duration := EXTRACT(EPOCH FROM (NOW() - v_started_at))::INTEGER;
  v_progress := CASE WHEN v_total_scenes > 0
                     THEN (v_current_index::NUMERIC / v_total_scenes * 100)
                     ELSE 0 END;

  UPDATE public.scenario_sessions
     SET status = 'abandoned', duration_seconds = v_duration
   WHERE id = p_session_id;

  IF v_current_scene IS NOT NULL THEN
    UPDATE public.scenario_scene_stats
       SET drop_off_count = drop_off_count + 1
     WHERE scenario_id = v_scenario_id AND scene_id = v_current_scene;
  END IF;

  UPDATE public.user_scenario_progress
     SET best_progress_percent   = GREATEST(best_progress_percent, v_progress),
         last_played_at          = NOW(),
         total_play_time_seconds = total_play_time_seconds + v_duration
   WHERE user_id = v_user_id AND scenario_id = v_scenario_id;

  UPDATE public.scenario_daily_stats
     SET abandoned_sessions = abandoned_sessions + 1,
         updated_at         = NOW()
   WHERE scenario_id = v_scenario_id AND stat_date = CURRENT_DATE;
END;
$$;

-- ----------------------------------------------------------------------------
-- Reward grant pipeline
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.grant_scenario_reward(
  p_user_id                  UUID,
  p_scenario_id              TEXT,
  p_choices_made             JSONB DEFAULT '[]'::jsonb,
  p_completion_time_seconds  INTEGER DEFAULT NULL
) RETURNS JSONB
LANGUAGE plpgsql AS $$
DECLARE
  v_reward            RECORD;
  v_granted_rewards   JSONB := '[]'::jsonb;
  v_already_claimed   BOOLEAN;
  v_condition_met     BOOLEAN;
  v_is_first          BOOLEAN;
BEGIN
  SELECT NOT EXISTS (
    SELECT 1 FROM public.user_reward_claims
     WHERE user_id = p_user_id AND scenario_id = p_scenario_id
  ) INTO v_is_first;

  FOR v_reward IN
    SELECT sr.*, rt.category, rt.name AS reward_name
      FROM public.scenario_rewards sr
      JOIN public.reward_types rt ON sr.reward_type_id = rt.id
     WHERE sr.scenario_id = p_scenario_id
       AND sr.is_active = true
       AND rt.is_active = true
     ORDER BY sr.display_order
  LOOP
    SELECT EXISTS (
      SELECT 1 FROM public.user_reward_claims
       WHERE user_id = p_user_id AND scenario_reward_id = v_reward.id
    ) INTO v_already_claimed;
    IF v_already_claimed THEN CONTINUE; END IF;

    v_condition_met := false;
    CASE v_reward.condition_type
      WHEN 'completion' THEN v_condition_met := true;
      WHEN 'first_completion' THEN v_condition_met := v_is_first;
      WHEN 'choice_based' THEN
        v_condition_met := (
          SELECT bool_and(choice_id = ANY (
            SELECT jsonb_array_elements_text(p_choices_made)
          ))
            FROM unnest(v_reward.required_choice_ids) AS choice_id
        );
      WHEN 'speed_run' THEN
        v_condition_met := (
          p_completion_time_seconds IS NOT NULL
          AND p_completion_time_seconds <=
              COALESCE((v_reward.metadata->>'max_seconds')::int, 9999999)
        );
      ELSE v_condition_met := true;
    END CASE;
    IF NOT v_condition_met THEN CONTINUE; END IF;

    INSERT INTO public.user_reward_claims
      (user_id, scenario_id, scenario_reward_id, reward_type_id,
       amount, choices_made, completion_time_seconds)
    VALUES
      (p_user_id, p_scenario_id, v_reward.id, v_reward.reward_type_id,
       v_reward.amount, p_choices_made, p_completion_time_seconds);

    CASE v_reward.category
      WHEN 'currency' THEN
        INSERT INTO public.user_balances (user_id, currency_type, balance, total_earned)
        VALUES (p_user_id, v_reward.reward_type_id, v_reward.amount, v_reward.amount)
        ON CONFLICT (user_id, currency_type) DO UPDATE SET
          balance      = public.user_balances.balance      + v_reward.amount,
          total_earned = public.user_balances.total_earned + v_reward.amount,
          updated_at   = NOW();

      WHEN 'content', 'cosmetic', 'special' THEN
        INSERT INTO public.user_inventory
          (user_id, item_type, item_id, quantity, acquired_from, source_id, metadata)
        VALUES
          (p_user_id, v_reward.reward_type_id,
           COALESCE(v_reward.metadata->>'item_id', v_reward.id::text),
           v_reward.amount, 'scenario_reward', p_scenario_id, v_reward.metadata)
        ON CONFLICT (user_id, item_type, item_id) DO UPDATE SET
          quantity = public.user_inventory.quantity + v_reward.amount;

      WHEN 'boost' THEN
        INSERT INTO public.user_inventory
          (user_id, item_type, item_id, quantity, acquired_from, source_id, metadata)
        VALUES
          (p_user_id, v_reward.reward_type_id, v_reward.id::text, v_reward.amount,
           'scenario_reward', p_scenario_id,
           jsonb_build_object(
             'expires_at', NOW() + INTERVAL '1 day' *
                COALESCE((v_reward.metadata->>'duration_days')::int, 1)
           ) || v_reward.metadata);
      ELSE NULL;
    END CASE;

    v_granted_rewards := v_granted_rewards || jsonb_build_object(
      'reward_id', v_reward.id,
      'type', v_reward.reward_type_id,
      'name', v_reward.reward_name,
      'amount', v_reward.amount,
      'category', v_reward.category
    );
  END LOOP;

  RETURN v_granted_rewards;
END;
$$;

-- ----------------------------------------------------------------------------
-- Stats RPC for admin dashboard
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_scenario_stats(
  p_scenario_id TEXT,
  p_days        INTEGER DEFAULT 30
) RETURNS JSONB
LANGUAGE plpgsql STABLE AS $$
DECLARE v_result JSONB;
BEGIN
  SELECT jsonb_build_object(
    'overview', (
      SELECT jsonb_build_object(
        'total_sessions',     COALESCE(SUM(total_sessions), 0),
        'unique_users',       COALESCE(SUM(unique_users), 0),
        'completed_sessions', COALESCE(SUM(completed_sessions), 0),
        'abandoned_sessions', COALESCE(SUM(abandoned_sessions), 0),
        'completion_rate',    CASE WHEN SUM(total_sessions) > 0
                                   THEN ROUND(SUM(completed_sessions)::NUMERIC / SUM(total_sessions) * 100, 2)
                                   ELSE 0 END,
        'avg_progress_percent',         ROUND(AVG(avg_progress_percent), 2),
        'avg_completion_time_seconds',  ROUND(AVG(avg_completion_time_seconds)),
        'total_choices_made',           COALESCE(SUM(total_choices_made), 0),
        'premium_choices_made',         COALESCE(SUM(premium_choices_made), 0),
        'total_affection_gained',       COALESCE(SUM(total_affection_gained), 0)
      )
      FROM public.scenario_daily_stats
      WHERE scenario_id = p_scenario_id AND stat_date >= CURRENT_DATE - p_days
    ),
    'choice_distribution', (
      SELECT COALESCE(jsonb_agg(jsonb_build_object(
        'scene_id', scene_id,
        'choice_id', choice_id,
        'choice_text', choice_text,
        'selection_count', selection_count,
        'is_premium', is_premium
      )), '[]'::jsonb)
      FROM public.scenario_choice_stats
      WHERE scenario_id = p_scenario_id
    ),
    'drop_off_points', (
      SELECT COALESCE(jsonb_agg(jsonb_build_object(
        'scene_id', scene_id,
        'scene_index', scene_index,
        'drop_off_count', drop_off_count
      ) ORDER BY drop_off_count DESC), '[]'::jsonb)
      FROM public.scenario_scene_stats
      WHERE scenario_id = p_scenario_id AND drop_off_count > 0
      LIMIT 10
    )
  ) INTO v_result;

  RETURN v_result;
END;
$$;

-- ============================================================================
-- Row Level Security
-- ============================================================================
ALTER TABLE public.scenario_templates       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_scenario_progress   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.scenario_sessions        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.scenario_scene_stats     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.scenario_choice_stats    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.scenario_daily_stats     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reward_types             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.scenario_rewards         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_reward_claims       ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "scenario_templates_read" ON public.scenario_templates;
CREATE POLICY "scenario_templates_read" ON public.scenario_templates
  FOR SELECT USING (is_active = true);

DROP POLICY IF EXISTS "scenario_templates_admin_write" ON public.scenario_templates;
CREATE POLICY "scenario_templates_admin_write" ON public.scenario_templates
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.role = 'admin'));

DROP POLICY IF EXISTS "user_scenario_progress_self" ON public.user_scenario_progress;
CREATE POLICY "user_scenario_progress_self" ON public.user_scenario_progress
  FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "scenario_sessions_self" ON public.scenario_sessions;
CREATE POLICY "scenario_sessions_self" ON public.scenario_sessions
  FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Aggregate stats: read-only public, admin write
DROP POLICY IF EXISTS "scenario_scene_stats_read" ON public.scenario_scene_stats;
CREATE POLICY "scenario_scene_stats_read" ON public.scenario_scene_stats FOR SELECT USING (true);

DROP POLICY IF EXISTS "scenario_choice_stats_read" ON public.scenario_choice_stats;
CREATE POLICY "scenario_choice_stats_read" ON public.scenario_choice_stats FOR SELECT USING (true);

DROP POLICY IF EXISTS "scenario_daily_stats_read" ON public.scenario_daily_stats;
CREATE POLICY "scenario_daily_stats_read" ON public.scenario_daily_stats FOR SELECT USING (true);

DROP POLICY IF EXISTS "reward_types_read" ON public.reward_types;
CREATE POLICY "reward_types_read" ON public.reward_types FOR SELECT USING (true);

DROP POLICY IF EXISTS "scenario_rewards_read" ON public.scenario_rewards;
CREATE POLICY "scenario_rewards_read" ON public.scenario_rewards FOR SELECT USING (true);

DROP POLICY IF EXISTS "scenario_rewards_admin_write" ON public.scenario_rewards;
CREATE POLICY "scenario_rewards_admin_write" ON public.scenario_rewards
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.role = 'admin'));

DROP POLICY IF EXISTS "user_reward_claims_self" ON public.user_reward_claims;
CREATE POLICY "user_reward_claims_self" ON public.user_reward_claims
  FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
