/**
 * AI Agent Core
 * 메인 AI 에이전트 - 모든 AI 기능의 통합 인터페이스
 *
 * 핵심 원칙:
 * 1. 페르소나 일관성 - persona_core의 데이터는 절대 변하지 않음
 * 2. 기억 유지 - 모든 중요 대화는 영구 저장
 * 3. 컨텍스트 연속성 - 이전 대화를 기억하고 참조
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { LLMClient, getLLMClient } from './llm-client';
import type { LLMCallOptions } from './llm-client';
import type { TaskContext } from './model-selector';
import { EventTriggerEngine, EventScheduler } from './event-trigger-engine';
import { MemoryManager } from './memory-system';
import { PersonaLoader, getPersonaLoader } from './persona-loader';
import {
  Persona,
  PersonaTraits,
  PersonaWorldview,
  RelationshipState,
  ConversationSession,
  ConversationMessage,
  LLMContext,
  UserPersonaContext,
  EventTriggerRule,
  UserActivity,
  DialogueChoice,
  PersonaMood,
  ScheduledEvent,
} from './types';
import { getDefaultPersonaData } from './default-personas';

// ============================================
// AI Agent 클래스
// ============================================

export class AIAgent {
  private supabase: SupabaseClient;
  private llmClient: LLMClient;
  private memoryManager: MemoryManager;
  private personaLoader: PersonaLoader;

  constructor(supabaseUrl: string, supabaseKey: string) {
    this.supabase = createClient(supabaseUrl, supabaseKey);
    this.llmClient = getLLMClient();
    this.memoryManager = new MemoryManager(this.supabase);
    this.personaLoader = getPersonaLoader(this.supabase);
  }

  // ============================================
  // 대화 관리
  // ============================================

  /**
   * 대화 세션 시작 또는 재개
   */
  async getOrCreateSession(
    userId: string,
    personaId: string
  ): Promise<ConversationSession> {
    // 기존 활성 세션 찾기 (status가 'active'이거나 null인 경우 - 하위호환성)
    const { data: existingSession } = await this.supabase
      .from('conversation_sessions')
      .select('*')
      .eq('user_id', userId)
      .eq('persona_id', personaId)
      .or('status.eq.active,status.is.null')
      .order('last_message_at', { ascending: false, nullsFirst: false })
      .limit(1)
      .single();

    if (existingSession) {
      // status가 null이면 active로 업데이트
      if (!existingSession.status) {
        await this.supabase
          .from('conversation_sessions')
          .update({ status: 'active' })
          .eq('id', existingSession.id);
      }
      return this.mapSession(existingSession);
    }

    // 관계 상태 조회
    const relationship = await this.getRelationship(userId, personaId);

    // 새 세션 생성
    const { data: newSession, error } = await this.supabase
      .from('conversation_sessions')
      .insert({
        user_id: userId,
        persona_id: personaId,
        status: 'active',
        affection_at_start: relationship.affection,
        relationship_stage: relationship.relationshipStage,
        emotional_state: { persona_mood: 'neutral', tension_level: 0 },
        last_message_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (error) throw error;
    return this.mapSession(newSession);
  }

  /**
   * 유저 메시지 처리 및 응답 생성
   */
  async processUserMessage(
    sessionId: string,
    userMessage: string,
    choiceData?: { choiceId: string; wasPremium: boolean }
  ): Promise<{
    response: ConversationMessage;
    choices: DialogueChoice[];
    affectionChange: number;
    scenarioTrigger?: {
      shouldStart: boolean;
      scenarioType: string;
      scenarioContext: string;
      location?: string;
      transitionMessage?: string;
    };
  }> {
    // 세션 조회
    const session = await this.getSession(sessionId);
    if (!session) throw new Error('Session not found');

    // 컨텍스트 구축
    const context = await this.buildLLMContext(session.userId, session.personaId, sessionId);

    // 유저 메시지 저장
    const userMsg = await this.saveMessage(sessionId, {
      role: 'user',
      content: userMessage,
      choiceData: choiceData ? {
        choiceId: choiceData.choiceId,
        choiceText: userMessage,
        wasPremium: choiceData.wasPremium,
      } : undefined,
    });

    // LLM 응답 생성 (동적 모델 선택 적용)
    const llmOptions: LLMCallOptions = {
      taskContext: {
        type: 'dialogue_response',
        relationshipStage: context.relationship.relationshipStage,
        affection: context.relationship.affection,
        emotionalIntensity: context.emotionalState.tensionLevel > 7 ? 'high' :
                           context.emotionalState.tensionLevel > 4 ? 'medium' : 'low',
        isVulnerableMoment: context.emotionalState.vulnerabilityShown,
        isPremiumContent: choiceData?.wasPremium,
        conversationLength: context.conversationHistory.length,
        requiresConsistency: true,
        requiresCreativity: true,
      } as TaskContext,
    };
    const llmResponse = await this.llmClient.generateResponse(context, userMessage, llmOptions);

    // 페르소나 응답 저장
    const personaMsg = await this.saveMessage(sessionId, {
      role: 'persona',
      content: llmResponse.content,
      emotion: llmResponse.emotion,
      innerThought: llmResponse.innerThought,
      affectionChange: llmResponse.affectionModifier,
      flagsChanged: llmResponse.flagsToSet || {},
    });

    // 관계 상태 업데이트
    await this.updateRelationship(session.userId, session.personaId, {
      affectionChange: llmResponse.affectionModifier,
      flagsToSet: llmResponse.flagsToSet,
    });

    // 선택지 생성 (standard tier 사용 - 비용 효율)
    const choiceOptions: LLMCallOptions = {
      taskContext: {
        type: 'choice_generation',
        relationshipStage: context.relationship.relationshipStage,
        affection: context.relationship.affection,
        requiresCreativity: true,
      } as TaskContext,
    };
    const choices = await this.llmClient.generateChoices(
      context,
      llmResponse.content,
      3,
      choiceOptions
    );

    // 세션 상태 업데이트
    await this.updateSessionState(sessionId, {
      emotionalState: {
        personaMood: llmResponse.emotion,
        tensionLevel: context.emotionalState.tensionLevel,
        vulnerabilityShown: llmResponse.emotion === 'vulnerable',
      },
      activeFlags: {
        ...session.activeFlags,
        vulnerabilityShown: llmResponse.emotion === 'vulnerable',
        ...llmResponse.flagsToSet,
      },
    });

    // 유저 활동 로그
    await this.logActivity(session.userId, session.personaId, 'message_sent', {
      sessionId,
      wasPremium: choiceData?.wasPremium,
    });

    return {
      response: personaMsg,
      choices,
      affectionChange: llmResponse.affectionModifier,
      scenarioTrigger: llmResponse.scenarioTrigger,
    };
  }

  // ============================================
  // 이벤트 트리거
  // ============================================

  /**
   * 유저 행동 기반 이벤트 트리거 체크
   */
  async checkEventTriggers(
    userId: string,
    personaId: string,
    triggerAction?: UserActivity
  ): Promise<ScheduledEvent | null> {
    // 이벤트 규칙 조회
    const { data: rules } = await this.supabase
      .from('event_trigger_rules')
      .select('*')
      .eq('is_active', true)
      .or(`persona_id.is.null,persona_id.eq.${personaId}`);

    if (!rules || rules.length === 0) return null;

    // 관계 상태 조회
    const relationship = await this.getRelationship(userId, personaId);

    // 최근 활동 조회
    const { data: recentActivity } = await this.supabase
      .from('user_activity_log')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(20);

    // 최근 이벤트 조회 (쿨다운 체크용)
    const { data: recentEvents } = await this.supabase
      .from('scheduled_events')
      .select('event_type, created_at')
      .eq('user_id', userId)
      .eq('persona_id', personaId)
      .order('created_at', { ascending: false })
      .limit(10);

    const activities = triggerAction
      ? [triggerAction, ...(recentActivity || []).map(this.mapActivity)]
      : (recentActivity || []).map(this.mapActivity);

    const lastEvents = (recentEvents || []).map(e => ({
      type: e.event_type,
      triggeredAt: new Date(e.created_at),
    }));

    // 트리거 평가
    const result = await EventTriggerEngine.evaluateTriggers(
      rules.map(this.mapRule),
      relationship,
      activities,
      lastEvents
    );

    if (result.shouldTrigger && result.event && result.rule) {
      // 이벤트 스케줄링
      const delay = EventScheduler.calculateNaturalDelay(1, 10, 'medium');
      const scheduledEvent = EventScheduler.scheduleDelayedEvent(
        userId,
        personaId,
        result.rule.eventType,
        result.event.eventData!,
        delay
      );

      // DB에 저장
      const { data: savedEvent } = await this.supabase
        .from('scheduled_events')
        .insert(scheduledEvent)
        .select()
        .single();

      return savedEvent;
    }

    return null;
  }

  /**
   * 예약된 이벤트 처리
   */
  async processScheduledEvent(eventId: string): Promise<{
    delivered: boolean;
    content?: string;
  }> {
    const { data: event } = await this.supabase
      .from('scheduled_events')
      .select('*')
      .eq('id', eventId)
      .single();

    if (!event || event.status !== 'pending') {
      return { delivered: false };
    }

    // 전달 조건 재확인
    // TODO: delivery_conditions 체크

    // LLM으로 실제 메시지 생성
    const context = await this.buildLLMContext(event.user_id, event.persona_id);
    const eventData = event.event_data;

    let content: string;

    if (eventData.generatedBy === 'llm') {
      const result = await this.llmClient.generateEventMessage(
        context,
        event.event_type,
        eventData.llmContextHint || 'general'
      );
      content = result.content;
    } else {
      // 템플릿에서 선택
      const templates = eventData.fallbackTemplates || ['안녕'];
      content = templates[Math.floor(Math.random() * templates.length)];
    }

    // 피드 이벤트로 저장
    await this.supabase.from('feed_events').insert({
      user_id: event.user_id,
      persona_id: event.persona_id,
      type: event.event_type,
      title: `${context.persona.name}님의 메시지`,
      preview: content.substring(0, 50),
    });

    // 이벤트 상태 업데이트
    await this.supabase
      .from('scheduled_events')
      .update({ status: 'delivered', delivered_at: new Date().toISOString() })
      .eq('id', eventId);

    return { delivered: true, content };
  }

  // ============================================
  // 관계 관리
  // ============================================

  /**
   * 유저-페르소나 관계 조회
   */
  async getRelationship(userId: string, personaId: string): Promise<RelationshipState> {
    const { data } = await this.supabase
      .from('user_persona_relationships')
      .select('*')
      .eq('user_id', userId)
      .eq('persona_id', personaId)
      .single();

    if (data) {
      return this.mapRelationship(data);
    }

    // 새 관계 생성
    const { data: newRel } = await this.supabase
      .from('user_persona_relationships')
      .insert({
        user_id: userId,
        persona_id: personaId,
        first_interaction_at: new Date().toISOString(),
      })
      .select()
      .single();

    // 첫 만남 기억 자동 생성
    await this.createFirstMeetingMemory(userId, personaId);

    return this.mapRelationship(newRel);
  }

  /**
   * 첫 만남 기억 생성
   */
  private async createFirstMeetingMemory(userId: string, personaId: string): Promise<void> {
    try {
      // 페르소나 정보 조회
      const personaData = await this.personaLoader.loadPersona(personaId);
      const personaName = personaData?.persona?.name || personaId;

      await this.supabase
        .from('persona_memories')
        .insert({
          user_id: userId,
          persona_id: personaId,
          memory_type: 'first_meeting',
          summary: `${personaName}과(와) 처음 만났다.`,
          details: {
            timestamp: new Date().toISOString(),
            context: 'DM 대화 시작',
          },
          emotional_weight: 8,
        })
        .single();
    } catch (error) {
      // 중복 기억은 무시
      console.log('[AIAgent] First meeting memory already exists or failed:', error);
    }
  }

  /**
   * 관계 상태 업데이트
   */
  private async updateRelationship(
    userId: string,
    personaId: string,
    updates: {
      affectionChange?: number;
      flagsToSet?: Record<string, boolean>;
      incrementMessages?: boolean;
    }
  ): Promise<void> {
    const current = await this.getRelationship(userId, personaId);

    const newAffection = Math.max(0, Math.min(100,
      current.affection + (updates.affectionChange || 0)
    ));

    // 관계 단계 자동 업그레이드
    const newStage = this.calculateRelationshipStage(newAffection);

    await this.supabase
      .from('user_persona_relationships')
      .update({
        affection: newAffection,
        relationship_stage: newStage,
        story_flags: { ...current.storyFlags, ...updates.flagsToSet },
        total_messages: updates.incrementMessages
          ? (current.totalMessages || 0) + 1
          : (current.totalMessages || 0),
        last_interaction_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('user_id', userId)
      .eq('persona_id', personaId);
  }

  private calculateRelationshipStage(affection: number): string {
    if (affection >= 90) return 'lover';
    if (affection >= 70) return 'intimate';
    if (affection >= 50) return 'close';
    if (affection >= 30) return 'friend';
    if (affection >= 10) return 'acquaintance';
    return 'stranger';
  }

  // ============================================
  // LLM 컨텍스트 구축 (개선된 버전)
  // ============================================

  private async buildLLMContext(
    userId: string,
    personaId: string,
    sessionId?: string
  ): Promise<LLMContext & { memories?: string; previousSummaries?: string }> {
    // 1. 페르소나 코어 데이터 로드 (캐싱됨, 절대 변하지 않음)
    let mappedPersona: Persona;
    let mappedTraits: PersonaTraits;
    let mappedWorldview: PersonaWorldview;

    try {
      const coreData = await this.personaLoader.loadPersona(personaId);
      mappedPersona = coreData.persona;
      mappedTraits = coreData.traits;
      mappedWorldview = coreData.worldview;
    } catch {
      // persona_core 테이블이 없거나 데이터가 없으면 기존 방식으로 폴백
      const { data: persona } = await this.supabase
        .from('personas')
        .select('*')
        .eq('id', personaId)
        .single();

      const { data: traits } = await this.supabase
        .from('persona_traits')
        .select('*')
        .eq('persona_id', personaId)
        .single();

      const { data: worldview } = await this.supabase
        .from('persona_worldview')
        .select('*')
        .eq('persona_id', personaId)
        .single();

      const defaultData = getDefaultPersonaData(personaId);

      if (persona) {
        mappedPersona = this.mapPersona(persona);
      } else if (defaultData) {
        mappedPersona = defaultData.persona;
      } else {
        mappedPersona = this.mapPersona(null);
      }

      if (traits) {
        mappedTraits = this.mapTraits(traits);
      } else if (defaultData) {
        mappedTraits = defaultData.traits;
      } else {
        mappedTraits = this.mapTraits(null);
      }

      if (worldview) {
        mappedWorldview = this.mapWorldview(worldview);
      } else if (defaultData) {
        mappedWorldview = defaultData.worldview;
      } else {
        mappedWorldview = this.mapWorldview(null);
      }
    }

    // 2. 유저 데이터 조회
    const { data: user } = await this.supabase
      .from('users')
      .select('*')
      .eq('id', userId)
      .single();

    // 3. 관계 상태 조회
    const relationship = await this.getRelationship(userId, personaId);

    // 4. 기억 시스템에서 중요 기억 조회
    let memories: string | undefined;
    let previousSummaries: string | undefined;

    try {
      memories = await this.memoryManager.getMemoriesForPrompt(userId, personaId);
      previousSummaries = await this.memoryManager.getSummariesForPrompt(userId, personaId);
    } catch (error) {
      console.warn('[AIAgent] Memory system not available:', error);
    }

    // 5. 대화 기록 조회 (세션이 있는 경우)
    let conversationHistory: ConversationMessage[] = [];
    let emotionalState = { personaMood: 'neutral' as PersonaMood, tensionLevel: 0, vulnerabilityShown: false };

    if (sessionId) {
      // 대화 컨텍스트를 위해 최근 50개 메시지 로드
      const { data: messages } = await this.supabase
        .from('conversation_messages')
        .select('*')
        .eq('session_id', sessionId)
        .order('sequence_number', { ascending: true })
        .limit(50);

      conversationHistory = (messages || []).map(this.mapMessage);

      const { data: session } = await this.supabase
        .from('conversation_sessions')
        .select('emotional_state')
        .eq('id', sessionId)
        .single();

      if (session?.emotional_state) {
        emotionalState = session.emotional_state;
      }
    }

    return {
      persona: mappedPersona,
      traits: mappedTraits,
      worldview: mappedWorldview,
      relationship,
      userPersona: this.mapUserPersona(user),
      conversationHistory,
      currentSituation: mappedWorldview.mainConflict || '',
      emotionalState,
      // 추가된 기억 컨텍스트
      memories,
      previousSummaries,
    };
  }

  // ============================================
  // 유틸리티 메서드
  // ============================================

  async getSession(sessionId: string): Promise<ConversationSession | null> {
    const { data } = await this.supabase
      .from('conversation_sessions')
      .select('*')
      .eq('id', sessionId)
      .single();

    return data ? this.mapSession(data) : null;
  }

  private async saveMessage(
    sessionId: string,
    message: Partial<ConversationMessage>
  ): Promise<ConversationMessage> {
    // 시퀀스 번호 계산
    const { count } = await this.supabase
      .from('conversation_messages')
      .select('*', { count: 'exact', head: true })
      .eq('session_id', sessionId);

    const { data, error } = await this.supabase
      .from('conversation_messages')
      .insert({
        session_id: sessionId,
        role: message.role,
        content: message.content,
        emotion: message.emotion,
        inner_thought: message.innerThought,
        choice_data: message.choiceData,
        affection_change: message.affectionChange || 0,
        flags_changed: message.flagsChanged || {},
        sequence_number: (count || 0) + 1,
      })
      .select()
      .single();

    if (error) throw error;
    return this.mapMessage(data);
  }

  private async updateSessionState(
    sessionId: string,
    updates: Partial<ConversationSession>
  ): Promise<void> {
    await this.supabase
      .from('conversation_sessions')
      .update({
        emotional_state: updates.emotionalState,
        active_flags: updates.activeFlags,
        last_message_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', sessionId);
  }

  private async logActivity(
    userId: string,
    personaId: string | undefined,
    actionType: string,
    actionData: Record<string, unknown>
  ): Promise<void> {
    await this.supabase.from('user_activity_log').insert({
      user_id: userId,
      persona_id: personaId,
      action_type: actionType,
      action_data: actionData,
    });
  }

  // ============================================
  // 매핑 함수들
  // ============================================

  private mapSession(data: Record<string, unknown>): ConversationSession {
    return {
      id: data.id as string,
      userId: data.user_id as string,
      personaId: data.persona_id as string,
      status: data.status as 'active' | 'paused' | 'completed',
      currentScenario: data.current_scenario as ConversationSession['currentScenario'],
      affectionAtStart: data.affection_at_start as number,
      relationshipStage: data.relationship_stage as ConversationSession['relationshipStage'],
      conversationSummary: data.conversation_summary as string | null,
      activeFlags: data.active_flags as Record<string, boolean>,
      emotionalState: data.emotional_state as ConversationSession['emotionalState'],
    };
  }

  private mapMessage(data: Record<string, unknown>): ConversationMessage {
    return {
      id: data.id as string,
      sessionId: data.session_id as string,
      role: data.role as ConversationMessage['role'],
      content: data.content as string,
      emotion: data.emotion as PersonaMood | undefined,
      innerThought: data.inner_thought as string | undefined,
      choiceData: data.choice_data as ConversationMessage['choiceData'],
      affectionChange: data.affection_change as number,
      flagsChanged: data.flags_changed as Record<string, boolean>,
      sequenceNumber: data.sequence_number as number,
      createdAt: new Date(data.created_at as string),
    };
  }

  private mapRelationship(data: Record<string, unknown>): RelationshipState {
    return {
      oduserId: data.user_id as string,
      personaId: data.persona_id as string,
      affection: data.affection as number,
      relationshipStage: data.relationship_stage as RelationshipState['relationshipStage'],
      trustLevel: data.trust_level as number,
      intimacyLevel: data.intimacy_level as number,
      tensionLevel: data.tension_level as number,
      completedEpisodes: data.completed_episodes as string[],
      unlockedEpisodes: data.unlocked_episodes as string[],
      storyFlags: data.story_flags as Record<string, boolean>,
      memorableMoments: data.memorable_moments as RelationshipState['memorableMoments'],
      lastInteractionAt: data.last_interaction_at ? new Date(data.last_interaction_at as string) : null,
      totalMessages: data.total_messages as number || 0,
    };
  }

  private mapPersona(data: Record<string, unknown> | null): Persona {
    const defaultAppearance = {
      hair: 'Unknown',
      eyes: 'Unknown',
      build: 'Unknown',
      style: 'Unknown',
      distinguishingFeatures: [],
    };
    if (!data) {
      return {
        id: '',
        name: 'Unknown',
        fullName: 'Unknown Character',
        role: 'Unknown',
        age: 0,
        ethnicity: 'Unknown',
        appearance: defaultAppearance,
        voiceDescription: 'A mysterious voice',
      };
    }
    return {
      id: data.id as string,
      name: data.name as string,
      fullName: data.full_name as string,
      role: data.role as string,
      age: data.age as number,
      ethnicity: data.ethnicity as string,
      appearance: (data.appearance as Persona['appearance']) || defaultAppearance,
      voiceDescription: data.voice_description as string,
    };
  }

  private mapTraits(data: Record<string, unknown> | null): PersonaTraits {
    const defaultStageBehavior = { tone: 'neutral', distance: 'normal' };
    if (!data) {
      return {
        surfacePersonality: ['Mysterious'],
        hiddenPersonality: ['Unknown depth'],
        coreTrope: 'The Enigma',
        likes: [],
        dislikes: [],
        speechPatterns: {
          formality: 'medium',
          petNames: [],
          verbalTics: [],
          emotionalRange: 'moderate',
        },
        behaviorByStage: {
          stranger: defaultStageBehavior,
          acquaintance: defaultStageBehavior,
          friend: defaultStageBehavior,
          close: defaultStageBehavior,
          intimate: defaultStageBehavior,
          lover: defaultStageBehavior,
        },
      };
    }
    return {
      surfacePersonality: (data.surface_personality as string[]) || [],
      hiddenPersonality: (data.hidden_personality as string[]) || [],
      coreTrope: (data.core_trope as string) || '',
      likes: (data.likes as string[]) || [],
      dislikes: (data.dislikes as string[]) || [],
      speechPatterns: (data.speech_patterns as PersonaTraits['speechPatterns']) || {
        formality: 'medium',
        petNames: [],
        verbalTics: [],
        emotionalRange: 'moderate',
      },
      behaviorByStage: (data.behavior_by_stage as PersonaTraits['behaviorByStage']) || {},
    };
  }

  private mapWorldview(data: Record<string, unknown> | null): PersonaWorldview {
    if (!data) {
      return {
        settings: ['Modern day'],
        timePeriod: 'Present',
        defaultRelationship: 'Strangers',
        relationshipAlternatives: [],
        mainConflict: '',
        conflictStakes: '',
        openingLine: 'Hello.',
        storyHooks: [],
        boundaries: [],
      };
    }
    return {
      settings: (data.settings as string[]) || [],
      timePeriod: (data.time_period as string) || '',
      defaultRelationship: (data.default_relationship as string) || '',
      relationshipAlternatives: (data.relationship_alternatives as string[]) || [],
      mainConflict: (data.main_conflict as string) || '',
      conflictStakes: (data.conflict_stakes as string) || '',
      openingLine: (data.opening_line as string) || '',
      storyHooks: (data.story_hooks as string[]) || [],
      boundaries: (data.boundaries as string[]) || [],
    };
  }

  private mapUserPersona(data: Record<string, unknown> | null): UserPersonaContext {
    if (!data) {
      return {
        nickname: 'Unknown',
        personalityType: 'ambivert',
        communicationStyle: 'direct',
        emotionalTendency: 'empathetic',
        interests: [],
        loveLanguage: 'words',
        attachmentStyle: 'secure',
        language: 'ko',
      };
    }
    return {
      nickname: (data.nickname as string) || 'Unknown',
      personalityType: (data.personality_type as string) || 'ambivert',
      communicationStyle: (data.communication_style as string) || 'direct',
      emotionalTendency: (data.emotional_tendency as string) || 'empathetic',
      interests: (data.interests as string[]) || [],
      loveLanguage: (data.love_language as string) || 'words',
      attachmentStyle: (data.attachment_style as string) || 'secure',
      language: (data.language as string) || (data.locale as string) || 'ko',
    };
  }

  private mapRule(data: Record<string, unknown>): EventTriggerRule {
    return {
      id: data.id as string,
      personaId: data.persona_id as string | null,
      eventType: data.event_type as EventTriggerRule['eventType'],
      triggerConditions: data.trigger_conditions as EventTriggerRule['triggerConditions'],
      baseProbability: data.base_probability as number,
      probabilityModifiers: data.probability_modifiers as EventTriggerRule['probabilityModifiers'],
      eventTemplate: data.event_template as EventTriggerRule['eventTemplate'],
      cooldownMinutes: data.cooldown_minutes as number,
      priority: data.priority as number,
    };
  }

  private mapActivity(data: Record<string, unknown>): UserActivity {
    return {
      userId: data.user_id as string,
      personaId: data.persona_id as string | undefined,
      actionType: data.action_type as UserActivity['actionType'],
      actionData: data.action_data as Record<string, unknown>,
      sessionId: data.session_id as string | undefined,
      timestamp: new Date(data.created_at as string),
    };
  }
}

// ============================================
// 싱글톤 인스턴스 생성
// ============================================

let aiAgentInstance: AIAgent | null = null;

export function getAIAgent(): AIAgent {
  if (!aiAgentInstance) {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
    aiAgentInstance = new AIAgent(supabaseUrl, supabaseKey);
  }
  return aiAgentInstance;
}
