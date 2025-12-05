/**
 * Stats Calculator
 * 관계 스탯 계산 로직
 */

import {
  RelationshipStage,
  RelationshipStats,
  ProgressInfo,
  Memory,
  RELATIONSHIP_STAGES,
} from './types';

// ============================================
// 관계 단계 계산
// ============================================

/**
 * 호감도 기반 관계 단계 계산
 */
export function calculateRelationshipStage(affection: number): RelationshipStage {
  if (affection >= 90) return 'lover';
  if (affection >= 70) return 'intimate';
  if (affection >= 50) return 'close';
  if (affection >= 30) return 'friend';
  if (affection >= 10) return 'acquaintance';
  return 'stranger';
}

/**
 * 관계 단계 인덱스 (비교용)
 */
export function getStageIndex(stage: RelationshipStage): number {
  return RELATIONSHIP_STAGES.indexOf(stage);
}

/**
 * 다음 단계까지 필요한 호감도
 */
export function getAffectionForNextStage(currentStage: RelationshipStage): number | null {
  const thresholds: Record<RelationshipStage, number | null> = {
    stranger: 10,
    acquaintance: 30,
    friend: 50,
    close: 70,
    intimate: 90,
    lover: null, // 최고 단계
  };
  return thresholds[currentStage];
}

// ============================================
// 레이더 차트 스탯 계산
// ============================================

/**
 * 관계 스탯 계산 (레이더 차트용)
 */
export function calculateRelationshipStats(
  relationship: {
    affection: number;
    trustLevel: number;
    intimacyLevel: number;
    totalMessages: number;
  },
  memories: Memory[],
  completedScenarios: number
): RelationshipStats {
  return {
    trust: calculateTrust(relationship.trustLevel),
    intimacy: calculateIntimacy(relationship.intimacyLevel),
    mystery: calculateMystery(memories, completedScenarios),
    chemistry: calculateChemistry(relationship.affection, relationship.intimacyLevel),
    loyalty: calculateLoyalty(relationship.totalMessages, memories),
  };
}

/**
 * 신뢰도 계산
 */
function calculateTrust(trustLevel: number): number {
  return Math.min(100, Math.max(0, trustLevel));
}

/**
 * 친밀도 계산
 */
function calculateIntimacy(intimacyLevel: number): number {
  return Math.min(100, Math.max(0, intimacyLevel));
}

/**
 * 미스터리 계산
 * - 비밀이 해금될수록 감소
 * - 시나리오를 완료할수록 감소
 */
function calculateMystery(memories: Memory[], completedScenarios: number): number {
  const totalSecrets = 8; // 총 비밀 수 (설정값)

  const unlockedSecrets = memories.filter(m =>
    ['secret_shared', 'intimate_moment'].includes(m.type)
  ).length;

  const secretPenalty = (unlockedSecrets / totalSecrets) * 60;
  const scenarioPenalty = completedScenarios * 5;

  return Math.max(0, Math.round(100 - secretPenalty - scenarioPenalty));
}

/**
 * 케미 계산
 * - 호감도 + 친밀도 평균
 */
function calculateChemistry(affection: number, intimacy: number): number {
  return Math.min(100, Math.round((affection + intimacy) / 2));
}

/**
 * 충성도 계산
 * - 총 메시지 수 기반
 * - 약속/화해 기억 보너스
 */
function calculateLoyalty(totalMessages: number, memories: Memory[]): number {
  const messageScore = Math.min(50, totalMessages / 10); // 최대 50점

  const promiseCount = memories.filter(m => m.type === 'promise').length;
  const reconciliationCount = memories.filter(m => m.type === 'reconciliation').length;

  const promiseBonus = promiseCount * 10;
  const reconciliationBonus = reconciliationCount * 15;

  return Math.min(100, Math.round(messageScore + promiseBonus + reconciliationBonus));
}

// ============================================
// 진행도 계산
// ============================================

const TOTAL_STORIES = 12; // 총 스토리 수 (설정값)
const TOTAL_SECRETS = 8;  // 총 비밀 수 (설정값)

/**
 * 진행도 정보 계산
 */
export function calculateProgressInfo(
  completedScenarios: number,
  memories: Memory[]
): ProgressInfo {
  const unlockedSecrets = memories.filter(m =>
    ['secret_shared', 'intimate_moment', 'milestone'].includes(m.type)
  ).length;

  return {
    storyProgress: completedScenarios,
    totalStories: TOTAL_STORIES,
    currentArc: getArcLabel(completedScenarios),
    unlockedSecrets,
    totalSecrets: TOTAL_SECRETS,
  };
}

/**
 * 현재 챕터 라벨
 */
export function getArcLabel(completedScenarios: number): string {
  if (completedScenarios === 0) return 'Prologue: 시작';
  if (completedScenarios < 3) return 'Chapter 1: 첫 만남';
  if (completedScenarios < 6) return 'Chapter 2: 가까워지는 마음';
  if (completedScenarios < 9) return 'Chapter 3: 흔들리는 감정';
  return 'Chapter 4: 진심';
}

// ============================================
// 호감도 변화 계산
// ============================================

/**
 * 호감도 변화 적용 (범위 제한)
 */
export function applyAffectionChange(current: number, change: number): number {
  return Math.max(0, Math.min(100, current + change));
}

/**
 * 신뢰도 변화 적용
 */
export function applyTrustChange(current: number, change: number): number {
  return Math.max(0, Math.min(100, current + change));
}

/**
 * 친밀도 변화 적용
 */
export function applyIntimacyChange(current: number, change: number): number {
  return Math.max(0, Math.min(100, current + change));
}

// ============================================
// 기억 중요도 계산
// ============================================

/**
 * 기억 타입별 기본 중요도
 */
export function getDefaultEmotionalWeight(memoryType: string): number {
  const weights: Record<string, number> = {
    first_meeting: 10,
    secret_shared: 9,
    intimate_moment: 9,
    conflict: 8,
    reconciliation: 8,
    milestone: 8,
    promise: 7,
    gift_received: 6,
    emotional_event: 6,
    nickname: 5,
    inside_joke: 5,
    location_memory: 4,
    user_preference: 3,
    important_date: 7,
  };
  return weights[memoryType] || 5;
}

/**
 * 기억이 비밀로 분류되는지 확인
 */
export function isSecretMemory(memoryType: string): boolean {
  return ['secret_shared', 'intimate_moment', 'milestone'].includes(memoryType);
}
