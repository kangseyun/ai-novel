/**
 * Event Trigger Service
 * DB와 연동하는 이벤트 트리거 서비스
 */

import { SupabaseClient } from '@supabase/supabase-js';
import { EventTriggerEngine, EventScheduler, RetentionAnalyzer } from './event-trigger-engine';
import {
  EventTriggerRule,
  RelationshipState,
  UserActivity,
  EventType,
  ScheduledEvent,
  RelationshipStage,
} from './types';

// ============================================
// DB 타입 정의
// ============================================

interface DBEventTriggerRule {
  id: string;
  persona_id: string;
  name: string;
  description: string | null;
  event_type: string;
  conditions: Record<string, unknown>;
  base_probability: number;
  probability_modifiers: Record<string, unknown>;
  event_template: Record<string, unknown>;
  cooldown_hours: number;
  priority: number;
  is_active: boolean;
}

interface DBUserPersonaRelationship {
  user_id: string;
  persona_id: string;
  affection: number;
  relationship_stage: string;
  trust_level: number;
  intimacy_level: number;
  tension_level: number;
  completed_episodes: string[];
  unlocked_episodes: string[];
  story_flags: Record<string, boolean>;
  total_messages: number;
  first_interaction_at: string | null;
  last_interaction_at: string | null;
}

interface DBScheduledEvent {
  id: string;
  user_id: string;
  persona_id: string;
  trigger_rule_id: string | null;
  event_type: string;
  event_data: Record<string, unknown>;
  scheduled_for: string;
  status: string;
  delivery_conditions: Record<string, unknown>;
  delivered_at: string | null;
}

interface DBUserEventState {
  user_id: string;
  persona_id: string;
  last_dm_event_at: string | null;
  last_feed_event_at: string | null;
  last_story_event_at: string | null;
  last_notification_at: string | null;
  events_today: number;
  consecutive_days_active: number;
  last_active_date: string | null;
}

// ============================================
// Event Trigger Service
// ============================================

export class EventTriggerService {
  private supabase: SupabaseClient;

  constructor(supabase: SupabaseClient) {
    this.supabase = supabase;
  }

  // ============================================
  // 규칙 조회
  // ============================================

  /**
   * 페르소나의 활성화된 트리거 규칙 조회
   */
  async getActiveRules(personaId: string): Promise<EventTriggerRule[]> {
    const { data, error } = await this.supabase
      .from('event_trigger_rules')
      .select('*')
      .eq('persona_id', personaId)
      .eq('is_active', true)
      .order('priority', { ascending: false });

    if (error) {
      console.error('[EventTriggerService] Failed to get rules:', error);
      return [];
    }

    return (data || []).map(this.mapDBRuleToRule);
  }

  /**
   * 특정 이벤트 타입의 규칙만 조회
   */
  async getRulesByType(personaId: string, eventType: EventType): Promise<EventTriggerRule[]> {
    const { data, error } = await this.supabase
      .from('event_trigger_rules')
      .select('*')
      .eq('persona_id', personaId)
      .eq('event_type', eventType)
      .eq('is_active', true)
      .order('priority', { ascending: false });

    if (error) {
      console.error('[EventTriggerService] Failed to get rules by type:', error);
      return [];
    }

    return (data || []).map(this.mapDBRuleToRule);
  }

  // ============================================
  // 유저 상태 조회
  // ============================================

  /**
   * 유저-페르소나 관계 상태 조회
   */
  async getRelationshipState(userId: string, personaId: string): Promise<RelationshipState | null> {
    const { data, error } = await this.supabase
      .from('user_persona_relationships')
      .select('*')
      .eq('user_id', userId)
      .eq('persona_id', personaId)
      .single();

    if (error || !data) {
      return null;
    }

    return this.mapDBRelationshipToState(data);
  }

  /**
   * 유저의 최근 활동 조회
   */
  async getRecentActivity(userId: string, personaId: string, limit: number = 50): Promise<UserActivity[]> {
    // conversation_messages에서 최근 활동 조회
    const { data: messages, error: msgError } = await this.supabase
      .from('conversation_messages')
      .select(`
        id,
        content,
        role,
        created_at,
        session:conversation_sessions!inner(user_id, persona_id)
      `)
      .eq('conversation_sessions.user_id', userId)
      .eq('conversation_sessions.persona_id', personaId)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (msgError) {
      console.error('[EventTriggerService] Failed to get recent activity:', msgError);
      return [];
    }

    return (messages || []).map(msg => ({
      id: msg.id,
      userId,
      personaId,
      actionType: msg.role === 'user' ? 'message_sent' : 'message_received',
      actionData: { content: msg.content },
      timestamp: new Date(msg.created_at),
    }));
  }

  /**
   * 마지막 이벤트 시간 조회
   */
  async getLastEvents(userId: string, personaId: string): Promise<{ type: EventType; triggeredAt: Date }[]> {
    const { data, error } = await this.supabase
      .from('user_event_state')
      .select('*')
      .eq('user_id', userId)
      .eq('persona_id', personaId)
      .single();

    if (error || !data) {
      return [];
    }

    const events: { type: EventType; triggeredAt: Date }[] = [];

    if (data.last_dm_event_at) {
      events.push({ type: 'dm_message', triggeredAt: new Date(data.last_dm_event_at) });
    }
    if (data.last_feed_event_at) {
      events.push({ type: 'feed_post', triggeredAt: new Date(data.last_feed_event_at) });
    }
    if (data.last_story_event_at) {
      events.push({ type: 'story_update', triggeredAt: new Date(data.last_story_event_at) });
    }
    if (data.last_notification_at) {
      events.push({ type: 'notification', triggeredAt: new Date(data.last_notification_at) });
    }

    return events;
  }

  // ============================================
  // 트리거 평가 및 실행
  // ============================================

  /**
   * 이벤트 트리거 평가 및 실행
   */
  async evaluateAndTrigger(userId: string, personaId: string): Promise<{
    triggered: boolean;
    event?: Partial<ScheduledEvent>;
    rule?: EventTriggerRule;
  }> {
    // 1. 필요한 데이터 조회
    const [rules, relationship, recentActivity, lastEvents] = await Promise.all([
      this.getActiveRules(personaId),
      this.getRelationshipState(userId, personaId),
      this.getRecentActivity(userId, personaId),
      this.getLastEvents(userId, personaId),
    ]);

    if (!relationship) {
      console.log('[EventTriggerService] No relationship found');
      return { triggered: false };
    }

    // 2. 트리거 엔진으로 평가
    const result = await EventTriggerEngine.evaluateTriggers(
      rules,
      relationship,
      recentActivity,
      lastEvents
    );

    if (!result.shouldTrigger || !result.event || !result.rule) {
      return { triggered: false };
    }

    // 3. 로그 기록
    await this.logTriggerAttempt(userId, personaId, result.rule, relationship, true);

    // 4. 이벤트 스케줄링
    const scheduledEvent = await this.scheduleEvent(result.event);

    // 5. 이벤트 상태 업데이트
    await this.updateEventState(userId, personaId, result.rule.eventType);

    return {
      triggered: true,
      event: scheduledEvent,
      rule: result.rule,
    };
  }

  /**
   * 이벤트 스케줄링 (중복 방지 로직 포함)
   */
  async scheduleEvent(event: Partial<ScheduledEvent>): Promise<DBScheduledEvent | null> {
    // 1. 최근 1시간 내 동일 타입 이벤트 체크
    const oneHourAgo = new Date(Date.now() - 3600000).toISOString();

    const { data: recentEvents } = await this.supabase
      .from('scheduled_events')
      .select('id, created_at, status')
      .eq('user_id', event.userId)
      .eq('persona_id', event.personaId)
      .eq('event_type', event.eventType)
      .in('status', ['pending', 'delivered'])
      .gt('created_at', oneHourAgo)
      .limit(1);

    if (recentEvents && recentEvents.length > 0) {
      console.log(`[EventTriggerService] Duplicate event prevented: ${event.eventType} for user ${event.userId}`);
      return null;
    }

    // 2. 동일 유저에게 오늘 전송된 이벤트 수 체크 (일일 한도)
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const { count: todayCount } = await this.supabase
      .from('scheduled_events')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', event.userId)
      .eq('persona_id', event.personaId)
      .eq('status', 'delivered')
      .gte('delivered_at', todayStart.toISOString());

    const MAX_DAILY_EVENTS = 5;
    if ((todayCount || 0) >= MAX_DAILY_EVENTS) {
      console.log(`[EventTriggerService] Daily limit reached for user ${event.userId}`);
      return null;
    }

    // 3. 이벤트 스케줄링
    const delayMinutes = EventScheduler.calculateNaturalDelay(1, 5, 'medium');
    const scheduledFor = new Date(Date.now() + delayMinutes * 60 * 1000);

    const { data, error } = await this.supabase
      .from('scheduled_events')
      .insert({
        user_id: event.userId,
        persona_id: event.personaId,
        trigger_rule_id: event.eventData?.triggerRuleId,
        event_type: event.eventType,
        event_data: event.eventData || {},
        scheduled_for: scheduledFor.toISOString(),
        status: 'pending',
        delivery_conditions: event.deliveryConditions || {},
      })
      .select()
      .single();

    if (error) {
      console.error('[EventTriggerService] Failed to schedule event:', error);
      return null;
    }

    return data;
  }

  /**
   * 펜딩 이벤트 조회 (배치 처리용)
   */
  async getPendingEvents(): Promise<DBScheduledEvent[]> {
    const now = new Date().toISOString();

    const { data, error } = await this.supabase
      .from('scheduled_events')
      .select('*')
      .eq('status', 'pending')
      .lte('scheduled_for', now)
      .order('scheduled_for', { ascending: true })
      .limit(100);

    if (error) {
      console.error('[EventTriggerService] Failed to get pending events:', error);
      return [];
    }

    return data || [];
  }

  /**
   * 이벤트 전달 완료 표시
   */
  async markEventDelivered(eventId: string): Promise<void> {
    await this.supabase
      .from('scheduled_events')
      .update({
        status: 'delivered',
        delivered_at: new Date().toISOString(),
      })
      .eq('id', eventId);
  }

  // ============================================
  // 상태 업데이트
  // ============================================

  /**
   * 이벤트 상태 업데이트
   */
  private async updateEventState(userId: string, personaId: string, eventType: EventType): Promise<void> {
    const now = new Date().toISOString();
    const today = new Date().toISOString().split('T')[0];

    // 타입별 컬럼 결정
    const updateData: Record<string, unknown> = {
      updated_at: now,
    };

    switch (eventType) {
      case 'dm_message':
        updateData.last_dm_event_at = now;
        break;
      case 'feed_post':
        updateData.last_feed_event_at = now;
        break;
      case 'story_update':
        updateData.last_story_event_at = now;
        break;
      case 'notification':
        updateData.last_notification_at = now;
        break;
    }

    // Upsert
    await this.supabase
      .from('user_event_state')
      .upsert({
        user_id: userId,
        persona_id: personaId,
        ...updateData,
        events_today_reset_at: today,
      }, {
        onConflict: 'user_id,persona_id',
      });

    // 오늘 이벤트 수 증가
    await this.supabase.rpc('increment_events_today', {
      p_user_id: userId,
      p_persona_id: personaId,
    });
  }

  /**
   * 트리거 시도 로그
   */
  private async logTriggerAttempt(
    userId: string,
    personaId: string,
    rule: EventTriggerRule,
    relationship: RelationshipState,
    wasTriggered: boolean
  ): Promise<void> {
    await this.supabase
      .from('event_trigger_logs')
      .insert({
        user_id: userId,
        persona_id: personaId,
        trigger_rule_id: rule.id,
        event_type: rule.eventType,
        user_state_snapshot: {
          affection: relationship.affection,
          relationshipStage: relationship.relationshipStage,
          currentHour: new Date().getHours(),
        },
        was_triggered: wasTriggered,
      });
  }

  // ============================================
  // 리텐션 분석
  // ============================================

  /**
   * 유저 이탈 위험도 분석
   */
  async analyzeChurnRisk(userId: string, personaId: string): Promise<{
    risk: 'low' | 'medium' | 'high';
    score: number;
    recommendation?: string;
  }> {
    const relationship = await this.getRelationshipState(userId, personaId);
    const recentActivity = await this.getRecentActivity(userId, personaId, 20);

    if (!relationship) {
      return { risk: 'high', score: 100, recommendation: 'New user - send welcome message' };
    }

    const result = RetentionAnalyzer.calculateChurnRisk(
      relationship.lastInteractionAt,
      relationship.totalMessages || 0,
      recentActivity.length
    );

    let recommendation: string | undefined;
    if (result.risk === 'high') {
      recommendation = 'Send emotional DM to re-engage user';
    } else if (result.risk === 'medium') {
      recommendation = 'Send casual check-in message';
    }

    return { ...result, recommendation };
  }

  /**
   * 최적 연락 시간 분석
   */
  async getOptimalContactTime(userId: string, personaId: string): Promise<{
    hour: number;
    dayOfWeek: number;
    confidence: number;
  }> {
    const activity = await this.getRecentActivity(userId, personaId, 100);
    return RetentionAnalyzer.suggestOptimalContactTime(activity);
  }

  // ============================================
  // 매핑 함수
  // ============================================

  private mapDBRuleToRule(dbRule: DBEventTriggerRule): EventTriggerRule {
    return {
      id: dbRule.id,
      personaId: dbRule.persona_id,
      eventType: dbRule.event_type as EventType,
      triggerConditions: {
        minAffection: dbRule.conditions.minAffection as number | undefined,
        maxAffection: dbRule.conditions.maxAffection as number | undefined,
        relationshipStage: dbRule.conditions.relationshipStage as RelationshipStage[] | undefined,
        hoursSinceLastActivity: dbRule.conditions.hoursSinceLastActivity as { min?: number; max?: number } | undefined,
        timeRange: dbRule.conditions.timeRange as { start: string; end: string } | undefined,
        userAction: dbRule.conditions.userAction as string | undefined,
        actionData: dbRule.conditions.actionData as Record<string, unknown> | undefined,
      },
      baseProbability: dbRule.base_probability,
      probabilityModifiers: {
        affectionPer10: dbRule.probability_modifiers.affectionPer10 as number | undefined,
        intimateSageBonus: dbRule.probability_modifiers.intimateStageBonus as number | undefined,
        nightTimeBonus: dbRule.probability_modifiers.nightTimeBonus as number | undefined,
        daysInactiveBonus: dbRule.probability_modifiers.daysInactiveBonus as number | undefined,
        maxProbability: dbRule.probability_modifiers.maxProbability as number | undefined,
      },
      eventTemplate: {
        requireLlmGeneration: dbRule.event_template.requireLlmGeneration as boolean,
        llmContextHint: dbRule.event_template.llmContextHint as string,
        fallbackTemplates: dbRule.event_template.fallbackTemplates as string[] | undefined,
        mood: dbRule.event_template.mood as string | undefined,
        emotionalIntensity: dbRule.event_template.emotionalIntensity as 'low' | 'medium' | 'high' | undefined,
      },
      cooldownMinutes: dbRule.cooldown_hours * 60,
      priority: dbRule.priority,
    };
  }

  private mapDBRelationshipToState(db: DBUserPersonaRelationship): RelationshipState {
    return {
      oduserId: db.user_id,
      personaId: db.persona_id,
      affection: db.affection,
      relationshipStage: db.relationship_stage as RelationshipStage,
      trustLevel: db.trust_level,
      intimacyLevel: db.intimacy_level,
      tensionLevel: db.tension_level,
      completedEpisodes: db.completed_episodes || [],
      unlockedEpisodes: db.unlocked_episodes || [],
      storyFlags: db.story_flags || {},
      memorableMoments: [],
      lastInteractionAt: db.last_interaction_at ? new Date(db.last_interaction_at) : null,
      totalMessages: db.total_messages,
      firstInteractionAt: db.first_interaction_at ? new Date(db.first_interaction_at) : null,
    };
  }
}

// ============================================
// 싱글톤 인스턴스
// ============================================

let eventTriggerServiceInstance: EventTriggerService | null = null;

export function getEventTriggerService(supabase: SupabaseClient): EventTriggerService {
  if (!eventTriggerServiceInstance) {
    eventTriggerServiceInstance = new EventTriggerService(supabase);
  }
  return eventTriggerServiceInstance;
}
