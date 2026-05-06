-- ============================================================================
-- 031_scenario_lint_llm_meta.sql
-- LLM-based scenario lint metadata (Phase 1 - advisory).
-- Adds bookkeeping columns so we can compare prompt versions and track cost.
-- The actual findings still live in scenario_templates.lint_findings (JSONB),
-- with each finding gaining a `source: 'rule' | 'llm'` discriminator field.
-- ============================================================================

ALTER TABLE public.scenario_templates
  ADD COLUMN IF NOT EXISTS lint_llm_version TEXT,
  ADD COLUMN IF NOT EXISTS lint_llm_model   TEXT,
  ADD COLUMN IF NOT EXISTS lint_llm_at      TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS lint_llm_cost    NUMERIC(10,6);

CREATE INDEX IF NOT EXISTS idx_scenario_lint_llm_version
  ON public.scenario_templates(lint_llm_version)
  WHERE lint_llm_version IS NOT NULL;
