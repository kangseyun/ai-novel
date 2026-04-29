-- ============================================================================
-- 010_onboarding.sql
-- Onboarding configuration: which personas are featured, copy per locale,
-- A/B variant weights, default flags.
--
-- Consolidates legacy migration: 050 (onboarding_personas + settings,
-- scenario type extension, RLS).
-- ============================================================================

-- ----------------------------------------------------------------------------
-- onboarding_personas — featured persona list with localized teaser copy
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.onboarding_personas (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  persona_id              TEXT NOT NULL REFERENCES public.persona_core(id) ON DELETE CASCADE,

  display_name            JSONB NOT NULL DEFAULT '{"ko":"","en":""}'::jsonb,
  teaser_line             JSONB NOT NULL DEFAULT '{"ko":"","en":""}'::jsonb,
  onboarding_image_url    TEXT,
  theme_color             TEXT NOT NULL DEFAULT '#8B5CF6',
  display_order           INTEGER NOT NULL DEFAULT 0,
  is_active               BOOLEAN NOT NULL DEFAULT true,

  -- Optional override of the first scenario specifically for onboarding
  onboarding_scenario_id  TEXT REFERENCES public.scenario_templates(id) ON DELETE SET NULL,

  created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (persona_id)
);

CREATE INDEX IF NOT EXISTS idx_onboarding_personas_active ON public.onboarding_personas(is_active);
CREATE INDEX IF NOT EXISTS idx_onboarding_personas_order  ON public.onboarding_personas(display_order);

DROP TRIGGER IF EXISTS trg_onboarding_personas_updated_at ON public.onboarding_personas;
CREATE TRIGGER trg_onboarding_personas_updated_at
  BEFORE UPDATE ON public.onboarding_personas
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ----------------------------------------------------------------------------
-- onboarding_settings — global key/value config
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.onboarding_settings (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  setting_key     TEXT UNIQUE NOT NULL,
  setting_value   JSONB NOT NULL DEFAULT '{}'::jsonb,
  description     TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_onboarding_settings_key
  ON public.onboarding_settings(setting_key);

DROP TRIGGER IF EXISTS trg_onboarding_settings_updated_at ON public.onboarding_settings;
CREATE TRIGGER trg_onboarding_settings_updated_at
  BEFORE UPDATE ON public.onboarding_settings
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

INSERT INTO public.onboarding_settings (setting_key, setting_value, description) VALUES
  ('variant_weights',         '{"A":0.33,"B":0.33,"C":0.34}'::jsonb, 'A/B/C variant weights'),
  ('default_variant',         '"B"'::jsonb,                          'Default onboarding variant'),
  ('show_skip_button',        'true'::jsonb,                         'Whether the skip button is shown'),
  ('max_personas_display',    '5'::jsonb,                            'Max personas listed in onboarding'),
  ('initial_follows_required','5'::jsonb,                            'Min personas user must follow to finish onboarding')
ON CONFLICT (setting_key) DO NOTHING;

-- ============================================================================
-- Row Level Security
-- ============================================================================
ALTER TABLE public.onboarding_personas  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.onboarding_settings  ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "onboarding_personas_read" ON public.onboarding_personas;
CREATE POLICY "onboarding_personas_read" ON public.onboarding_personas
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "onboarding_personas_admin_write" ON public.onboarding_personas;
CREATE POLICY "onboarding_personas_admin_write" ON public.onboarding_personas
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.role = 'admin'));

DROP POLICY IF EXISTS "onboarding_settings_read" ON public.onboarding_settings;
CREATE POLICY "onboarding_settings_read" ON public.onboarding_settings
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "onboarding_settings_admin_write" ON public.onboarding_settings;
CREATE POLICY "onboarding_settings_admin_write" ON public.onboarding_settings
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.role = 'admin'));
