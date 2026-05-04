-- ============================================================================
-- 029_experiments.sql
-- Lightweight A/B experimentation: experiments / assignments / events.
--
-- The runtime calls lib/experiments.assignVariant(userId, key) which
-- writes a sticky assignment, and recordEvent(userId, key, eventName)
-- to log conversions. Admins read aggregate results via
-- /api/admin/experiments/[id]/results.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.experiments (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key                 TEXT NOT NULL UNIQUE,
  name                TEXT NOT NULL,
  description         TEXT,
  status              TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','running','paused','complete')),
  variants            JSONB NOT NULL DEFAULT '[{"name":"control","weight":1},{"name":"treatment","weight":1}]'::jsonb,
  conversion_events   JSONB NOT NULL DEFAULT '[]'::jsonb,    -- ["pass_purchased","standard_purchased","retained_d7"]
  metadata            JSONB NOT NULL DEFAULT '{}'::jsonb,
  started_at          TIMESTAMPTZ,
  ended_at            TIMESTAMPTZ,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_experiments_status ON public.experiments(status);
CREATE INDEX IF NOT EXISTS idx_experiments_key    ON public.experiments(key);

DROP TRIGGER IF EXISTS trg_experiments_updated_at ON public.experiments;
CREATE TRIGGER trg_experiments_updated_at
  BEFORE UPDATE ON public.experiments
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE IF NOT EXISTS public.experiment_assignments (
  experiment_id   UUID NOT NULL REFERENCES public.experiments(id) ON DELETE CASCADE,
  user_id         UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  variant_name    TEXT NOT NULL,
  assigned_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (experiment_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_experiment_assignments_user_id ON public.experiment_assignments(user_id);
CREATE INDEX IF NOT EXISTS idx_experiment_assignments_variant ON public.experiment_assignments(experiment_id, variant_name);

CREATE TABLE IF NOT EXISTS public.experiment_events (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  experiment_id   UUID NOT NULL REFERENCES public.experiments(id) ON DELETE CASCADE,
  user_id         UUID REFERENCES public.users(id) ON DELETE SET NULL,
  event_name      TEXT NOT NULL,
  value           NUMERIC,
  metadata        JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_experiment_events_exp_user ON public.experiment_events(experiment_id, user_id);
CREATE INDEX IF NOT EXISTS idx_experiment_events_event    ON public.experiment_events(experiment_id, event_name);

ALTER TABLE public.experiments             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.experiment_assignments  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.experiment_events       ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "experiments_admin_all" ON public.experiments;
CREATE POLICY "experiments_admin_all" ON public.experiments
  FOR ALL TO authenticated
  USING (private.is_admin(auth.uid()))
  WITH CHECK (private.is_admin(auth.uid()));

-- Users can read their own assignment (so client SDK can avoid a round trip)
DROP POLICY IF EXISTS "experiment_assignments_self_read" ON public.experiment_assignments;
CREATE POLICY "experiment_assignments_self_read" ON public.experiment_assignments
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR private.is_admin(auth.uid()));

DROP POLICY IF EXISTS "experiment_events_admin_read" ON public.experiment_events;
CREATE POLICY "experiment_events_admin_read" ON public.experiment_events
  FOR SELECT TO authenticated
  USING (private.is_admin(auth.uid()));
