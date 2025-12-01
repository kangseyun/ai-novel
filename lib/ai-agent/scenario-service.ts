/**
 * Scenario Service
 * 시나리오 관리 - 첫 만남부터 스토리 에피소드까지
 */

import { SupabaseClient } from '@supabase/supabase-js';

// ============================================
// 타입 정의
// ============================================

export interface ScenarioTemplate {
  id: string;
  personaId: string;
  title: string;
  description: string | null;
  scenarioType: 'first_meeting' | 'story_episode' | 'dm_triggered' | 'scheduled_event' | 'milestone';
  triggerConditions: Record<string, unknown>;
  content: ScenarioContent;
  sortOrder: number;
  minAffection: number;
  minRelationshipStage: string;
  prerequisiteScenarios: string[];
  isActive: boolean;
}

export interface ScenarioContent {
  scenes: ScenarioScene[];
  endingConditions?: {
    proceedToDm?: boolean;
    unlockDmChat?: boolean;
    setRelationshipStage?: string;
    initialAffectionByChoice?: Record<string, number>;
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
  tone: string;
  nextScene: string;
  affectionChange: number;
  flag?: string;
  isPremium?: boolean;
}

export interface UserScenarioProgress {
  id: string;
  userId: string;
  personaId: string;
  scenarioId: string;
  status: 'not_started' | 'in_progress' | 'completed' | 'abandoned';
  currentPosition: {
    sceneIndex?: number;
    sceneId?: string;
  };
  choicesMade: Array<{
    sceneId: string;
    choiceId: string;
    timestamp: string;
  }>;
  startedAt: Date | null;
  completedAt: Date | null;
}

// ============================================
// Scenario Service
// ============================================

export class ScenarioService {
  private supabase: SupabaseClient;

  constructor(supabase: SupabaseClient) {
    this.supabase = supabase;
  }

  // ============================================
  // 시나리오 조회
  // ============================================

  /**
   * 페르소나의 첫 만남 시나리오 조회
   */
  async getFirstMeetingScenario(personaId: string): Promise<ScenarioTemplate | null> {
    const { data, error } = await this.supabase
      .from('scenario_templates')
      .select('*')
      .eq('persona_id', personaId)
      .eq('scenario_type', 'first_meeting')
      .eq('is_active', true)
      .order('sort_order', { ascending: true })
      .limit(1)
      .single();

    if (error || !data) {
      return null;
    }

    return this.mapScenarioTemplate(data);
  }

  /**
   * 시나리오 ID로 조회
   */
  async getScenario(scenarioId: string): Promise<ScenarioTemplate | null> {
    const { data, error } = await this.supabase
      .from('scenario_templates')
      .select('*')
      .eq('id', scenarioId)
      .single();

    if (error || !data) {
      return null;
    }

    return this.mapScenarioTemplate(data);
  }

  /**
   * 유저가 접근 가능한 시나리오 목록 조회
   */
  async getAvailableScenarios(
    userId: string,
    personaId: string,
    currentAffection: number,
    currentStage: string
  ): Promise<ScenarioTemplate[]> {
    // 완료한 시나리오 목록 조회
    const { data: progressData } = await this.supabase
      .from('user_scenario_progress')
      .select('scenario_id')
      .eq('user_id', userId)
      .eq('persona_id', personaId)
      .eq('status', 'completed');

    const completedScenarioIds = (progressData || []).map(p => p.scenario_id);

    // 조건에 맞는 시나리오 조회
    const { data, error } = await this.supabase
      .from('scenario_templates')
      .select('*')
      .eq('persona_id', personaId)
      .eq('is_active', true)
      .lte('min_affection', currentAffection)
      .order('sort_order', { ascending: true });

    if (error || !data) {
      return [];
    }

    // 필터링: 선행 조건 체크 및 미완료 시나리오만
    return data
      .filter(scenario => {
        // 이미 완료한 시나리오 제외
        if (completedScenarioIds.includes(scenario.id)) {
          return false;
        }

        // 선행 시나리오 조건 체크
        const prerequisites = scenario.prerequisite_scenarios || [];
        if (prerequisites.length > 0) {
          const allPrerequisitesMet = prerequisites.every(
            (prereq: string) => completedScenarioIds.includes(prereq)
          );
          if (!allPrerequisitesMet) {
            return false;
          }
        }

        return true;
      })
      .map(this.mapScenarioTemplate);
  }

  // ============================================
  // 진행 상태 관리
  // ============================================

  /**
   * 유저의 시나리오 진행 상태 조회
   */
  async getProgress(
    userId: string,
    personaId: string,
    scenarioId: string
  ): Promise<UserScenarioProgress | null> {
    const { data, error } = await this.supabase
      .from('user_scenario_progress')
      .select('*')
      .eq('user_id', userId)
      .eq('persona_id', personaId)
      .eq('scenario_id', scenarioId)
      .single();

    if (error || !data) {
      return null;
    }

    return this.mapProgress(data);
  }

  /**
   * 시나리오 시작
   */
  async startScenario(
    userId: string,
    personaId: string,
    scenarioId: string
  ): Promise<UserScenarioProgress> {
    const { data, error } = await this.supabase
      .from('user_scenario_progress')
      .upsert({
        user_id: userId,
        persona_id: personaId,
        scenario_id: scenarioId,
        status: 'in_progress',
        current_position: { sceneIndex: 0 },
        choices_made: [],
        started_at: new Date().toISOString(),
      }, {
        onConflict: 'user_id,persona_id,scenario_id'
      })
      .select()
      .single();

    if (error) throw error;
    return this.mapProgress(data);
  }

  /**
   * 시나리오 진행 (씬 이동)
   */
  async advanceScene(
    userId: string,
    personaId: string,
    scenarioId: string,
    nextSceneId: string,
    choiceMade?: { sceneId: string; choiceId: string }
  ): Promise<UserScenarioProgress> {
    const current = await this.getProgress(userId, personaId, scenarioId);

    const choicesMade = current?.choicesMade || [];
    if (choiceMade) {
      choicesMade.push({
        ...choiceMade,
        timestamp: new Date().toISOString(),
      });
    }

    const { data, error } = await this.supabase
      .from('user_scenario_progress')
      .update({
        current_position: { sceneId: nextSceneId },
        choices_made: choicesMade,
        updated_at: new Date().toISOString(),
      })
      .eq('user_id', userId)
      .eq('persona_id', personaId)
      .eq('scenario_id', scenarioId)
      .select()
      .single();

    if (error) throw error;
    return this.mapProgress(data);
  }

  /**
   * 시나리오 완료
   */
  async completeScenario(
    userId: string,
    personaId: string,
    scenarioId: string,
    endingData?: {
      finalAffection?: number;
      flagsToSet?: Record<string, boolean>;
    }
  ): Promise<void> {
    await this.supabase
      .from('user_scenario_progress')
      .update({
        status: 'completed',
        completed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('user_id', userId)
      .eq('persona_id', personaId)
      .eq('scenario_id', scenarioId);

    // 호감도 및 플래그 업데이트
    if (endingData?.finalAffection !== undefined) {
      await this.supabase
        .from('user_persona_relationships')
        .update({
          affection: endingData.finalAffection,
          story_flags: endingData.flagsToSet || {},
          updated_at: new Date().toISOString(),
        })
        .eq('user_id', userId)
        .eq('persona_id', personaId);
    }

    // 유저의 첫 시나리오 완료 표시
    await this.supabase
      .from('users')
      .update({
        first_scenario_completed: true,
        updated_at: new Date().toISOString(),
      })
      .eq('id', userId);
  }

  // ============================================
  // 유저 상태 확인
  // ============================================

  /**
   * 유저가 첫 시나리오를 완료했는지 확인
   */
  async hasCompletedFirstScenario(userId: string, personaId: string): Promise<boolean> {
    const { data } = await this.supabase
      .from('user_scenario_progress')
      .select('status')
      .eq('user_id', userId)
      .eq('persona_id', personaId)
      .eq('status', 'completed')
      .limit(1);

    return (data || []).length > 0;
  }

  /**
   * 유저의 현재 진행 중인 시나리오 조회
   */
  async getCurrentScenario(userId: string, personaId: string): Promise<{
    progress: UserScenarioProgress;
    scenario: ScenarioTemplate;
  } | null> {
    const { data, error } = await this.supabase
      .from('user_scenario_progress')
      .select('*')
      .eq('user_id', userId)
      .eq('persona_id', personaId)
      .eq('status', 'in_progress')
      .order('updated_at', { ascending: false })
      .limit(1)
      .single();

    if (error || !data) {
      return null;
    }

    const scenario = await this.getScenario(data.scenario_id);
    if (!scenario) {
      return null;
    }

    return {
      progress: this.mapProgress(data),
      scenario,
    };
  }

  // ============================================
  // 매핑 함수
  // ============================================

  private mapScenarioTemplate(data: Record<string, unknown>): ScenarioTemplate {
    return {
      id: data.id as string,
      personaId: data.persona_id as string,
      title: data.title as string,
      description: data.description as string | null,
      scenarioType: data.scenario_type as ScenarioTemplate['scenarioType'],
      triggerConditions: data.trigger_conditions as Record<string, unknown>,
      content: data.content as ScenarioContent,
      sortOrder: data.sort_order as number,
      minAffection: data.min_affection as number,
      minRelationshipStage: data.min_relationship_stage as string,
      prerequisiteScenarios: data.prerequisite_scenarios as string[],
      isActive: data.is_active as boolean,
    };
  }

  private mapProgress(data: Record<string, unknown>): UserScenarioProgress {
    return {
      id: data.id as string,
      userId: data.user_id as string,
      personaId: data.persona_id as string,
      scenarioId: data.scenario_id as string,
      status: data.status as UserScenarioProgress['status'],
      currentPosition: data.current_position as UserScenarioProgress['currentPosition'],
      choicesMade: data.choices_made as UserScenarioProgress['choicesMade'],
      startedAt: data.started_at ? new Date(data.started_at as string) : null,
      completedAt: data.completed_at ? new Date(data.completed_at as string) : null,
    };
  }
}

// ============================================
// 싱글톤 인스턴스
// ============================================

let scenarioServiceInstance: ScenarioService | null = null;

export function getScenarioService(supabase: SupabaseClient): ScenarioService {
  if (!scenarioServiceInstance) {
    scenarioServiceInstance = new ScenarioService(supabase);
  }
  return scenarioServiceInstance;
}
