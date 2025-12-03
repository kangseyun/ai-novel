/**
 * Memory System
 * 페르소나의 장기 기억과 대화 컨텍스트를 관리
 */

import { SupabaseClient } from '@supabase/supabase-js';
import {
  ConversationMessage,
  PersonaMood,
  MemoryType,
  PersonaMemory,
  ConversationSummary,
  MemoryQueryOptions,
  MEMORY_TYPE_LABELS,
} from './types';
import {
  asString,
  asNumber,
  asDate,
  asNullableDate,
  asObject,
  DBRecord,
} from '../utils/db-mapper';

// Re-export for backward compatibility
export type { MemoryType, PersonaMemory, ConversationSummary } from './types';

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
    options?: MemoryQueryOptions
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
      return `- [${MEMORY_TYPE_LABELS[m.memoryType]}] ${m.summary}`;
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

  private mapMemory(data: DBRecord): PersonaMemory {
    return {
      id: asString(data.id),
      userId: asString(data.user_id),
      personaId: asString(data.persona_id),
      memoryType: data.memory_type as MemoryType,
      summary: asString(data.summary),
      details: asObject(data.details),
      emotionalWeight: asNumber(data.emotional_weight, 5),
      affectionAtTime: asNumber(data.affection_at_time, 0),
      lastReferencedAt: asNullableDate(data.last_referenced_at),
      referenceCount: asNumber(data.reference_count, 0),
      createdAt: asDate(data.created_at),
    };
  }

  private mapSummary(data: DBRecord): ConversationSummary {
    return {
      id: asString(data.id),
      userId: asString(data.user_id),
      personaId: asString(data.persona_id),
      sessionId: data.session_id as string | null,
      summaryType: data.summary_type as ConversationSummary['summaryType'],
      summary: asString(data.summary),
      topics: data.topics as string[],
      emotionalArc: asObject(data.emotional_arc),
      affectionStart: asNumber(data.affection_start, 0),
      affectionEnd: asNumber(data.affection_end, 0),
      flagsSet: asObject<Record<string, boolean>>(data.flags_set),
      periodStart: asDate(data.period_start),
      periodEnd: asDate(data.period_end),
      createdAt: asDate(data.created_at),
    };
  }
}
