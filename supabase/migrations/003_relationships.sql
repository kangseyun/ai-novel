-- ============================================================================
-- 003_relationships.sql
-- User-persona relationships, relationship stage configuration, milestones,
-- evolution tracking, and the unlock/affection RPCs.
--
-- LUMIN pivot: relationship stages are
--   stranger -> fan -> friend -> close -> heart
-- (legacy stages 'acquaintance', 'intimate', 'lover' are intentionally
--  removed; CHECK constraint enforces the new set.)
--
-- Consolidates legacy migrations: 015 (relationships, milestones, journey),
--   016 (RPC functions), 026 (relationship_stage_config), 040 (FK fixup),
--   plus the LUMIN stage rename.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- user_persona_relationships
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.user_persona_relationships (
  id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                     UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  persona_id                  TEXT NOT NULL REFERENCES public.persona_core(id) ON DELETE CASCADE,

  affection                   INTEGER NOT NULL DEFAULT 0
                              CHECK (affection >= 0 AND affection <= 100),
  relationship_stage          TEXT NOT NULL DEFAULT 'stranger'
                              CHECK (relationship_stage IN (
                                'stranger', 'fan', 'friend', 'close', 'heart'
                              )),

  trust_level                 INTEGER NOT NULL DEFAULT 0,
  intimacy_level              INTEGER NOT NULL DEFAULT 0,
  tension_level               INTEGER NOT NULL DEFAULT 0,

  completed_episodes          TEXT[] NOT NULL DEFAULT '{}',
  unlocked_episodes           TEXT[] NOT NULL DEFAULT '{}',
  story_flags                 JSONB  NOT NULL DEFAULT '{}'::jsonb,

  total_messages              INTEGER NOT NULL DEFAULT 0,
  total_scenarios_completed   INTEGER NOT NULL DEFAULT 0,
  first_interaction_at        TIMESTAMPTZ,
  last_interaction_at         TIMESTAMPTZ,
  longest_conversation_length INTEGER NOT NULL DEFAULT 0,

  shared_secrets_count        INTEGER NOT NULL DEFAULT 0,
  conflicts_resolved          INTEGER NOT NULL DEFAULT 0,
  user_nickname               TEXT,
  persona_nickname            TEXT,

  is_unlocked                 BOOLEAN NOT NULL DEFAULT false,
  unlocked_at                 TIMESTAMPTZ,

  created_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, persona_id)
);

CREATE INDEX IF NOT EXISTS idx_upr_user      ON public.user_persona_relationships(user_id);
CREATE INDEX IF NOT EXISTS idx_upr_persona   ON public.user_persona_relationships(persona_id);
CREATE INDEX IF NOT EXISTS idx_upr_stage     ON public.user_persona_relationships(relationship_stage);
CREATE INDEX IF NOT EXISTS idx_upr_unlocked  ON public.user_persona_relationships(user_id, is_unlocked)
  WHERE is_unlocked = true;

-- ----------------------------------------------------------------------------
-- relationship_milestones
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.relationship_milestones (
  id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                     UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  persona_id                  TEXT NOT NULL,
  milestone_type              TEXT NOT NULL,
  affection_at_time           INTEGER,
  relationship_stage_at_time  TEXT,
  context                     JSONB NOT NULL DEFAULT '{}'::jsonb,
  achieved_at                 TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, persona_id, milestone_type)
);

CREATE INDEX IF NOT EXISTS idx_milestones_user_persona
  ON public.relationship_milestones(user_id, persona_id);
CREATE INDEX IF NOT EXISTS idx_milestones_type
  ON public.relationship_milestones(milestone_type);

-- ----------------------------------------------------------------------------
-- relationship_stage_config — display labels & feature unlocks per stage
-- (NULL persona_id == default config)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.relationship_stage_config (
  id                  SERIAL PRIMARY KEY,
  persona_id          TEXT REFERENCES public.persona_core(id) ON DELETE CASCADE,
  stage               TEXT NOT NULL CHECK (stage IN (
                        'stranger', 'fan', 'friend', 'close', 'heart'
                      )),
  min_affection       INTEGER NOT NULL DEFAULT 0,
  display_name_ko     TEXT,
  display_name_en     TEXT,
  unlocked_features   TEXT[] NOT NULL DEFAULT '{}',
  description         TEXT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (persona_id, stage)
);

CREATE INDEX IF NOT EXISTS idx_stage_config_persona
  ON public.relationship_stage_config(persona_id);

INSERT INTO public.relationship_stage_config
  (persona_id, stage, min_affection, display_name_ko, display_name_en, description, unlocked_features) VALUES
  (NULL, 'stranger',  0,  '낯선 사람',     'Stranger',  '아직 어색한 사이',         ARRAY['basic_chat']),
  (NULL, 'fan',       10, '팬',            'Fan',       '응원하는 사이',            ARRAY['basic_chat','daily_message']),
  (NULL, 'friend',    30, '친구',          'Friend',    '편하게 대화하는 친구',     ARRAY['basic_chat','daily_message','photos']),
  (NULL, 'close',     60, '가까운 사이',    'Close',     '속마음을 나누는 사이',     ARRAY['basic_chat','daily_message','photos','voice_message']),
  (NULL, 'heart',     90, '하트 💗',       'Heart',     '서로에게 특별한 사이',     ARRAY['basic_chat','daily_message','photos','voice_message','video_call','exclusive_content'])
ON CONFLICT (persona_id, stage) DO NOTHING;

-- ----------------------------------------------------------------------------
-- Stage <-> affection helpers (LUMIN thresholds)
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.calculate_relationship_stage(
  p_affection  INTEGER,
  p_persona_id TEXT DEFAULT NULL
)
RETURNS TEXT
LANGUAGE plpgsql STABLE AS $$
DECLARE
  v_stage TEXT;
BEGIN
  SELECT rsc.stage INTO v_stage
    FROM public.relationship_stage_config rsc
   WHERE (rsc.persona_id = p_persona_id OR rsc.persona_id IS NULL)
     AND rsc.min_affection <= COALESCE(p_affection, 0)
   ORDER BY
     CASE WHEN rsc.persona_id = p_persona_id THEN 0 ELSE 1 END,
     rsc.min_affection DESC
   LIMIT 1;

  RETURN COALESCE(v_stage, 'stranger');
END;
$$;

CREATE OR REPLACE FUNCTION public.get_relationship_stage_config(
  p_persona_id TEXT DEFAULT NULL
)
RETURNS TABLE (
  stage             TEXT,
  min_affection     INTEGER,
  display_name_ko   TEXT,
  display_name_en   TEXT,
  description       TEXT,
  unlocked_features TEXT[]
)
LANGUAGE plpgsql STABLE AS $$
BEGIN
  RETURN QUERY
  SELECT rsc.stage, rsc.min_affection, rsc.display_name_ko,
         rsc.display_name_en, rsc.description, rsc.unlocked_features
    FROM public.relationship_stage_config rsc
   WHERE rsc.persona_id = p_persona_id
      OR (rsc.persona_id IS NULL AND NOT EXISTS (
            SELECT 1 FROM public.relationship_stage_config rsc2
             WHERE rsc2.persona_id = p_persona_id AND rsc2.stage = rsc.stage
          ))
   ORDER BY rsc.min_affection ASC;
END;
$$;

-- ----------------------------------------------------------------------------
-- Affection update RPC (used by the AI engine and by scenario rewards)
-- Returns: (new_affection, new_stage, stage_changed)
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.update_affection(
  p_user_id    UUID,
  p_persona_id TEXT,
  p_change     INTEGER
)
RETURNS TABLE(new_affection INTEGER, new_stage TEXT, stage_changed BOOLEAN)
LANGUAGE plpgsql AS $$
DECLARE
  v_current_aff   INTEGER;
  v_current_stage TEXT;
  v_new_aff       INTEGER;
  v_new_stage     TEXT;
BEGIN
  SELECT affection, relationship_stage
    INTO v_current_aff, v_current_stage
    FROM public.user_persona_relationships
   WHERE user_id = p_user_id AND persona_id = p_persona_id
   FOR UPDATE;

  IF NOT FOUND THEN
    v_new_aff := GREATEST(0, LEAST(100, p_change));
    INSERT INTO public.user_persona_relationships
      (user_id, persona_id, affection, relationship_stage)
    VALUES (p_user_id, p_persona_id, v_new_aff, 'stranger');
    RETURN QUERY SELECT v_new_aff, 'stranger'::TEXT, FALSE;
    RETURN;
  END IF;

  v_new_aff   := GREATEST(0, LEAST(100, v_current_aff + p_change));
  v_new_stage := public.calculate_relationship_stage(v_new_aff, p_persona_id);

  UPDATE public.user_persona_relationships
     SET affection          = v_new_aff,
         relationship_stage = v_new_stage,
         updated_at         = NOW()
   WHERE user_id = p_user_id AND persona_id = p_persona_id;

  -- Journey stat sync
  UPDATE public.user_journey_stats
     SET total_affection_gained = total_affection_gained + GREATEST(p_change, 0),
         total_affection_lost   = total_affection_lost   + GREATEST(-p_change, 0),
         max_affection_reached  = GREATEST(max_affection_reached, v_new_aff),
         affection_changes_count = affection_changes_count + 1,
         updated_at             = NOW()
   WHERE user_id = p_user_id AND persona_id = p_persona_id;

  RETURN QUERY SELECT v_new_aff, v_new_stage, (v_new_stage <> v_current_stage);
END;
$$;

-- ----------------------------------------------------------------------------
-- Unlock / initialize a (user, persona) relationship row
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.unlock_persona(p_user_id UUID, p_persona_id TEXT)
RETURNS void
LANGUAGE plpgsql AS $$
BEGIN
  INSERT INTO public.user_persona_relationships
    (user_id, persona_id, affection, relationship_stage,
     is_unlocked, unlocked_at, first_interaction_at)
  VALUES
    (p_user_id, p_persona_id, 0, 'stranger', TRUE, NOW(), NOW())
  ON CONFLICT (user_id, persona_id) DO UPDATE
    SET is_unlocked = TRUE,
        unlocked_at = COALESCE(public.user_persona_relationships.unlocked_at, NOW()),
        updated_at  = NOW();

  INSERT INTO public.user_journey_stats (user_id, persona_id)
  VALUES (p_user_id, p_persona_id)
  ON CONFLICT (user_id, persona_id) DO NOTHING;
END;
$$;

-- ----------------------------------------------------------------------------
-- Update lightweight per-relationship stats (called from message hot path)
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.update_relationship_stats(
  p_user_id            UUID,
  p_persona_id         TEXT,
  p_message_increment  INTEGER DEFAULT 1
)
RETURNS void
LANGUAGE plpgsql AS $$
BEGIN
  UPDATE public.user_persona_relationships
     SET total_messages       = total_messages + p_message_increment,
         last_interaction_at  = NOW(),
         first_interaction_at = COALESCE(first_interaction_at, NOW()),
         updated_at           = NOW()
   WHERE user_id = p_user_id AND persona_id = p_persona_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.update_journey_stats(
  p_user_id              UUID,
  p_persona_id           TEXT,
  p_dm_messages          INTEGER DEFAULT 0,
  p_scenarios_completed  INTEGER DEFAULT 0,
  p_choices_made         INTEGER DEFAULT 0,
  p_time_spent           INTEGER DEFAULT 0
)
RETURNS void
LANGUAGE plpgsql AS $$
BEGIN
  INSERT INTO public.user_journey_stats
    (user_id, persona_id, total_dm_messages_sent,
     total_scenarios_completed, total_choices_made, total_time_spent_minutes)
  VALUES
    (p_user_id, p_persona_id, p_dm_messages,
     p_scenarios_completed, p_choices_made, p_time_spent)
  ON CONFLICT (user_id, persona_id) DO UPDATE SET
    total_dm_messages_sent    = public.user_journey_stats.total_dm_messages_sent    + p_dm_messages,
    total_scenarios_completed = public.user_journey_stats.total_scenarios_completed + p_scenarios_completed,
    total_choices_made        = public.user_journey_stats.total_choices_made        + p_choices_made,
    total_time_spent_minutes  = public.user_journey_stats.total_time_spent_minutes  + p_time_spent,
    updated_at                = NOW();
END;
$$;

CREATE OR REPLACE FUNCTION public.update_streak(p_user_id UUID, p_persona_id TEXT)
RETURNS void
LANGUAGE plpgsql AS $$
DECLARE
  v_last  DATE;
  v_cur   INTEGER;
  v_max   INTEGER;
BEGIN
  SELECT last_active_date, current_streak_days, max_streak_days
    INTO v_last, v_cur, v_max
    FROM public.user_journey_stats
   WHERE user_id = p_user_id AND persona_id = p_persona_id;

  IF NOT FOUND THEN
    INSERT INTO public.user_journey_stats
      (user_id, persona_id, current_streak_days, max_streak_days, last_active_date, days_active)
    VALUES (p_user_id, p_persona_id, 1, 1, CURRENT_DATE, 1);
    RETURN;
  END IF;

  IF v_last = CURRENT_DATE - INTERVAL '1 day' THEN
    v_cur := v_cur + 1;
    IF v_cur > v_max THEN v_max := v_cur; END IF;
  ELSIF v_last < CURRENT_DATE - INTERVAL '1 day' THEN
    v_cur := 1;
  END IF;

  UPDATE public.user_journey_stats
     SET current_streak_days = v_cur,
         max_streak_days     = v_max,
         last_active_date    = CURRENT_DATE,
         days_active         = days_active + CASE WHEN v_last = CURRENT_DATE THEN 0 ELSE 1 END,
         updated_at          = NOW()
   WHERE user_id = p_user_id AND persona_id = p_persona_id;
END;
$$;

-- ----------------------------------------------------------------------------
-- Auto-record milestones on stage / affection / message-count thresholds
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.check_and_record_milestones()
RETURNS TRIGGER AS $$
DECLARE
  v_thresholds INT[] := ARRAY[25, 50, 75, 100];
  v_th INT;
BEGIN
  -- Affection milestones
  FOREACH v_th IN ARRAY v_thresholds LOOP
    IF NEW.affection >= v_th AND (OLD.affection IS NULL OR OLD.affection < v_th) THEN
      INSERT INTO public.relationship_milestones
        (user_id, persona_id, milestone_type, affection_at_time, relationship_stage_at_time)
      VALUES
        (NEW.user_id, NEW.persona_id, 'affection_' || v_th, NEW.affection, NEW.relationship_stage)
      ON CONFLICT (user_id, persona_id, milestone_type) DO NOTHING;
    END IF;
  END LOOP;

  -- Stage transition milestones
  IF NEW.relationship_stage IS DISTINCT FROM OLD.relationship_stage THEN
    INSERT INTO public.relationship_milestones
      (user_id, persona_id, milestone_type, affection_at_time, relationship_stage_at_time)
    VALUES
      (NEW.user_id, NEW.persona_id, 'stage_' || NEW.relationship_stage,
       NEW.affection, NEW.relationship_stage)
    ON CONFLICT (user_id, persona_id, milestone_type) DO NOTHING;
  END IF;

  -- Message-count milestones
  IF NEW.total_messages >= 100  AND (OLD.total_messages IS NULL OR OLD.total_messages < 100)  THEN
    INSERT INTO public.relationship_milestones
      (user_id, persona_id, milestone_type, affection_at_time, relationship_stage_at_time)
    VALUES (NEW.user_id, NEW.persona_id, 'messages_100', NEW.affection, NEW.relationship_stage)
    ON CONFLICT (user_id, persona_id, milestone_type) DO NOTHING;
  END IF;
  IF NEW.total_messages >= 500  AND (OLD.total_messages IS NULL OR OLD.total_messages < 500)  THEN
    INSERT INTO public.relationship_milestones
      (user_id, persona_id, milestone_type, affection_at_time, relationship_stage_at_time)
    VALUES (NEW.user_id, NEW.persona_id, 'messages_500', NEW.affection, NEW.relationship_stage)
    ON CONFLICT (user_id, persona_id, milestone_type) DO NOTHING;
  END IF;
  IF NEW.total_messages >= 1000 AND (OLD.total_messages IS NULL OR OLD.total_messages < 1000) THEN
    INSERT INTO public.relationship_milestones
      (user_id, persona_id, milestone_type, affection_at_time, relationship_stage_at_time)
    VALUES (NEW.user_id, NEW.persona_id, 'messages_1000', NEW.affection, NEW.relationship_stage)
    ON CONFLICT (user_id, persona_id, milestone_type) DO NOTHING;
  END IF;

  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_upr_milestones ON public.user_persona_relationships;
CREATE TRIGGER trg_upr_milestones
  BEFORE UPDATE ON public.user_persona_relationships
  FOR EACH ROW EXECUTE FUNCTION public.check_and_record_milestones();

-- ============================================================================
-- Row Level Security
-- ============================================================================
ALTER TABLE public.user_persona_relationships  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.relationship_milestones     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.relationship_stage_config   ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "upr_self" ON public.user_persona_relationships;
CREATE POLICY "upr_self" ON public.user_persona_relationships
  FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "milestones_self" ON public.relationship_milestones;
CREATE POLICY "milestones_self" ON public.relationship_milestones
  FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "stage_config_read" ON public.relationship_stage_config;
CREATE POLICY "stage_config_read" ON public.relationship_stage_config
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "stage_config_admin_write" ON public.relationship_stage_config;
CREATE POLICY "stage_config_admin_write" ON public.relationship_stage_config
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.role = 'admin'));
