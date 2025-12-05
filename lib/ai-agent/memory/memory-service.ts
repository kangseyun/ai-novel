/**
 * Memory Service (RAG Core) - Complete Implementation
 *
 * 역할:
 * 1. 대화 내용을 임베딩하여 기억으로 저장
 * 2. 유저 질문과 관련된 과거 기억 검색 (Supabase Vector Search)
 * 3. 페르소나의 지식(Lore) 검색
 * 4. 장기 기억 관리 (persona_memories)
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { getEmbeddingService, EMBEDDING_DIMENSIONS } from './embedding-service';
import { getPersonaConfig } from './persona-config-store';
import { LoreEntry } from '../../../types/persona-engine';

// ============================================
// 타입 정의
// ============================================

export interface MemoryResult {
  content: string;
  similarity: number;
  type: 'memory' | 'lore' | 'conversation';
  metadata?: Record<string, unknown>;
}

export interface SaveMemoryOptions {
  memoryType?: string;
  emotionalWeight?: number;
  importanceScore?: number;
  sessionId?: string;
}

export interface SearchOptions {
  matchThreshold?: number;
  memoryCount?: number;
  conversationCount?: number;
  loreCount?: number;
  keywords?: string[];
}

// ============================================
// Memory Service 클래스
// ============================================

export class MemoryService {
  private embeddingService = getEmbeddingService();
  private supabase: SupabaseClient | null = null;
  private loreEmbeddingCache: Map<string, Map<string, number[]>> = new Map();
  private pendingEmbeddings: Array<{
    table: string;
    id: string;
    content: string;
  }> = [];
  private flushInterval: NodeJS.Timeout | null = null;

  constructor() {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (supabaseUrl && supabaseKey) {
      this.supabase = createClient(supabaseUrl, supabaseKey);
      // 10초마다 배치 임베딩 저장
      this.flushInterval = setInterval(() => this.flushPendingEmbeddings(), 10000);
    }
  }

  // ============================================
  // 통합 컨텍스트 검색 (메인 진입점)
  // ============================================

  /**
   * 관련된 모든 정보 검색 (기억 + 대화 + Lore)
   */
  async retrieveContext(
    personaId: string,
    query: string,
    userId?: string,
    options: SearchOptions = {}
  ): Promise<{ memories: string[]; lore: string[]; conversations: string[] }> {
    const {
      matchThreshold = 0.6,
      memoryCount = 5,
      conversationCount = 5,
      loreCount = 3,
    } = options;

    // 1. 쿼리 임베딩 생성
    const queryEmbedding = await this.embeddingService.generateEmbedding(query);
    if (!queryEmbedding) {
      console.warn('[MemoryService] Failed to generate query embedding');
      return { memories: [], lore: [], conversations: [] };
    }

    // 2. Supabase가 있으면 DB 검색, 없으면 로컬 검색
    if (this.supabase && userId) {
      return this.searchFromDatabase(
        userId,
        personaId,
        queryEmbedding,
        matchThreshold,
        memoryCount,
        conversationCount,
        loreCount
      );
    }

    // 3. 로컬 폴백 (Lore만 검색)
    const relevantLore = await this.searchLoreLocal(personaId, queryEmbedding);
    return {
      memories: [],
      lore: relevantLore.map(l => l.content),
      conversations: [],
    };
  }

  /**
   * DB에서 통합 검색
   */
  private async searchFromDatabase(
    userId: string,
    personaId: string,
    queryEmbedding: number[],
    matchThreshold: number,
    memoryCount: number,
    conversationCount: number,
    loreCount: number
  ): Promise<{ memories: string[]; lore: string[]; conversations: string[] }> {
    if (!this.supabase) {
      return { memories: [], lore: [], conversations: [] };
    }

    try {
      // search_all_context RPC 호출
      const { data, error } = await this.supabase.rpc('search_all_context', {
        p_user_id: userId,
        p_persona_id: personaId,
        p_query_embedding: `[${queryEmbedding.join(',')}]`,
        p_match_threshold: matchThreshold,
        p_memory_count: memoryCount,
        p_conversation_count: conversationCount,
        p_lore_count: loreCount,
      });

      if (error) {
        console.error('[MemoryService] search_all_context error:', error);
        // 폴백: 개별 검색 시도
        return this.searchIndividually(
          userId,
          personaId,
          queryEmbedding,
          matchThreshold,
          memoryCount,
          conversationCount,
          loreCount
        );
      }

      // 결과 분류
      const memories: string[] = [];
      const lore: string[] = [];
      const conversations: string[] = [];

      for (const item of data || []) {
        switch (item.source_type) {
          case 'memory':
            memories.push(item.content);
            break;
          case 'lore':
            lore.push(item.content);
            break;
          case 'conversation':
            conversations.push(`${item.metadata?.role === 'user' ? 'User' : 'Char'}: ${item.content}`);
            break;
        }
      }

      // Lore가 없으면 로컬 검색 폴백
      if (lore.length === 0) {
        const localLore = await this.searchLoreLocal(personaId, queryEmbedding);
        lore.push(...localLore.map(l => l.content));
      }

      return { memories, lore, conversations };
    } catch (err) {
      console.error('[MemoryService] DB search failed:', err);
      const localLore = await this.searchLoreLocal(personaId, queryEmbedding);
      return {
        memories: [],
        lore: localLore.map(l => l.content),
        conversations: [],
      };
    }
  }

  /**
   * 개별 테이블 검색 (폴백용)
   */
  private async searchIndividually(
    userId: string,
    personaId: string,
    queryEmbedding: number[],
    matchThreshold: number,
    memoryCount: number,
    conversationCount: number,
    loreCount: number
  ): Promise<{ memories: string[]; lore: string[]; conversations: string[] }> {
    if (!this.supabase) {
      return { memories: [], lore: [], conversations: [] };
    }

    const embeddingStr = `[${queryEmbedding.join(',')}]`;

    // 병렬로 개별 검색
    const [memoriesResult, conversationsResult, loreResult] = await Promise.allSettled([
      this.supabase.rpc('search_memories_semantic', {
        p_user_id: userId,
        p_persona_id: personaId,
        p_query_embedding: embeddingStr,
        p_match_threshold: matchThreshold,
        p_match_count: memoryCount,
      }),
      this.supabase.rpc('search_conversation_memories', {
        p_user_id: userId,
        p_persona_id: personaId,
        p_query_embedding: embeddingStr,
        p_match_threshold: matchThreshold,
        p_match_count: conversationCount,
      }),
      this.supabase.rpc('search_lore_semantic', {
        p_persona_id: personaId,
        p_query_embedding: embeddingStr,
        p_match_threshold: matchThreshold,
        p_match_count: loreCount,
      }),
    ]);

    const memories: string[] = [];
    const conversations: string[] = [];
    const lore: string[] = [];

    if (memoriesResult.status === 'fulfilled' && memoriesResult.value.data) {
      memories.push(...memoriesResult.value.data.map((m: { summary: string }) => m.summary));
    }

    if (conversationsResult.status === 'fulfilled' && conversationsResult.value.data) {
      conversations.push(
        ...conversationsResult.value.data.map(
          (c: { role: string; content: string }) =>
            `${c.role === 'user' ? 'User' : 'Char'}: ${c.content}`
        )
      );
    }

    if (loreResult.status === 'fulfilled' && loreResult.value.data) {
      lore.push(...loreResult.value.data.map((l: { content: string }) => l.content));
    }

    // Lore가 없으면 로컬 폴백
    if (lore.length === 0) {
      const localLore = await this.searchLoreLocal(personaId, queryEmbedding);
      lore.push(...localLore.map(l => l.content));
    }

    return { memories, lore, conversations };
  }

  // ============================================
  // Lore 검색 (로컬 캐시 + 벡터 검색)
  // ============================================

  /**
   * Lore(설정) 로컬 검색 (캐시된 임베딩 사용)
   */
  private async searchLoreLocal(
    personaId: string,
    queryEmbedding: number[]
  ): Promise<MemoryResult[]> {
    const config = await getPersonaConfig(personaId);
    if (!config || !config.lore || config.lore.length === 0) return [];

    // 캐시된 임베딩 가져오기 또는 생성
    let loreCache = this.loreEmbeddingCache.get(personaId);
    if (!loreCache) {
      loreCache = new Map();
      this.loreEmbeddingCache.set(personaId, loreCache);
    }

    // 임베딩이 없는 항목 수집
    const loreNeedingEmbedding: LoreEntry[] = [];
    for (const entry of config.lore) {
      if (!loreCache.has(entry.key)) {
        loreNeedingEmbedding.push(entry);
      }
    }

    // 배치로 임베딩 생성
    if (loreNeedingEmbedding.length > 0) {
      const texts = loreNeedingEmbedding.map(e => `${e.key}: ${e.content}`);
      const embeddings = await this.embeddingService.generateEmbeddings(texts);

      for (let i = 0; i < loreNeedingEmbedding.length; i++) {
        const entry = loreNeedingEmbedding[i];
        const embedding = embeddings[i]?.embedding;
        if (embedding && embedding.length > 0) {
          loreCache.set(entry.key, embedding);
        }
      }
    }

    // 유사도 계산 및 정렬
    const candidates = config.lore
      .map(entry => {
        const embedding = loreCache.get(entry.key);
        if (!embedding || embedding.length === 0) return null;
        return {
          text: entry.content,
          embedding,
        };
      })
      .filter((c): c is { text: string; embedding: number[] } => c !== null);

    const results = this.embeddingService.findMostSimilar(
      queryEmbedding,
      candidates,
      3 // Top 3 Lore
    );

    return results.map(r => ({
      content: r.text,
      similarity: r.similarity,
      type: 'lore' as const,
    }));
  }

  // ============================================
  // 기억 저장
  // ============================================

  /**
   * 대화 내용을 기억으로 저장 (비동기 임베딩)
   */
  async saveMemory(
    personaId: string,
    userId: string,
    content: string,
    role: 'user' | 'assistant',
    options: SaveMemoryOptions = {}
  ): Promise<string | null> {
    if (!this.supabase) {
      console.log(`[MemoryService] No DB, skipped: "${content.substring(0, 30)}..."`);
      return null;
    }

    const {
      sessionId,
      importanceScore = 5,
    } = options;

    try {
      // 1. 먼저 DB에 저장 (임베딩 없이)
      const { data, error } = await this.supabase
        .from('conversation_memories')
        .insert({
          user_id: userId,
          persona_id: personaId,
          session_id: sessionId,
          role,
          content,
          importance_score: importanceScore,
          is_active: true,
        })
        .select('id')
        .single();

      if (error) {
        console.error('[MemoryService] Save memory error:', error);
        return null;
      }

      // 2. 임베딩 생성을 배치 큐에 추가
      this.pendingEmbeddings.push({
        table: 'conversation_memories',
        id: data.id,
        content,
      });

      return data.id;
    } catch (err) {
      console.error('[MemoryService] Save memory failed:', err);
      return null;
    }
  }

  /**
   * 장기 기억 저장 (중요한 이벤트)
   */
  async saveLongTermMemory(
    personaId: string,
    userId: string,
    summary: string,
    memoryType: string,
    options: {
      details?: Record<string, unknown>;
      emotionalWeight?: number;
      affectionAtTime?: number;
    } = {}
  ): Promise<string | null> {
    if (!this.supabase) {
      return null;
    }

    const {
      details = {},
      emotionalWeight = 5,
      affectionAtTime,
    } = options;

    try {
      const { data, error } = await this.supabase
        .from('persona_memories')
        .insert({
          user_id: userId,
          persona_id: personaId,
          memory_type: memoryType,
          summary,
          details,
          emotional_weight: emotionalWeight,
          affection_at_time: affectionAtTime,
          importance_score: emotionalWeight,
          is_active: true,
        })
        .select('id')
        .single();

      if (error) {
        console.error('[MemoryService] Save long-term memory error:', error);
        return null;
      }

      // 임베딩 큐에 추가
      this.pendingEmbeddings.push({
        table: 'persona_memories',
        id: data.id,
        content: `${memoryType}: ${summary}`,
      });

      return data.id;
    } catch (err) {
      console.error('[MemoryService] Save long-term memory failed:', err);
      return null;
    }
  }

  // ============================================
  // Lore 관리 (DB 저장)
  // ============================================

  /**
   * Lore를 DB에 저장하고 임베딩 생성
   */
  async saveLore(
    personaId: string,
    category: string,
    key: string,
    content: string,
    importanceScore: number = 5
  ): Promise<string | null> {
    if (!this.supabase) {
      return null;
    }

    try {
      const { data, error } = await this.supabase
        .from('persona_lore')
        .upsert({
          persona_id: personaId,
          category,
          key,
          content,
          importance_score: importanceScore,
          is_active: true,
          updated_at: new Date().toISOString(),
        }, {
          onConflict: 'persona_id,key',
        })
        .select('id')
        .single();

      if (error) {
        console.error('[MemoryService] Save lore error:', error);
        return null;
      }

      // 임베딩 큐에 추가
      this.pendingEmbeddings.push({
        table: 'persona_lore',
        id: data.id,
        content: `${key}: ${content}`,
      });

      return data.id;
    } catch (err) {
      console.error('[MemoryService] Save lore failed:', err);
      return null;
    }
  }

  /**
   * 페르소나 Lore를 DB에 동기화
   */
  async syncLoreToDatabase(personaId: string): Promise<number> {
    const config = await getPersonaConfig(personaId);
    if (!config || !config.lore || config.lore.length === 0) return 0;

    let count = 0;
    for (const entry of config.lore) {
      const result = await this.saveLore(
        personaId,
        'general',
        entry.key,
        entry.content,
        5
      );
      if (result) count++;
    }

    console.log(`[MemoryService] Synced ${count} lore entries for ${personaId}`);
    return count;
  }

  // ============================================
  // 배치 임베딩 처리
  // ============================================

  /**
   * 대기 중인 임베딩을 배치로 처리
   */
  private async flushPendingEmbeddings(): Promise<void> {
    if (this.pendingEmbeddings.length === 0 || !this.supabase) return;

    const batch = [...this.pendingEmbeddings];
    this.pendingEmbeddings = [];

    console.log(`[MemoryService] Processing ${batch.length} pending embeddings`);

    try {
      // 배치로 임베딩 생성
      const texts = batch.map(item => item.content);
      const embeddings = await this.embeddingService.generateEmbeddings(texts);

      // 테이블별로 그룹화
      const byTable: Record<string, Array<{ id: string; embedding: number[] }>> = {};

      for (let i = 0; i < batch.length; i++) {
        const item = batch[i];
        const embedding = embeddings[i]?.embedding;

        if (!embedding || embedding.length === 0) continue;

        if (!byTable[item.table]) {
          byTable[item.table] = [];
        }
        byTable[item.table].push({ id: item.id, embedding });
      }

      // 테이블별로 업데이트
      for (const [table, items] of Object.entries(byTable)) {
        for (const item of items) {
          await this.supabase
            .from(table)
            .update({ embedding: `[${item.embedding.join(',')}]` })
            .eq('id', item.id);
        }
      }

      console.log(`[MemoryService] Updated embeddings for ${batch.length} items`);
    } catch (err) {
      console.error('[MemoryService] Flush embeddings failed:', err);
      // 실패한 항목 다시 큐에 추가
      this.pendingEmbeddings.push(...batch);
    }
  }

  // ============================================
  // 기억 참조 추적
  // ============================================

  /**
   * 기억이 참조되었음을 기록
   */
  async incrementMemoryReference(memoryId: string): Promise<void> {
    if (!this.supabase) return;

    try {
      await this.supabase.rpc('increment_memory_reference', {
        p_memory_id: memoryId,
      });
    } catch (err) {
      console.error('[MemoryService] Increment reference failed:', err);
    }
  }

  // ============================================
  // 정리
  // ============================================

  /**
   * 클린업
   */
  async cleanup(): Promise<void> {
    if (this.flushInterval) {
      clearInterval(this.flushInterval);
    }
    await this.flushPendingEmbeddings();
  }

  /**
   * 캐시 클리어
   */
  clearCache(personaId?: string): void {
    if (personaId) {
      this.loreEmbeddingCache.delete(personaId);
    } else {
      this.loreEmbeddingCache.clear();
    }
  }
}

// ============================================
// 싱글톤 인스턴스
// ============================================

export const memoryService = new MemoryService();
