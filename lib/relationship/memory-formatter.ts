/**
 * Memory Formatter
 * UI 표시용 데이터 포맷팅
 */

import {
  MemoryType,
  RelationshipStage,
  SummaryType,
  Memory,
  LockedMemory,
  FormattedMemory,
  FormattedSummary,
  ConversationSummary,
  DEFAULT_DISPLAYABLE_MEMORY_TYPES,
} from './types';
import type { PersonaMemoryType } from '../../types/persona-engine';

// ============================================
// 라벨 변환
// ============================================

/**
 * 기억 타입 → 한글 제목
 */
export function getMemoryTitle(type: MemoryType | string): string {
  const titles: Record<string, string> = {
    first_meeting: '첫 만남',
    promise: '약속',
    secret_shared: '비밀',
    conflict: '갈등',
    reconciliation: '화해',
    intimate_moment: '특별한 순간',
    gift_received: '선물',
    milestone: '기념일',
    user_preference: '취향',
    emotional_event: '감정적 사건',
    location_memory: '함께 간 곳',
    nickname: '별명',
    inside_joke: '둘만의 농담',
    important_date: '중요한 날',
  };
  return titles[type] || type;
}

/**
 * 관계 단계 → 한글 라벨
 */
export function getRelationshipLabel(stage: RelationshipStage | string): string {
  const labels: Record<string, string> = {
    stranger: '처음',
    fan: '팬',
    friend: '친구',
    close: '가까운 사이',
    heart: '진심',
  };
  return labels[stage] || stage;
}

/**
 * 관계 단계 → 영문 라벨
 */
export function getRelationshipLabelEn(stage: RelationshipStage | string): string {
  const labels: Record<string, string> = {
    stranger: 'Stranger',
    fan: 'Fan',
    friend: 'Friend',
    close: 'Close',
    heart: 'Heart',
  };
  return labels[stage] || stage;
}

/**
 * 요약 타입 → 한글 라벨
 */
export function getSummaryTypeLabel(type: string): string {
  const labels: Record<string, string> = {
    session: '대화 요약',
    daily: '오늘의 대화',
    weekly: '이번 주 요약',
    relationship_arc: '관계 발전',
  };
  return labels[type] || type;
}

// ============================================
// 해금 조건
// ============================================

/**
 * 기억 타입별 해금 조건 텍스트
 */
export function getUnlockCondition(
  type: MemoryType | string,
  currentStage?: RelationshipStage
): string {
  const conditions: Record<string, string> = {
    first_meeting: '첫 만남 시나리오 완료',
    promise: '친구 단계 이상',
    secret_shared: '친밀도 50 이상',
    conflict: '갈등 이벤트 발생',
    reconciliation: '갈등 해결',
    intimate_moment: '가까운 사이 이상',
    gift_received: '선물 주고받기',
    milestone: '관계 진전',
    user_preference: '대화 중 취향 공유',
    emotional_event: '감정적 대화',
    location_memory: '함께 장소 방문',
    nickname: '별명 설정',
    inside_joke: '반복되는 농담',
    important_date: '기념일 설정',
  };
  return conditions[type] || '더 알아가면 기록됩니다';
}

/**
 * 기억 타입이 현재 단계에서 해금 가능한지 확인
 */
export function canUnlockMemoryType(
  type: MemoryType,
  stage: RelationshipStage,
  affection: number,
  intimacy: number
): boolean {
  const requirements: Record<MemoryType, () => boolean> = {
    first_meeting: () => true,
    promise: () => stage !== 'stranger' && stage !== 'fan',
    secret_shared: () => intimacy >= 50,
    conflict: () => affection >= 20,
    reconciliation: () => affection >= 30,
    intimate_moment: () => stage === 'close' || stage === 'heart',
    gift_received: () => stage !== 'stranger',
    milestone: () => true,
    user_preference: () => true,
    emotional_event: () => affection >= 20,
    location_memory: () => stage !== 'stranger',
    nickname: () => stage !== 'stranger' && stage !== 'fan',
    inside_joke: () => affection >= 40,
    important_date: () => stage !== 'stranger',
  };

  return requirements[type]?.() ?? true;
}

// ============================================
// 데이터 포맷팅
// ============================================

/**
 * DB 기억 → UI용 포맷
 */
export function formatMemory(memory: Memory | Record<string, unknown>): FormattedMemory {
  const mem = memory as Record<string, unknown>;
  return {
    id: mem.id as string,
    type: mem.type as MemoryType || mem.memory_type as MemoryType,
    title: getMemoryTitle((mem.type || mem.memory_type) as string),
    content: mem.summary as string || mem.content as string || '',
    details: mem.details as Record<string, unknown> || {},
    emotionalWeight: mem.emotionalWeight as number || mem.emotional_weight as number || 5,
    createdAt: mem.createdAt as string || mem.created_at as string || new Date().toISOString(),
    isLocked: false,
  };
}

/**
 * 잠긴 기억 생성
 */
export function createLockedMemory(
  type: MemoryType,
  currentStage?: RelationshipStage
): LockedMemory {
  return {
    id: `locked_${type}`,
    type,
    title: getMemoryTitle(type),
    unlockCondition: getUnlockCondition(type, currentStage),
    isLocked: true,
  };
}

/**
 * 해금되지 않은 기억 타입 목록 생성 (기본 타입 사용)
 * @deprecated - Use getLockedMemoriesForPersona for persona-specific types
 */
export function getLockedMemories(
  unlockedTypes: Set<MemoryType | string>,
  currentStage?: RelationshipStage
): LockedMemory[] {
  return DEFAULT_DISPLAYABLE_MEMORY_TYPES
    .filter(type => !unlockedTypes.has(type))
    .map(type => createLockedMemory(type, currentStage));
}

/**
 * 페르소나별 잠긴 기억 목록 생성
 */
export function getLockedMemoriesForPersona(
  unlockedTypes: Set<MemoryType | string>,
  personaMemoryTypes: PersonaMemoryType[],
  currentStage?: RelationshipStage,
  currentAffection?: number
): LockedMemory[] {
  return personaMemoryTypes
    .filter(memType => !unlockedTypes.has(memType.id))
    .map(memType => ({
      id: `locked_${memType.id}`,
      type: memType.id as MemoryType,
      title: memType.title,
      unlockCondition: getPersonaMemoryUnlockCondition(memType, currentStage, currentAffection),
      isLocked: true as const,
    }));
}

/**
 * 페르소나 기억 타입의 해금 조건 텍스트 생성
 */
function getPersonaMemoryUnlockCondition(
  memType: PersonaMemoryType,
  currentStage?: RelationshipStage,
  currentAffection?: number
): string {
  if (!memType.unlockCondition) {
    return '대화를 더 나누면 기록됩니다';
  }

  const conditions: string[] = [];
  const cond = memType.unlockCondition;

  if (cond.minAffection) {
    const affectionLabel = currentAffection !== undefined
      ? `호감도 ${cond.minAffection} 필요 (현재: ${currentAffection})`
      : `호감도 ${cond.minAffection} 이상`;
    conditions.push(affectionLabel);
  }

  if (cond.minStage) {
    const stageLabel = getRelationshipLabel(cond.minStage);
    conditions.push(`${stageLabel} 단계 이상`);
  }

  if (cond.requiredFlag) {
    conditions.push('특별한 이벤트 필요');
  }

  return conditions.length > 0 ? conditions.join(', ') : '더 알아가면 기록됩니다';
}

/**
 * 페르소나 기억 타입에서 제목 가져오기
 */
export function getPersonaMemoryTitle(
  typeId: string,
  personaMemoryTypes?: PersonaMemoryType[]
): string {
  if (personaMemoryTypes) {
    const found = personaMemoryTypes.find(t => t.id === typeId);
    if (found) return found.title;
  }
  return getMemoryTitle(typeId);
}

/**
 * 페르소나 기억 타입에서 이모지 가져오기
 */
export function getPersonaMemoryEmoji(
  typeId: string,
  personaMemoryTypes?: PersonaMemoryType[]
): string {
  if (personaMemoryTypes) {
    const found = personaMemoryTypes.find(t => t.id === typeId);
    if (found) return found.emoji;
  }
  return getMemoryEmoji(typeId);
}

/**
 * DB 요약 → UI용 포맷
 */
export function formatSummary(summary: ConversationSummary | Record<string, unknown>): FormattedSummary {
  const sum = summary as Record<string, unknown>;
  return {
    id: sum.id as string,
    type: (sum.type || sum.summary_type || 'session') as SummaryType,
    summary: sum.summary as string || '',
    topics: sum.topics as string[] || [],
    emotionalArc: sum.emotionalArc as Record<string, unknown> || sum.emotional_arc as Record<string, unknown> || {},
    periodStart: sum.periodStart as string || sum.period_start as string || '',
    periodEnd: sum.periodEnd as string || sum.period_end as string || '',
  };
}

// ============================================
// 아이콘/이모지 매핑
// ============================================

/**
 * 기억 타입 → 이모지
 */
export function getMemoryEmoji(type: MemoryType | string): string {
  const emojis: Record<string, string> = {
    first_meeting: '👋',
    promise: '🤝',
    secret_shared: '🤫',
    conflict: '⚡',
    reconciliation: '🤗',
    intimate_moment: '💕',
    gift_received: '🎁',
    milestone: '🎉',
    user_preference: '💭',
    emotional_event: '💗',
    location_memory: '📍',
    nickname: '💬',
    inside_joke: '😂',
    important_date: '📅',
  };
  return emojis[type] || '📝';
}

/**
 * 관계 단계 → 이모지
 */
export function getStageEmoji(stage: RelationshipStage | string): string {
  const emojis: Record<string, string> = {
    stranger: '👤',
    fan: '🙂',
    friend: '😊',
    close: '🥰',
    heart: '💕',
  };
  return emojis[stage] || '👤';
}

// ============================================
// 날짜 포맷팅
// ============================================

/**
 * 상대적 시간 표시
 */
export function formatRelativeTime(dateString: string | null): string {
  if (!dateString) return '없음';

  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffMins < 1) return '방금 전';
  if (diffMins < 60) return `${diffMins}분 전`;
  if (diffHours < 24) return `${diffHours}시간 전`;
  if (diffDays < 7) return `${diffDays}일 전`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)}주 전`;
  if (diffDays < 365) return `${Math.floor(diffDays / 30)}개월 전`;
  return `${Math.floor(diffDays / 365)}년 전`;
}

/**
 * 짧은 날짜 포맷
 */
export function formatShortDate(dateString: string | null): string {
  if (!dateString) return '';

  const date = new Date(dateString);
  const month = date.getMonth() + 1;
  const day = date.getDate();
  return `${month}/${day}`;
}

/**
 * 전체 날짜 포맷
 */
export function formatFullDate(dateString: string | null): string {
  if (!dateString) return '';

  const date = new Date(dateString);
  return date.toLocaleDateString('ko-KR', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}
