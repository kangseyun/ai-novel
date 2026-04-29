-- ============================================================================
-- 009_marketing_admin.sql
-- Marketing project / image / copy / campaign tables and the admin-only
-- generation pipeline. Service-role plus admin-role-can-write policy.
--
-- Consolidates legacy migrations: 029 (projects + images),
-- 030 (project persona / base image refs), 031 (copies + concept fields),
-- 032 (image hierarchy: parent/group/is_base), 033 (campaigns + ad
-- executions), 034 (selected_base_image_id on tasks),
-- 045 (admin-can-view-all-users policy).
-- ============================================================================

-- ----------------------------------------------------------------------------
-- marketing_projects
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.marketing_projects (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name                  TEXT NOT NULL,
  description           TEXT,
  status                TEXT NOT NULL DEFAULT 'active'
                        CHECK (status IN ('active','completed','archived')),
  target_platform       TEXT NOT NULL DEFAULT 'meta'
                        CHECK (target_platform IN ('meta','google','tiktok','all')),

  -- Selected persona for this project (loose link; persona_id is TEXT slug)
  persona_id            TEXT,
  persona_name          TEXT,
  persona_avatar_url    TEXT,

  -- Selected base image (used as parent for subsequent variants)
  base_image_url        TEXT,
  base_template         TEXT,
  base_custom_prompt    TEXT,

  -- Concept fields
  marketing_concept     TEXT,
  cta_goal              TEXT,

  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_marketing_projects_status     ON public.marketing_projects(status);
CREATE INDEX IF NOT EXISTS idx_marketing_projects_persona_id ON public.marketing_projects(persona_id);

DROP TRIGGER IF EXISTS trg_marketing_projects_updated_at ON public.marketing_projects;
CREATE TRIGGER trg_marketing_projects_updated_at
  BEFORE UPDATE ON public.marketing_projects
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ----------------------------------------------------------------------------
-- marketing_images — generated assets (with parent / group lineage)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.marketing_images (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id            UUID REFERENCES public.marketing_projects(id) ON DELETE CASCADE,

  -- Loose link to persona by id; can also be NULL
  persona_id            TEXT,
  persona_name          TEXT NOT NULL,

  image_url             TEXT NOT NULL,
  thumbnail_url         TEXT,

  ad_size               TEXT NOT NULL,
  ad_size_label         TEXT NOT NULL,
  template              TEXT NOT NULL,
  template_label        TEXT NOT NULL,
  custom_prompt         TEXT,
  generated_prompt      TEXT,

  width                 INTEGER,
  height                INTEGER,
  file_size             INTEGER,

  status                TEXT NOT NULL DEFAULT 'generated'
                        CHECK (status IN ('generating','generated','approved','rejected','used')),
  used_at               TIMESTAMPTZ,
  notes                 TEXT,

  -- Hierarchy / lineage
  parent_image_id       UUID REFERENCES public.marketing_images(id) ON DELETE SET NULL,
  generation_order      INTEGER NOT NULL DEFAULT 0,
  is_base               BOOLEAN NOT NULL DEFAULT false,
  generation_group_id   UUID,

  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_marketing_images_project_id        ON public.marketing_images(project_id);
CREATE INDEX IF NOT EXISTS idx_marketing_images_persona_id        ON public.marketing_images(persona_id);
CREATE INDEX IF NOT EXISTS idx_marketing_images_ad_size           ON public.marketing_images(ad_size);
CREATE INDEX IF NOT EXISTS idx_marketing_images_status            ON public.marketing_images(status);
CREATE INDEX IF NOT EXISTS idx_marketing_images_parent_id         ON public.marketing_images(parent_image_id);
CREATE INDEX IF NOT EXISTS idx_marketing_images_is_base           ON public.marketing_images(is_base);
CREATE INDEX IF NOT EXISTS idx_marketing_images_generation_group  ON public.marketing_images(generation_group_id);

DROP TRIGGER IF EXISTS trg_marketing_images_updated_at ON public.marketing_images;
CREATE TRIGGER trg_marketing_images_updated_at
  BEFORE UPDATE ON public.marketing_images
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ----------------------------------------------------------------------------
-- marketing_copies — generated headlines / body / CTAs
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.marketing_copies (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id      UUID REFERENCES public.marketing_projects(id) ON DELETE CASCADE,
  headline        TEXT NOT NULL,
  body            TEXT NOT NULL,
  cta             TEXT NOT NULL,
  version         INTEGER NOT NULL DEFAULT 1,
  variation_type  TEXT,
  status          TEXT NOT NULL DEFAULT 'generated'
                  CHECK (status IN ('generated','approved','rejected','used')),
  impressions     INTEGER NOT NULL DEFAULT 0,
  clicks          INTEGER NOT NULL DEFAULT 0,
  conversions     INTEGER NOT NULL DEFAULT 0,
  ctr             DECIMAL(5,4),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_marketing_copies_project_id ON public.marketing_copies(project_id);
CREATE INDEX IF NOT EXISTS idx_marketing_copies_status     ON public.marketing_copies(status);

DROP TRIGGER IF EXISTS trg_marketing_copies_updated_at ON public.marketing_copies;
CREATE TRIGGER trg_marketing_copies_updated_at
  BEFORE UPDATE ON public.marketing_copies
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ----------------------------------------------------------------------------
-- marketing_generation_tasks — image-generation worker queue
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.marketing_generation_tasks (
  id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id                  UUID REFERENCES public.marketing_projects(id) ON DELETE CASCADE,
  external_task_id            TEXT,
  status                      TEXT NOT NULL DEFAULT 'pending'
                              CHECK (status IN ('pending','processing','completed','failed')),
  prompt                      TEXT,
  ad_size                     TEXT,
  template                    TEXT,
  selected_base_image_id      UUID REFERENCES public.marketing_images(id) ON DELETE SET NULL,
  metadata                    JSONB NOT NULL DEFAULT '{}'::jsonb,
  error_message               TEXT,
  created_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_marketing_tasks_project       ON public.marketing_generation_tasks(project_id);
CREATE INDEX IF NOT EXISTS idx_marketing_tasks_status        ON public.marketing_generation_tasks(status);
CREATE INDEX IF NOT EXISTS idx_marketing_tasks_base_image_id ON public.marketing_generation_tasks(selected_base_image_id);

DROP TRIGGER IF EXISTS trg_marketing_generation_tasks_updated_at ON public.marketing_generation_tasks;
CREATE TRIGGER trg_marketing_generation_tasks_updated_at
  BEFORE UPDATE ON public.marketing_generation_tasks
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ----------------------------------------------------------------------------
-- marketing_campaigns + ad executions
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.marketing_campaigns (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name                    TEXT NOT NULL,
  platform                TEXT NOT NULL CHECK (platform IN ('meta','tiktok','google','other')),
  status                  TEXT NOT NULL DEFAULT 'draft',
  external_campaign_id    TEXT,
  budget_daily            DECIMAL(10, 2),
  start_date              TIMESTAMPTZ,
  end_date                TIMESTAMPTZ,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_marketing_campaigns_status
  ON public.marketing_campaigns(status);

DROP TRIGGER IF EXISTS trg_marketing_campaigns_updated_at ON public.marketing_campaigns;
CREATE TRIGGER trg_marketing_campaigns_updated_at
  BEFORE UPDATE ON public.marketing_campaigns
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE IF NOT EXISTS public.marketing_ad_executions (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id             UUID REFERENCES public.marketing_campaigns(id) ON DELETE SET NULL,
  image_id                UUID REFERENCES public.marketing_images(id)    ON DELETE SET NULL,
  platform                TEXT NOT NULL,
  external_ad_id          TEXT,
  external_creative_id    TEXT,
  status                  TEXT NOT NULL DEFAULT 'pending',
  performance_data        JSONB NOT NULL DEFAULT '{}'::jsonb,
  uploaded_at             TIMESTAMPTZ,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_marketing_ad_executions_image_id
  ON public.marketing_ad_executions(image_id);

-- ============================================================================
-- Row Level Security: admin-only writes, public reads where useful
-- ============================================================================
ALTER TABLE public.marketing_projects           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.marketing_images             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.marketing_copies             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.marketing_generation_tasks   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.marketing_campaigns          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.marketing_ad_executions      ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE tbl TEXT;
BEGIN
  FOREACH tbl IN ARRAY ARRAY[
    'marketing_projects','marketing_images','marketing_copies',
    'marketing_generation_tasks','marketing_campaigns','marketing_ad_executions'
  ] LOOP
    EXECUTE format('DROP POLICY IF EXISTS "%s_admin_all" ON public.%s', tbl, tbl);
    EXECUTE format(
      'CREATE POLICY "%s_admin_all" ON public.%s FOR ALL TO authenticated
         USING (EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.role = ''admin''))
         WITH CHECK (EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.role = ''admin''))',
      tbl, tbl
    );
  END LOOP;
END $$;
