-- ============================================================================
-- 021_event_trigger_rules_persona_fk.sql
-- Add the missing foreign key event_trigger_rules.persona_id -> persona_core.id
-- so PostgREST can embed persona_core columns from event_trigger_rules
-- (e.g. ?select=*,persona_core(name,profile_image_url)).
--
-- Without this FK PostgREST fails the request with PGRST200
-- ("Could not find a relationship between 'event_trigger_rules' and
-- 'persona_core' in the schema cache").
--
-- ON DELETE SET NULL: persona_id is nullable (global rules apply when null),
-- so we keep the rule and just clear the link if a persona is deleted.
-- ============================================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
      FROM pg_constraint c
      JOIN pg_class      t ON t.oid = c.conrelid
      JOIN pg_namespace  n ON n.oid = t.relnamespace
     WHERE n.nspname = 'public'
       AND t.relname = 'event_trigger_rules'
       AND c.contype = 'f'
       AND c.conname = 'event_trigger_rules_persona_id_fkey'
  ) THEN
    ALTER TABLE public.event_trigger_rules
      ADD CONSTRAINT event_trigger_rules_persona_id_fkey
      FOREIGN KEY (persona_id)
      REFERENCES public.persona_core(id)
      ON DELETE SET NULL;
  END IF;
END$$;

-- Helpful for the LEFT JOIN PostgREST will issue when embedding.
CREATE INDEX IF NOT EXISTS idx_event_trigger_rules_persona_id
  ON public.event_trigger_rules(persona_id);
