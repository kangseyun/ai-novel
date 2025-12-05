/**
 * Memory Extractor
 * DM 대화에서 자동으로 기억을 추출하는 시스템
 *
 * 역할:
 * 1. 대화 내용 분석하여 기억 후보 탐지
 * 2. 기억 타입 분류
 * 3. RelationshipManager를 통해 기억 저장
 */

import { MemoryType, SaveMemoryInput } from './types';
import { getRelationshipManager } from './relationship-manager';

// ============================================
// 기억 패턴 정의
// ============================================

interface MemoryPattern {
  type: MemoryType;
  patterns: RegExp[];
  extractSummary: (match: RegExpMatchArray, context: string) => string;
  extractDetails?: (match: RegExpMatchArray, context: string) => Record<string, unknown>;
  minAffection?: number;
  emotionalWeight?: number;
}

const MEMORY_PATTERNS: MemoryPattern[] = [
  // 약속 관련
  {
    type: 'promise',
    patterns: [
      /약속(해|할게|하자|했어)/g,
      /다음에\s*(같이|함께)\s*(.+?)(하자|할까|갈래)/g,
      /꼭\s*(.+?)(해줄게|할게|보여줄게)/g,
      /언젠간?\s*(.+?)(가자|하자|보자)/g,
    ],
    extractSummary: (match, context) => {
      const sentence = extractSentenceContaining(context, match[0]);
      return sentence || `약속: ${match[0]}`;
    },
    extractDetails: (match) => ({
      promiseContent: match[0],
      promiseType: 'future_plan',
    }),
    emotionalWeight: 7,
  },

  // 비밀 공유
  {
    type: 'secret_shared',
    patterns: [
      /비밀인데/g,
      /아무한테도\s*(말|얘기)\s*안\s*(했|해)/g,
      /처음\s*말하는\s*(건데|거야)/g,
      /너(한테|만)\s*(만|)\s*(말|얘기)(해|하는)/g,
      /사실은?\s*(.+?)(야|이야|거든)/g,
    ],
    extractSummary: (match, context) => {
      const sentence = extractSentenceContaining(context, match[0]);
      return sentence || `비밀을 공유했다`;
    },
    extractDetails: (match) => ({
      secretType: 'personal',
      sharedAt: new Date().toISOString(),
    }),
    minAffection: 30,
    emotionalWeight: 9,
  },

  // 갈등
  {
    type: 'conflict',
    patterns: [
      /화\s*(났|나|내지마)/g,
      /싫어(졌어|해|)/g,
      /실망(했어|이야|스러워)/g,
      /왜\s*그래|왜\s*이래/g,
      /미안해|죄송해/g,
    ],
    extractSummary: (match, context) => {
      const sentence = extractSentenceContaining(context, match[0]);
      return sentence || `갈등 상황 발생`;
    },
    extractDetails: (match) => ({
      conflictTrigger: match[0],
      resolved: false,
    }),
    emotionalWeight: 8,
  },

  // 화해
  {
    type: 'reconciliation',
    patterns: [
      /용서(해|할게|했어)/g,
      /괜찮아|괜찮은거야/g,
      /화\s*풀(어|렸어|자)/g,
      /다시\s*잘\s*해보자/g,
    ],
    extractSummary: (match, context) => {
      const sentence = extractSentenceContaining(context, match[0]);
      return sentence || `화해했다`;
    },
    extractDetails: () => ({
      resolved: true,
      reconciliationType: 'verbal',
    }),
    emotionalWeight: 8,
  },

  // 특별한 순간
  {
    type: 'intimate_moment',
    patterns: [
      /좋아(해|했어|하게\s*됐어)/g,
      /보고\s*싶(어|었어|을\s*거야)/g,
      /특별(해|한\s*사람|하다)/g,
      /내\s*곁에\s*있어/g,
      /행복(해|했어|하다)/g,
    ],
    extractSummary: (match, context) => {
      const sentence = extractSentenceContaining(context, match[0]);
      return sentence || `특별한 순간을 공유했다`;
    },
    extractDetails: (match) => ({
      momentType: 'emotional_connection',
      expression: match[0],
    }),
    minAffection: 50,
    emotionalWeight: 9,
  },

  // 선물
  {
    type: 'gift_received',
    patterns: [
      /선물(이야|해줄게|받아)/g,
      /줄게|줄\s*거야/g,
      /사\s*줄(게|까)/g,
    ],
    extractSummary: (match, context) => {
      const sentence = extractSentenceContaining(context, match[0]);
      return sentence || `선물 관련 대화`;
    },
    extractDetails: (match) => ({
      giftMentioned: match[0],
    }),
    emotionalWeight: 6,
  },

  // 취향/선호도
  {
    type: 'user_preference',
    patterns: [
      /좋아하(는|는\s*거|는\s*게)/g,
      /싫어하(는|는\s*거|는\s*게)/g,
      /취향(이|은|이야)/g,
      /제일\s*좋아/g,
      /최애/g,
    ],
    extractSummary: (match, context) => {
      const sentence = extractSentenceContaining(context, match[0]);
      return sentence || `취향 공유`;
    },
    extractDetails: (match, context) => ({
      preferenceType: 'general',
      context: extractSentenceContaining(context, match[0]),
    }),
    emotionalWeight: 3,
  },

  // 장소 기억
  {
    type: 'location_memory',
    patterns: [
      /가봤(어|던|는데)/g,
      /같이\s*갔(던|었던|어)/g,
      /여기\s*(좋다|좋아|괜찮다)/g,
      /우리\s*(자리|테이블|장소)/g,
    ],
    extractSummary: (match, context) => {
      const sentence = extractSentenceContaining(context, match[0]);
      return sentence || `함께 간 장소`;
    },
    extractDetails: (match) => ({
      locationType: 'visited',
    }),
    emotionalWeight: 4,
  },

  // 별명
  {
    type: 'nickname',
    patterns: [
      /불러(줘|줄게|도\s*돼)/g,
      /별명(이|은|으로)/g,
      /애칭/g,
    ],
    extractSummary: (match, context) => {
      const sentence = extractSentenceContaining(context, match[0]);
      return sentence || `별명 설정`;
    },
    extractDetails: (match) => ({
      nicknameContext: match[0],
    }),
    emotionalWeight: 5,
  },

  // 둘만의 농담
  {
    type: 'inside_joke',
    patterns: [
      /ㅋㅋㅋ+/g,
      /ㅎㅎㅎ+/g,
      /웃겨|웃기다/g,
      /농담(이야|이지|인데)/g,
    ],
    extractSummary: (match, context) => {
      const sentence = extractSentenceContaining(context, match[0]);
      return sentence || `함께 웃은 순간`;
    },
    extractDetails: () => ({
      jokeType: 'shared_humor',
    }),
    minAffection: 20,
    emotionalWeight: 5,
  },

  // 중요한 날짜
  {
    type: 'important_date',
    patterns: [
      /생일(이야|인데|축하|에)/g,
      /기념일/g,
      /\d+월\s*\d+일/g,
      /오늘\s*(.+?)(날|데이)/g,
    ],
    extractSummary: (match, context) => {
      const sentence = extractSentenceContaining(context, match[0]);
      return sentence || `중요한 날짜 언급`;
    },
    extractDetails: (match) => ({
      dateType: 'mentioned',
      dateContext: match[0],
    }),
    emotionalWeight: 7,
  },
];

// ============================================
// 유틸리티 함수
// ============================================

/**
 * 특정 텍스트를 포함하는 문장 추출
 */
function extractSentenceContaining(text: string, target: string): string | null {
  const sentences = text.split(/[.!?。！？\n]/);
  for (const sentence of sentences) {
    if (sentence.includes(target)) {
      return sentence.trim();
    }
  }
  return null;
}

/**
 * 대화 맥락 결합
 */
function combineContext(userMessage: string, personaResponse: string): string {
  return `User: ${userMessage}\nPersona: ${personaResponse}`;
}

// ============================================
// Memory Extractor 클래스
// ============================================

export interface ExtractedMemory {
  type: MemoryType;
  summary: string;
  details: Record<string, unknown>;
  emotionalWeight: number;
  source: 'user' | 'persona' | 'both';
}

export interface ExtractionResult {
  memories: ExtractedMemory[];
  shouldSave: boolean;
}

export class MemoryExtractor {
  private recentExtractions: Map<string, Set<string>> = new Map();
  private extractionCooldown = 5 * 60 * 1000; // 5분 쿨다운

  /**
   * 대화에서 기억 추출
   */
  extractMemories(
    userMessage: string,
    personaResponse: string,
    currentAffection: number
  ): ExtractionResult {
    const memories: ExtractedMemory[] = [];
    const context = combineContext(userMessage, personaResponse);

    for (const pattern of MEMORY_PATTERNS) {
      // 호감도 조건 확인
      if (pattern.minAffection && currentAffection < pattern.minAffection) {
        continue;
      }

      for (const regex of pattern.patterns) {
        // 유저 메시지에서 검색
        const userMatches = userMessage.matchAll(new RegExp(regex.source, regex.flags));
        for (const match of userMatches) {
          const memory = this.createMemory(pattern, match, context, 'user');
          if (memory) memories.push(memory);
        }

        // 페르소나 응답에서 검색
        const personaMatches = personaResponse.matchAll(new RegExp(regex.source, regex.flags));
        for (const match of personaMatches) {
          const memory = this.createMemory(pattern, match, context, 'persona');
          if (memory) memories.push(memory);
        }
      }
    }

    // 중복 제거
    const uniqueMemories = this.deduplicateMemories(memories);

    return {
      memories: uniqueMemories,
      shouldSave: uniqueMemories.length > 0,
    };
  }

  /**
   * 기억 객체 생성
   */
  private createMemory(
    pattern: MemoryPattern,
    match: RegExpMatchArray,
    context: string,
    source: 'user' | 'persona'
  ): ExtractedMemory | null {
    const summary = pattern.extractSummary(match, context);
    if (!summary || summary.length < 5) return null;

    const details = pattern.extractDetails
      ? pattern.extractDetails(match, context)
      : {};

    return {
      type: pattern.type,
      summary,
      details: {
        ...details,
        matchedText: match[0],
        extractedAt: new Date().toISOString(),
      },
      emotionalWeight: pattern.emotionalWeight || 5,
      source,
    };
  }

  /**
   * 중복 기억 제거
   */
  private deduplicateMemories(memories: ExtractedMemory[]): ExtractedMemory[] {
    const seen = new Map<string, ExtractedMemory>();

    for (const memory of memories) {
      const key = `${memory.type}:${memory.summary.substring(0, 30)}`;
      const existing = seen.get(key);

      if (!existing || memory.emotionalWeight > existing.emotionalWeight) {
        seen.set(key, memory);
      }
    }

    return Array.from(seen.values());
  }

  /**
   * 추출된 기억을 저장
   */
  async saveExtractedMemories(
    userId: string,
    personaId: string,
    memories: ExtractedMemory[],
    sessionId?: string
  ): Promise<number> {
    const manager = getRelationshipManager();
    let savedCount = 0;

    // 쿨다운 체크용 키
    const cooldownKey = `${userId}:${personaId}`;
    const recentTypes = this.recentExtractions.get(cooldownKey) || new Set();
    const now = Date.now();

    for (const memory of memories) {
      // 같은 타입이 최근에 저장되었는지 확인
      if (recentTypes.has(memory.type)) {
        continue;
      }

      const input: SaveMemoryInput = {
        type: memory.type,
        summary: memory.summary,
        details: memory.details,
        emotionalWeight: memory.emotionalWeight,
        sourceType: 'dm',
        sourceId: sessionId,
      };

      try {
        const saved = await manager.saveMemory(userId, personaId, input);
        if (saved) {
          savedCount++;
          recentTypes.add(memory.type);
        }
      } catch (error) {
        console.error('[MemoryExtractor] Save failed:', error);
      }
    }

    // 쿨다운 타이머 설정
    this.recentExtractions.set(cooldownKey, recentTypes);
    setTimeout(() => {
      this.recentExtractions.delete(cooldownKey);
    }, this.extractionCooldown);

    return savedCount;
  }
}

// ============================================
// 싱글톤 인스턴스
// ============================================

let memoryExtractorInstance: MemoryExtractor | null = null;

export function getMemoryExtractor(): MemoryExtractor {
  if (!memoryExtractorInstance) {
    memoryExtractorInstance = new MemoryExtractor();
  }
  return memoryExtractorInstance;
}
