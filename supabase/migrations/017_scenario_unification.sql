-- ============================================================================
-- 017_scenario_unification.sql
-- Scenario v1 + v2 unification reconciliation.
--
-- Background:
--   006_scenarios.sql / 007_scenarios_v2.sql already established the unified
--   schema: scenario_templates is the master catalog (with generation_mode)
--   and v2 details live in guided_scenario_plots / dynamic_scenario_templates
--   linked by scenario_id. The application code, however, was split between
--   v1 (ScenarioService) and v2 (ScenarioSessionManager / engines), and a few
--   columns the application expects were missing. This migration reconciles
--   the gaps without rewriting the underlying tables, so we have a single
--   source of truth driven by scenario_templates.generation_mode.
--
-- Idempotent: safe to re-run.
-- ============================================================================

-- 1) scenario_templates: ensure generation_mode + index exist
ALTER TABLE public.scenario_templates
  ADD COLUMN IF NOT EXISTS generation_mode TEXT NOT NULL DEFAULT 'static';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conname = 'scenario_templates_generation_mode_check'
  ) THEN
    ALTER TABLE public.scenario_templates
      ADD CONSTRAINT scenario_templates_generation_mode_check
      CHECK (generation_mode IN ('static','guided','dynamic'));
  END IF;
END$$;

CREATE INDEX IF NOT EXISTS idx_scenario_templates_generation_mode
  ON public.scenario_templates(generation_mode);

-- 2) scenario_templates: optional metadata blob used by admin save flow
ALTER TABLE public.scenario_templates
  ADD COLUMN IF NOT EXISTS metadata JSONB NOT NULL DEFAULT '{}'::jsonb;

-- 3) Backfill any pre-existing rows that may have NULL generation_mode (no-op
--    if column was created with the NOT NULL DEFAULT above, but kept for safety
--    when running on environments that diverged).
UPDATE public.scenario_templates
   SET generation_mode = 'static'
 WHERE generation_mode IS NULL;
