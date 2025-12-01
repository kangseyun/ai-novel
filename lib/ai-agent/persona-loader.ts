/**
 * Persona Loader
 * persona_core 테이블에서 페르소나 마스터 데이터를 로드
 * 이 데이터는 절대 변하지 않는 페르소나의 핵심 정체성
 */

import { SupabaseClient } from '@supabase/supabase-js';
import { Persona, PersonaTraits, PersonaWorldview, RelationshipStage } from './types';
import { getDefaultPersonaData } from './default-personas';

// ============================================
// 페르소나 코어 데이터 타입
// ============================================

export interface PersonaCoreData {
  persona: Persona;
  traits: PersonaTraits;
  worldview: PersonaWorldview;
  // 추가 필드들
  absoluteRules: string[];
  firstScenarioId: string | null;
}

export interface PersonaBehavior {
  tone: string;
  distance: string;
  actions?: string;
  textingBehavior?: string;
  vulnerability?: number;
}

// ============================================
// Persona Loader
// ============================================

export class PersonaLoader {
  private supabase: SupabaseClient;
  private cache: Map<string, PersonaCoreData> = new Map();
  private cacheExpiry: Map<string, number> = new Map();
  private CACHE_TTL = 5 * 60 * 1000; // 5분 캐시

  constructor(supabase: SupabaseClient) {
    this.supabase = supabase;
  }

  /**
   * 페르소나 코어 데이터 로드
   * 캐싱을 통해 반복 로드 최소화
   */
  async loadPersona(personaId: string): Promise<PersonaCoreData> {
    // 캐시 확인
    const cached = this.getFromCache(personaId);
    if (cached) {
      return cached;
    }

    // DB에서 로드
    const { data, error } = await this.supabase
      .from('persona_core')
      .select('*')
      .eq('id', personaId)
      .single();

    if (error || !data) {
      // DB에 없으면 기본 데이터 사용
      const defaultData = getDefaultPersonaData(personaId);
      if (defaultData) {
        const coreData: PersonaCoreData = {
          persona: defaultData.persona,
          traits: defaultData.traits,
          worldview: defaultData.worldview,
          absoluteRules: defaultData.worldview.boundaries || [],
          firstScenarioId: null,
        };
        this.setCache(personaId, coreData);
        return coreData;
      }

      throw new Error(`Persona not found: ${personaId}`);
    }

    const coreData = this.mapCoreData(data);
    this.setCache(personaId, coreData);
    return coreData;
  }

  /**
   * 특정 관계 단계의 행동 패턴 조회
   */
  async getBehaviorForStage(
    personaId: string,
    stage: RelationshipStage
  ): Promise<PersonaBehavior> {
    const coreData = await this.loadPersona(personaId);
    const stageBehavior = coreData.traits.behaviorByStage[stage];

    if (!stageBehavior) {
      return {
        tone: 'neutral',
        distance: 'normal',
      };
    }

    return {
      tone: stageBehavior.tone || 'neutral',
      distance: stageBehavior.distance || 'normal',
      actions: stageBehavior.actions,
      textingBehavior: stageBehavior.textingBehavior,
      vulnerability: stageBehavior.vulnerability ? Number(stageBehavior.vulnerability) : undefined,
    };
  }

  /**
   * 페르소나의 첫 시나리오 ID 조회
   */
  async getFirstScenarioId(personaId: string): Promise<string | null> {
    const coreData = await this.loadPersona(personaId);
    return coreData.firstScenarioId;
  }

  /**
   * 페르소나의 절대 규칙 조회
   */
  async getAbsoluteRules(personaId: string): Promise<string[]> {
    const coreData = await this.loadPersona(personaId);
    return coreData.absoluteRules;
  }

  // ============================================
  // 캐시 관리
  // ============================================

  private getFromCache(personaId: string): PersonaCoreData | null {
    const expiry = this.cacheExpiry.get(personaId);
    if (expiry && Date.now() > expiry) {
      this.cache.delete(personaId);
      this.cacheExpiry.delete(personaId);
      return null;
    }
    return this.cache.get(personaId) || null;
  }

  private setCache(personaId: string, data: PersonaCoreData): void {
    this.cache.set(personaId, data);
    this.cacheExpiry.set(personaId, Date.now() + this.CACHE_TTL);
  }

  clearCache(): void {
    this.cache.clear();
    this.cacheExpiry.clear();
  }

  // ============================================
  // 데이터 매핑
  // ============================================

  private mapCoreData(data: Record<string, unknown>): PersonaCoreData {
    const appearance = data.appearance as Record<string, unknown> || {};
    const corePersonality = data.core_personality as Record<string, unknown> || {};
    const speechPatterns = data.speech_patterns as Record<string, unknown> || {};
    const worldview = data.worldview as Record<string, unknown> || {};
    const behaviorByStage = data.behavior_by_stage as Record<string, Record<string, string>> || {};

    return {
      persona: {
        id: data.id as string,
        name: data.name as string,
        fullName: data.full_name as string,
        role: data.role as string,
        age: data.age as number,
        ethnicity: data.ethnicity as string,
        appearance: {
          hair: appearance.hair as string || '',
          eyes: appearance.eyes as string || '',
          build: appearance.build as string || '',
          style: appearance.style as string || '',
          distinguishingFeatures: (appearance.distinguishing_features as string[]) || [],
        },
        voiceDescription: data.voice_description as string || '',
      },
      traits: {
        surfacePersonality: (corePersonality.surface as string[]) || [],
        hiddenPersonality: (corePersonality.hidden as string[]) || [],
        coreTrope: (corePersonality.core_trope as string) || '',
        likes: (data.likes as string[]) || [],
        dislikes: (data.dislikes as string[]) || [],
        speechPatterns: {
          formality: (speechPatterns.formality as PersonaTraits['speechPatterns']['formality']) || 'medium',
          petNames: (speechPatterns.pet_names as string[]) || [],
          verbalTics: (speechPatterns.verbal_tics as string[]) || [],
          emotionalRange: (speechPatterns.emotional_range as string) || 'moderate',
        },
        behaviorByStage: this.mapBehaviorByStage(behaviorByStage),
      },
      worldview: {
        settings: (worldview.settings as string[]) || [],
        timePeriod: (worldview.time_period as string) || 'Present',
        defaultRelationship: (worldview.default_relationship as string) || '',
        relationshipAlternatives: (worldview.relationship_alternatives as string[]) || [],
        mainConflict: (worldview.main_conflict as string) || '',
        conflictStakes: (worldview.conflict_stakes as string) || '',
        openingLine: (worldview.opening_line as string) || '',
        storyHooks: (worldview.story_hooks as string[]) || [],
        boundaries: (data.absolute_rules as string[]) || [],
      },
      absoluteRules: (data.absolute_rules as string[]) || [],
      firstScenarioId: data.first_scenario_id as string | null,
    };
  }

  private mapBehaviorByStage(
    data: Record<string, Record<string, string>>
  ): Record<RelationshipStage, PersonaTraits['behaviorByStage'][RelationshipStage]> {
    const stages: RelationshipStage[] = ['stranger', 'acquaintance', 'friend', 'close', 'intimate', 'lover'];
    const result: Record<string, PersonaTraits['behaviorByStage'][RelationshipStage]> = {};

    for (const stage of stages) {
      const stageData = data[stage] || {};
      result[stage] = {
        tone: stageData.tone || 'neutral',
        distance: stageData.distance || 'normal',
        ...stageData,
      };
    }

    return result as Record<RelationshipStage, PersonaTraits['behaviorByStage'][RelationshipStage]>;
  }
}

// ============================================
// 싱글톤 인스턴스
// ============================================

let personaLoaderInstance: PersonaLoader | null = null;

export function getPersonaLoader(supabase: SupabaseClient): PersonaLoader {
  if (!personaLoaderInstance) {
    personaLoaderInstance = new PersonaLoader(supabase);
  }
  return personaLoaderInstance;
}
