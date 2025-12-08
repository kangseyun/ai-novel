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

// 보상 관련 타입
export interface ScenarioReward {
  id: string;
  scenarioId: string;
  rewardTypeId: string;
  conditionType: 'completion' | 'first_completion' | 'choice_based' | 'perfect_run' | 'speed_run';
  requiredChoiceIds: string[];
  amount: number;
  metadata: Record<string, unknown>;
  displayOrder: number;
  isActive: boolean;
}

export interface GrantedReward {
  rewardId: string;
  type: string;
  name: string;
  amount: number;
  category: string;
}

// 메트릭스 관련 타입
export interface ScenarioStats {
  overview: {
    totalSessions: number;
    uniqueUsers: number;
    completedSessions: number;
    abandonedSessions: number;
    completionRate: number;
    avgProgressPercent: number;
    avgCompletionTimeSeconds: number;
    totalChoicesMade: number;
    premiumChoicesMade: number;
    totalAffectionGained: number;
  };
  dailyStats: Array<{
    date: string;
    sessions: number;
    completed: number;
    abandoned: number;
    completionRate: number;
  }>;
  choiceDistribution: Array<{
    sceneId: string;
    choiceId: string;
    choiceText: string;
    selectionCount: number;
    isPremium: boolean;
    selectionPercentage: number;
  }>;
  dropOffPoints: Array<{
    sceneId: string;
    sceneIndex: number;
    dropOffCount: number;
    dropOffRate: number;
  }>;
}

export interface ScenarioSession {
  id: string;
  userId: string;
  scenarioId: string;
  personaId: string | null;
  status: 'started' | 'in_progress' | 'completed' | 'abandoned';
  startedAt: Date;
  lastActivityAt: Date;
  completedAt: Date | null;
  currentSceneId: string | null;
  currentSceneIndex: number;
  totalScenes: number | null;
  choicesMade: Array<{
    sceneId: string;
    choiceId: string;
    choiceText?: string;
    isPremium?: boolean;
    affectionChange?: number;
    timestamp: string;
  }>;
  durationSeconds: number | null;
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
      choicesMade?: Array<{ sceneId: string; choiceId: string }>;
    }
  ): Promise<void> {
    // 시나리오 정보 조회
    const scenario = await this.getScenario(scenarioId);

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
      // 현재 시나리오 완료 수 조회
      const { data: currentRel } = await this.supabase
        .from('user_persona_relationships')
        .select('total_scenarios_completed, story_flags')
        .eq('user_id', userId)
        .eq('persona_id', personaId)
        .single();

      const currentCount = currentRel?.total_scenarios_completed || 0;
      const currentFlags = currentRel?.story_flags || {};

      await this.supabase
        .from('user_persona_relationships')
        .update({
          affection: endingData.finalAffection,
          story_flags: { ...currentFlags, ...(endingData.flagsToSet || {}) },
          total_scenarios_completed: currentCount + 1,
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

    // 시나리오 완료 메모리 저장
    const memoryType = scenario?.scenarioType === 'first_meeting' ? 'first_meeting' : 'milestone';
    await this.supabase
      .from('persona_memories')
      .upsert({
        user_id: userId,
        persona_id: personaId,
        memory_type: memoryType,
        summary: `시나리오 완료: ${scenario?.title || scenarioId}`,
        details: {
          scenarioId,
          scenarioType: scenario?.scenarioType,
          choicesMade: endingData?.choicesMade || [],
          finalAffection: endingData?.finalAffection,
        },
        emotional_weight: scenario?.scenarioType === 'first_meeting' ? 10 : 7,
        importance_score: scenario?.scenarioType === 'first_meeting' ? 10 : 7,
        affection_at_time: endingData?.finalAffection || 0,
        source_type: 'scenario',
        source_id: scenarioId,
        is_active: true,
      }, {
        onConflict: 'user_id,persona_id,memory_type,summary',
      });

    // 첫 시나리오 마일스톤 기록
    if (scenario?.scenarioType === 'first_meeting') {
      await this.supabase
        .from('relationship_milestones')
        .upsert({
          user_id: userId,
          persona_id: personaId,
          milestone_type: 'first_scenario',
          affection_at_time: endingData?.finalAffection || 0,
          relationship_stage_at_time: 'stranger',
          context: { scenarioId, scenarioTitle: scenario.title },
        }, {
          onConflict: 'user_id,persona_id,milestone_type',
        });
    }

    // 여정 통계 업데이트
    await this.supabase
      .from('user_journey_stats')
      .upsert({
        user_id: userId,
        persona_id: personaId,
        total_scenarios_completed: 1,
        total_choices_made: endingData?.choicesMade?.length || 0,
      }, {
        onConflict: 'user_id,persona_id',
      });

    // 보상 지급은 별도로 호출 (grantScenarioRewards)
  }

  // ============================================
  // 보상 시스템
  // ============================================

  /**
   * 시나리오 완료 보상 지급
   */
  async grantScenarioRewards(
    userId: string,
    scenarioId: string,
    choicesMade: string[],
    completionTimeSeconds?: number
  ): Promise<GrantedReward[]> {
    try {
      const { data, error } = await this.supabase.rpc('grant_scenario_reward', {
        p_user_id: userId,
        p_scenario_id: scenarioId,
        p_choices_made: JSON.stringify(choicesMade),
        p_completion_time_seconds: completionTimeSeconds,
      });

      if (error) {
        console.error('Error granting rewards:', error);
        return [];
      }

      // JSONB 배열을 파싱
      const rewards = Array.isArray(data) ? data : [];
      return rewards.map((r: Record<string, unknown>) => ({
        rewardId: r.reward_id as string,
        type: r.type as string,
        name: r.name as string,
        amount: r.amount as number,
        category: r.category as string,
      }));
    } catch (err) {
      console.error('Error in grantScenarioRewards:', err);
      return [];
    }
  }

  /**
   * 시나리오의 보상 목록 조회
   */
  async getScenarioRewards(scenarioId: string): Promise<ScenarioReward[]> {
    const { data, error } = await this.supabase
      .from('scenario_rewards')
      .select(`
        *,
        reward_types (
          id,
          name,
          category,
          icon
        )
      `)
      .eq('scenario_id', scenarioId)
      .eq('is_active', true)
      .order('display_order');

    if (error || !data) {
      return [];
    }

    return data.map(r => ({
      id: r.id,
      scenarioId: r.scenario_id,
      rewardTypeId: r.reward_type_id,
      conditionType: r.condition_type,
      requiredChoiceIds: r.required_choice_ids || [],
      amount: r.amount,
      metadata: r.metadata || {},
      displayOrder: r.display_order,
      isActive: r.is_active,
    }));
  }

  /**
   * 유저 잔액 조회
   */
  async getUserBalance(userId: string, currencyType: string): Promise<number> {
    const { data } = await this.supabase
      .from('user_balances')
      .select('balance')
      .eq('user_id', userId)
      .eq('currency_type', currencyType)
      .single();

    return data?.balance || 0;
  }

  /**
   * 유저의 모든 잔액 조회
   */
  async getUserBalances(userId: string): Promise<Record<string, number>> {
    const { data } = await this.supabase
      .from('user_balances')
      .select('currency_type, balance')
      .eq('user_id', userId);

    const balances: Record<string, number> = {};
    (data || []).forEach((b: { currency_type: string; balance: number }) => {
      balances[b.currency_type] = b.balance;
    });
    return balances;
  }

  /**
   * 유저의 시나리오 보상 수령 기록 조회
   */
  async getUserRewardClaims(userId: string, scenarioId?: string): Promise<{
    scenarioId: string;
    rewardTypeId: string;
    amount: number;
    claimedAt: Date;
  }[]> {
    let query = this.supabase
      .from('user_reward_claims')
      .select('scenario_id, reward_type_id, amount, claimed_at')
      .eq('user_id', userId);

    if (scenarioId) {
      query = query.eq('scenario_id', scenarioId);
    }

    const { data } = await query.order('claimed_at', { ascending: false });

    return (data || []).map((c: Record<string, unknown>) => ({
      scenarioId: c.scenario_id as string,
      rewardTypeId: c.reward_type_id as string,
      amount: c.amount as number,
      claimedAt: new Date(c.claimed_at as string),
    }));
  }

  // ============================================
  // 메트릭스 시스템
  // ============================================

  /**
   * 시나리오 세션 시작
   */
  async startSession(
    userId: string,
    scenarioId: string,
    personaId?: string,
    totalScenes?: number,
    userAgent?: string,
    platform?: string
  ): Promise<string> {
    try {
      const { data, error } = await this.supabase.rpc('start_scenario_session', {
        p_user_id: userId,
        p_scenario_id: scenarioId,
        p_persona_id: personaId || null,
        p_total_scenes: totalScenes || null,
        p_user_agent: userAgent || null,
        p_platform: platform || null,
      });

      if (error) {
        console.error('Error starting session:', error);
        throw error;
      }

      return data as string;
    } catch (err) {
      console.error('Error in startSession:', err);
      throw err;
    }
  }

  /**
   * 씬 진입 기록
   */
  async recordSceneView(
    sessionId: string,
    sceneId: string,
    sceneIndex: number,
    timeSpentMs: number = 0
  ): Promise<void> {
    try {
      const { error } = await this.supabase.rpc('record_scene_view', {
        p_session_id: sessionId,
        p_scene_id: sceneId,
        p_scene_index: sceneIndex,
        p_time_spent_ms: timeSpentMs,
      });

      if (error) {
        console.error('Error recording scene view:', error);
      }
    } catch (err) {
      console.error('Error in recordSceneView:', err);
    }
  }

  /**
   * 선택지 기록
   */
  async recordChoiceMade(
    sessionId: string,
    sceneId: string,
    choiceId: string,
    choiceText?: string,
    isPremium: boolean = false,
    affectionChange: number = 0
  ): Promise<void> {
    try {
      const { error } = await this.supabase.rpc('record_choice_made', {
        p_session_id: sessionId,
        p_scene_id: sceneId,
        p_choice_id: choiceId,
        p_choice_text: choiceText || null,
        p_is_premium: isPremium,
        p_affection_change: affectionChange,
      });

      if (error) {
        console.error('Error recording choice:', error);
      }
    } catch (err) {
      console.error('Error in recordChoiceMade:', err);
    }
  }

  /**
   * 세션 완료 처리
   */
  async completeSession(sessionId: string): Promise<void> {
    try {
      const { error } = await this.supabase.rpc('complete_scenario_session', {
        p_session_id: sessionId,
      });

      if (error) {
        console.error('Error completing session:', error);
      }
    } catch (err) {
      console.error('Error in completeSession:', err);
    }
  }

  /**
   * 세션 이탈 처리
   */
  async abandonSession(sessionId: string): Promise<void> {
    try {
      const { error } = await this.supabase.rpc('abandon_scenario_session', {
        p_session_id: sessionId,
      });

      if (error) {
        console.error('Error abandoning session:', error);
      }
    } catch (err) {
      console.error('Error in abandonSession:', err);
    }
  }

  /**
   * 시나리오 통계 조회
   */
  async getScenarioStats(scenarioId: string, days: number = 30): Promise<ScenarioStats | null> {
    try {
      const { data, error } = await this.supabase.rpc('get_scenario_stats', {
        p_scenario_id: scenarioId,
        p_days: days,
      });

      if (error) {
        console.error('Error getting scenario stats:', error);
        return null;
      }

      const stats = data as Record<string, unknown>;

      // snake_case를 camelCase로 변환
      const overview = stats.overview as Record<string, unknown>;
      const dailyStats = (stats.daily_stats || []) as Array<Record<string, unknown>>;
      const choiceDistribution = (stats.choice_distribution || []) as Array<Record<string, unknown>>;
      const dropOffPoints = (stats.drop_off_points || []) as Array<Record<string, unknown>>;

      return {
        overview: {
          totalSessions: (overview?.total_sessions as number) || 0,
          uniqueUsers: (overview?.unique_users as number) || 0,
          completedSessions: (overview?.completed_sessions as number) || 0,
          abandonedSessions: (overview?.abandoned_sessions as number) || 0,
          completionRate: (overview?.completion_rate as number) || 0,
          avgProgressPercent: (overview?.avg_progress_percent as number) || 0,
          avgCompletionTimeSeconds: (overview?.avg_completion_time_seconds as number) || 0,
          totalChoicesMade: (overview?.total_choices_made as number) || 0,
          premiumChoicesMade: (overview?.premium_choices_made as number) || 0,
          totalAffectionGained: (overview?.total_affection_gained as number) || 0,
        },
        dailyStats: dailyStats.map((d) => ({
          date: d.date as string,
          sessions: d.sessions as number,
          completed: d.completed as number,
          abandoned: d.abandoned as number,
          completionRate: d.completion_rate as number,
        })),
        choiceDistribution: choiceDistribution.map((c) => ({
          sceneId: c.scene_id as string,
          choiceId: c.choice_id as string,
          choiceText: c.choice_text as string,
          selectionCount: c.selection_count as number,
          isPremium: c.is_premium as boolean,
          selectionPercentage: c.selection_percentage as number,
        })),
        dropOffPoints: dropOffPoints.map((d) => ({
          sceneId: d.scene_id as string,
          sceneIndex: d.scene_index as number,
          dropOffCount: d.drop_off_count as number,
          dropOffRate: d.drop_off_rate as number,
        })),
      };
    } catch (err) {
      console.error('Error in getScenarioStats:', err);
      return null;
    }
  }

  /**
   * 시나리오 세션 조회
   */
  async getSession(sessionId: string): Promise<ScenarioSession | null> {
    const { data, error } = await this.supabase
      .from('scenario_sessions')
      .select('*')
      .eq('id', sessionId)
      .single();

    if (error || !data) {
      return null;
    }

    return this.mapSession(data);
  }

  /**
   * 유저의 시나리오 세션 목록 조회
   */
  async getUserSessions(
    userId: string,
    scenarioId?: string,
    status?: ScenarioSession['status'],
    limit: number = 20
  ): Promise<ScenarioSession[]> {
    let query = this.supabase
      .from('scenario_sessions')
      .select('*')
      .eq('user_id', userId)
      .order('started_at', { ascending: false })
      .limit(limit);

    if (scenarioId) {
      query = query.eq('scenario_id', scenarioId);
    }

    if (status) {
      query = query.eq('status', status);
    }

    const { data, error } = await query;

    if (error || !data) {
      return [];
    }

    return data.map(this.mapSession);
  }

  /**
   * 유저의 시나리오 진행 상태 조회 (메트릭스용)
   */
  async getUserScenarioMetrics(userId: string, scenarioId: string): Promise<{
    isCompleted: boolean;
    completionCount: number;
    bestProgressPercent: number;
    firstStartedAt: Date | null;
    firstCompletedAt: Date | null;
    lastPlayedAt: Date | null;
    totalPlayTimeSeconds: number;
    lastChoicesMade: Array<{ sceneId: string; choiceId: string }>;
    rewardsClaimed: Array<{ rewardId: string; amount: number }>;
  } | null> {
    const { data, error } = await this.supabase
      .from('user_scenario_progress')
      .select('*')
      .eq('user_id', userId)
      .eq('scenario_id', scenarioId)
      .single();

    if (error || !data) {
      return null;
    }

    return {
      isCompleted: data.is_completed as boolean,
      completionCount: data.completion_count as number,
      bestProgressPercent: data.best_progress_percent as number,
      firstStartedAt: data.first_started_at ? new Date(data.first_started_at as string) : null,
      firstCompletedAt: data.first_completed_at ? new Date(data.first_completed_at as string) : null,
      lastPlayedAt: data.last_played_at ? new Date(data.last_played_at as string) : null,
      totalPlayTimeSeconds: data.total_play_time_seconds as number,
      lastChoicesMade: (data.last_choices_made as Array<{ sceneId: string; choiceId: string }>) || [],
      rewardsClaimed: (data.rewards_claimed as Array<{ rewardId: string; amount: number }>) || [],
    };
  }

  /**
   * 일별 통계 조회
   */
  async getDailyStats(scenarioId: string, startDate: Date, endDate: Date): Promise<Array<{
    date: string;
    totalSessions: number;
    uniqueUsers: number;
    completedSessions: number;
    abandonedSessions: number;
    avgProgressPercent: number;
    avgCompletionTimeSeconds: number;
    totalChoicesMade: number;
    premiumChoicesMade: number;
    totalAffectionGained: number;
  }>> {
    const { data, error } = await this.supabase
      .from('scenario_daily_stats')
      .select('*')
      .eq('scenario_id', scenarioId)
      .gte('stat_date', startDate.toISOString().split('T')[0])
      .lte('stat_date', endDate.toISOString().split('T')[0])
      .order('stat_date', { ascending: false });

    if (error || !data) {
      return [];
    }

    return data.map((d: Record<string, unknown>) => ({
      date: d.stat_date as string,
      totalSessions: d.total_sessions as number,
      uniqueUsers: d.unique_users as number,
      completedSessions: d.completed_sessions as number,
      abandonedSessions: d.abandoned_sessions as number,
      avgProgressPercent: d.avg_progress_percent as number,
      avgCompletionTimeSeconds: d.avg_completion_time_seconds as number,
      totalChoicesMade: d.total_choices_made as number,
      premiumChoicesMade: d.premium_choices_made as number,
      totalAffectionGained: d.total_affection_gained as number,
    }));
  }

  /**
   * 선택지 통계 조회
   */
  async getChoiceStats(scenarioId: string): Promise<Array<{
    sceneId: string;
    choiceId: string;
    choiceText: string | null;
    selectionCount: number;
    uniqueUserCount: number;
    isPremium: boolean;
    premiumConversionCount: number;
    affectionChange: number;
  }>> {
    const { data, error } = await this.supabase
      .from('scenario_choice_stats')
      .select('*')
      .eq('scenario_id', scenarioId)
      .order('scene_id')
      .order('selection_count', { ascending: false });

    if (error || !data) {
      return [];
    }

    return data.map((c: Record<string, unknown>) => ({
      sceneId: c.scene_id as string,
      choiceId: c.choice_id as string,
      choiceText: c.choice_text as string | null,
      selectionCount: c.selection_count as number,
      uniqueUserCount: c.unique_user_count as number,
      isPremium: c.is_premium as boolean,
      premiumConversionCount: c.premium_conversion_count as number,
      affectionChange: c.affection_change as number,
    }));
  }

  /**
   * 씬별 통계 조회
   */
  async getSceneStats(scenarioId: string): Promise<Array<{
    sceneId: string;
    sceneIndex: number;
    viewCount: number;
    uniqueUserCount: number;
    avgTimeSpentMs: number;
    dropOffCount: number;
    dropOffRate: number;
  }>> {
    const { data, error } = await this.supabase
      .from('scenario_scene_stats')
      .select('*')
      .eq('scenario_id', scenarioId)
      .order('scene_index');

    if (error || !data) {
      return [];
    }

    return data.map((s: Record<string, unknown>) => ({
      sceneId: s.scene_id as string,
      sceneIndex: s.scene_index as number,
      viewCount: s.view_count as number,
      uniqueUserCount: s.unique_user_count as number,
      avgTimeSpentMs: s.avg_time_spent_ms as number,
      dropOffCount: s.drop_off_count as number,
      dropOffRate: s.view_count ? ((s.drop_off_count as number) / (s.view_count as number)) * 100 : 0,
    }));
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

  private mapSession(data: Record<string, unknown>): ScenarioSession {
    return {
      id: data.id as string,
      userId: data.user_id as string,
      scenarioId: data.scenario_id as string,
      personaId: data.persona_id as string | null,
      status: data.status as ScenarioSession['status'],
      startedAt: new Date(data.started_at as string),
      lastActivityAt: new Date(data.last_activity_at as string),
      completedAt: data.completed_at ? new Date(data.completed_at as string) : null,
      currentSceneId: data.current_scene_id as string | null,
      currentSceneIndex: data.current_scene_index as number,
      totalScenes: data.total_scenes as number | null,
      choicesMade: (data.choices_made as ScenarioSession['choicesMade']) || [],
      durationSeconds: data.duration_seconds as number | null,
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
