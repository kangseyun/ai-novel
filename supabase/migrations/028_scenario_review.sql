-- ============================================================================
-- 028_scenario_review.sql
-- Publishing workflow for scenario_templates: draft → in_review → approved
-- (or rejected). Auto-lint findings (lib/moderation.detectFlags) get stored
-- on submit so reviewers see them inline.
--
-- Existing rows are seeded as 'approved' to preserve current behavior;
-- new rows default to 'draft' so admins must explicitly submit + approve
-- before the runtime treats them as live content.
-- ============================================================================

ALTER TABLE public.scenario_templates
  ADD COLUMN IF NOT EXISTS review_status   TEXT NOT NULL DEFAULT 'draft'
                            CHECK (review_status IN ('draft','in_review','approved','rejected')),
  ADD COLUMN IF NOT EXISTS submitted_at    TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS reviewed_at     TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS reviewer_id     UUID REFERENCES public.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS review_notes    TEXT,
  ADD COLUMN IF NOT EXISTS lint_findings   JSONB NOT NULL DEFAULT '[]'::jsonb;

UPDATE public.scenario_templates
   SET review_status = 'approved'
 WHERE review_status = 'draft' AND is_active = true;

CREATE INDEX IF NOT EXISTS idx_scenario_templates_review_status
  ON public.scenario_templates(review_status);
