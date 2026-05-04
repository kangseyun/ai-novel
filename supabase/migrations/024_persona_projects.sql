-- ============================================================================
-- 024_persona_projects.sql
-- Sidebar "projects" / folders that group personas in /admin/personas.
--
-- The admin UI (app/admin/personas/page.tsx + ProjectSidebar) reads/writes
-- persona_projects and links each persona via persona_core.project_id.
-- Neither was carried over during the recent migrations consolidation, so
-- the page errored on load.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.persona_projects (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name            TEXT NOT NULL,
  description     TEXT,
  color           TEXT NOT NULL DEFAULT '#64748b',
  icon            TEXT NOT NULL DEFAULT '📁',
  target_audience TEXT CHECK (target_audience IN ('female','male','anime')),
  status          TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','archived')),
  sort_order      INTEGER NOT NULL DEFAULT 0,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_persona_projects_sort_order ON public.persona_projects(sort_order);
CREATE INDEX IF NOT EXISTS idx_persona_projects_status     ON public.persona_projects(status);

DROP TRIGGER IF EXISTS trg_persona_projects_updated_at ON public.persona_projects;
CREATE TRIGGER trg_persona_projects_updated_at
  BEFORE UPDATE ON public.persona_projects
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

ALTER TABLE public.persona_core
  ADD COLUMN IF NOT EXISTS project_id UUID REFERENCES public.persona_projects(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_persona_core_project_id ON public.persona_core(project_id);

ALTER TABLE public.persona_projects ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "persona_projects_read" ON public.persona_projects;
CREATE POLICY "persona_projects_read" ON public.persona_projects
  FOR SELECT TO authenticated, anon
  USING (true);

DROP POLICY IF EXISTS "persona_projects_admin_write" ON public.persona_projects;
CREATE POLICY "persona_projects_admin_write" ON public.persona_projects
  FOR ALL TO authenticated
  USING (private.is_admin(auth.uid()))
  WITH CHECK (private.is_admin(auth.uid()));
