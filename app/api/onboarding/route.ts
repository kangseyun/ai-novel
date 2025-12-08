import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

export async function GET() {
  try {
    // Fetch active onboarding personas
    const { data: onboardingPersonas, error: personasError } = await supabase
      .from('onboarding_personas')
      .select(`
        id,
        persona_id,
        display_name,
        teaser_line,
        onboarding_image_url,
        theme_color,
        display_order,
        is_active,
        onboarding_scenario_id,
        persona_core (
          name,
          full_name,
          first_scenario_id,
          profile_image_url
        )
      `)
      .eq('is_active', true)
      .order('display_order', { ascending: true });

    if (personasError) {
      console.error('Error fetching onboarding personas:', personasError);
      throw personasError;
    }

    // Fetch onboarding settings
    const { data: settingsData, error: settingsError } = await supabase
      .from('onboarding_settings')
      .select('setting_key, setting_value');

    if (settingsError) {
      console.error('Error fetching onboarding settings:', settingsError);
      throw settingsError;
    }

    // Parse settings
    const settings: Record<string, unknown> = {};
    settingsData?.forEach((s) => {
      settings[s.setting_key] = s.setting_value;
    });

    // Transform personas to expected format
    const personas = onboardingPersonas?.map((op) => {
      // persona_core can be an array or object depending on query
      const personaCoreData = op.persona_core as unknown;
      const personaCore = Array.isArray(personaCoreData)
        ? personaCoreData[0] as { name: string; full_name: string; first_scenario_id: string | null; profile_image_url: string | null } | undefined
        : personaCoreData as { name: string; full_name: string; first_scenario_id: string | null; profile_image_url: string | null } | null;
      return {
        id: op.persona_id,
        name: op.display_name,
        teaserLine: op.teaser_line,
        // onboarding_image_url을 우선 사용, 없으면 persona_core.profile_image_url 사용
        image: op.onboarding_image_url || personaCore?.profile_image_url || null,
        color: op.theme_color,
        available: true,
        scenarioId: op.onboarding_scenario_id || personaCore?.first_scenario_id || null,
      };
    }) || [];

    return NextResponse.json({
      personas,
      settings: {
        variantWeights: settings.variant_weights || { A: 0.33, B: 0.33, C: 0.34 },
        defaultVariant: typeof settings.default_variant === 'string'
          ? settings.default_variant.replace(/"/g, '')
          : 'B',
        showSkipButton: settings.show_skip_button ?? true,
        maxPersonasDisplay: settings.max_personas_display || 5,
      },
    });
  } catch (error) {
    console.error('Error in onboarding API:', error);
    return NextResponse.json(
      { error: 'Failed to fetch onboarding data' },
      { status: 500 }
    );
  }
}
