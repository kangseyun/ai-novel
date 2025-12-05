/**
 * Relationship Manager
 * 관계 시스템 통합 관리 서비스
 *
 * 역할:
 * 1. 관계 상태 관리 (호감도, 단계, 스탯)
 * 2. 장기 기억 저장/조회 (UI용 persona_memories)
 * 3. 별명 관리
 * 4. 대화 요약 생성
 * 5. UI 데이터 포맷팅
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import {
  RelationshipStage,
  RelationshipState,
  RelationshipStats,
  ProgressInfo,
  Memory,
  MemoryType,
  SaveMemoryInput,
  UpdateRelationshipInput,
  SetNicknameInput,
  MemoryListResponse,
  MemoryDetailResponse,
  PersonaRelationshipSummary,
  FormattedMemory,
  LockedMemory,
  FormattedSummary,
} from './types';
import {
  calculateRelationshipStage,
  calculateRelationshipStats,
  calculateProgressInfo,
  applyAffectionChange,
  applyTrustChange,
  applyIntimacyChange,
  getDefaultEmotionalWeight,
  getArcLabel,
} from './stats-calculator';
import {
  getMemoryTitle,
  getRelationshipLabel,
  getUnlockCondition,
  formatMemory,
  getLockedMemories,
  formatSummary,
} from './memory-formatter';

// ============================================
// Relationship Manager 클래스
// ============================================

export class RelationshipManager {
  private supabase: SupabaseClient;

  constructor(supabaseUrl?: string, supabaseKey?: string) {
    const url = supabaseUrl || process.env.NEXT_PUBLIC_SUPABASE_URL || '';
    const key = supabaseKey || process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
    this.supabase = createClient(url, key);
  }

  // ============================================
  // 관계 상태 관리
  // ============================================

  /**
   * 관계 상태 조회
   */
  async getRelationship(userId: string, personaId: string): Promise<RelationshipState | null> {
    const { data, error } = await this.supabase
      .from('user_persona_relationships')
      .select('*')
      .eq('user_id', userId)
      .eq('persona_id', personaId)
      .single();

    if (error || !data) {
      return null;
    }

    return this.mapRelationship(data);
  }

  /**
   * 관계 상태 생성 또는 조회
   */
  async getOrCreateRelationship(userId: string, personaId: string): Promise<RelationshipState> {
    const existing = await this.getRelationship(userId, personaId);
    if (existing) return existing;

    const { data, error } = await this.supabase
      .from('user_persona_relationships')
      .insert({
        user_id: userId,
        persona_id: personaId,
        first_interaction_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (error) throw error;
    return this.mapRelationship(data);
  }

  /**
   * 관계 상태 업데이트
   */
  async updateRelationship(
    userId: string,
    personaId: string,
    updates: UpdateRelationshipInput
  ): Promise<RelationshipState> {
    const current = await this.getOrCreateRelationship(userId, personaId);

    const newAffection = updates.affectionChange !== undefined
      ? applyAffectionChange(current.affection, updates.affectionChange)
      : current.affection;

    const newTrust = updates.trustChange !== undefined
      ? applyTrustChange(current.trustLevel, updates.trustChange)
      : current.trustLevel;

    const newIntimacy = updates.intimacyChange !== undefined
      ? applyIntimacyChange(current.intimacyLevel, updates.intimacyChange)
      : current.intimacyLevel;

    const newStage = calculateRelationshipStage(newAffection);

    const { data, error } = await this.supabase
      .from('user_persona_relationships')
      .update({
        affection: newAffection,
        trust_level: newTrust,
        intimacy_level: newIntimacy,
        relationship_stage: newStage,
        story_flags: { ...current.storyFlags, ...(updates.flagsToSet || {}) },
        total_messages: updates.incrementMessages
          ? current.totalMessages + 1
          : current.totalMessages,
        last_interaction_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('user_id', userId)
      .eq('persona_id', personaId)
      .select()
      .single();

    if (error) throw error;
    return this.mapRelationship(data);
  }

  // ============================================
  // 장기 기억 관리
  // ============================================

  /**
   * 기억 저장
   */
  async saveMemory(
    userId: string,
    personaId: string,
    input: SaveMemoryInput
  ): Promise<Memory | null> {
    const relationship = await this.getRelationship(userId, personaId);

    const { data, error } = await this.supabase
      .from('persona_memories')
      .insert({
        user_id: userId,
        persona_id: personaId,
        memory_type: input.type,
        summary: input.summary,
        details: input.details || {},
        emotional_weight: input.emotionalWeight || getDefaultEmotionalWeight(input.type),
        importance_score: input.emotionalWeight || getDefaultEmotionalWeight(input.type),
        affection_at_time: relationship?.affection || 0,
        source_type: input.sourceType || 'dm',
        source_id: input.sourceId || null,
        is_active: true,
      })
      .select()
      .single();

    if (error) {
      // 중복 기억은 무시
      if (error.code === '23505') {
        console.log('[RelationshipManager] Duplicate memory, skipped');
        return null;
      }
      throw error;
    }

    return this.mapMemory(data);
  }

  /**
   * 기억 목록 조회
   */
  async getMemories(
    userId: string,
    personaId: string,
    options: { limit?: number; types?: MemoryType[] } = {}
  ): Promise<Memory[]> {
    let query = this.supabase
      .from('persona_memories')
      .select('*')
      .eq('user_id', userId)
      .eq('persona_id', personaId)
      .eq('is_active', true)
      .order('created_at', { ascending: false });

    if (options.types && options.types.length > 0) {
      query = query.in('memory_type', options.types);
    }

    if (options.limit) {
      query = query.limit(options.limit);
    }

    const { data, error } = await query;

    if (error) throw error;
    return (data || []).map(this.mapMemory);
  }

  /**
   * 기억 삭제
   */
  async deleteMemory(memoryId: string): Promise<boolean> {
    const { error } = await this.supabase
      .from('persona_memories')
      .update({ is_active: false })
      .eq('id', memoryId);

    return !error;
  }

  // ============================================
  // 별명 관리
  // ============================================

  /**
   * 별명 설정
   */
  async setNickname(
    userId: string,
    personaId: string,
    input: SetNicknameInput
  ): Promise<void> {
    const column = input.type === 'user' ? 'user_nickname' : 'persona_nickname';

    await this.supabase
      .from('user_persona_relationships')
      .update({
        [column]: input.nickname,
        updated_at: new Date().toISOString(),
      })
      .eq('user_id', userId)
      .eq('persona_id', personaId);

    // 별명 설정 시 기억으로도 저장
    await this.saveMemory(userId, personaId, {
      type: 'nickname',
      summary: input.type === 'user'
        ? `${input.nickname}이라고 불러주기로 했다`
        : `${input.nickname}이라고 부르기로 했다`,
      details: {
        nicknameType: input.type,
        nickname: input.nickname,
      },
      sourceType: 'manual',
    });
  }

  /**
   * 별명 조회
   */
  async getNicknames(userId: string, personaId: string): Promise<{
    userNickname: string | null;
    personaNickname: string | null;
  }> {
    const relationship = await this.getRelationship(userId, personaId);
    return {
      userNickname: relationship?.userNickname || null,
      personaNickname: relationship?.personaNickname || null,
    };
  }

  // ============================================
  // 대화 요약
  // ============================================

  /**
   * 세션 요약 저장
   */
  async saveSessionSummary(
    userId: string,
    personaId: string,
    sessionId: string,
    summary: string,
    options: {
      topics?: string[];
      emotionalArc?: { start: string; end: string; keyMoments: string[] };
      affectionStart?: number;
      affectionEnd?: number;
      flagsSet?: Record<string, boolean>;
    } = {}
  ): Promise<void> {
    await this.supabase
      .from('conversation_summaries')
      .insert({
        user_id: userId,
        persona_id: personaId,
        session_id: sessionId,
        summary_type: 'session',
        summary,
        topics: options.topics || [],
        emotional_arc: options.emotionalArc || {},
        affection_start: options.affectionStart,
        affection_end: options.affectionEnd,
        flags_set: options.flagsSet || {},
        period_start: new Date().toISOString(),
        period_end: new Date().toISOString(),
      });
  }

  /**
   * 최근 요약 조회
   */
  async getRecentSummaries(
    userId: string,
    personaId: string,
    limit: number = 10
  ): Promise<FormattedSummary[]> {
    const { data } = await this.supabase
      .from('conversation_summaries')
      .select('*')
      .eq('user_id', userId)
      .eq('persona_id', personaId)
      .order('created_at', { ascending: false })
      .limit(limit);

    return (data || []).map(formatSummary);
  }

  // ============================================
  // 스탯 및 진행도
  // ============================================

  /**
   * 관계 스탯 계산
   */
  async getStats(userId: string, personaId: string): Promise<RelationshipStats> {
    const [relationship, memories, scenarios] = await Promise.all([
      this.getRelationship(userId, personaId),
      this.getMemories(userId, personaId),
      this.getCompletedScenarioCount(userId, personaId),
    ]);

    if (!relationship) {
      return { trust: 0, intimacy: 0, mystery: 100, chemistry: 0, loyalty: 0 };
    }

    return calculateRelationshipStats(
      {
        affection: relationship.affection,
        trustLevel: relationship.trustLevel,
        intimacyLevel: relationship.intimacyLevel,
        totalMessages: relationship.totalMessages,
      },
      memories,
      scenarios
    );
  }

  /**
   * 진행도 정보
   */
  async getProgress(userId: string, personaId: string): Promise<ProgressInfo> {
    const [memories, scenarioCount] = await Promise.all([
      this.getMemories(userId, personaId),
      this.getCompletedScenarioCount(userId, personaId),
    ]);

    return calculateProgressInfo(scenarioCount, memories);
  }

  /**
   * 완료 시나리오 수
   */
  private async getCompletedScenarioCount(userId: string, personaId: string): Promise<number> {
    const { count } = await this.supabase
      .from('user_scenario_progress')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('persona_id', personaId)
      .eq('status', 'completed');

    return count || 0;
  }

  // ============================================
  // UI 데이터 포맷팅
  // ============================================

  /**
   * 기억 페이지 목록 데이터 (GET /api/memory)
   */
  async getMemoryListData(userId: string): Promise<MemoryListResponse> {
    // 1. 관계 목록 조회
    const { data: relationships } = await this.supabase
      .from('user_persona_relationships')
      .select('*')
      .eq('user_id', userId)
      .order('last_interaction_at', { ascending: false });

    if (!relationships || relationships.length === 0) {
      return { personas: [], stats: { totalCharacters: 0, totalSecrets: 0, totalStories: 0 } };
    }

    const personaIds = relationships.map(r => r.persona_id);

    // 2. 페르소나 코어 데이터
    const { data: cores } = await this.supabase
      .from('persona_core')
      .select('id, name, full_name, role, appearance')
      .in('id', personaIds);

    const coreMap = (cores || []).reduce((acc, c) => {
      acc[c.id] = c;
      return acc;
    }, {} as Record<string, any>);

    // 3. 기억 조회
    const { data: allMemories } = await this.supabase
      .from('persona_memories')
      .select('*')
      .eq('user_id', userId)
      .in('persona_id', personaIds)
      .eq('is_active', true)
      .order('created_at', { ascending: false });

    const memoriesByPersona = (allMemories || []).reduce((acc, m) => {
      if (!acc[m.persona_id]) acc[m.persona_id] = [];
      acc[m.persona_id].push(m);
      return acc;
    }, {} as Record<string, any[]>);

    // 4. 시나리오 진행
    const { data: scenarios } = await this.supabase
      .from('user_scenario_progress')
      .select('persona_id, status')
      .eq('user_id', userId)
      .in('persona_id', personaIds);

    const scenariosByPersona = (scenarios || []).reduce((acc, s) => {
      if (!acc[s.persona_id]) acc[s.persona_id] = { total: 0, completed: 0 };
      acc[s.persona_id].total++;
      if (s.status === 'completed') acc[s.persona_id].completed++;
      return acc;
    }, {} as Record<string, { total: number; completed: number }>);

    // 5. 데이터 조합
    const personas: PersonaRelationshipSummary[] = relationships.map(rel => {
      const core = coreMap[rel.persona_id];
      const memories = memoriesByPersona[rel.persona_id] || [];
      const scenarioInfo = scenariosByPersona[rel.persona_id] || { total: 0, completed: 0 };

      const secretMemories = memories.filter((m: any) =>
        ['secret_shared', 'intimate_moment', 'milestone'].includes(m.memory_type)
      );

      return {
        id: rel.persona_id,
        name: core?.name || rel.persona_id,
        fullName: core?.full_name || '',
        role: core?.role || '',
        image: core?.appearance?.profile_image || `https://i.pravatar.cc/400?u=${rel.persona_id}`,
        affection: rel.affection || 0,
        trust: rel.trust_level || 0,
        intimacy: rel.intimacy_level || 0,
        stage: rel.relationship_stage || 'stranger',
        stageLabel: getRelationshipLabel(rel.relationship_stage || 'stranger'),
        storyProgress: scenarioInfo.completed,
        totalStories: Math.max(scenarioInfo.total, 12),
        unlockedSecrets: secretMemories.length,
        totalSecrets: 8,
        currentArc: getArcLabel(scenarioInfo.completed),
        userNickname: rel.user_nickname,
        personaNickname: rel.persona_nickname,
        totalMessages: rel.total_messages || 0,
        firstInteractionAt: rel.first_interaction_at,
        lastInteractionAt: rel.last_interaction_at,
        memories: memories.map(formatMemory),
      };
    });

    // 6. 통계
    const stats = {
      totalCharacters: personas.length,
      totalSecrets: personas.reduce((sum, p) => sum + p.unlockedSecrets, 0),
      totalStories: personas.reduce((sum, p) => sum + p.storyProgress, 0),
    };

    return { personas, stats };
  }

  /**
   * 기억 페이지 상세 데이터 (GET /api/memory/:personaId)
   */
  async getMemoryDetailData(userId: string, personaId: string): Promise<MemoryDetailResponse> {
    // 1. 관계 조회
    const relationship = await this.getRelationship(userId, personaId);
    if (!relationship) {
      return { exists: false };
    }

    // 2. 페르소나 코어
    const { data: core } = await this.supabase
      .from('persona_core')
      .select('*')
      .eq('id', personaId)
      .single();

    // 3. 기억
    const memories = await this.getMemories(userId, personaId);

    // 4. 대화 요약
    const summaries = await this.getRecentSummaries(userId, personaId);

    // 5. 스탯 & 진행도
    const [stats, progress] = await Promise.all([
      this.getStats(userId, personaId),
      this.getProgress(userId, personaId),
    ]);

    // 6. 잠긴 메모
    const unlockedTypes = new Set(memories.map(m => m.type));
    const lockedMemos = getLockedMemories(unlockedTypes, relationship.stage);

    return {
      exists: true,
      persona: {
        id: personaId,
        name: core?.name || personaId,
        fullName: core?.full_name || '',
        role: core?.role || '',
        image: core?.appearance?.profile_image || `https://i.pravatar.cc/400?u=${personaId}`,
      },
      relationship: {
        stage: relationship.stage,
        stageLabel: getRelationshipLabel(relationship.stage),
        affection: relationship.affection,
        trust: relationship.trustLevel,
        intimacy: relationship.intimacyLevel,
        totalMessages: relationship.totalMessages,
        firstInteractionAt: relationship.firstInteractionAt?.toISOString() || null,
        lastInteractionAt: relationship.lastInteractionAt?.toISOString() || null,
        userNickname: relationship.userNickname,
        personaNickname: relationship.personaNickname,
      },
      stats,
      progress,
      memories: memories.map(formatMemory),
      lockedMemos,
      recentSummaries: summaries,
    };
  }

  // ============================================
  // 매핑 함수
  // ============================================

  private mapRelationship(data: Record<string, unknown>): RelationshipState {
    return {
      userId: data.user_id as string,
      personaId: data.persona_id as string,
      affection: (data.affection as number) || 0,
      trustLevel: (data.trust_level as number) || 0,
      intimacyLevel: (data.intimacy_level as number) || 0,
      tensionLevel: (data.tension_level as number) || 0,
      stage: (data.relationship_stage as RelationshipStage) || 'stranger',
      userNickname: data.user_nickname as string | null,
      personaNickname: data.persona_nickname as string | null,
      storyFlags: (data.story_flags as Record<string, boolean>) || {},
      completedScenarios: (data.completed_scenarios as string[]) || [],
      unlockedSecrets: (data.unlocked_secrets as string[]) || [],
      totalMessages: (data.total_messages as number) || 0,
      longestConversationLength: (data.longest_conversation_length as number) || 0,
      sharedSecretsCount: (data.shared_secrets_count as number) || 0,
      conflictsResolved: (data.conflicts_resolved as number) || 0,
      firstInteractionAt: data.first_interaction_at
        ? new Date(data.first_interaction_at as string)
        : null,
      lastInteractionAt: data.last_interaction_at
        ? new Date(data.last_interaction_at as string)
        : null,
    };
  }

  private mapMemory(data: Record<string, unknown>): Memory {
    return {
      id: data.id as string,
      userId: data.user_id as string,
      personaId: data.persona_id as string,
      type: data.memory_type as MemoryType,
      summary: data.summary as string,
      details: (data.details as Record<string, unknown>) || {},
      emotionalWeight: (data.emotional_weight as number) || 5,
      importanceScore: (data.importance_score as number) || 5,
      affectionAtTime: (data.affection_at_time as number) || 0,
      referenceCount: (data.reference_count as number) || 0,
      lastReferencedAt: data.last_referenced_at
        ? new Date(data.last_referenced_at as string)
        : null,
      sourceType: (data.source_type as Memory['sourceType']) || 'dm',
      sourceId: data.source_id as string | null,
      isActive: data.is_active !== false,
      createdAt: new Date(data.created_at as string),
    };
  }
}

// ============================================
// 싱글톤 인스턴스
// ============================================

let relationshipManagerInstance: RelationshipManager | null = null;

export function getRelationshipManager(): RelationshipManager {
  if (!relationshipManagerInstance) {
    relationshipManagerInstance = new RelationshipManager();
  }
  return relationshipManagerInstance;
}

// 팩토리 함수 (커스텀 Supabase 클라이언트용)
export function createRelationshipManager(
  supabaseUrl: string,
  supabaseKey: string
): RelationshipManager {
  return new RelationshipManager(supabaseUrl, supabaseKey);
}
