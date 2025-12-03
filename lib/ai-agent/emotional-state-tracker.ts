/**
 * Emotional State Tracker
 * 감정 상태와 갈등 상황을 추적하여 대화 일관성 유지
 *
 * 핵심 목표:
 * - 싸운 직후 "사랑해"라고 하는 몰입 파괴 방지
 * - 감정 상태의 자연스러운 전환
 * - 갈등-화해 아크의 일관성 유지
 */

import { SupabaseClient } from '@supabase/supabase-js';
import { PersonaMood, RelationshipStage } from './types';
import { asString, asNumber, asDate, asNullableDate, asBoolean, asObject } from '../utils/db-mapper';

// ============================================
// 타입 정의
// ============================================

/**
 * 감정 상태 스냅샷
 */
export interface EmotionalSnapshot {
  id: string;
  userId: string;
  personaId: string;
  mood: PersonaMood;
  tensionLevel: number;        // 0-10 (긴장도)
  warmthLevel: number;         // 0-10 (친밀도/따뜻함)
  unresolvedConflict: boolean; // 미해결 갈등 여부
  conflictContext?: string;    // 갈등 상황 설명
  lastPositiveInteraction: Date | null;
  lastNegativeInteraction: Date | null;
  consecutiveNegativeCount: number; // 연속 부정적 상호작용 수
  recentEmotionalEvents: EmotionalEvent[];
  createdAt: Date;
  updatedAt: Date;
}

/**
 * 감정적 이벤트 (최근 상호작용 기록)
 */
export interface EmotionalEvent {
  type: 'positive' | 'negative' | 'neutral' | 'conflict' | 'reconciliation';
  intensity: number;          // 1-10
  description: string;
  affectionChange: number;
  timestamp: Date;
}

/**
 * 갈등 기록
 */
export interface ConflictRecord {
  id: string;
  userId: string;
  personaId: string;
  conflictType: ConflictType;
  severity: number;           // 1-10
  cause: string;              // 갈등 원인
  personaFeeling: PersonaMood; // 페르소나의 감정
  isResolved: boolean;
  resolvedAt: Date | null;
  resolutionType?: ResolutionType;
  cooldownHours: number;      // 페르소나가 풀리는데 필요한 시간
  affectionImpact: number;    // 호감도 영향
  createdAt: Date;
}

export type ConflictType =
  | 'minor_disagreement'   // 가벼운 의견 충돌
  | 'hurt_feelings'        // 감정 상함
  | 'broken_promise'       // 약속 위반
  | 'trust_breach'         // 신뢰 손상
  | 'major_fight'          // 큰 싸움
  | 'jealousy'             // 질투
  | 'neglect';             // 무관심/방치

export type ResolutionType =
  | 'sincere_apology'      // 진심 어린 사과
  | 'time_passed'          // 시간이 해결
  | 'user_effort'          // 유저의 노력
  | 'persona_forgave'      // 페르소나가 용서
  | 'mutual_understanding'; // 상호 이해

/**
 * 감정 전환 규칙
 */
interface EmotionalTransitionRule {
  fromState: PersonaMood | 'conflict';
  requiredConditions: {
    minTimePassed?: number;        // 최소 경과 시간 (분)
    minPositiveInteractions?: number; // 최소 긍정적 상호작용 수
    requiresApology?: boolean;     // 사과 필요 여부
    conflictMustBeResolved?: boolean;
  };
  naturalTransitions: PersonaMood[];
  forbiddenTransitions: PersonaMood[];
}

// ============================================
// 감정 전환 규칙 정의
// ============================================

const EMOTIONAL_TRANSITION_RULES: EmotionalTransitionRule[] = [
  {
    fromState: 'angry',
    requiredConditions: {
      minTimePassed: 30,
      minPositiveInteractions: 2,
    },
    naturalTransitions: ['neutral', 'sad', 'worried'],
    forbiddenTransitions: ['happy', 'flirty', 'playful', 'excited'],
  },
  {
    fromState: 'conflict',
    requiredConditions: {
      minTimePassed: 60,
      minPositiveInteractions: 3,
      requiresApology: true,
      conflictMustBeResolved: true,
    },
    naturalTransitions: ['neutral', 'sad', 'worried'],
    forbiddenTransitions: ['happy', 'flirty', 'playful', 'excited', 'vulnerable'],
  },
  {
    fromState: 'sad',
    requiredConditions: {
      minPositiveInteractions: 1,
    },
    naturalTransitions: ['neutral', 'worried', 'happy'],
    forbiddenTransitions: ['flirty', 'playful'],
  },
  {
    fromState: 'jealous',
    requiredConditions: {
      minTimePassed: 15,
    },
    naturalTransitions: ['neutral', 'happy', 'worried', 'playful'],
    forbiddenTransitions: [],
  },
];

/**
 * 갈등 심각도별 쿨다운 시간 (시간 단위)
 */
const CONFLICT_COOLDOWN_HOURS: Record<ConflictType, number> = {
  minor_disagreement: 0.5,
  hurt_feelings: 2,
  broken_promise: 6,
  trust_breach: 24,
  major_fight: 12,
  jealousy: 1,
  neglect: 4,
};

// ============================================
// EmotionalStateTracker 클래스
// ============================================

export class EmotionalStateTracker {
  private supabase: SupabaseClient;
  private cache: Map<string, EmotionalSnapshot> = new Map();
  private conflictCache: Map<string, ConflictRecord[]> = new Map();
  private readonly CACHE_TTL = 5 * 60 * 1000; // 5분
  private cacheTimestamps: Map<string, number> = new Map();

  constructor(supabase: SupabaseClient) {
    this.supabase = supabase;
  }

  // ============================================
  // 감정 상태 조회/업데이트
  // ============================================

  /**
   * 현재 감정 상태 가져오기
   */
  async getEmotionalState(
    userId: string,
    personaId: string
  ): Promise<EmotionalSnapshot | null> {
    const cacheKey = `${userId}:${personaId}`;

    // 캐시 확인
    const cached = this.cache.get(cacheKey);
    const cacheTime = this.cacheTimestamps.get(cacheKey);
    if (cached && cacheTime && Date.now() - cacheTime < this.CACHE_TTL) {
      return cached;
    }

    const { data, error } = await this.supabase
      .from('emotional_states')
      .select('*')
      .eq('user_id', userId)
      .eq('persona_id', personaId)
      .single();

    if (error || !data) {
      // 없으면 기본 상태 생성
      return this.createDefaultState(userId, personaId);
    }

    const snapshot = this.mapSnapshot(data);
    this.cache.set(cacheKey, snapshot);
    this.cacheTimestamps.set(cacheKey, Date.now());

    return snapshot;
  }

  /**
   * 감정 상태 업데이트
   */
  async updateEmotionalState(
    userId: string,
    personaId: string,
    update: Partial<{
      mood: PersonaMood;
      tensionLevel: number;
      warmthLevel: number;
      unresolvedConflict: boolean;
      conflictContext: string;
      affectionChange: number;
      interactionType: 'positive' | 'negative' | 'neutral';
      eventDescription: string;
    }>
  ): Promise<EmotionalSnapshot> {
    const current = await this.getEmotionalState(userId, personaId);

    // 새 감정 이벤트 추가
    const newEvent: EmotionalEvent | null = update.interactionType ? {
      type: update.interactionType,
      intensity: Math.abs(update.affectionChange || 0),
      description: update.eventDescription || '',
      affectionChange: update.affectionChange || 0,
      timestamp: new Date(),
    } : null;

    // 최근 이벤트 목록 업데이트 (최대 10개 유지)
    const recentEvents = current?.recentEmotionalEvents || [];
    if (newEvent) {
      recentEvents.unshift(newEvent);
      if (recentEvents.length > 10) {
        recentEvents.pop();
      }
    }

    // 연속 부정적 상호작용 카운트
    let consecutiveNegative = current?.consecutiveNegativeCount || 0;
    if (update.interactionType === 'negative') {
      consecutiveNegative++;
    } else if (update.interactionType === 'positive') {
      consecutiveNegative = 0;
    }

    const updateData = {
      user_id: userId,
      persona_id: personaId,
      mood: update.mood || current?.mood || 'neutral',
      tension_level: update.tensionLevel ?? current?.tensionLevel ?? 5,
      warmth_level: update.warmthLevel ?? current?.warmthLevel ?? 5,
      unresolved_conflict: update.unresolvedConflict ?? current?.unresolvedConflict ?? false,
      conflict_context: update.conflictContext || current?.conflictContext || null,
      last_positive_interaction: update.interactionType === 'positive'
        ? new Date().toISOString()
        : current?.lastPositiveInteraction?.toISOString() || null,
      last_negative_interaction: update.interactionType === 'negative'
        ? new Date().toISOString()
        : current?.lastNegativeInteraction?.toISOString() || null,
      consecutive_negative_count: consecutiveNegative,
      recent_emotional_events: recentEvents,
      updated_at: new Date().toISOString(),
    };

    const { data, error } = await this.supabase
      .from('emotional_states')
      .upsert(updateData, {
        onConflict: 'user_id,persona_id',
      })
      .select()
      .single();

    if (error) {
      console.error('[EmotionalState] Update error:', error);
      throw error;
    }

    const snapshot = this.mapSnapshot(data);

    // 캐시 업데이트
    const cacheKey = `${userId}:${personaId}`;
    this.cache.set(cacheKey, snapshot);
    this.cacheTimestamps.set(cacheKey, Date.now());

    return snapshot;
  }

  // ============================================
  // 갈등 관리
  // ============================================

  /**
   * 갈등 기록
   */
  async recordConflict(
    userId: string,
    personaId: string,
    conflict: {
      type: ConflictType;
      severity: number;
      cause: string;
      personaFeeling: PersonaMood;
      affectionImpact: number;
    }
  ): Promise<ConflictRecord> {
    const cooldownHours = CONFLICT_COOLDOWN_HOURS[conflict.type] * (conflict.severity / 5);

    const { data, error } = await this.supabase
      .from('conflict_records')
      .insert({
        user_id: userId,
        persona_id: personaId,
        conflict_type: conflict.type,
        severity: conflict.severity,
        cause: conflict.cause,
        persona_feeling: conflict.personaFeeling,
        is_resolved: false,
        cooldown_hours: cooldownHours,
        affection_impact: conflict.affectionImpact,
      })
      .select()
      .single();

    if (error) {
      console.error('[EmotionalState] Record conflict error:', error);
      throw error;
    }

    // 감정 상태도 업데이트
    await this.updateEmotionalState(userId, personaId, {
      mood: conflict.personaFeeling,
      unresolvedConflict: true,
      conflictContext: conflict.cause,
      interactionType: 'negative',
      affectionChange: conflict.affectionImpact,
      eventDescription: `갈등: ${conflict.cause}`,
    });

    // 캐시 무효화
    this.conflictCache.delete(`${userId}:${personaId}`);

    return this.mapConflict(data);
  }

  /**
   * 미해결 갈등 조회
   */
  async getUnresolvedConflicts(
    userId: string,
    personaId: string
  ): Promise<ConflictRecord[]> {
    const cacheKey = `${userId}:${personaId}`;
    const cached = this.conflictCache.get(cacheKey);
    if (cached) {
      return cached.filter(c => !c.isResolved);
    }

    const { data, error } = await this.supabase
      .from('conflict_records')
      .select('*')
      .eq('user_id', userId)
      .eq('persona_id', personaId)
      .eq('is_resolved', false)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('[EmotionalState] Get conflicts error:', error);
      return [];
    }

    const conflicts = (data || []).map(this.mapConflict);
    this.conflictCache.set(cacheKey, conflicts);

    return conflicts;
  }

  /**
   * 갈등 해결
   */
  async resolveConflict(
    conflictId: string,
    resolutionType: ResolutionType
  ): Promise<void> {
    const { data, error } = await this.supabase
      .from('conflict_records')
      .update({
        is_resolved: true,
        resolved_at: new Date().toISOString(),
        resolution_type: resolutionType,
      })
      .eq('id', conflictId)
      .select()
      .single();

    if (error) {
      console.error('[EmotionalState] Resolve conflict error:', error);
      return;
    }

    // 해당 유저-페르소나의 감정 상태 업데이트
    if (data) {
      const userId = asString(data.user_id);
      const personaId = asString(data.persona_id);

      // 다른 미해결 갈등이 있는지 확인
      const remaining = await this.getUnresolvedConflicts(userId, personaId);

      await this.updateEmotionalState(userId, personaId, {
        unresolvedConflict: remaining.length > 0,
        conflictContext: remaining.length > 0 ? remaining[0].cause : undefined,
        interactionType: 'positive',
        eventDescription: `갈등 해결: ${resolutionType}`,
      });

      // 캐시 무효화
      this.conflictCache.delete(`${userId}:${personaId}`);
    }
  }

  // ============================================
  // 감정 전환 검증
  // ============================================

  /**
   * 감정 전환이 자연스러운지 검증
   */
  async validateEmotionalTransition(
    userId: string,
    personaId: string,
    proposedMood: PersonaMood
  ): Promise<{
    isValid: boolean;
    reason?: string;
    suggestedMood?: PersonaMood;
    warningLevel: 'none' | 'low' | 'high';
  }> {
    const state = await this.getEmotionalState(userId, personaId);
    if (!state) {
      return { isValid: true, warningLevel: 'none' };
    }

    const currentMood = state.mood;
    const unresolvedConflicts = await this.getUnresolvedConflicts(userId, personaId);

    // 미해결 갈등이 있는 경우 특별 검증
    if (unresolvedConflicts.length > 0 || state.unresolvedConflict) {
      const conflictRule = EMOTIONAL_TRANSITION_RULES.find(r => r.fromState === 'conflict');
      if (conflictRule?.forbiddenTransitions.includes(proposedMood)) {
        return {
          isValid: false,
          reason: `미해결 갈등이 있어 ${proposedMood} 감정으로 전환할 수 없습니다.`,
          suggestedMood: 'neutral',
          warningLevel: 'high',
        };
      }
    }

    // 현재 감정에서의 전환 규칙 확인
    const rule = EMOTIONAL_TRANSITION_RULES.find(r => r.fromState === currentMood);
    if (rule) {
      // 금지된 전환인지 확인
      if (rule.forbiddenTransitions.includes(proposedMood)) {
        // 조건을 충족하는지 확인
        const conditionsMet = await this.checkTransitionConditions(state, rule.requiredConditions);

        if (!conditionsMet) {
          return {
            isValid: false,
            reason: `${currentMood}에서 ${proposedMood}로의 갑작스러운 전환은 부자연스럽습니다.`,
            suggestedMood: rule.naturalTransitions[0] || 'neutral',
            warningLevel: 'high',
          };
        }
      }
    }

    // 연속 부정적 상호작용 후 갑자기 긍정적 감정
    if (state.consecutiveNegativeCount >= 3) {
      const positiveEmotions: PersonaMood[] = ['happy', 'flirty', 'playful', 'excited'];
      if (positiveEmotions.includes(proposedMood)) {
        return {
          isValid: false,
          reason: '연속된 부정적 상호작용 후 갑자기 긍정적 감정은 부자연스럽습니다.',
          suggestedMood: 'neutral',
          warningLevel: 'high',
        };
      }
    }

    return { isValid: true, warningLevel: 'none' };
  }

  /**
   * 전환 조건 충족 여부 확인
   */
  private async checkTransitionConditions(
    state: EmotionalSnapshot,
    conditions: EmotionalTransitionRule['requiredConditions']
  ): Promise<boolean> {
    // 최소 경과 시간 확인
    if (conditions.minTimePassed) {
      const lastNegative = state.lastNegativeInteraction;
      if (lastNegative) {
        const minutesPassed = (Date.now() - lastNegative.getTime()) / (1000 * 60);
        if (minutesPassed < conditions.minTimePassed) {
          return false;
        }
      }
    }

    // 최소 긍정적 상호작용 수 확인
    if (conditions.minPositiveInteractions) {
      const positiveCount = state.recentEmotionalEvents
        .filter(e => e.type === 'positive').length;
      if (positiveCount < conditions.minPositiveInteractions) {
        return false;
      }
    }

    // 갈등 해결 필요 여부
    if (conditions.conflictMustBeResolved && state.unresolvedConflict) {
      return false;
    }

    return true;
  }

  // ============================================
  // 프롬프트용 컨텍스트 생성
  // ============================================

  /**
   * 프롬프트에 주입할 감정 컨텍스트 생성
   */
  async buildEmotionalContext(
    userId: string,
    personaId: string
  ): Promise<string> {
    const state = await this.getEmotionalState(userId, personaId);
    const conflicts = await this.getUnresolvedConflicts(userId, personaId);

    if (!state) {
      return '(감정 상태 정보 없음)';
    }

    const parts: string[] = [];

    // 현재 감정 상태
    parts.push(`현재 감정: ${state.mood} (긴장도: ${state.tensionLevel}/10, 친밀도: ${state.warmthLevel}/10)`);

    // 미해결 갈등 경고
    if (conflicts.length > 0 || state.unresolvedConflict) {
      parts.push('\n⚠️ **미해결 갈등 - 중요!**');
      for (const conflict of conflicts) {
        const hoursSince = (Date.now() - conflict.createdAt.getTime()) / (1000 * 60 * 60);
        const cooldownRemaining = Math.max(0, conflict.cooldownHours - hoursSince);

        parts.push(`- 원인: ${conflict.cause}`);
        parts.push(`- 심각도: ${conflict.severity}/10`);
        parts.push(`- 페르소나 감정: ${conflict.personaFeeling}`);
        if (cooldownRemaining > 0) {
          parts.push(`- 아직 마음이 풀리지 않음 (약 ${Math.ceil(cooldownRemaining)}시간 필요)`);
        }
      }
      parts.push('\n★ 갈등이 해결되기 전까지는 긍정적 반응을 자제해야 합니다.');
      parts.push('★ 사과나 화해 시도에 대해서만 점진적으로 반응하세요.');
    }

    // 연속 부정적 상호작용 경고
    if (state.consecutiveNegativeCount >= 2) {
      parts.push(`\n⚠️ 연속 ${state.consecutiveNegativeCount}회 부정적 상호작용이 있었습니다.`);
      parts.push('갑자기 태도를 바꾸지 마세요. 서서히 풀어나가야 합니다.');
    }

    // 최근 감정 이벤트 요약
    if (state.recentEmotionalEvents.length > 0) {
      parts.push('\n최근 상호작용:');
      const recentEvents = state.recentEmotionalEvents.slice(0, 5);
      for (const event of recentEvents) {
        const emoji = event.type === 'positive' ? '😊' :
                      event.type === 'negative' ? '😢' :
                      event.type === 'conflict' ? '😠' :
                      event.type === 'reconciliation' ? '🤝' : '😐';
        parts.push(`${emoji} ${event.description} (호감도 ${event.affectionChange >= 0 ? '+' : ''}${event.affectionChange})`);
      }
    }

    return parts.join('\n');
  }

  // ============================================
  // 유틸리티
  // ============================================

  private async createDefaultState(
    userId: string,
    personaId: string
  ): Promise<EmotionalSnapshot> {
    const defaultState: EmotionalSnapshot = {
      id: '',
      userId,
      personaId,
      mood: 'neutral',
      tensionLevel: 5,
      warmthLevel: 5,
      unresolvedConflict: false,
      lastPositiveInteraction: null,
      lastNegativeInteraction: null,
      consecutiveNegativeCount: 0,
      recentEmotionalEvents: [],
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    // DB에 저장
    const { data } = await this.supabase
      .from('emotional_states')
      .upsert({
        user_id: userId,
        persona_id: personaId,
        mood: 'neutral',
        tension_level: 5,
        warmth_level: 5,
        unresolved_conflict: false,
        consecutive_negative_count: 0,
        recent_emotional_events: [],
      }, {
        onConflict: 'user_id,persona_id',
      })
      .select()
      .single();

    return data ? this.mapSnapshot(data) : defaultState;
  }

  private mapSnapshot(data: Record<string, unknown>): EmotionalSnapshot {
    return {
      id: asString(data.id),
      userId: asString(data.user_id),
      personaId: asString(data.persona_id),
      mood: (data.mood as PersonaMood) || 'neutral',
      tensionLevel: asNumber(data.tension_level, 5),
      warmthLevel: asNumber(data.warmth_level, 5),
      unresolvedConflict: asBoolean(data.unresolved_conflict, false),
      conflictContext: data.conflict_context as string | undefined,
      lastPositiveInteraction: asNullableDate(data.last_positive_interaction),
      lastNegativeInteraction: asNullableDate(data.last_negative_interaction),
      consecutiveNegativeCount: asNumber(data.consecutive_negative_count, 0),
      recentEmotionalEvents: Array.isArray(data.recent_emotional_events)
        ? (data.recent_emotional_events as EmotionalEvent[])
        : [],
      createdAt: asDate(data.created_at),
      updatedAt: asDate(data.updated_at),
    };
  }

  private mapConflict(data: Record<string, unknown>): ConflictRecord {
    return {
      id: asString(data.id),
      userId: asString(data.user_id),
      personaId: asString(data.persona_id),
      conflictType: data.conflict_type as ConflictType,
      severity: asNumber(data.severity, 5),
      cause: asString(data.cause),
      personaFeeling: data.persona_feeling as PersonaMood,
      isResolved: asBoolean(data.is_resolved, false),
      resolvedAt: asNullableDate(data.resolved_at),
      resolutionType: data.resolution_type as ResolutionType | undefined,
      cooldownHours: asNumber(data.cooldown_hours, 1),
      affectionImpact: asNumber(data.affection_impact, 0),
      createdAt: asDate(data.created_at),
    };
  }
}

// ============================================
// 싱글톤 인스턴스
// ============================================

let trackerInstance: EmotionalStateTracker | null = null;

export function getEmotionalStateTracker(supabase: SupabaseClient): EmotionalStateTracker {
  if (!trackerInstance) {
    trackerInstance = new EmotionalStateTracker(supabase);
  }
  return trackerInstance;
}
