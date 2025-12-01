/**
 * Memory System
 * 페르소나의 장기 기억과 대화 컨텍스트를 관리
 */

import { SupabaseClient } from '@supabase/supabase-js';
import { RelationshipState, ConversationMessage, PersonaMood } from './types';

// ============================================
// 기억 타입 정의
// ============================================

export type MemoryType =
  | 'first_meeting'
  | 'promise'
  | 'secret_shared'
  | 'conflict'
  | 'reconciliation'
  | 'intimate_moment'
  | 'gift_received'
  | 'milestone'
  | 'user_preference'
  | 'emotional_event'
  | 'location_memory'
  | 'nickname'
  | 'inside_joke'
  | 'important_date';

export interface PersonaMemory {
  id: string;
  userId: string;
  personaId: string;
  memoryType: MemoryType;
  summary: string;
  details: Record<string, unknown>;
  emotionalWeight: number;
  affectionAtTime: number;
  lastReferencedAt: Date | null;
  referenceCount: number;
  createdAt: Date;
}

export interface ConversationSummary {
  id: string;
  userId: string;
  personaId: string;
  sessionId: string | null;
  summaryType: 'session' | 'daily' | 'weekly' | 'relationship_arc';
  summary: string;
  topics: string[];
  emotionalArc: Record<string, unknown>;
  affectionStart: number;
  affectionEnd: number;
  flagsSet: Record<string, boolean>;
  periodStart: Date;
  periodEnd: Date;
  createdAt: Date;
}

// ============================================
// Memory Manager
// ============================================

export class MemoryManager {
  private supabase: SupabaseClient;

  constructor(supabase: SupabaseClient) {
    this.supabase = supabase;
  }

  // ============================================
  // 기억 저장
  // ============================================

  /**
   * 새로운 기억 저장
   */
  async saveMemory(
    userId: string,
    personaId: string,
    memory: {
      type: MemoryType;
      summary: string;
      details?: Record<string, unknown>;
      emotionalWeight?: number;
      affectionAtTime: number;
    }
  ): Promise<PersonaMemory | null> {
    const { data, error } = await this.supabase
      .from('persona_memories')
      .upsert({
        user_id: userId,
        persona_id: personaId,
        memory_type: memory.type,
        summary: memory.summary,
        details: memory.details || {},
        emotional_weight: memory.emotionalWeight || 5,
        affection_at_time: memory.affectionAtTime,
      }, {
        onConflict: 'user_id,persona_id,memory_type,summary'
      })
      .select()
      .single();

    if (error) {
      console.error('[Memory] Save error:', error);
      return null;
    }

    return this.mapMemory(data);
  }

  /**
   * 대화에서 기억할 만한 내용 자동 추출
   */
  async extractMemoriesFromConversation(
    userId: string,
    personaId: string,
    messages: ConversationMessage[],
    currentAffection: number
  ): Promise<void> {
    // 기억 추출 패턴
    const patterns = {
      promise: /약속|할게|해줄게|기다려|꼭|다음에/,
      secret: /비밀|아무도 모르|처음 말하|나만 알아/,
      nickname: /부를게|라고 해|별명/,
      preference: /좋아해|싫어해|취향|최애/,
      important_date: /생일|기념일|특별한 날/,
    };

    for (const msg of messages) {
      if (msg.role === 'user') {
        // 유저가 공유한 정보에서 기억 추출
        for (const [type, pattern] of Object.entries(patterns)) {
          if (pattern.test(msg.content)) {
            await this.saveMemory(userId, personaId, {
              type: type as MemoryType,
              summary: msg.content.slice(0, 100),
              details: { originalMessage: msg.content, context: 'user_shared' },
              emotionalWeight: 6,
              affectionAtTime: currentAffection,
            });
          }
        }
      }

      // 높은 감정 강도의 메시지는 감정적 사건으로 기록
      if (msg.affectionChange && Math.abs(msg.affectionChange) >= 3) {
        await this.saveMemory(userId, personaId, {
          type: 'emotional_event',
          summary: `${msg.affectionChange > 0 ? '긍정적' : '부정적'} 감정적 순간`,
          details: {
            messageContent: msg.content.slice(0, 200),
            affectionChange: msg.affectionChange,
            emotion: msg.emotion,
          },
          emotionalWeight: 8,
          affectionAtTime: currentAffection,
        });
      }
    }
  }

  // ============================================
  // 기억 조회
  // ============================================

  /**
   * 유저-페르소나 관계의 모든 기억 조회
   */
  async getMemories(
    userId: string,
    personaId: string,
    options?: {
      types?: MemoryType[];
      limit?: number;
      minEmotionalWeight?: number;
    }
  ): Promise<PersonaMemory[]> {
    let query = this.supabase
      .from('persona_memories')
      .select('*')
      .eq('user_id', userId)
      .eq('persona_id', personaId)
      .order('emotional_weight', { ascending: false })
      .order('created_at', { ascending: false });

    if (options?.types && options.types.length > 0) {
      query = query.in('memory_type', options.types);
    }

    if (options?.minEmotionalWeight) {
      query = query.gte('emotional_weight', options.minEmotionalWeight);
    }

    if (options?.limit) {
      query = query.limit(options.limit);
    }

    const { data, error } = await query;

    if (error) {
      console.error('[Memory] Get error:', error);
      return [];
    }

    return (data || []).map(this.mapMemory);
  }

  /**
   * 프롬프트에 포함할 핵심 기억 조회
   */
  async getMemoriesForPrompt(
    userId: string,
    personaId: string
  ): Promise<string> {
    // 가장 중요한 기억들 (상위 10개)
    const memories = await this.getMemories(userId, personaId, {
      limit: 10,
      minEmotionalWeight: 5,
    });

    if (memories.length === 0) {
      return '(아직 특별한 기억이 없음)';
    }

    const memoryStrings = memories.map(m => {
      const typeLabels: Record<MemoryType, string> = {
        first_meeting: '첫 만남',
        promise: '약속',
        secret_shared: '공유된 비밀',
        conflict: '갈등',
        reconciliation: '화해',
        intimate_moment: '친밀한 순간',
        gift_received: '받은 선물',
        milestone: '관계 마일스톤',
        user_preference: '유저 취향',
        emotional_event: '감정적 사건',
        location_memory: '함께 간 장소',
        nickname: '별명',
        inside_joke: '둘만의 농담',
        important_date: '중요한 날짜',
      };

      return `- [${typeLabels[m.memoryType]}] ${m.summary}`;
    });

    return memoryStrings.join('\n');
  }

  /**
   * 기억 참조 횟수 증가
   */
  async referenceMemory(memoryId: string): Promise<void> {
    await this.supabase
      .from('persona_memories')
      .update({
        reference_count: this.supabase.rpc('increment_reference_count'),
        last_referenced_at: new Date().toISOString(),
      })
      .eq('id', memoryId);
  }

  // ============================================
  // 대화 요약
  // ============================================

  /**
   * 세션 종료 시 대화 요약 저장
   */
  async saveConversationSummary(
    userId: string,
    personaId: string,
    sessionId: string,
    messages: ConversationMessage[],
    affectionStart: number,
    affectionEnd: number,
    flagsSet: Record<string, boolean>
  ): Promise<void> {
    // 대화 요약 생성 (간단한 규칙 기반, LLM 호출 없이)
    const topics = this.extractTopics(messages);
    const emotionalArc = this.analyzeEmotionalArc(messages);

    const summary = this.generateSimpleSummary(messages, topics);

    const { error } = await this.supabase
      .from('conversation_summaries')
      .insert({
        user_id: userId,
        persona_id: personaId,
        session_id: sessionId,
        summary_type: 'session',
        summary,
        topics,
        emotional_arc: emotionalArc,
        affection_start: affectionStart,
        affection_end: affectionEnd,
        flags_set: flagsSet,
        period_start: messages[0]?.createdAt || new Date(),
        period_end: messages[messages.length - 1]?.createdAt || new Date(),
      });

    if (error) {
      console.error('[Memory] Summary save error:', error);
    }
  }

  /**
   * 최근 대화 요약들 조회
   */
  async getRecentSummaries(
    userId: string,
    personaId: string,
    limit: number = 5
  ): Promise<ConversationSummary[]> {
    const { data, error } = await this.supabase
      .from('conversation_summaries')
      .select('*')
      .eq('user_id', userId)
      .eq('persona_id', personaId)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      console.error('[Memory] Get summaries error:', error);
      return [];
    }

    return (data || []).map(this.mapSummary);
  }

  /**
   * 프롬프트에 포함할 대화 요약 조회
   */
  async getSummariesForPrompt(
    userId: string,
    personaId: string
  ): Promise<string> {
    const summaries = await this.getRecentSummaries(userId, personaId, 3);

    if (summaries.length === 0) {
      return '(이전 대화 기록 없음)';
    }

    return summaries.map(s => {
      const date = new Date(s.periodEnd).toLocaleDateString('ko-KR');
      return `[${date}] ${s.summary}`;
    }).join('\n');
  }

  // ============================================
  // 유틸리티
  // ============================================

  private extractTopics(messages: ConversationMessage[]): string[] {
    const topics = new Set<string>();

    const topicPatterns = [
      { pattern: /일|스케줄|연습|공연|콘서트/, topic: '아이돌 활동' },
      { pattern: /피곤|지친|힘들|스트레스/, topic: '피로/스트레스' },
      { pattern: /좋아|사랑|보고싶|그리워/, topic: '감정 표현' },
      { pattern: /먹|밥|음식|라면/, topic: '음식' },
      { pattern: /자|잠|피곤|새벽/, topic: '수면/새벽' },
      { pattern: /만나|보자|약속/, topic: '만남 약속' },
      { pattern: /걱정|불안|무서/, topic: '걱정/불안' },
    ];

    for (const msg of messages) {
      for (const { pattern, topic } of topicPatterns) {
        if (pattern.test(msg.content)) {
          topics.add(topic);
        }
      }
    }

    return Array.from(topics);
  }

  private analyzeEmotionalArc(messages: ConversationMessage[]): Record<string, unknown> {
    const emotions: PersonaMood[] = [];
    let totalAffectionChange = 0;

    for (const msg of messages) {
      if (msg.emotion) {
        emotions.push(msg.emotion);
      }
      totalAffectionChange += msg.affectionChange || 0;
    }

    const emotionCounts: Record<string, number> = {};
    for (const emotion of emotions) {
      emotionCounts[emotion] = (emotionCounts[emotion] || 0) + 1;
    }

    const dominantEmotion = Object.entries(emotionCounts)
      .sort((a, b) => b[1] - a[1])[0]?.[0] || 'neutral';

    return {
      dominantEmotion,
      emotionCounts,
      totalAffectionChange,
      messageCount: messages.length,
    };
  }

  private generateSimpleSummary(
    messages: ConversationMessage[],
    topics: string[]
  ): string {
    const messageCount = messages.length;
    const userMessages = messages.filter(m => m.role === 'user').length;
    const topicStr = topics.length > 0 ? topics.join(', ') : '일상 대화';

    return `${messageCount}개의 메시지 교환. 주제: ${topicStr}. 유저 메시지 ${userMessages}개.`;
  }

  private mapMemory(data: Record<string, unknown>): PersonaMemory {
    return {
      id: data.id as string,
      userId: data.user_id as string,
      personaId: data.persona_id as string,
      memoryType: data.memory_type as MemoryType,
      summary: data.summary as string,
      details: data.details as Record<string, unknown>,
      emotionalWeight: data.emotional_weight as number,
      affectionAtTime: data.affection_at_time as number,
      lastReferencedAt: data.last_referenced_at
        ? new Date(data.last_referenced_at as string)
        : null,
      referenceCount: data.reference_count as number,
      createdAt: new Date(data.created_at as string),
    };
  }

  private mapSummary(data: Record<string, unknown>): ConversationSummary {
    return {
      id: data.id as string,
      userId: data.user_id as string,
      personaId: data.persona_id as string,
      sessionId: data.session_id as string | null,
      summaryType: data.summary_type as ConversationSummary['summaryType'],
      summary: data.summary as string,
      topics: data.topics as string[],
      emotionalArc: data.emotional_arc as Record<string, unknown>,
      affectionStart: data.affection_start as number,
      affectionEnd: data.affection_end as number,
      flagsSet: data.flags_set as Record<string, boolean>,
      periodStart: new Date(data.period_start as string),
      periodEnd: new Date(data.period_end as string),
      createdAt: new Date(data.created_at as string),
    };
  }
}
