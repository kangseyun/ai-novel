/**
 * Event Trigger Engine
 * 이벤트 발생 확률 계산 및 트리거 결정
 */

import {
  EventTriggerRule,
  RelationshipState,
  UserActivity,
  EventType,
  ScheduledEvent,
  EventData,
} from './types';

// ============================================
// 이벤트 트리거 엔진
// ============================================

export class EventTriggerEngine {
  /**
   * 주어진 컨텍스트에서 트리거할 이벤트 결정
   */
  static async evaluateTriggers(
    rules: EventTriggerRule[],
    relationship: RelationshipState,
    recentActivity: UserActivity[],
    lastEvents: { type: EventType; triggeredAt: Date }[]
  ): Promise<{ shouldTrigger: boolean; event?: Partial<ScheduledEvent>; rule?: EventTriggerRule }> {
    // 우선순위순 정렬
    const sortedRules = [...rules].sort((a, b) => b.priority - a.priority);

    for (const rule of sortedRules) {
      // 페르소나 필터링
      if (rule.personaId && rule.personaId !== relationship.personaId) {
        continue;
      }

      // 쿨다운 체크
      const lastSameTypeEvent = lastEvents.find(e => e.type === rule.eventType);
      if (lastSameTypeEvent) {
        const cooldownMs = rule.cooldownMinutes * 60 * 1000;
        if (Date.now() - lastSameTypeEvent.triggeredAt.getTime() < cooldownMs) {
          continue;
        }
      }

      // 조건 체크
      if (!this.checkConditions(rule.triggerConditions, relationship, recentActivity)) {
        continue;
      }

      // 확률 계산
      const probability = this.calculateProbability(
        rule.baseProbability,
        rule.probabilityModifiers,
        relationship,
        recentActivity
      );

      // 확률 기반 결정
      if (Math.random() < probability) {
        return {
          shouldTrigger: true,
          event: {
            userId: relationship.oduserId,
            personaId: relationship.personaId,
            eventType: rule.eventType,
            eventData: {
              triggerRuleId: rule.id,
              generatedBy: rule.eventTemplate.requireLlmGeneration ? 'llm' : 'template',
            },
            status: 'pending',
          },
          rule,
        };
      }
    }

    return { shouldTrigger: false };
  }

  /**
   * 트리거 조건 체크
   */
  private static checkConditions(
    conditions: EventTriggerRule['triggerConditions'],
    relationship: RelationshipState,
    recentActivity: UserActivity[]
  ): boolean {
    // 호감도 조건
    if (conditions.minAffection !== undefined && relationship.affection < conditions.minAffection) {
      return false;
    }
    if (conditions.maxAffection !== undefined && relationship.affection > conditions.maxAffection) {
      return false;
    }

    // 관계 단계 조건
    if (conditions.relationshipStage && !conditions.relationshipStage.includes(relationship.relationshipStage)) {
      return false;
    }

    // 시간 범위 조건
    if (conditions.timeRange) {
      const now = new Date();
      const currentTime = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
      const { start, end } = conditions.timeRange;

      // 자정을 넘어가는 시간 범위 처리
      if (start > end) {
        if (currentTime < start && currentTime > end) return false;
      } else {
        if (currentTime < start || currentTime > end) return false;
      }
    }

    // 마지막 활동 시간 조건
    if (conditions.hoursSinceLastActivity) {
      const lastActivity = recentActivity[0];
      if (lastActivity) {
        const hoursSince = (Date.now() - lastActivity.timestamp.getTime()) / (1000 * 60 * 60);
        if (conditions.hoursSinceLastActivity.min !== undefined && hoursSince < conditions.hoursSinceLastActivity.min) {
          return false;
        }
        if (conditions.hoursSinceLastActivity.max !== undefined && hoursSince > conditions.hoursSinceLastActivity.max) {
          return false;
        }
      }
    }

    // 특정 유저 액션 조건
    if (conditions.userAction) {
      const matchingActivity = recentActivity.find(a => a.actionType === conditions.userAction);
      if (!matchingActivity) return false;

      // 액션 데이터 매칭
      if (conditions.actionData) {
        for (const [key, expectedValues] of Object.entries(conditions.actionData)) {
          const actualValue = matchingActivity.actionData[key];
          if (Array.isArray(expectedValues)) {
            if (!expectedValues.includes(actualValue)) return false;
          } else if (actualValue !== expectedValues) {
            return false;
          }
        }
      }
    }

    return true;
  }

  /**
   * 최종 확률 계산
   */
  private static calculateProbability(
    baseProbability: number,
    modifiers: EventTriggerRule['probabilityModifiers'],
    relationship: RelationshipState,
    recentActivity: UserActivity[]
  ): number {
    let probability = baseProbability;

    // 호감도 기반 보너스
    if (modifiers.affectionPer10) {
      probability += Math.floor(relationship.affection / 10) * modifiers.affectionPer10;
    }

    // 친밀 단계 보너스
    if (modifiers.intimateSageBonus) {
      if (['intimate', 'lover'].includes(relationship.relationshipStage)) {
        probability += modifiers.intimateSageBonus;
      }
    }

    // 심야 시간 보너스
    if (modifiers.nightTimeBonus) {
      const hour = new Date().getHours();
      if (hour >= 22 || hour < 5) {
        probability += modifiers.nightTimeBonus;
      }
    }

    // 비활동 기간 보너스
    if (modifiers.daysInactiveBonus && relationship.lastInteractionAt) {
      const daysSince = (Date.now() - relationship.lastInteractionAt.getTime()) / (1000 * 60 * 60 * 24);
      probability += Math.floor(daysSince) * modifiers.daysInactiveBonus;
    }

    // 연속 프리미엄 선택 보너스
    if (modifiers.consecutivePremiumBonus) {
      const premiumChoices = recentActivity.filter(
        a => a.actionType === 'choice_made' && a.actionData.wasPremium
      ).length;
      probability += premiumChoices * modifiers.consecutivePremiumBonus;
    }

    // 최대 확률 제한
    if (modifiers.maxProbability) {
      probability = Math.min(probability, modifiers.maxProbability);
    }

    // 0-1 범위 보장
    return Math.max(0, Math.min(1, probability));
  }
}

// ============================================
// 이벤트 스케줄러
// ============================================

export class EventScheduler {
  /**
   * 지연된 이벤트 스케줄링
   */
  static scheduleDelayedEvent(
    userId: string,
    personaId: string,
    eventType: EventType,
    eventData: EventData,
    delayMinutes: number,
    conditions?: Record<string, unknown>
  ): Partial<ScheduledEvent> {
    const scheduledFor = new Date(Date.now() + delayMinutes * 60 * 1000);

    return {
      userId,
      personaId,
      eventType,
      eventData,
      scheduledFor,
      status: 'pending',
      deliveryConditions: conditions || {},
    };
  }

  /**
   * 랜덤 지연 시간 계산 (자연스러운 타이밍)
   */
  static calculateNaturalDelay(
    minMinutes: number,
    maxMinutes: number,
    urgency: 'low' | 'medium' | 'high' = 'medium'
  ): number {
    const range = maxMinutes - minMinutes;

    // 긴급도에 따른 분포 조정
    let delay: number;
    switch (urgency) {
      case 'high':
        // 빠른 응답 확률 높음
        delay = minMinutes + Math.random() * Math.random() * range;
        break;
      case 'low':
        // 느린 응답 확률 높음
        delay = minMinutes + (1 - Math.random() * Math.random()) * range;
        break;
      default:
        // 균등 분포
        delay = minMinutes + Math.random() * range;
    }

    return Math.round(delay);
  }
}

// ============================================
// 리텐션 분석기
// ============================================

export class RetentionAnalyzer {
  /**
   * 유저 이탈 위험도 계산
   */
  static calculateChurnRisk(
    lastInteractionAt: Date | null,
    totalInteractions: number,
    recentActivityCount: number
  ): { risk: 'low' | 'medium' | 'high'; score: number } {
    let score = 0;

    // 마지막 상호작용 시간
    if (!lastInteractionAt) {
      score += 50;
    } else {
      const daysSince = (Date.now() - lastInteractionAt.getTime()) / (1000 * 60 * 60 * 24);
      if (daysSince > 7) score += 40;
      else if (daysSince > 3) score += 25;
      else if (daysSince > 1) score += 10;
    }

    // 총 상호작용 수 (적을수록 위험)
    if (totalInteractions < 5) score += 30;
    else if (totalInteractions < 20) score += 15;

    // 최근 활동량 감소
    if (recentActivityCount < 2) score += 20;

    return {
      risk: score >= 60 ? 'high' : score >= 30 ? 'medium' : 'low',
      score: Math.min(100, score),
    };
  }

  /**
   * 최적 연락 시간 추천
   */
  static suggestOptimalContactTime(activityHistory: UserActivity[]): {
    hour: number;
    dayOfWeek: number;
    confidence: number;
  } {
    if (activityHistory.length < 5) {
      // 데이터 부족 시 기본값
      return { hour: 21, dayOfWeek: 0, confidence: 0.3 };
    }

    // 활동 시간 분석
    const hourCounts: Record<number, number> = {};
    const dayCounts: Record<number, number> = {};

    for (const activity of activityHistory) {
      const date = new Date(activity.timestamp);
      const hour = date.getHours();
      const day = date.getDay();

      hourCounts[hour] = (hourCounts[hour] || 0) + 1;
      dayCounts[day] = (dayCounts[day] || 0) + 1;
    }

    // 가장 활발한 시간/요일 찾기
    const bestHour = Object.entries(hourCounts).sort((a, b) => b[1] - a[1])[0];
    const bestDay = Object.entries(dayCounts).sort((a, b) => b[1] - a[1])[0];

    const totalActivities = activityHistory.length;
    const confidence = Math.min(0.9, 0.3 + (totalActivities / 100) * 0.6);

    return {
      hour: parseInt(bestHour[0]),
      dayOfWeek: parseInt(bestDay[0]),
      confidence,
    };
  }
}
