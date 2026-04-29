-- ============================================================================
-- 002_personas.sql
-- Persona master data (persona_core), example dialogues, prompt templates,
-- profile image task pipeline, and the personas view used by the app.
--
-- Consolidates legacy migrations:
--   012 (persona_core base), 013 (UI fields on legacy personas table),
--   025 (base_instruction / tone_config / situation_presets / examples),
--   027 (profile_image_url + prompt templates), 028 (status / published_at),
--   035 (image tasks + history), 036 (image history unique constraint),
--   037 (UI fields on persona_core), 038 (data migration — superseded),
--   039 (personas view), 040 (FK fix — already correct here),
--   061 (target_audience).
-- ============================================================================

-- ----------------------------------------------------------------------------
-- persona_core — single source of truth for persona definitions.
-- TEXT primary key (e.g. 'haeon', 'kael') so the app can reference by slug.
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.persona_core (
  id                    TEXT PRIMARY KEY,
  name                  TEXT NOT NULL,
  full_name             TEXT NOT NULL,
  role                  TEXT NOT NULL,
  age                   INTEGER NOT NULL,
  ethnicity             TEXT,
  voice_description     TEXT,
  appearance            JSONB NOT NULL DEFAULT '{}'::jsonb,

  -- Personality / behaviour data (consumed by AI engine)
  core_personality      JSONB NOT NULL DEFAULT '{}'::jsonb,
  speech_patterns       JSONB NOT NULL DEFAULT '{}'::jsonb,
  tone_config           JSONB NOT NULL DEFAULT '{}'::jsonb,
  situation_presets     JSONB NOT NULL DEFAULT '{}'::jsonb,
  worldview             JSONB NOT NULL DEFAULT '{}'::jsonb,
  behavior_by_stage     JSONB NOT NULL DEFAULT '{}'::jsonb,
  base_instruction      TEXT,

  likes                 TEXT[] NOT NULL DEFAULT '{}',
  dislikes              TEXT[] NOT NULL DEFAULT '{}',
  absolute_rules        TEXT[] NOT NULL DEFAULT '{}',

  first_scenario_id     TEXT,

  -- UI / SNS profile fields (formerly on legacy personas table)
  display_name          TEXT,
  username              TEXT,
  bio                   TEXT,
  profile_image_url     TEXT,
  cover_image_url       TEXT,
  gallery_images        TEXT[] NOT NULL DEFAULT '{}',

  is_verified           BOOLEAN NOT NULL DEFAULT true,
  is_active             BOOLEAN NOT NULL DEFAULT true,
  is_premium            BOOLEAN NOT NULL DEFAULT false,
  category              TEXT NOT NULL DEFAULT 'other',
  tags                  TEXT[] NOT NULL DEFAULT '{}',
  sort_order            INTEGER NOT NULL DEFAULT 0,

  followers_count       TEXT    NOT NULL DEFAULT '0',
  following_count       INTEGER NOT NULL DEFAULT 0,
  posts_count           INTEGER NOT NULL DEFAULT 0,

  -- Targeting
  target_audience       TEXT NOT NULL DEFAULT 'female'
                        CHECK (target_audience IN ('female', 'male', 'anime')),

  -- Lifecycle status: published (live) | lab (admin only)
  status                TEXT NOT NULL DEFAULT 'lab'
                        CHECK (status IN ('published', 'lab')),
  published_at          TIMESTAMPTZ,

  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_persona_core_status         ON public.persona_core(status);
CREATE INDEX IF NOT EXISTS idx_persona_core_is_active      ON public.persona_core(is_active);
CREATE INDEX IF NOT EXISTS idx_persona_core_is_premium     ON public.persona_core(is_premium);
CREATE INDEX IF NOT EXISTS idx_persona_core_category       ON public.persona_core(category);
CREATE INDEX IF NOT EXISTS idx_persona_core_target_aud     ON public.persona_core(target_audience);
CREATE INDEX IF NOT EXISTS idx_persona_core_sort_order     ON public.persona_core(sort_order);

-- updated_at trigger (uses set_updated_at from 001)
DROP TRIGGER IF EXISTS trg_persona_core_updated_at ON public.persona_core;
CREATE TRIGGER trg_persona_core_updated_at
  BEFORE UPDATE ON public.persona_core
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Auto-set published_at when status flips to 'published'
CREATE OR REPLACE FUNCTION public.update_persona_published_at()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'published' AND (OLD.status IS NULL OR OLD.status <> 'published') THEN
    NEW.published_at := NOW();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_persona_published_at ON public.persona_core;
CREATE TRIGGER trg_persona_published_at
  BEFORE UPDATE ON public.persona_core
  FOR EACH ROW EXECUTE FUNCTION public.update_persona_published_at();

-- ----------------------------------------------------------------------------
-- personas view — read-only view used by app code (preserves the abstraction
-- that previously had a separate personas table). Filtered to active personas.
-- ----------------------------------------------------------------------------
DROP VIEW IF EXISTS public.personas;
CREATE VIEW public.personas AS
SELECT
  id,
  name,
  COALESCE(display_name, name) AS display_name,
  COALESCE(username, id)       AS username,
  full_name,
  bio,
  profile_image_url            AS avatar_url,
  profile_image_url,
  cover_image_url,
  is_verified,
  is_active,
  is_premium,
  category,
  target_audience,
  tags,
  sort_order,
  followers_count,
  following_count,
  posts_count,
  gallery_images,
  age,
  ethnicity,
  appearance,
  voice_description,
  role,
  status,
  created_at,
  updated_at
FROM public.persona_core
WHERE is_active = true OR is_active IS NULL;

GRANT SELECT ON public.personas TO authenticated;
GRANT SELECT ON public.personas TO anon;

-- ----------------------------------------------------------------------------
-- persona_example_dialogues — few-shot examples used by the LLM to lock tone
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.persona_example_dialogues (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  persona_id  TEXT NOT NULL REFERENCES public.persona_core(id) ON DELETE CASCADE,
  tags        TEXT[] NOT NULL DEFAULT '{}',
  messages    JSONB  NOT NULL DEFAULT '[]'::jsonb,
  priority    INTEGER NOT NULL DEFAULT 0,
  min_stage   TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_persona_example_dialogues_persona
  ON public.persona_example_dialogues(persona_id);
CREATE INDEX IF NOT EXISTS idx_persona_example_dialogues_tags
  ON public.persona_example_dialogues USING GIN (tags);

-- ----------------------------------------------------------------------------
-- persona_prompt_templates — reusable prompt seeds (admin-managed)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.persona_prompt_templates (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT NOT NULL,
  description TEXT,
  prompt      TEXT NOT NULL,
  category    TEXT NOT NULL DEFAULT 'general',
  is_active   BOOLEAN NOT NULL DEFAULT true,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_persona_prompt_templates_category
  ON public.persona_prompt_templates(category);
CREATE INDEX IF NOT EXISTS idx_persona_prompt_templates_active
  ON public.persona_prompt_templates(is_active);

DROP TRIGGER IF EXISTS trg_persona_prompt_templates_updated_at ON public.persona_prompt_templates;
CREATE TRIGGER trg_persona_prompt_templates_updated_at
  BEFORE UPDATE ON public.persona_prompt_templates
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ----------------------------------------------------------------------------
-- persona_image_tasks — Kling AI generation pipeline
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.persona_image_tasks (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  persona_id        TEXT NOT NULL REFERENCES public.persona_core(id) ON DELETE CASCADE,
  external_task_id  TEXT NOT NULL,
  status            TEXT NOT NULL DEFAULT 'processing'
                    CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  prompt            TEXT,
  image_type        TEXT NOT NULL DEFAULT 'profile',
  error_message     TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_persona_image_tasks_persona_id
  ON public.persona_image_tasks(persona_id);
CREATE INDEX IF NOT EXISTS idx_persona_image_tasks_status
  ON public.persona_image_tasks(status);
CREATE INDEX IF NOT EXISTS idx_persona_image_tasks_external_id
  ON public.persona_image_tasks(external_task_id);

DROP TRIGGER IF EXISTS trg_persona_image_tasks_updated_at ON public.persona_image_tasks;
CREATE TRIGGER trg_persona_image_tasks_updated_at
  BEFORE UPDATE ON public.persona_image_tasks
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ----------------------------------------------------------------------------
-- persona_image_history — versioned history of generated images
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.persona_image_history (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  persona_id  TEXT NOT NULL REFERENCES public.persona_core(id) ON DELETE CASCADE,
  task_id     UUID REFERENCES public.persona_image_tasks(id) ON DELETE SET NULL,
  image_url   TEXT NOT NULL,
  prompt      TEXT,
  is_current  BOOLEAN NOT NULL DEFAULT false,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_persona_image_history_persona_id
  ON public.persona_image_history(persona_id);
CREATE INDEX IF NOT EXISTS idx_persona_image_history_is_current
  ON public.persona_image_history(is_current);

-- task_id should appear only once across history (idempotent inserts)
CREATE UNIQUE INDEX IF NOT EXISTS uq_persona_image_history_task_id
  ON public.persona_image_history(task_id) WHERE task_id IS NOT NULL;

-- Only one is_current image per persona
CREATE OR REPLACE FUNCTION public.set_single_current_image()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.is_current = TRUE THEN
    UPDATE public.persona_image_history
       SET is_current = FALSE
     WHERE persona_id = NEW.persona_id AND id <> NEW.id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_set_single_current_image ON public.persona_image_history;
CREATE TRIGGER trg_set_single_current_image
  BEFORE INSERT OR UPDATE ON public.persona_image_history
  FOR EACH ROW EXECUTE FUNCTION public.set_single_current_image();

-- ----------------------------------------------------------------------------
-- persona_posts — SNS feed posts authored by personas
-- (kept generic; LUMIN-specific seed content lives in 014_lumin_seed.sql)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.persona_posts (
  id                            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  persona_id                    TEXT NOT NULL REFERENCES public.persona_core(id) ON DELETE CASCADE,
  post_type                     TEXT NOT NULL DEFAULT 'image',
  caption                       TEXT,
  images                        TEXT[],
  location                      TEXT,
  likes_count                   INTEGER NOT NULL DEFAULT 0,
  comments_count                INTEGER NOT NULL DEFAULT 0,
  required_relationship_stage   TEXT NOT NULL DEFAULT 'stranger',
  required_affection            INTEGER NOT NULL DEFAULT 0,
  is_premium                    BOOLEAN NOT NULL DEFAULT false,
  hours_ago                     INTEGER NOT NULL DEFAULT 1,
  mood                          TEXT,
  hashtags                      TEXT[],
  created_at                    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at                    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_persona_posts_persona ON public.persona_posts(persona_id);
CREATE INDEX IF NOT EXISTS idx_persona_posts_stage   ON public.persona_posts(required_relationship_stage);

-- ----------------------------------------------------------------------------
-- Helper: full persona config in a single row
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_full_persona_config(p_persona_id TEXT)
RETURNS TABLE (
  id                TEXT,
  name              TEXT,
  role              TEXT,
  base_instruction  TEXT,
  core_personality  JSONB,
  speech_patterns   JSONB,
  tone_config       JSONB,
  situation_presets JSONB,
  behavior_by_stage JSONB,
  worldview         JSONB,
  likes             TEXT[],
  dislikes          TEXT[],
  absolute_rules    TEXT[]
)
LANGUAGE plpgsql AS $$
BEGIN
  RETURN QUERY
  SELECT pc.id, pc.name, pc.role, pc.base_instruction, pc.core_personality,
         pc.speech_patterns, pc.tone_config, pc.situation_presets,
         pc.behavior_by_stage, pc.worldview, pc.likes, pc.dislikes,
         pc.absolute_rules
    FROM public.persona_core pc
   WHERE pc.id = p_persona_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_persona_example_dialogues(
  p_persona_id TEXT,
  p_tags TEXT[] DEFAULT NULL,
  p_stage TEXT DEFAULT NULL
)
RETURNS TABLE (
  id        UUID,
  tags      TEXT[],
  messages  JSONB,
  priority  INTEGER
)
LANGUAGE plpgsql AS $$
BEGIN
  RETURN QUERY
  SELECT ped.id, ped.tags, ped.messages, ped.priority
    FROM public.persona_example_dialogues ped
   WHERE ped.persona_id = p_persona_id
     AND (p_tags IS NULL OR ped.tags && p_tags)
     -- Stage rank is interpreted by the calling code; here we only enforce
     -- "no min_stage" or "any non-null stage match" to keep the function
     -- audience-neutral. Detailed gating lives in TS.
     AND (p_stage IS NULL OR ped.min_stage IS NULL OR ped.min_stage = p_stage)
   ORDER BY ped.priority DESC;
END;
$$;

-- Realtime hookup for image task pipeline (best-effort)
DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.persona_image_tasks;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;
DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.persona_image_history;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

-- ============================================================================
-- Row Level Security
-- ============================================================================
ALTER TABLE public.persona_core              ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.persona_example_dialogues ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.persona_prompt_templates  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.persona_image_tasks       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.persona_image_history     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.persona_posts             ENABLE ROW LEVEL SECURITY;

-- Public read for published personas / examples / posts
DROP POLICY IF EXISTS "persona_core_read" ON public.persona_core;
CREATE POLICY "persona_core_read" ON public.persona_core
  FOR SELECT USING (status = 'published' OR EXISTS (
    SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.role = 'admin'
  ));

DROP POLICY IF EXISTS "persona_example_dialogues_read" ON public.persona_example_dialogues;
CREATE POLICY "persona_example_dialogues_read" ON public.persona_example_dialogues
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "persona_prompt_templates_read" ON public.persona_prompt_templates;
CREATE POLICY "persona_prompt_templates_read" ON public.persona_prompt_templates
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "persona_image_tasks_read" ON public.persona_image_tasks;
CREATE POLICY "persona_image_tasks_read" ON public.persona_image_tasks
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "persona_image_history_read" ON public.persona_image_history;
CREATE POLICY "persona_image_history_read" ON public.persona_image_history
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "persona_posts_read" ON public.persona_posts;
CREATE POLICY "persona_posts_read" ON public.persona_posts
  FOR SELECT USING (true);

-- Admin write policies
DROP POLICY IF EXISTS "persona_core_admin_write" ON public.persona_core;
CREATE POLICY "persona_core_admin_write" ON public.persona_core
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.role = 'admin'));

DROP POLICY IF EXISTS "persona_example_dialogues_admin_write" ON public.persona_example_dialogues;
CREATE POLICY "persona_example_dialogues_admin_write" ON public.persona_example_dialogues
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.role = 'admin'));

DROP POLICY IF EXISTS "persona_prompt_templates_admin_write" ON public.persona_prompt_templates;
CREATE POLICY "persona_prompt_templates_admin_write" ON public.persona_prompt_templates
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.role = 'admin'));

DROP POLICY IF EXISTS "persona_image_tasks_admin_write" ON public.persona_image_tasks;
CREATE POLICY "persona_image_tasks_admin_write" ON public.persona_image_tasks
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.role = 'admin'));

DROP POLICY IF EXISTS "persona_image_history_admin_write" ON public.persona_image_history;
CREATE POLICY "persona_image_history_admin_write" ON public.persona_image_history
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.role = 'admin'));

DROP POLICY IF EXISTS "persona_posts_admin_write" ON public.persona_posts;
CREATE POLICY "persona_posts_admin_write" ON public.persona_posts
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.role = 'admin'));
