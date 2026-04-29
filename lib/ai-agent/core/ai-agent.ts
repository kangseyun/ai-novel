/**
 * AI Agent Core
 * 메인 AI 에이전트 - Character.AI Style Engine Integration (Clean Architecture)
 *
 * [v2.1 Refactor]
 * - Removed Legacy Modules: MemoryManager, PersonaLoader, default-personas
 * - Fully migrated to PromptEngine & MemoryService
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { LLMClient, getLLMClient } from './llm-client';
import type { LLMCallOptions } from './llm-client';
import type { TaskContext } from './model-selector';
import { EventTriggerEngine, EventScheduler } from '../modules/event-trigger-engine';
import { evaluateScenarioTriggers, executeScenarioTrigger } from '../modules/event-trigger-service';
import { getScenarioSessionManager, ScenarioSessionManager, ScenarioMode } from '../modules/scenario-session-manager';
import { PromptEngine } from './prompt-engine';
import { memoryService } from '../memory/memory-service';
import { getPersonaConfig, getFullPersonaData } from '../memory/persona-config-store';
import { EngineContext, PersonaConfig, SituationPresets } from '../../../types/persona-engine';
import {
  getMemoryExtractor,
  getSessionSummarizer,
  getRelationshipManager,
} from '../../relationship';
import {
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
  Persona,
  PersonaTraits,
  PersonaWorldview,
  StageBehavior
} from '../utils/types';

// ============================================
// AI Agent 클래스
// ============================================

export class AIAgent {
  private supabase: SupabaseClient;
  private llmClient: LLMClient;
  private scenarioManager: ScenarioSessionManager;

  constructor(supabaseUrl: string, supabaseKey: string) {
    this.supabase = createClient(supabaseUrl, supabaseKey);
    this.llmClient = getLLMClient();
    this.scenarioManager = getScenarioSessionManager(this.supabase);
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
      if (!existingSession.status) {
        await this.supabase
          .from('conversation_sessions')
          .update({ status: 'active' })
          .eq('id', existingSession.id);
      }
      return this.mapSession(existingSession);
    }

    const relationship = await this.getRelationship(userId, personaId);

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
   * 유저 메시지 처리 및 응답 생성 (New Architecture)
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

    // 1. Engine Context 구축 (RAG 포함)
    const context = await this.buildLLMContext(session.userId, session.personaId, sessionId);

    // RAG 검색 (MemoryService) - userId 전달로 완전한 컨텍스트 검색
    const ragResult = await memoryService.retrieveContext(
      session.personaId,
      userMessage,
      session.userId,
      {
        matchThreshold: 0.4,  // 0.6 → 0.4: 더 많은 관련 기억 검색
        memoryCount: 10,      // 5 → 10: 더 많은 기억 검색
        conversationCount: 10, // 5 → 10: 더 많은 대화 기록 검색
        loreCount: 5,         // 3 → 5: 더 많은 설정 검색
      }
    );

    // 페르소나 설정 가져오기 (DB 우선)
    const personaConfig = await getPersonaConfig(session.personaId);
    if (!personaConfig) {
      throw new Error(`Persona config not found for ${session.personaId}`);
    }

    // Engine Context 매핑
    const engineContext: EngineContext = {
      config: personaConfig,
      relationship: {
        stage: context.relationship.relationshipStage,
        affection: context.relationship.affection,
      },
      situation: {
        current: this.determineCurrentSituation(context, personaConfig.situationPresets),
        generatedAt: Date.now()
      },
      retrievedMemories: ragResult.memories,
      retrievedLore: ragResult.lore,
      retrievedConversations: ragResult.conversations,
      history: context.conversationHistory.map(m => ({
        role: m.role === 'user' ? 'user' : 'assistant',
        content: m.content
      }))
    };

    // 유저 메시지 저장
    await this.saveMessage(sessionId, {
      role: 'user',
      content: userMessage,
      choiceData: choiceData ? {
        choiceId: choiceData.choiceId,
        choiceText: userMessage,
        wasPremium: choiceData.wasPremium,
      } : undefined,
    });

    // 2. PromptEngine을 통한 프롬프트 생성
    const systemPrompt = PromptEngine.buildSystemPrompt(engineContext);

    // 3. LLM 호출
    const llmOptions: LLMCallOptions = {
      taskContext: {
        type: 'dialogue_response',
        relationshipStage: context.relationship.relationshipStage,
        affection: context.relationship.affection,
        emotionalIntensity: 'low',
        isVulnerableMoment: false,
        isPremiumContent: choiceData?.wasPremium,
        conversationLength: context.conversationHistory.length,
        requiresConsistency: true,
        requiresCreativity: true,
      } as TaskContext,
      systemPromptOverride: systemPrompt
    };

    const llmResponse = await this.llmClient.generateResponse(
      context,
      userMessage,
      llmOptions
    );

    // 페르소나 응답 저장 + DB 작업들 병렬 실행
    const [personaMsg] = await Promise.all([
      this.saveMessage(sessionId, {
        role: 'persona',
        content: llmResponse.content,
        emotion: llmResponse.emotion,
        innerThought: llmResponse.innerThought,
        affectionChange: llmResponse.affectionModifier,
        flagsChanged: llmResponse.flagsToSet || {},
      }),
      this.updateRelationship(session.userId, session.personaId, {
        affectionChange: llmResponse.affectionModifier,
        flagsToSet: llmResponse.flagsToSet,
        incrementMessages: true,
      }),
      this.updateSessionState(sessionId, {
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
      }),
      this.logActivity(session.userId, session.personaId, 'message_sent', {
        sessionId,
        wasPremium: choiceData?.wasPremium,
      }),
    ]);

    // 4. 대화 기억 저장 (RAG용) - sessionId 포함
    this.saveToVectorMemory(session.userId, session.personaId, sessionId, userMessage, personaMsg.content);

    // 5. 자동 기억 추출 (RelationshipManager 연동)
    this.extractAndSaveMemories(
      session.userId,
      session.personaId,
      sessionId,
      userMessage,
      personaMsg.content,
      context.relationship.affection
    );

    // 6. 시나리오 트리거 평가 (DB 기반)
    let scenarioTrigger = llmResponse.scenarioTrigger;

    if (!scenarioTrigger?.shouldStart) {
      // LLM에서 트리거가 없으면 DB 트리거 규칙 평가
      const triggerResult = await evaluateScenarioTriggers(
        this.supabase,
        session.userId,
        session.personaId,
        {
          affection: context.relationship.affection + (llmResponse.affectionModifier || 0),
          relationshipStage: context.relationship.relationshipStage,
          hoursSinceLastActivity: 0, // 현재 활동 중이므로 0
          sessionMessageCount: context.conversationHistory.length,
          lastMessageContent: userMessage,
        }
      );

      if (triggerResult.shouldTrigger && triggerResult.trigger) {
        // 트리거 실행
        const execResult = await executeScenarioTrigger(
          this.supabase,
          session.userId,
          session.personaId,
          triggerResult.trigger.id,
          triggerResult.trigger.scenarioConfig,
          {
            affection: context.relationship.affection,
            relationshipStage: context.relationship.relationshipStage,
            lastMessage: userMessage,
          }
        );

        if (execResult.triggered) {
          // scenarioType을 기존 타입으로 매핑 (static/guided/dynamic → meeting/custom 등)
          const mappedScenarioType = execResult.scenarioType === 'dynamic' ? 'custom' : 'meeting';
          scenarioTrigger = {
            shouldStart: true,
            scenarioType: mappedScenarioType,
            scenarioContext: `Triggered by: ${triggerResult.trigger.name}`,
            location: undefined,
            transitionMessage: `${personaConfig?.name || '캐릭터'}가 특별한 이야기를 준비했어요...`,
          };
        }
      }
    }

    return {
      response: personaMsg,
      choices: [],
      affectionChange: llmResponse.affectionModifier,
      scenarioTrigger,
    };
  }

  /**
   * 대화에서 기억 자동 추출 및 저장
   */
  private async extractAndSaveMemories(
    userId: string,
    personaId: string,
    sessionId: string,
    userMessage: string,
    personaResponse: string,
    currentAffection: number
  ): Promise<void> {
    try {
      const extractor = getMemoryExtractor();
      const { memories, shouldSave } = extractor.extractMemories(
        userMessage,
        personaResponse,
        currentAffection
      );

      if (shouldSave && memories.length > 0) {
        const savedCount = await extractor.saveExtractedMemories(
          userId,
          personaId,
          memories,
          sessionId
        );
        // savedCount > 0 인 경우는 의미 있는 기억이 추출됨
        void savedCount;
      }
    } catch (error) {
      console.error('[AIAgent] Memory extraction failed:', error);
    }
  }

  private async saveToVectorMemory(
    userId: string,
    personaId: string,
    sessionId: string,
    userMsg: string,
    assistantMsg: string
  ): Promise<void> {
    Promise.all([
      memoryService.saveMemory(personaId, userId, userMsg, 'user', { sessionId }),
      memoryService.saveMemory(personaId, userId, assistantMsg, 'assistant', { sessionId })
    ]).catch(err => console.error('[AIAgent] Vector save failed:', err));
  }

  /**
   * 현재 상황 결정 (DB의 situation_presets 사용)
   */
  private determineCurrentSituation(
    context: LLMContext,
    situationPresets?: SituationPresets | null
  ): string {
    const recentMsgs = context.conversationHistory.slice(-5);
    const combinedText = recentMsgs.map(m => m.content).join(' ');

    // 대화 내용에서 키워드 기반 상황 추출 시도
    const keywordSituations = this.extractSituationFromKeywords(combinedText, situationPresets);
    if (keywordSituations) {
      return keywordSituations;
    }

    // 시간대별 상황 결정 (DB presets 사용)
    const hour = new Date().getHours();
    const timeSlot = this.getTimeSlot(hour);

    if (situationPresets && situationPresets[timeSlot]) {
      const situations = situationPresets[timeSlot];
      if (Array.isArray(situations) && situations.length > 0) {
        // 랜덤하게 하나 선택
        return situations[Math.floor(Math.random() * situations.length)];
      }
    }

    // DB에 설정이 없는 경우 기본값
    return this.getDefaultSituationByTime(hour);
  }

  /**
   * 시간대 슬롯 반환
   */
  private getTimeSlot(hour: number): string {
    if (hour < 6) return 'dawn';
    if (hour < 12) return 'morning';
    if (hour < 14) return 'afternoon';
    if (hour < 18) return 'evening';
    return 'night';
  }

  /**
   * 키워드 기반 상황 추출
   */
  private extractSituationFromKeywords(
    text: string,
    situationPresets?: SituationPresets | null
  ): string | null {
    // DB presets의 각 상황에서 키워드 매칭 시도
    if (situationPresets) {
      for (const [, situations] of Object.entries(situationPresets)) {
        if (Array.isArray(situations)) {
          for (const situation of situations) {
            if (typeof situation === 'string') {
              // 상황 텍스트에서 주요 단어 추출 (예: "침대", "연습실", "차")
              const keywords = this.extractKeywords(situation);
              for (const keyword of keywords) {
                if (text.includes(keyword)) {
                  return situation;
                }
              }
            }
          }
        }
      }
    }
    return null;
  }

  /**
   * 상황 텍스트에서 키워드 추출
   */
  private extractKeywords(situation: string): string[] {
    // 괄호 이전의 핵심 단어 추출
    const mainPart = situation.split('(')[0].trim();
    // 공백 기준으로 분리하고 짧은 단어 제외
    return mainPart.split(' ').filter(word => word.length >= 2);
  }

  /**
   * 기본 시간대별 상황 (DB 없을 때 폴백)
   */
  private getDefaultSituationByTime(hour: number): string {
    if (hour < 6) return '자고 있다가 깸';
    if (hour < 12) return '아침 준비 중';
    if (hour < 14) return '오후 활동 중';
    if (hour < 18) return '저녁 준비 중';
    return '집에서 쉬는 중';
  }

  // ============================================
  // 세션 관리
  // ============================================

  /**
   * 세션 종료 및 요약 생성
   */
  async endSession(sessionId: string): Promise<{
    success: boolean;
    summary?: string;
    error?: string;
  }> {
    try {
      const session = await this.getSession(sessionId);
      if (!session) {
        return { success: false, error: 'Session not found' };
      }

      // 세션 상태 업데이트
      await this.supabase
        .from('conversation_sessions')
        .update({
          status: 'completed',
          updated_at: new Date().toISOString(),
        })
        .eq('id', sessionId);

      // 세션 요약 생성
      const summarizer = getSessionSummarizer();
      const result = await summarizer.summarizeSession(
        sessionId,
        session.userId,
        session.personaId
      );

      if (result) {
        return { success: true, summary: result.summary };
      }

      return { success: true };
    } catch (error) {
      console.error('[AIAgent] End session failed:', error);
      return { success: false, error: String(error) };
    }
  }

  /**
   * 비활성 세션 자동 종료 (크론용)
   */
  async cleanupInactiveSessions(inactiveMinutes: number = 30): Promise<number> {
    const cutoffTime = new Date(Date.now() - inactiveMinutes * 60 * 1000);

    const { data: inactiveSessions } = await this.supabase
      .from('conversation_sessions')
      .select('id')
      .eq('status', 'active')
      .lt('last_message_at', cutoffTime.toISOString());

    if (!inactiveSessions || inactiveSessions.length === 0) {
      return 0;
    }

    let closedCount = 0;
    for (const session of inactiveSessions) {
      const result = await this.endSession(session.id);
      if (result.success) closedCount++;
    }

    return closedCount;
  }

  // ============================================
  // 이벤트 트리거
  // ============================================

  async checkEventTriggers(
    userId: string,
    personaId: string,
    triggerAction?: UserActivity
  ): Promise<ScheduledEvent | null> {
    // Note: This logic assumes event_trigger_rules table exists
    const { data: rules } = await this.supabase
      .from('event_trigger_rules')
      .select('*')
      .eq('is_active', true)
      .or(`persona_id.is.null,persona_id.eq.${personaId}`);

    if (!rules || rules.length === 0) return null;

    const relationship = await this.getRelationship(userId, personaId);

    const { data: recentActivity } = await this.supabase
      .from('user_activity_log')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(20);

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

    const result = await EventTriggerEngine.evaluateTriggers(
      rules.map(this.mapRule),
      relationship,
      activities,
      lastEvents
    );

    if (result.shouldTrigger && result.event && result.rule) {
      const delay = EventScheduler.calculateNaturalDelay(1, 10, 'medium');
      const scheduledEvent = EventScheduler.scheduleDelayedEvent(
        userId,
        personaId,
        result.rule.eventType,
        result.event.eventData!,
        delay
      );

      const { data: savedEvent } = await this.supabase
        .from('scheduled_events')
        .insert(scheduledEvent)
        .select()
        .single();

      return savedEvent;
    }

    return null;
  }

  async processScheduledEvent(eventId: string): Promise<{
    delivered: boolean;
    content?: string;
    message?: string;
  }> {
    const { data: event } = await this.supabase
      .from('scheduled_events')
      .select('*')
      .eq('id', eventId)
      .single();

    if (!event || event.status !== 'pending') {
      return { delivered: false };
    }

    if (event.delivery_conditions && Object.keys(event.delivery_conditions).length > 0) {
      const canDeliver = await this.validateDeliveryConditions(
        event.delivery_conditions,
        event.user_id,
        event.persona_id
      );

      if (!canDeliver) {
        await this.supabase
          .from('scheduled_events')
          .update({
            status: 'expired',
            updated_at: new Date().toISOString()
          })
          .eq('id', eventId);

        return { delivered: false, message: 'Delivery conditions not met' };
      }
    }

    // LLM으로 메시지 생성 시에도 RAG/Context 활용
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
      const templates = eventData.fallbackTemplates || ['안녕'];
      content = templates[Math.floor(Math.random() * templates.length)];
    }

    await this.supabase.from('feed_events').insert({
      user_id: event.user_id,
      persona_id: event.persona_id,
      type: event.event_type,
      title: `${context.persona.name}님의 메시지`,
      preview: content.substring(0, 50),
    });

    await this.supabase
      .from('scheduled_events')
      .update({ status: 'delivered', delivered_at: new Date().toISOString() })
      .eq('id', eventId);

    return { delivered: true, content };
  }

  // ============================================
  // 관계 관리
  // ============================================

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

    const { data: newRel } = await this.supabase
      .from('user_persona_relationships')
      .insert({
        user_id: userId,
        persona_id: personaId,
        first_interaction_at: new Date().toISOString(),
      })
      .select()
      .single();

    return this.mapRelationship(newRel);
  }

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

    // DB에서 관계 단계 계산 (페르소나별 커스텀 설정 지원)
    const newStage = await this.calculateRelationshipStageFromDB(newAffection, personaId);

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

  /**
   * 관계 단계 계산 (DB 설정 우선, 캐시 사용)
   */
  private async calculateRelationshipStageFromDB(affection: number, personaId: string): Promise<string> {
    try {
      // DB 함수 호출로 관계 단계 계산
      const { data, error } = await this.supabase
        .rpc('calculate_relationship_stage', {
          p_affection: affection,
          p_persona_id: personaId
        });

      if (error) {
        console.error('[AIAgent] calculateRelationshipStage DB error:', error);
        return this.calculateRelationshipStage(affection);
      }

      return data || this.calculateRelationshipStage(affection);
    } catch (error) {
      console.error('[AIAgent] calculateRelationshipStage error:', error);
      return this.calculateRelationshipStage(affection);
    }
  }

  /**
   * 관계 단계 계산 (폴백 - 하드코딩)
   */
  private calculateRelationshipStage(affection: number): string {
    if (affection >= 90) return 'heart';
    if (affection >= 60) return 'close';
    if (affection >= 30) return 'friend';
    if (affection >= 10) return 'fan';
    return 'stranger';
  }

  private async validateDeliveryConditions(
    conditions: Record<string, unknown>,
    userId: string,
    personaId: string
  ): Promise<boolean> {
    const { data: relationship } = await this.supabase
      .from('user_persona_relationships')
      .select('affection, relationship_stage, story_flags')
      .eq('user_id', userId)
      .eq('persona_id', personaId)
      .single();

    if (!relationship) return false;

    if (conditions.minAffection !== undefined) {
      if (relationship.affection < (conditions.minAffection as number)) return false;
    }
    if (conditions.maxAffection !== undefined) {
      if (relationship.affection > (conditions.maxAffection as number)) return false;
    }
    if (conditions.relationshipStage) {
      const allowedStages = conditions.relationshipStage as string[];
      if (!allowedStages.includes(relationship.relationship_stage)) return false;
    }

    return true;
  }

  // ============================================
  // LLM 컨텍스트 구축 (Simpler & Faster)
  // ============================================

  private async buildLLMContext(
    userId: string,
    personaId: string,
    sessionId?: string
  ): Promise<LLMContext> {
    // 병렬 데이터 로드 (DB에서 페르소나 전체 데이터 포함)
    const [
      userResult,
      relationshipResult,
      messagesResult,
      sessionResult,
      personaDataResult,
    ] = await Promise.allSettled([
      this.supabase.from('users').select('*').eq('id', userId).single(),
      this.getRelationship(userId, personaId),
      sessionId
        ? this.supabase
            .from('conversation_messages')
            .select('*')
            .eq('session_id', sessionId)
            .order('sequence_number', { ascending: true })
            .limit(100)  // 50 → 100: 더 많은 대화 맥락 유지
        : Promise.resolve({ data: null }),
      sessionId
        ? this.supabase
            .from('conversation_sessions')
            .select('emotional_state')
            .eq('id', sessionId)
            .single()
            : Promise.resolve({ data: null }),
      getFullPersonaData(personaId),
    ]);

    // DB에서 페르소나 전체 데이터 가져오기
    const personaData = personaDataResult.status === 'fulfilled' ? personaDataResult.value : null;

    // Persona 매핑 (DB 데이터 우선, 없으면 기본값)
    const mappedPersona: Persona = {
      id: personaId,
      name: personaData?.name || 'Unknown',
      fullName: personaData?.full_name || personaData?.name || 'Unknown',
      role: personaData?.role || 'Unknown',
      age: personaData?.age || 20,
      ethnicity: personaData?.ethnicity || 'Unknown',
      appearance: {
        hair: personaData?.appearance?.hair || '',
        eyes: personaData?.appearance?.eyes || '',
        build: personaData?.appearance?.build || '',
        style: personaData?.appearance?.style || '',
        distinguishingFeatures: personaData?.appearance?.distinguishingFeatures || [],
      },
      voiceDescription: personaData?.voice_description || ''
    };

    // Traits 매핑 (DB 데이터 우선)
    const mappedTraits: PersonaTraits = {
      surfacePersonality: personaData?.core_personality?.surface || [],
      hiddenPersonality: personaData?.core_personality?.hidden || [],
      coreTrope: personaData?.core_personality?.core_trope || '',
      likes: personaData?.likes || [],
      dislikes: personaData?.dislikes || [],
      speechPatterns: {
        formality: (personaData?.speech_patterns?.formality as 'low' | 'medium' | 'high') || 'low',
        petNames: personaData?.speech_patterns?.petNames || [],
        verbalTics: personaData?.speech_patterns?.verbalTics || [],
        emotionalRange: (personaData?.speech_patterns?.emotionalRange as 'low' | 'medium' | 'high') || 'high',
      },
      behaviorByStage: this.mapBehaviorByStage(personaData?.behavior_by_stage),
    };

    // Worldview 매핑 (DB 데이터 우선)
    const mappedWorldview: PersonaWorldview = {
      settings: personaData?.worldview?.settings || [],
      timePeriod: personaData?.worldview?.timePeriod || 'Present',
      defaultRelationship: personaData?.worldview?.defaultRelationship || '',
      relationshipAlternatives: personaData?.worldview?.relationshipAlternatives || [],
      mainConflict: personaData?.worldview?.mainConflict || '',
      conflictStakes: personaData?.worldview?.conflictStakes || '',
      openingLine: personaData?.worldview?.openingLine || '',
      storyHooks: personaData?.worldview?.storyHooks || [],
      boundaries: personaData?.worldview?.boundaries || personaData?.absolute_rules || [],
    };

    const user = userResult.status === 'fulfilled' ? userResult.value.data : null;
    const relationship = relationshipResult.status === 'fulfilled'
      ? relationshipResult.value
      : await this.getRelationship(userId, personaId);

    let conversationHistory: ConversationMessage[] = [];
    if (messagesResult.status === 'fulfilled' && messagesResult.value.data) {
      conversationHistory = messagesResult.value.data.map(this.mapMessage);
    }

    let emotionalState = { personaMood: 'neutral' as PersonaMood, tensionLevel: 0, vulnerabilityShown: false };
    if (sessionResult.status === 'fulfilled' && sessionResult.value.data?.emotional_state) {
      emotionalState = sessionResult.value.data.emotional_state;
    }

    return {
      persona: mappedPersona,
      traits: mappedTraits,
      worldview: mappedWorldview,
      relationship,
      userPersona: this.mapUserPersona(user),
      conversationHistory,
      currentSituation: '',
      emotionalState,
    };
  }

  /**
   * behavior_by_stage DB 데이터를 PersonaTraits 형식으로 변환
   */
  private mapBehaviorByStage(
    dbData?: Record<string, { affection_range?: number[]; behaviors?: string[]; allowed_topics?: string[]; intimacy_level?: string; tone?: string; distance?: string }>
  ): PersonaTraits['behaviorByStage'] {
    const defaultBehavior: StageBehavior = {
      tone: 'neutral',
      distance: 'formal',
    };

    if (!dbData) {
      return {
        stranger: { ...defaultBehavior },
        fan: { ...defaultBehavior },
        friend: { ...defaultBehavior, distance: 'casual' },
        close: { ...defaultBehavior, tone: 'warm', distance: 'close' },
        heart: { ...defaultBehavior, tone: 'loving', distance: 'intimate' },
      };
    }

    const result: PersonaTraits['behaviorByStage'] = {} as PersonaTraits['behaviorByStage'];
    const stages = ['stranger', 'fan', 'friend', 'close', 'heart'] as const;

    for (const stage of stages) {
      const stageData = dbData[stage];
      result[stage] = {
        tone: stageData?.tone || defaultBehavior.tone,
        distance: stageData?.distance || defaultBehavior.distance,
        // 추가 필드들도 string으로 매핑
        intimacy: stageData?.intimacy_level || '',
      };
    }

    return result;
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

  // ============================================
  // 시나리오 관리 (Guided/Dynamic 통합)
  // ============================================

  /**
   * 시나리오 시작
   */
  async startScenario(
    mode: ScenarioMode,
    scenarioId: string,
    userId: string,
    personaId: string,
    triggerContext?: {
      affection: number;
      relationshipStage: string;
      triggeredBy?: string;
    }
  ): Promise<{
    success: boolean;
    sessionId?: string;
    openingMessage?: {
      content: string;
      emotion?: string;
      choices?: { id: string; text: string; isPremium: boolean }[];
    };
    error?: string;
  }> {
    const result = await this.scenarioManager.startScenario(
      mode,
      scenarioId,
      userId,
      personaId,
      triggerContext
    );

    if (!result.success) {
      return { success: false, error: result.error };
    }

    return {
      success: true,
      sessionId: result.session?.id,
      openingMessage: result.openingMessage
        ? {
            content: result.openingMessage.content,
            emotion: result.openingMessage.emotion,
            choices: result.openingMessage.choices?.map(c => ({
              id: c.id,
              text: c.text,
              isPremium: c.isPremium,
            })),
          }
        : undefined,
    };
  }

  /**
   * 시나리오 메시지 처리
   */
  async processScenarioMessage(
    sessionId: string,
    mode: ScenarioMode,
    userMessage: string,
    userId: string,
    personaId: string
  ): Promise<{
    success: boolean;
    message?: {
      content: string;
      emotion?: string;
      narration?: string;
      choices?: { id: string; text: string; isPremium: boolean }[];
    };
    scenarioComplete?: boolean;
    error?: string;
  }> {
    const result = await this.scenarioManager.processMessage(sessionId, mode, userMessage);

    if (!result.success) {
      return { success: false, error: result.error };
    }

    // 시나리오 완료 시 보상 처리
    if (result.sessionComplete) {
      await this.handleScenarioCompletion(sessionId, mode, userId, personaId);
    }

    return {
      success: true,
      message: result.message
        ? {
            content: result.message.content,
            emotion: result.message.emotion,
            narration: result.message.narration,
            choices: result.message.choices?.map(c => ({
              id: c.id,
              text: c.text,
              isPremium: c.isPremium,
            })),
          }
        : undefined,
      scenarioComplete: result.sessionComplete,
    };
  }

  /**
   * 활성 시나리오 세션 확인
   */
  async getActiveScenarioSession(
    userId: string,
    personaId: string
  ): Promise<{
    hasActiveSession: boolean;
    session?: {
      id: string;
      mode: ScenarioMode;
      progress: { currentStep: number; totalSteps: number; percentComplete: number };
    };
  }> {
    const session = await this.scenarioManager.getActiveSession(userId, personaId);

    if (!session) {
      return { hasActiveSession: false };
    }

    return {
      hasActiveSession: true,
      session: {
        id: session.id,
        mode: session.mode,
        progress: session.progress,
      },
    };
  }

  /**
   * 시나리오 완료 처리 (보상 등)
   */
  private async handleScenarioCompletion(
    sessionId: string,
    mode: ScenarioMode,
    userId: string,
    personaId: string
  ): Promise<void> {
    try {
      // 시나리오 완료 기록
      await this.supabase.from('scenario_completion_rewards').insert({
        user_id: userId,
        persona_id: personaId,
        scenario_session_id: sessionId,
        scenario_mode: mode,
        completed_at: new Date().toISOString(),
      });

      // 관계 업데이트 (시나리오 완료 보너스)
      await this.updateRelationship(userId, personaId, {
        affectionChange: mode === 'dynamic' ? 5 : 3, // 동적 시나리오는 더 높은 보상
        flagsToSet: { [`scenario_${sessionId}_completed`]: true },
      });

      // 활동 로그
      await this.logActivity(userId, personaId, 'scenario_completed', {
        sessionId,
        mode,
      });
    } catch (error) {
      console.error('[AIAgent] Failed to handle scenario completion:', error);
    }
  }

  /**
   * 시나리오 일시정지
   */
  async pauseScenario(sessionId: string, mode: ScenarioMode): Promise<void> {
    await this.scenarioManager.pauseSession(sessionId, mode);
  }

  /**
   * 시나리오 재개
   */
  async resumeScenario(sessionId: string, mode: ScenarioMode): Promise<{
    success: boolean;
    session?: {
      id: string;
      progress: { currentStep: number; totalSteps: number };
    };
  }> {
    const session = await this.scenarioManager.resumeSession(sessionId, mode);

    if (!session) {
      return { success: false };
    }

    return {
      success: true,
      session: {
        id: session.id,
        progress: session.progress,
      },
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
