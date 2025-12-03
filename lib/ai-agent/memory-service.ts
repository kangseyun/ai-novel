/**
 * Memory Service
 * 페르소나 기억 관리 서비스
 * 고급 기억 추출, 통합, 만료 관리 + 시맨틱 검색 기능 제공
 */

import { SupabaseClient } from '@supabase/supabase-js';
import {
  MemoryType,
  PersonaMemory,
  MemoryExtractionResult,
  MemorySaveOptions,
  MemorySourceType,
} from './types';
import {
  asString,
  asNumber,
  asBoolean,
  asDate,
  asNullableDate,
  asObject,
  DBRecord,
} from '../utils/db-mapper';
import { getEmbeddingService, EmbeddingService } from './embedding-service';

// Re-export for backward compatibility
export type { MemoryType, MemoryExtractionResult } from './types';
// Alias for backward compatibility
export type Memory = PersonaMemory;

// ============================================
// 메모리 감지 키워드/패턴
// ============================================

const MEMORY_PATTERNS: Record<MemoryType, { keywords: string[]; patterns: RegExp[] }> = {
  first_meeting: {
    keywords: ['처음', '첫', 'first', '만나서', 'meet', 'met', 'nice to meet'],
    patterns: [/처음\s*(만|봐|봤)/, /첫\s*만남/, /first\s*time/i, /nice\s*to\s*meet/i, /when\s*we\s*(first\s*)?met/i],
  },
  promise: {
    keywords: ['약속', '맹세', '꼭', '반드시', 'promise', 'swear', 'guarantee', 'vow', '기다려', '다음에', '해줄게', '할게'],
    patterns: [/약속\s*할[게래]/, /꼭\s*.+[할께]/, /반드시\s*.+할/, /i\s*promise/i, /i\s*swear/i, /i('ll| will)\s*always/i, /다음에\s*.+하자/, /기다려\s*줄/, /(영화|밥|데이트).*하자/, /만나자/, /보러\s*가자/],
  },
  secret_shared: {
    keywords: ['비밀', '아무한테도', '너만', '우리만', 'secret', 'between us', 'dont tell', 'nobody knows'],
    patterns: [/비밀인데/, /아무한테도\s*말/, /너한테만/, /우리만\s*아는/, /our\s*secret/i, /between\s*(you\s*and\s*me|us)/i, /don'?t\s*tell\s*anyone/i],
  },
  conflict: {
    // 강화된 갈등 감지 패턴 - 미해결 갈등은 일관성의 핵심!
    keywords: ['싫어', '미워', '화나', '짜증', '실망', '섭섭', '서운', '왜그래', '뭐야', '됐어', '그만해', '지겨워',
               'angry', 'hate', 'upset', 'frustrated', 'mad', 'disappointed', 'annoyed', 'sick of', 'leave me alone'],
    patterns: [
      /왜\s*그래/, /싫어.*해/, /화\s*났/, /실망/, /서운해/, /섭섭해/,
      /뭐야\s*진짜/, /됐어\s*이제/, /그만\s*해/, /지겨워/, /말\s*걸지\s*마/,
      /i('m| am)\s*(so\s*)?(angry|mad|upset|disappointed)/i,
      /you\s*made\s*me\s*(angry|upset|sad)/i,
      /i\s*(hate|can't stand)/i,
      /don'?t\s*talk\s*to\s*me/i,
      /leave\s*me\s*alone/i,
      /i('m| am)\s*done/i,
      /this\s*is\s*(over|the\s*end)/i,
    ],
  },
  reconciliation: {
    keywords: ['미안', '용서', '화해', 'sorry', 'forgive', 'apologize', 'make up', 'my fault'],
    patterns: [/미안해/, /용서.*해/, /화해하자/, /잘못했어/, /i('m| am)\s*sorry/i, /please\s*forgive/i, /my\s*(bad|fault)/i, /can\s*we\s*make\s*up/i],
  },
  intimate_moment: {
    keywords: ['사랑', '좋아', '보고싶', '특별', 'love', 'miss', 'special', 'mean so much', 'care about'],
    patterns: [/사랑해/, /너무\s*좋아/, /많이\s*보고.*싶/, /너\s*없이/, /i\s*love\s*you/i, /i\s*miss\s*you/i, /you('re| are)\s*special/i, /you\s*mean\s*(so\s*much|everything)/i],
  },
  gift_received: {
    keywords: ['선물', '줄게', '받아', 'gift', 'present', 'got you', 'for you'],
    patterns: [/선물\s*줄/, /이거\s*받아/, /선물.*준비/, /got\s*(this|something)\s*for\s*you/i, /here('s| is)\s*a\s*(gift|present)/i, /i\s*bought\s*(this|you)/i],
  },
  milestone: {
    keywords: ['기념', '100일', '1주년', 'anniversary', 'celebrate', 'days together', 'months'],
    patterns: [/\d+일\s*기념/, /우리\s*사귄/, /기념일/, /\d+\s*(day|month|year)s?\s*(anniversary|together)/i, /happy\s*anniversary/i, /let('s| us)\s*celebrate/i],
  },
  user_preference: {
    keywords: ['좋아하', '싫어하', '취향', '맛', 'favorite', 'like', 'prefer', 'hate', 'love'],
    patterns: [/좋아하는\s*\w+/, /싫어하는\s*\w+/, /취향이/, /my\s*favorite\s*(is|thing)/i, /i\s*(really\s*)?(like|love|prefer|hate)/i, /i('m| am)\s*into/i],
  },
  emotional_event: {
    keywords: ['울었', '감동', '행복', '슬퍼', 'cry', 'happy', 'sad', 'emotional', 'touched', 'moved'],
    patterns: [/울\s*뻔/, /감동\s*받/, /너무\s*행복/, /슬퍼/, /made\s*me\s*cry/i, /so\s*(happy|sad|emotional)/i, /i('m| am)\s*(so\s*)?(touched|moved)/i, /brought\s*tears/i],
  },
  location_memory: {
    keywords: ['같이 갔', '데이트', '장소', '카페', '공원', 'went together', 'date', 'place', 'restaurant', 'park'],
    patterns: [/같이\s*가/, /데이트.*하자/, /거기서\s*만나/, /let('s| us)\s*go\s*to/i, /(remember\s*)?(that|the)\s*(place|cafe|restaurant)/i, /our\s*(spot|place)/i],
  },
  nickname: {
    keywords: ['별명', '부를게', '이름', '호칭', 'nickname', 'call me', 'call you', 'name'],
    patterns: [/뭐라고\s*부를/, /별명.*뭐/, /이렇게\s*부를게/, /can\s*i\s*call\s*you/i, /call\s*me/i, /my\s*nickname/i, /(pet|nick)name/i],
  },
  inside_joke: {
    keywords: ['우리만', '기억나', '그때', '웃겼', 'remember when', 'our thing', 'funny', 'joke'],
    patterns: [/우리만\s*아는/, /그때\s*기억/, /둘만의/, /remember\s*when/i, /our\s*(thing|joke)/i, /that\s*was\s*(so\s*)?funny/i, /only\s*we\s*(know|understand)/i],
  },
  important_date: {
    keywords: ['생일', '기념일', '특별한 날', 'birthday', 'special day', 'important date'],
    patterns: [/생일이\s*언제/, /기념일/, /특별한\s*날/, /when('s| is)\s*your\s*birthday/i, /my\s*birthday\s*is/i, /mark\s*(the|this)\s*date/i, /special\s*day/i],
  },
};

// ============================================
// Memory Service
// ============================================

// 시맨틱 검색 결과 타입
export interface SemanticSearchResult extends Memory {
  similarity: number;
  semanticScore?: number;
  keywordScore?: number;
  finalScore?: number;
}

export class MemoryService {
  private supabase: SupabaseClient;
  private embeddingService: EmbeddingService;

  constructor(supabase: SupabaseClient) {
    this.supabase = supabase;
    this.embeddingService = getEmbeddingService();
  }

  // ============================================
  // 메모리 저장
  // ============================================

  /**
   * 메모리 저장
   */
  async saveMemory(
    userId: string,
    personaId: string,
    memoryType: MemoryType,
    summary: string,
    details: Record<string, unknown> = {},
    options: MemorySaveOptions = {}
  ): Promise<Memory | null> {
    // 현재 호감도 조회
    const { data: relationship } = await this.supabase
      .from('user_persona_relationships')
      .select('affection')
      .eq('user_id', userId)
      .eq('persona_id', personaId)
      .single();

    const { data, error } = await this.supabase
      .from('persona_memories')
      .upsert({
        user_id: userId,
        persona_id: personaId,
        memory_type: memoryType,
        summary,
        details,
        emotional_weight: options.emotionalWeight ?? 5,
        importance_score: options.importanceScore ?? 5,
        affection_at_time: relationship?.affection ?? 0,
        source_type: options.sourceType ?? 'dm',
        source_id: options.sourceId,
        is_active: true,
      }, {
        onConflict: 'user_id,persona_id,memory_type,summary',
      })
      .select()
      .single();

    if (error) {
      console.error('[MemoryService] Failed to save memory:', error);
      return null;
    }

    return this.mapDBMemory(data);
  }

  /**
   * 대화에서 메모리 추출 및 저장
   */
  async extractAndSaveFromConversation(
    userId: string,
    personaId: string,
    userMessage: string,
    aiResponse: string,
    sessionId: string
  ): Promise<Memory[]> {
    const savedMemories: Memory[] = [];

    // 유저 메시지에서 메모리 추출
    const userExtractions = this.extractMemoryFromText(userMessage, 'user');
    for (const extraction of userExtractions) {
      if (extraction.shouldSave && extraction.memoryType && extraction.summary) {
        const memory = await this.saveMemory(
          userId,
          personaId,
          extraction.memoryType,
          extraction.summary,
          extraction.details,
          {
            emotionalWeight: extraction.emotionalWeight,
            importanceScore: extraction.importanceScore,
            sourceType: 'dm',
            sourceId: sessionId,
          }
        );
        if (memory) savedMemories.push(memory);
      }
    }

    // AI 응답에서 메모리 추출 (페르소나가 말한 것)
    const aiExtractions = this.extractMemoryFromText(aiResponse, 'persona');
    for (const extraction of aiExtractions) {
      if (extraction.shouldSave && extraction.memoryType && extraction.summary) {
        const memory = await this.saveMemory(
          userId,
          personaId,
          extraction.memoryType,
          `${extraction.summary} (페르소나가 말함)`,
          { ...extraction.details, speaker: 'persona' },
          {
            emotionalWeight: extraction.emotionalWeight,
            importanceScore: extraction.importanceScore,
            sourceType: 'dm',
            sourceId: sessionId,
          }
        );
        if (memory) savedMemories.push(memory);
      }
    }

    return savedMemories;
  }

  /**
   * 텍스트에서 메모리 추출
   */
  private extractMemoryFromText(text: string, speaker: 'user' | 'persona'): MemoryExtractionResult[] {
    const results: MemoryExtractionResult[] = [];
    const normalizedText = text.toLowerCase();

    for (const [memoryType, { keywords, patterns }] of Object.entries(MEMORY_PATTERNS)) {
      // 키워드 매칭
      const keywordMatch = keywords.some(keyword => normalizedText.includes(keyword.toLowerCase()));

      // 패턴 매칭
      const patternMatch = patterns.some(pattern => pattern.test(text));

      if (keywordMatch || patternMatch) {
        results.push({
          shouldSave: true,
          memoryType: memoryType as MemoryType,
          summary: this.generateSummary(text, memoryType as MemoryType, speaker),
          details: {
            originalText: text.substring(0, 200),
            speaker,
            matchedType: patternMatch ? 'pattern' : 'keyword',
          },
          emotionalWeight: this.calculateEmotionalWeight(memoryType as MemoryType),
          importanceScore: this.calculateImportanceScore(memoryType as MemoryType),
        });
      }
    }

    return results;
  }

  /**
   * 메모리 요약 생성
   */
  private generateSummary(text: string, memoryType: MemoryType, speaker: 'user' | 'persona'): string {
    const shortText = text.substring(0, 100);

    const summaryTemplates: Record<MemoryType, string> = {
      first_meeting: '첫 만남의 순간',
      promise: speaker === 'user' ? '유저가 한 약속' : '페르소나가 한 약속',
      secret_shared: '비밀을 공유함',
      conflict: '갈등이 있었음',
      reconciliation: '화해의 순간',
      intimate_moment: '친밀한 순간',
      gift_received: '선물을 주고받음',
      milestone: '관계 마일스톤',
      user_preference: '유저의 취향 발견',
      emotional_event: '감정적인 순간',
      location_memory: '함께 간 장소',
      nickname: '별명을 정함',
      inside_joke: '둘만의 농담',
      important_date: '중요한 날짜 언급',
    };

    return `${summaryTemplates[memoryType]}: "${shortText}..."`;
  }

  /**
   * 감정 가중치 계산
   */
  private calculateEmotionalWeight(memoryType: MemoryType): number {
    const weights: Record<MemoryType, number> = {
      first_meeting: 8,
      promise: 7,
      secret_shared: 9,
      conflict: 8,
      reconciliation: 9,
      intimate_moment: 9,
      gift_received: 6,
      milestone: 8,
      user_preference: 4,
      emotional_event: 8,
      location_memory: 5,
      nickname: 6,
      inside_joke: 5,
      important_date: 7,
    };
    return weights[memoryType] || 5;
  }

  /**
   * 중요도 점수 계산
   */
  private calculateImportanceScore(memoryType: MemoryType): number {
    const scores: Record<MemoryType, number> = {
      first_meeting: 10,
      promise: 8,
      secret_shared: 9,
      conflict: 7,
      reconciliation: 8,
      intimate_moment: 9,
      gift_received: 6,
      milestone: 9,
      user_preference: 5,
      emotional_event: 7,
      location_memory: 5,
      nickname: 7,
      inside_joke: 6,
      important_date: 8,
    };
    return scores[memoryType] || 5;
  }

  // ============================================
  // 메모리 조회
  // ============================================

  /**
   * 유저-페르소나 메모리 조회
   */
  async getMemories(
    userId: string,
    personaId: string,
    options: {
      limit?: number;
      memoryTypes?: MemoryType[];
      minImportance?: number;
      activeOnly?: boolean;
    } = {}
  ): Promise<Memory[]> {
    let query = this.supabase
      .from('persona_memories')
      .select('*')
      .eq('user_id', userId)
      .eq('persona_id', personaId)
      .order('importance_score', { ascending: false })
      .order('created_at', { ascending: false });

    if (options.activeOnly !== false) {
      query = query.eq('is_active', true);
    }

    if (options.memoryTypes && options.memoryTypes.length > 0) {
      query = query.in('memory_type', options.memoryTypes);
    }

    if (options.minImportance) {
      query = query.gte('importance_score', options.minImportance);
    }

    if (options.limit) {
      query = query.limit(options.limit);
    }

    const { data, error } = await query;

    if (error) {
      console.error('[MemoryService] Failed to get memories:', error);
      return [];
    }

    return (data || []).map(this.mapDBMemory);
  }

  /**
   * 대화 컨텍스트용 메모리 조회 (LLM 프롬프트용)
   */
  async getMemoriesForContext(userId: string, personaId: string): Promise<string> {
    const memories = await this.getMemories(userId, personaId, {
      limit: 10,
      minImportance: 5,
      activeOnly: true,
    });

    if (memories.length === 0) {
      return 'No significant memories yet.';
    }

    const memoryStrings = memories.map(m => {
      const date = new Date(m.createdAt).toLocaleDateString('ko-KR');
      return `- [${m.memoryType}] ${m.summary} (${date})`;
    });

    return `Important memories:\n${memoryStrings.join('\n')}`;
  }

  /**
   * 메모리 참조 업데이트
   */
  async recordMemoryReference(memoryId: string): Promise<void> {
    await this.supabase.rpc('increment_memory_reference', {
      p_memory_id: memoryId,
    });
  }

  // ============================================
  // 메모리 관리 (만료/통합)
  // ============================================

  /**
   * 오래된 저품질 기억 만료 처리
   * - 90일 이상 된 기억 중 importance_score 3 이하
   */
  async expireOldMemories(userId: string, personaId: string): Promise<number> {
    const cutoffDate = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString();

    // importance_score가 낮고 오래된 기억 만료
    const { data: expiredLowImportance } = await this.supabase
      .from('persona_memories')
      .update({
        is_active: false,
        expires_at: new Date().toISOString()
      })
      .eq('user_id', userId)
      .eq('persona_id', personaId)
      .eq('is_active', true)
      .lt('created_at', cutoffDate)
      .lte('importance_score', 3)
      .select('id');

    // 90일 이상 되고 참조가 거의 없는 기억 만료
    const { data: expiredOld } = await this.supabase
      .from('persona_memories')
      .update({
        is_active: false,
        expires_at: new Date().toISOString()
      })
      .eq('user_id', userId)
      .eq('persona_id', personaId)
      .eq('is_active', true)
      .lt('created_at', cutoffDate)
      .lte('importance_score', 5)
      .select('id');

    const expiredCount = (expiredLowImportance?.length || 0) + (expiredOld?.length || 0);

    if (expiredCount > 0) {
      console.log(`[MemoryService] Expired ${expiredCount} old memories for ${userId}/${personaId}`);
    }

    return expiredCount;
  }

  /**
   * 유사한 기억 통합 (요약)
   * 같은 타입의 기억이 10개 이상이면 요약본으로 통합
   */
  async consolidateMemories(userId: string, personaId: string): Promise<void> {
    // 타입별 기억 수 조회
    const { data: memoryCounts } = await this.supabase
      .from('persona_memories')
      .select('memory_type')
      .eq('user_id', userId)
      .eq('persona_id', personaId)
      .eq('is_active', true);

    if (!memoryCounts) return;

    // 타입별 카운트
    const countByType: Record<string, number> = {};
    for (const m of memoryCounts) {
      countByType[m.memory_type] = (countByType[m.memory_type] || 0) + 1;
    }

    // 10개 이상인 타입 처리
    for (const [memoryType, count] of Object.entries(countByType)) {
      if (count >= 10) {
        await this.consolidateMemoriesByType(userId, personaId, memoryType);
      }
    }
  }

  private async consolidateMemoriesByType(
    userId: string,
    personaId: string,
    memoryType: string
  ): Promise<void> {
    // 해당 타입의 가장 오래된 기억들 조회 (최대 5개)
    const { data: oldMemories } = await this.supabase
      .from('persona_memories')
      .select('*')
      .eq('user_id', userId)
      .eq('persona_id', personaId)
      .eq('memory_type', memoryType)
      .eq('is_active', true)
      .order('created_at', { ascending: true })
      .limit(5);

    if (!oldMemories || oldMemories.length < 5) return;

    // 요약 생성 (단순 연결)
    const summaries = oldMemories.map(m => m.summary).join('; ');
    const consolidatedSummary = `[통합 기억] ${summaries}`;

    // 새 통합 기억 생성
    await this.supabase.from('persona_memories').insert({
      user_id: userId,
      persona_id: personaId,
      memory_type: memoryType,
      summary: consolidatedSummary,
      details: {
        consolidated: true,
        source_ids: oldMemories.map(m => m.id),
        original_count: oldMemories.length,
      },
      emotional_weight: Math.max(...oldMemories.map(m => m.emotional_weight || 5)),
      importance_score: Math.max(...oldMemories.map(m => m.importance_score || 5)),
      is_active: true,
      source_type: 'system',
    });

    // 원본 기억 비활성화
    await this.supabase
      .from('persona_memories')
      .update({ is_active: false })
      .in('id', oldMemories.map(m => m.id));

    console.log(`[MemoryService] Consolidated ${oldMemories.length} ${memoryType} memories`);
  }

  /**
   * 메모리 최적화 실행 (일일 배치)
   */
  async runMaintenanceJob(userId: string, personaId: string): Promise<{
    expired: number;
    consolidated: boolean;
  }> {
    const expired = await this.expireOldMemories(userId, personaId);
    await this.consolidateMemories(userId, personaId);

    return { expired, consolidated: true };
  }

  // ============================================
  // 매핑 함수
  // ============================================

  private mapDBMemory(db: DBRecord): Memory {
    return {
      id: asString(db.id),
      userId: asString(db.user_id),
      personaId: asString(db.persona_id),
      memoryType: db.memory_type as MemoryType,
      summary: asString(db.summary),
      details: asObject(db.details),
      emotionalWeight: asNumber(db.emotional_weight, 5),
      affectionAtTime: asNumber(db.affection_at_time, 0),
      importanceScore: asNumber(db.importance_score, 5),
      isActive: asBoolean(db.is_active, true),
      sourceType: db.source_type as MemorySourceType,
      sourceId: db.source_id as string | undefined,
      lastReferencedAt: asNullableDate(db.last_referenced_at),
      referenceCount: asNumber(db.reference_count, 0),
      createdAt: asDate(db.created_at),
    };
  }

  // ============================================
  // 시맨틱 검색 (Semantic Search)
  // ============================================

  /**
   * 시맨틱 검색으로 관련 기억 찾기
   * 예: "우리 3달 전에 갔던 카페" → 카페 관련 기억 찾기
   */
  async searchMemoriesSemantic(
    userId: string,
    personaId: string,
    query: string,
    options: {
      threshold?: number;  // 유사도 임계값 (0-1, 기본 0.7)
      limit?: number;      // 최대 결과 수
    } = {}
  ): Promise<SemanticSearchResult[]> {
    const { threshold = 0.7, limit = 5 } = options;

    // 1. 쿼리 임베딩 생성
    const queryEmbedding = await this.embeddingService.generateEmbedding(query);
    if (!queryEmbedding || queryEmbedding.length === 0) {
      console.warn('[MemoryService] Failed to generate query embedding, falling back to keyword search');
      return this.fallbackKeywordSearch(userId, personaId, query, limit);
    }

    // 2. DB 시맨틱 검색 호출
    const { data, error } = await this.supabase.rpc('search_memories_semantic', {
      p_user_id: userId,
      p_persona_id: personaId,
      p_query_embedding: `[${queryEmbedding.join(',')}]`,
      p_match_threshold: threshold,
      p_match_count: limit,
    });

    if (error) {
      console.error('[MemoryService] Semantic search failed:', error);
      return this.fallbackKeywordSearch(userId, personaId, query, limit);
    }

    // 3. 결과 매핑
    return (data || []).map((row: DBRecord) => ({
      ...this.mapDBMemory(row),
      similarity: asNumber(row.similarity, 0),
    }));
  }

  /**
   * 하이브리드 검색 (시맨틱 + 키워드 + 중요도)
   * 더 정확한 검색이 필요할 때 사용
   */
  async searchMemoriesHybrid(
    userId: string,
    personaId: string,
    query: string,
    options: {
      keywords?: string[];  // 추가 키워드 (없으면 자동 추출)
      threshold?: number;
      limit?: number;
    } = {}
  ): Promise<SemanticSearchResult[]> {
    const { threshold = 0.5, limit = 10 } = options;

    // 1. 쿼리 임베딩 생성
    const queryEmbedding = await this.embeddingService.generateEmbedding(query);

    // 2. 키워드 추출 (제공되지 않은 경우)
    const keywords = options.keywords || this.extractKeywords(query);

    // 3. 임베딩 생성 실패 시 키워드만으로 검색
    if (!queryEmbedding || queryEmbedding.length === 0) {
      return this.fallbackKeywordSearch(userId, personaId, query, limit, keywords);
    }

    // 4. DB 하이브리드 검색 호출
    const { data, error } = await this.supabase.rpc('search_memories_hybrid', {
      p_user_id: userId,
      p_persona_id: personaId,
      p_query_embedding: `[${queryEmbedding.join(',')}]`,
      p_keywords: keywords,
      p_match_threshold: threshold,
      p_match_count: limit,
    });

    if (error) {
      console.error('[MemoryService] Hybrid search failed:', error);
      return this.fallbackKeywordSearch(userId, personaId, query, limit, keywords);
    }

    // 5. 결과 매핑
    return (data || []).map((row: DBRecord) => ({
      ...this.mapDBMemory(row),
      similarity: asNumber(row.final_score, 0),
      semanticScore: asNumber(row.semantic_score, 0),
      keywordScore: asNumber(row.keyword_score, 0),
      finalScore: asNumber(row.final_score, 0),
    }));
  }

  /**
   * 대화 컨텍스트에 관련 기억 추가 (시맨틱 검색 활용)
   * 기존 getMemoriesForContext의 향상 버전
   */
  async getRelevantMemoriesForContext(
    userId: string,
    personaId: string,
    currentMessage: string
  ): Promise<string> {
    // 1. 시맨틱 검색으로 관련 기억 찾기
    const relevantMemories = await this.searchMemoriesHybrid(
      userId,
      personaId,
      currentMessage,
      { threshold: 0.4, limit: 5 }
    );

    // 2. 중요도 높은 최근 기억도 포함
    const recentImportant = await this.getMemories(userId, personaId, {
      limit: 5,
      minImportance: 7,
      activeOnly: true,
    });

    // 3. 중복 제거 및 병합
    const memoryMap = new Map<string, Memory>();
    for (const m of [...relevantMemories, ...recentImportant]) {
      if (!memoryMap.has(m.id)) {
        memoryMap.set(m.id, m);
      }
    }

    const allMemories = Array.from(memoryMap.values());

    if (allMemories.length === 0) {
      return 'No significant memories yet.';
    }

    // 4. 포맷팅
    const memoryStrings = allMemories.slice(0, 10).map(m => {
      const date = new Date(m.createdAt).toLocaleDateString('ko-KR');
      const relevanceTag = 'similarity' in m
        ? ` [관련도: ${Math.round((m as SemanticSearchResult).similarity * 100)}%]`
        : '';
      return `- [${m.memoryType}] ${m.summary} (${date})${relevanceTag}`;
    });

    return `Important memories (context-aware):\n${memoryStrings.join('\n')}`;
  }

  /**
   * 메모리 임베딩 생성 및 저장
   * 새 메모리 저장 시 또는 배치로 호출
   */
  async generateAndSaveEmbedding(memoryId: string): Promise<boolean> {
    // 1. 메모리 조회
    const { data: memory, error: fetchError } = await this.supabase
      .from('persona_memories')
      .select('id, summary, details')
      .eq('id', memoryId)
      .single();

    if (fetchError || !memory) {
      console.error('[MemoryService] Memory not found:', memoryId);
      return false;
    }

    // 2. 임베딩 생성할 텍스트 준비
    const textToEmbed = `${memory.summary} ${JSON.stringify(memory.details || {})}`;
    const embedding = await this.embeddingService.generateEmbedding(textToEmbed);

    if (!embedding || embedding.length === 0) {
      console.error('[MemoryService] Failed to generate embedding for:', memoryId);
      return false;
    }

    // 3. 임베딩 저장
    const { error: updateError } = await this.supabase
      .from('persona_memories')
      .update({ embedding: `[${embedding.join(',')}]` })
      .eq('id', memoryId);

    if (updateError) {
      console.error('[MemoryService] Failed to save embedding:', updateError);
      return false;
    }

    return true;
  }

  /**
   * 임베딩 없는 기억들 배치 처리
   */
  async batchGenerateEmbeddings(
    userId?: string,
    personaId?: string,
    batchSize: number = 50
  ): Promise<{ processed: number; failed: number }> {
    // 1. 임베딩 없는 기억 조회
    let query = this.supabase
      .from('persona_memories')
      .select('id, summary, details')
      .is('embedding', null)
      .eq('is_active', true)
      .limit(batchSize);

    if (userId) query = query.eq('user_id', userId);
    if (personaId) query = query.eq('persona_id', personaId);

    const { data: memories, error } = await query;

    if (error || !memories || memories.length === 0) {
      return { processed: 0, failed: 0 };
    }

    // 2. 배치 임베딩 생성
    const texts = memories.map(m =>
      `${m.summary} ${JSON.stringify(m.details || {})}`
    );
    const embeddings = await this.embeddingService.generateEmbeddings(texts);

    // 3. 결과 저장
    let processed = 0;
    let failed = 0;

    for (let i = 0; i < memories.length; i++) {
      const embedding = embeddings[i]?.embedding;
      if (!embedding || embedding.length === 0) {
        failed++;
        continue;
      }

      const { error: updateError } = await this.supabase
        .from('persona_memories')
        .update({ embedding: `[${embedding.join(',')}]` })
        .eq('id', memories[i].id);

      if (updateError) {
        failed++;
      } else {
        processed++;
      }
    }

    console.log(`[MemoryService] Batch embedding: ${processed} processed, ${failed} failed`);
    return { processed, failed };
  }

  // ============================================
  // 헬퍼 함수
  // ============================================

  /**
   * 키워드 추출 (간단한 구현)
   */
  private extractKeywords(text: string): string[] {
    // 불용어 제거 및 의미있는 단어 추출
    const stopWords = new Set([
      '그', '저', '이', '것', '수', '등', '들', '및', '에', '를', '을', '가', '이', '의',
      'the', 'a', 'an', 'is', 'are', 'was', 'were', 'be', 'been', 'being',
      'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could', 'should',
      'i', 'you', 'he', 'she', 'it', 'we', 'they', 'my', 'your', 'his', 'her',
    ]);

    const words = text
      .toLowerCase()
      .replace(/[^\w\s가-힣]/g, ' ')
      .split(/\s+/)
      .filter(w => w.length > 1 && !stopWords.has(w));

    // 중복 제거
    return Array.from(new Set(words)).slice(0, 10);
  }

  /**
   * 키워드 기반 폴백 검색
   */
  private async fallbackKeywordSearch(
    userId: string,
    personaId: string,
    query: string,
    limit: number,
    keywords?: string[]
  ): Promise<SemanticSearchResult[]> {
    const searchKeywords = keywords || this.extractKeywords(query);

    if (searchKeywords.length === 0) {
      // 키워드도 없으면 최근 중요 기억 반환
      const memories = await this.getMemories(userId, personaId, {
        limit,
        minImportance: 5,
        activeOnly: true,
      });
      return memories.map(m => ({ ...m, similarity: 0.5 }));
    }

    // ILIKE 검색
    const { data, error } = await this.supabase
      .from('persona_memories')
      .select('*')
      .eq('user_id', userId)
      .eq('persona_id', personaId)
      .eq('is_active', true)
      .or(searchKeywords.map(kw => `summary.ilike.%${kw}%`).join(','))
      .order('importance_score', { ascending: false })
      .limit(limit);

    if (error) {
      console.error('[MemoryService] Keyword search failed:', error);
      return [];
    }

    return (data || []).map(row => ({
      ...this.mapDBMemory(row),
      similarity: 0.6, // 키워드 매칭은 낮은 유사도 부여
    }));
  }
}

// ============================================
// 싱글톤 인스턴스
// ============================================

let memoryServiceInstance: MemoryService | null = null;

export function getMemoryService(supabase: SupabaseClient): MemoryService {
  if (!memoryServiceInstance) {
    memoryServiceInstance = new MemoryService(supabase);
  }
  return memoryServiceInstance;
}
