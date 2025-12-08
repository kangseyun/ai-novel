'use client';

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';

export interface OnboardingPersona {
  id: string;
  name: { ko: string; en: string };
  teaserLine: { ko: string; en: string };
  image: string | null;
  color: string;
  available: boolean;
  scenarioId: string | null;
}

export interface OnboardingSettings {
  variantWeights: { A: number; B: number };
  defaultVariant: 'A' | 'B';
  showSkipButton: boolean;
  maxPersonasDisplay: number;
}

export interface ScenarioData {
  id: string;
  personaId: string;
  title: string;
  description: string | null;
  scenarioType: string;
  content: {
    scenes: ScenarioScene[];
    endingConditions?: {
      proceedToDm?: boolean;
      unlockDmChat?: boolean;
      setRelationshipStage?: string;
      initialAffectionByChoice?: Record<string, number>;
    };
  };
  character?: {
    id: string;
    name: string;
    fullName: string;
    appearance?: Record<string, unknown>;
    personality?: Record<string, unknown>;
    speechPatterns?: Record<string, unknown>;
    profileImageUrl?: string | null;
  };
}

export interface ScenarioScene {
  id: string;
  type: 'narration' | 'dialogue' | 'choice' | 'character_appear' | 'transition';
  text?: string;
  character?: string;
  expression?: string;
  innerThought?: string;
  background?: string;
  ambient?: string;
  transition?: string;
  prompt?: string;
  choices?: ScenarioChoice[];
}

export interface ScenarioChoice {
  id: string;
  text: string;
  tone?: string;
  nextScene: string;
  affectionChange: number;
  flag?: string;
  isPremium?: boolean;
}

interface UseOnboardingDataReturn {
  personas: OnboardingPersona[];
  settings: OnboardingSettings;
  isLoading: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
}

interface UseScenarioDataReturn {
  scenario: ScenarioData | null;
  isLoading: boolean;
  error: Error | null;
}

// 온보딩 데이터를 가져오는 훅
export function useOnboardingData(): UseOnboardingDataReturn {
  const [personas, setPersonas] = useState<OnboardingPersona[]>([]);
  const [settings, setSettings] = useState<OnboardingSettings>({
    variantWeights: { A: 0.5, B: 0.5 },
    defaultVariant: 'B',
    showSkipButton: true,
    maxPersonasDisplay: 5,
  });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchData = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      // API 엔드포인트 호출
      const response = await fetch('/api/onboarding');
      if (!response.ok) {
        throw new Error('Failed to fetch onboarding data');
      }

      const data = await response.json();
      setPersonas(data.personas || []);
      setSettings(data.settings || settings);
    } catch (err) {
      console.error('Error fetching onboarding data:', err);
      setError(err instanceof Error ? err : new Error('Unknown error'));
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return { personas, settings, isLoading, error, refetch: fetchData };
}

// 시나리오 데이터를 가져오는 훅
export function useScenarioData(scenarioId: string | null): UseScenarioDataReturn {
  const [scenario, setScenario] = useState<ScenarioData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!scenarioId) {
      setScenario(null);
      return;
    }

    const fetchScenario = async () => {
      try {
        setIsLoading(true);
        setError(null);

        const response = await fetch(`/api/scenarios/${scenarioId}`);
        if (!response.ok) {
          throw new Error('Failed to fetch scenario');
        }

        const data = await response.json();
        setScenario(data);
      } catch (err) {
        console.error('Error fetching scenario:', err);
        setError(err instanceof Error ? err : new Error('Unknown error'));
      } finally {
        setIsLoading(false);
      }
    };

    fetchScenario();
  }, [scenarioId]);

  return { scenario, isLoading, error };
}

// 온보딩 설정을 직접 Supabase에서 가져오는 함수 (서버 컴포넌트용)
export async function getOnboardingConfig() {
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

    if (personasError) throw personasError;

    // Fetch settings
    const { data: settingsData, error: settingsError } = await supabase
      .from('onboarding_settings')
      .select('setting_key, setting_value');

    if (settingsError) throw settingsError;

    // Parse settings
    const settings: Record<string, unknown> = {};
    settingsData?.forEach((s) => {
      settings[s.setting_key] = s.setting_value;
    });

    // Transform personas
    const personas = onboardingPersonas?.map((op) => {
      // persona_core can be an array or object depending on query
      const personaCoreData = op.persona_core as unknown;
      const personaCore = Array.isArray(personaCoreData)
        ? personaCoreData[0] as { name: string; first_scenario_id: string | null; profile_image_url: string | null } | undefined
        : personaCoreData as { name: string; first_scenario_id: string | null; profile_image_url: string | null } | null;
      return {
        id: op.persona_id,
        name: op.display_name as { ko: string; en: string },
        teaserLine: op.teaser_line as { ko: string; en: string },
        // onboarding_image_url을 우선 사용, 없으면 persona_core.profile_image_url 사용
        image: op.onboarding_image_url || personaCore?.profile_image_url || null,
        color: op.theme_color,
        available: true,
        scenarioId: op.onboarding_scenario_id || personaCore?.first_scenario_id || null,
      };
    }) || [];

    return {
      personas,
      settings: {
        variantWeights: (settings.variant_weights || { A: 0.5, B: 0.5 }) as { A: number; B: number },
        defaultVariant: (typeof settings.default_variant === 'string'
          ? settings.default_variant.replace(/"/g, '')
          : 'B') as 'A' | 'B',
        showSkipButton: (settings.show_skip_button ?? true) as boolean,
        maxPersonasDisplay: (settings.max_personas_display || 5) as number,
      },
    };
  } catch (error) {
    console.error('Error fetching onboarding config:', error);
    return null;
  }
}
