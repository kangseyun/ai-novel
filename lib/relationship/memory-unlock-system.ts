/**
 * Memory Unlock System
 * 기억 해금 조건 검증 및 해금 처리
 *
 * 역할:
 * 1. 기억 타입별 해금 조건 정의
 * 2. 조건 충족 여부 검증
 * 3. 자동 해금 트리거
 * 4. 해금 진행도 계산
 */

import { MemoryType, RelationshipStage, Memory } from './types';
import { getRelationshipManager } from './relationship-manager';
import type { PersonaMemoryType } from '../../types/persona-engine';
import { createServerClient } from '../supabase-server';

// ============================================
// 해금 조건 타입 정의
// ============================================

export interface UnlockCondition {
  type: 'stage' | 'affection' | 'intimacy' | 'trust' | 'messages' | 'scenario' | 'time' | 'flag';
  operator: '>=' | '<=' | '>' | '<' | '==';
  value: number | string | boolean;
}

export interface MemoryUnlockRule {
  memoryType: MemoryType;
  displayName: string;
  description: string;
  conditions: UnlockCondition[];
  requireAll: boolean; // true: AND, false: OR
  priority: number;
  hint: string; // 잠금 상태에서 보여줄 힌트
}

export interface UnlockProgress {
  memoryType: MemoryType;
  displayName: string;
  isUnlocked: boolean;
  progress: number; // 0-100
  hint: string;
  conditions: {
    description: string;
    met: boolean;
    progress?: number;
  }[];
}

// ============================================
// 해금 규칙 정의
// ============================================

export const MEMORY_UNLOCK_RULES: MemoryUnlockRule[] = [
  {
    memoryType: 'first_meeting',
    displayName: '첫 만남',
    description: '처음 대화를 시작하면 자동으로 기록됩니다',
    conditions: [
      { type: 'messages', operator: '>=', value: 1 },
    ],
    requireAll: true,
    priority: 1,
    hint: '첫 대화를 시작해보세요',
  },
  {
    memoryType: 'promise',
    displayName: '약속',
    description: '친구 이상의 관계에서 약속을 나눌 수 있습니다',
    conditions: [
      { type: 'stage', operator: '>=', value: 'friend' },
    ],
    requireAll: true,
    priority: 2,
    hint: '더 친해지면 약속을 나눌 수 있어요',
  },
  {
    memoryType: 'secret_shared',
    displayName: '비밀',
    description: '친밀도가 높아지면 비밀을 공유할 수 있습니다',
    conditions: [
      { type: 'intimacy', operator: '>=', value: 50 },
    ],
    requireAll: true,
    priority: 3,
    hint: '친밀도 50 이상 필요',
  },
  {
    memoryType: 'conflict',
    displayName: '갈등',
    description: '관계에서 갈등이 발생할 수 있습니다',
    conditions: [
      { type: 'affection', operator: '>=', value: 20 },
    ],
    requireAll: true,
    priority: 4,
    hint: '관계가 깊어지면 갈등도 생겨요',
  },
  {
    memoryType: 'reconciliation',
    displayName: '화해',
    description: '갈등 후 화해하면 기록됩니다',
    conditions: [
      { type: 'flag', operator: '==', value: 'had_conflict' },
      { type: 'affection', operator: '>=', value: 30 },
    ],
    requireAll: true,
    priority: 5,
    hint: '갈등 후 화해가 필요해요',
  },
  {
    memoryType: 'intimate_moment',
    displayName: '특별한 순간',
    description: '특별한 사이가 되면 더 깊은 순간을 공유합니다',
    conditions: [
      { type: 'stage', operator: '>=', value: 'intimate' },
    ],
    requireAll: true,
    priority: 6,
    hint: '특별한 사이가 되면 해금됩니다',
  },
  {
    memoryType: 'gift_received',
    displayName: '선물',
    description: '선물을 주고받으면 기록됩니다',
    conditions: [
      { type: 'stage', operator: '>=', value: 'acquaintance' },
    ],
    requireAll: true,
    priority: 7,
    hint: '아는 사이가 되면 해금됩니다',
  },
  {
    memoryType: 'milestone',
    displayName: '기념일',
    description: '시나리오를 완료하거나 특별한 이벤트를 경험하세요',
    conditions: [
      { type: 'scenario', operator: '>=', value: 1 },
    ],
    requireAll: true,
    priority: 8,
    hint: '시나리오를 완료해보세요',
  },
  {
    memoryType: 'user_preference',
    displayName: '취향',
    description: '대화 중 취향을 공유하면 기록됩니다',
    conditions: [
      { type: 'messages', operator: '>=', value: 10 },
    ],
    requireAll: true,
    priority: 9,
    hint: '대화를 더 나눠보세요',
  },
  {
    memoryType: 'emotional_event',
    displayName: '감정적 사건',
    description: '감정적인 대화를 나누면 기록됩니다',
    conditions: [
      { type: 'affection', operator: '>=', value: 20 },
    ],
    requireAll: true,
    priority: 10,
    hint: '호감도 20 이상 필요',
  },
  {
    memoryType: 'location_memory',
    displayName: '함께 간 곳',
    description: '시나리오에서 함께 장소를 방문하면 기록됩니다',
    conditions: [
      { type: 'stage', operator: '>=', value: 'acquaintance' },
    ],
    requireAll: true,
    priority: 11,
    hint: '함께 이야기를 진행해보세요',
  },
  {
    memoryType: 'nickname',
    displayName: '별명',
    description: '친구 이상이 되면 별명을 설정할 수 있습니다',
    conditions: [
      { type: 'stage', operator: '>=', value: 'friend' },
    ],
    requireAll: true,
    priority: 12,
    hint: '친구가 되면 별명을 지을 수 있어요',
  },
  {
    memoryType: 'inside_joke',
    displayName: '둘만의 농담',
    description: '함께 웃은 순간이 반복되면 기록됩니다',
    conditions: [
      { type: 'affection', operator: '>=', value: 40 },
    ],
    requireAll: true,
    priority: 13,
    hint: '호감도 40 이상 필요',
  },
  {
    memoryType: 'important_date',
    displayName: '중요한 날',
    description: '특별한 날을 함께 기념하면 기록됩니다',
    conditions: [
      { type: 'stage', operator: '>=', value: 'acquaintance' },
    ],
    requireAll: true,
    priority: 14,
    hint: '특별한 날을 함께 보내보세요',
  },
];

// ============================================
// 관계 단계 순서
// ============================================

const STAGE_ORDER: Record<RelationshipStage, number> = {
  stranger: 0,
  acquaintance: 1,
  friend: 2,
  close: 3,
  intimate: 4,
  lover: 5,
};

// ============================================
// Memory Unlock System 클래스
// ============================================

export class MemoryUnlockSystem {
  /**
   * 특정 기억 타입이 해금 가능한지 확인
   */
  checkUnlockConditions(
    memoryType: MemoryType,
    context: {
      stage: RelationshipStage;
      affection: number;
      intimacy: number;
      trust: number;
      totalMessages: number;
      completedScenarios: number;
      storyFlags: Record<string, boolean>;
    }
  ): { canUnlock: boolean; progress: number; unmetConditions: string[] } {
    const rule = MEMORY_UNLOCK_RULES.find(r => r.memoryType === memoryType);
    if (!rule) {
      return { canUnlock: true, progress: 100, unmetConditions: [] };
    }

    const results = rule.conditions.map(condition =>
      this.evaluateCondition(condition, context)
    );

    const metCount = results.filter(r => r.met).length;
    const totalCount = results.length;

    const canUnlock = rule.requireAll
      ? results.every(r => r.met)
      : results.some(r => r.met);

    const progress = rule.requireAll
      ? results.reduce((sum, r) => sum + r.progress, 0) / totalCount
      : Math.max(...results.map(r => r.progress));

    const unmetConditions = results
      .filter(r => !r.met)
      .map(r => r.description);

    return { canUnlock, progress, unmetConditions };
  }

  /**
   * 단일 조건 평가
   */
  private evaluateCondition(
    condition: UnlockCondition,
    context: {
      stage: RelationshipStage;
      affection: number;
      intimacy: number;
      trust: number;
      totalMessages: number;
      completedScenarios: number;
      storyFlags: Record<string, boolean>;
    }
  ): { met: boolean; progress: number; description: string } {
    let currentValue: number | string | boolean;
    let targetValue = condition.value;
    let description = '';

    switch (condition.type) {
      case 'stage':
        currentValue = STAGE_ORDER[context.stage];
        targetValue = STAGE_ORDER[condition.value as RelationshipStage] ?? 0;
        description = `관계 단계: ${condition.value}`;
        break;

      case 'affection':
        currentValue = context.affection;
        description = `호감도: ${condition.value}`;
        break;

      case 'intimacy':
        currentValue = context.intimacy;
        description = `친밀도: ${condition.value}`;
        break;

      case 'trust':
        currentValue = context.trust;
        description = `신뢰도: ${condition.value}`;
        break;

      case 'messages':
        currentValue = context.totalMessages;
        description = `대화 수: ${condition.value}`;
        break;

      case 'scenario':
        currentValue = context.completedScenarios;
        description = `완료 시나리오: ${condition.value}`;
        break;

      case 'flag':
        currentValue = context.storyFlags[condition.value as string] ?? false;
        targetValue = true;
        description = `조건: ${condition.value}`;
        break;

      default:
        return { met: true, progress: 100, description: '' };
    }

    const met = this.compare(currentValue, condition.operator, targetValue);

    // 진행도 계산
    let progress = 0;
    if (typeof currentValue === 'number' && typeof targetValue === 'number') {
      progress = Math.min(100, (currentValue / targetValue) * 100);
    } else if (typeof currentValue === 'boolean') {
      progress = currentValue ? 100 : 0;
    } else {
      progress = met ? 100 : 0;
    }

    return { met, progress, description };
  }

  /**
   * 비교 연산
   */
  private compare(
    current: number | string | boolean,
    operator: string,
    target: number | string | boolean
  ): boolean {
    if (typeof current === 'number' && typeof target === 'number') {
      switch (operator) {
        case '>=': return current >= target;
        case '<=': return current <= target;
        case '>': return current > target;
        case '<': return current < target;
        case '==': return current === target;
        default: return false;
      }
    }
    return current === target;
  }

  /**
   * 모든 기억 타입의 해금 상태 조회
   */
  async getUnlockStatus(
    userId: string,
    personaId: string
  ): Promise<UnlockProgress[]> {
    const manager = getRelationshipManager();

    const [relationship, memories, scenarios] = await Promise.all([
      manager.getRelationship(userId, personaId),
      manager.getMemories(userId, personaId),
      this.getCompletedScenarioCount(userId, personaId),
    ]);

    if (!relationship) {
      return MEMORY_UNLOCK_RULES.map(rule => ({
        memoryType: rule.memoryType,
        displayName: rule.displayName,
        isUnlocked: false,
        progress: 0,
        hint: rule.hint,
        conditions: [],
      }));
    }

    const unlockedTypes = new Set(memories.map(m => m.type));

    const context = {
      stage: relationship.stage,
      affection: relationship.affection,
      intimacy: relationship.intimacyLevel,
      trust: relationship.trustLevel,
      totalMessages: relationship.totalMessages,
      completedScenarios: scenarios,
      storyFlags: relationship.storyFlags,
    };

    return MEMORY_UNLOCK_RULES.map(rule => {
      const hasMemory = unlockedTypes.has(rule.memoryType);
      const { canUnlock, progress, unmetConditions } = this.checkUnlockConditions(
        rule.memoryType,
        context
      );

      return {
        memoryType: rule.memoryType,
        displayName: rule.displayName,
        isUnlocked: hasMemory,
        progress: hasMemory ? 100 : progress,
        hint: hasMemory ? '' : rule.hint,
        conditions: rule.conditions.map((cond, i) => ({
          description: this.getConditionDescription(cond),
          met: hasMemory || !unmetConditions.includes(this.getConditionDescription(cond)),
          progress: hasMemory ? 100 : undefined,
        })),
      };
    }).sort((a, b) => {
      // 해금된 것 먼저, 그 다음 진행도 순
      if (a.isUnlocked !== b.isUnlocked) {
        return a.isUnlocked ? -1 : 1;
      }
      return b.progress - a.progress;
    });
  }

  /**
   * 조건 설명 텍스트 생성
   */
  private getConditionDescription(condition: UnlockCondition): string {
    const operatorText: Record<string, string> = {
      '>=': '이상',
      '<=': '이하',
      '>': '초과',
      '<': '미만',
      '==': '',
    };

    switch (condition.type) {
      case 'stage':
        return `관계 단계 ${condition.value} ${operatorText[condition.operator]}`;
      case 'affection':
        return `호감도 ${condition.value} ${operatorText[condition.operator]}`;
      case 'intimacy':
        return `친밀도 ${condition.value} ${operatorText[condition.operator]}`;
      case 'trust':
        return `신뢰도 ${condition.value} ${operatorText[condition.operator]}`;
      case 'messages':
        return `대화 ${condition.value}회 ${operatorText[condition.operator]}`;
      case 'scenario':
        return `시나리오 ${condition.value}개 완료`;
      case 'flag':
        return `특수 조건: ${condition.value}`;
      default:
        return '';
    }
  }

  /**
   * 완료 시나리오 수 조회
   */
  private async getCompletedScenarioCount(
    userId: string,
    personaId: string
  ): Promise<number> {
    const manager = getRelationshipManager();
    const progress = await manager.getProgress(userId, personaId);
    return progress.storyProgress;
  }

  /**
   * 해금 가능한 기억 목록 (힌트용)
   */
  getUnlockableMemories(
    context: {
      stage: RelationshipStage;
      affection: number;
      intimacy: number;
      trust: number;
      totalMessages: number;
      completedScenarios: number;
      storyFlags: Record<string, boolean>;
    },
    unlockedTypes: Set<MemoryType>
  ): { type: MemoryType; hint: string; progress: number }[] {
    return MEMORY_UNLOCK_RULES
      .filter(rule => !unlockedTypes.has(rule.memoryType))
      .map(rule => {
        const { progress } = this.checkUnlockConditions(rule.memoryType, context);
        return {
          type: rule.memoryType,
          hint: rule.hint,
          progress,
        };
      })
      .filter(item => item.progress >= 50) // 50% 이상 진행된 것만
      .sort((a, b) => b.progress - a.progress)
      .slice(0, 3);
  }
}

// ============================================
// 페르소나별 기억 타입 해금 상태 조회
// ============================================

export interface PersonaUnlockProgress {
  memoryType: string;
  displayName: string;
  description: string;
  emoji: string;
  isUnlocked: boolean;
  progress: number;
  hint: string;
}

/**
 * DB에서 페르소나 기억 타입 가져오기
 */
export async function getPersonaMemoryTypes(personaId: string): Promise<PersonaMemoryType[]> {
  try {
    const supabase = await createServerClient();

    const { data, error } = await supabase
      .from('persona_memory_types')
      .select('type_id, title, description, emoji, min_affection, min_stage, required_flag, display_order')
      .eq('persona_id', personaId.toLowerCase())
      .order('display_order', { ascending: true });

    if (error) {
      console.error('[PersonaMemoryTypes] Error:', error);
      return [];
    }

    if (!data || data.length === 0) {
      return [];
    }

    return data.map(row => ({
      id: row.type_id,
      title: row.title,
      description: row.description || '',
      emoji: row.emoji || '📝',
      unlockCondition: (row.min_affection || row.min_stage || row.required_flag) ? {
        minAffection: row.min_affection || undefined,
        minStage: row.min_stage || undefined,
        requiredFlag: row.required_flag || undefined,
      } : undefined,
    }));
  } catch (error) {
    console.error('[PersonaMemoryTypes] Error:', error);
    return [];
  }
}

/**
 * 페르소나별 기억 해금 상태 조회
 */
export async function getPersonaUnlockStatus(
  userId: string,
  personaId: string
): Promise<PersonaUnlockProgress[]> {
  const personaMemoryTypes = await getPersonaMemoryTypes(personaId);

  // 페르소나별 기억 타입이 없으면 기본 규칙 사용
  if (personaMemoryTypes.length === 0) {
    const unlockSystem = getMemoryUnlockSystem();
    const defaultStatus = await unlockSystem.getUnlockStatus(userId, personaId);
    return defaultStatus.map(s => ({
      memoryType: s.memoryType,
      displayName: s.displayName,
      description: '',
      emoji: '📝',
      isUnlocked: s.isUnlocked,
      progress: s.progress,
      hint: s.hint,
    }));
  }

  const manager = getRelationshipManager();
  const [relationship, memories] = await Promise.all([
    manager.getRelationship(userId, personaId),
    manager.getMemories(userId, personaId),
  ]);

  const unlockedTypes = new Set<string>(memories.map(m => m.type));

  const stageOrder: Record<string, number> = {
    stranger: 0,
    acquaintance: 1,
    friend: 2,
    close: 3,
    intimate: 4,
    lover: 5,
  };

  return personaMemoryTypes.map(memType => {
    const isUnlocked = unlockedTypes.has(memType.id);

    if (isUnlocked) {
      return {
        memoryType: memType.id,
        displayName: memType.title,
        description: memType.description,
        emoji: memType.emoji,
        isUnlocked: true,
        progress: 100,
        hint: '',
      };
    }

    // 조건이 없으면 대화만 하면 해금 가능
    if (!memType.unlockCondition) {
      return {
        memoryType: memType.id,
        displayName: memType.title,
        description: memType.description,
        emoji: memType.emoji,
        isUnlocked: false,
        progress: 50,
        hint: '대화를 더 나누면 기록됩니다',
      };
    }

    const cond = memType.unlockCondition;
    let progress = 0;
    const hints: string[] = [];

    // 호감도 조건 체크
    if (cond.minAffection) {
      const currentAffection = relationship?.affection || 0;
      const affectionProgress = Math.min(100, (currentAffection / cond.minAffection) * 100);
      progress = Math.max(progress, affectionProgress);
      if (currentAffection < cond.minAffection) {
        hints.push(`호감도 ${cond.minAffection} 필요 (현재: ${currentAffection})`);
      }
    }

    // 단계 조건 체크
    if (cond.minStage) {
      const currentStageIdx = stageOrder[relationship?.stage || 'stranger'] || 0;
      const requiredStageIdx = stageOrder[cond.minStage] || 0;
      const stageProgress = Math.min(100, (currentStageIdx / requiredStageIdx) * 100);
      progress = Math.max(progress, stageProgress);
      if (currentStageIdx < requiredStageIdx) {
        const stageLabels: Record<string, string> = {
          stranger: '처음',
          acquaintance: '아는 사이',
          friend: '친구',
          close: '가까운 사이',
          intimate: '특별한 사이',
          lover: '연인',
        };
        hints.push(`${stageLabels[cond.minStage] || cond.minStage} 단계 필요`);
      }
    }

    // 플래그 조건 체크
    if (cond.requiredFlag) {
      const hasFlag = relationship?.storyFlags?.[cond.requiredFlag] ?? false;
      if (!hasFlag) {
        hints.push('특별한 이벤트 필요');
      } else {
        progress = Math.max(progress, 100);
      }
    }

    return {
      memoryType: memType.id,
      displayName: memType.title,
      description: memType.description,
      emoji: memType.emoji,
      isUnlocked: false,
      progress: Math.round(progress),
      hint: hints.length > 0 ? hints.join(', ') : '더 친해지면 해금됩니다',
    };
  }).sort((a, b) => {
    // 해금된 것 먼저, 그 다음 진행도 순
    if (a.isUnlocked !== b.isUnlocked) {
      return a.isUnlocked ? -1 : 1;
    }
    return b.progress - a.progress;
  });
}

// ============================================
// 싱글톤 인스턴스
// ============================================

let memoryUnlockSystemInstance: MemoryUnlockSystem | null = null;

export function getMemoryUnlockSystem(): MemoryUnlockSystem {
  if (!memoryUnlockSystemInstance) {
    memoryUnlockSystemInstance = new MemoryUnlockSystem();
  }
  return memoryUnlockSystemInstance;
}
