/**
 * Persona Configuration Service
 * DB에서 페르소나 설정을 가져오는 서비스
 */

import { createServerClient } from '../../supabase-server';
import { PersonaConfig, ExampleDialogue, ToneConfig } from '../../../types/persona-engine';

// 캐시 (서버 재시작까지 유지)
const configCache = new Map<string, { data: PersonaConfig; timestamp: number }>();
const CACHE_TTL = 5 * 60 * 1000; // 5분

export interface PersonaCoreData {
  id: string;
  name: string;
  full_name: string;
  role: string;
  age: number;
  ethnicity: string | null;
  voice_description: string | null;
  appearance: {
    hair?: string;
    eyes?: string;
    build?: string;
    style?: string;
    distinguishingFeatures?: string[];
  };
  base_instruction: string | null;
  core_personality: {
    surface?: string[];
    hidden?: string[];
    core_trope?: string;
  };
  speech_patterns: {
    formality?: string;
    petNames?: string[];
    verbalTics?: string[];
    emotionalRange?: string;
  };
  tone_config: ToneConfig | null;
  situation_presets: Record<string, string[]> | null;
  behavior_by_stage: Record<string, {
    affection_range?: number[];
    behaviors?: string[];
    allowed_topics?: string[];
    intimacy_level?: string;
  }>;
  worldview: {
    settings?: string[];
    timePeriod?: string;
    defaultRelationship?: string;
    relationshipAlternatives?: string[];
    mainConflict?: string;
    conflictStakes?: string;
    openingLine?: string;
    storyHooks?: string[];
    boundaries?: string[];
  };
  likes: string[];
  dislikes: string[];
  absolute_rules: string[];
  first_scenario_id: string | null;
}

export interface ExampleDialogueRow {
  id: string;
  tags: string[];
  messages: Array<{ role: string; content: string }>;
  priority: number;
  min_stage: string | null;
}

export interface LoreRow {
  category: string;
  key: string;
  content: string;
}

/**
 * DB에서 페르소나 설정 가져오기
 */
export async function getPersonaConfigFromDB(personaId: string): Promise<PersonaConfig | null> {
  // 캐시 확인
  const cached = configCache.get(personaId);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.data;
  }

  try {
    const supabase = await createServerClient();

    // 병렬로 모든 데이터 조회
    const [coreResult, dialoguesResult, loreResult] = await Promise.all([
      supabase
        .from('persona_core')
        .select('*')
        .eq('id', personaId)
        .single(),
      supabase
        .from('persona_example_dialogues')
        .select('*')
        .eq('persona_id', personaId)
        .order('priority', { ascending: false }),
      supabase
        .from('persona_lore')
        .select('category, key, content')
        .eq('persona_id', personaId),
    ]);

    if (coreResult.error || !coreResult.data) {
      console.error('[PersonaConfigService] Core data not found:', personaId);
      return null;
    }

    const core = coreResult.data as PersonaCoreData;
    const dialogues = (dialoguesResult.data || []) as ExampleDialogueRow[];
    const loreItems = (loreResult.data || []) as LoreRow[];

    // PersonaConfig 형식으로 변환
    const config: PersonaConfig = {
      name: core.name,
      role: core.role,
      baseInstruction: core.base_instruction || '',

      exampleDialogues: dialogues.map(d => ({
        tags: d.tags,
        messages: d.messages.map(m => ({
          role: m.role as 'user' | 'char',
          content: m.content,
        })),
      })),

      lore: loreItems.map(l => ({
        key: l.key,
        content: l.content,
      })),

      situationPresets: core.situation_presets || {},

      toneConfig: core.tone_config || {
        style: 'chat',
        allowEmoji: true,
        allowSlang: true,
        minLength: 1,
        maxLength: 3,
      },
    };

    // 캐시에 저장
    configCache.set(personaId, { data: config, timestamp: Date.now() });

    return config;
  } catch (error) {
    console.error('[PersonaConfigService] Error:', error);
    return null;
  }
}

/**
 * 페르소나 전체 데이터 가져오기 (persona_core 전체)
 */
export async function getFullPersonaData(personaId: string): Promise<PersonaCoreData | null> {
  try {
    const supabase = await createServerClient();

    const { data, error } = await supabase
      .from('persona_core')
      .select('*')
      .eq('id', personaId)
      .single();

    if (error) {
      console.error('[PersonaConfigService] Error:', error);
      return null;
    }

    return data as PersonaCoreData;
  } catch (error) {
    console.error('[PersonaConfigService] Error:', error);
    return null;
  }
}

/**
 * 태그/상황에 맞는 예시 대화 가져오기
 */
export async function getRelevantExampleDialogues(
  personaId: string,
  tags?: string[],
  stage?: string
): Promise<ExampleDialogue[]> {
  try {
    const supabase = await createServerClient();

    let query = supabase
      .from('persona_example_dialogues')
      .select('*')
      .eq('persona_id', personaId);

    // 태그 필터 (배열 overlap)
    if (tags && tags.length > 0) {
      query = query.overlaps('tags', tags);
    }

    const { data, error } = await query.order('priority', { ascending: false });

    if (error) {
      console.error('[PersonaConfigService] Error:', error);
      return [];
    }

    const dialogues = (data || []) as ExampleDialogueRow[];

    // 단계 필터링 (클라이언트 측)
    const stageOrder: Record<string, number> = {
      stranger: 0,
      acquaintance: 1,
      friend: 2,
      close: 3,
      intimate: 4,
      lover: 5,
    };

    const currentStageIdx = stageOrder[stage || 'stranger'] || 0;

    return dialogues
      .filter(d => {
        if (!d.min_stage) return true;
        const minStageIdx = stageOrder[d.min_stage] || 0;
        return currentStageIdx >= minStageIdx;
      })
      .map(d => ({
        tags: d.tags,
        messages: d.messages.map(m => ({
          role: m.role as 'user' | 'char',
          content: m.content,
        })),
      }));
  } catch (error) {
    console.error('[PersonaConfigService] Error:', error);
    return [];
  }
}

/**
 * 캐시 무효화
 */
export function invalidatePersonaCache(personaId?: string): void {
  if (personaId) {
    configCache.delete(personaId);
  } else {
    configCache.clear();
  }
}
