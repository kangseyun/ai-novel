/**
 * Scenario Session Manager
 * 모든 시나리오 타입의 세션을 통합 관리하는 매니저
 *
 * 지원 시나리오 타입:
 * - static: 완전히 사전 정의된 시나리오
 * - guided: 플롯 포인트 기반 + AI 대화 생성
 * - dynamic: AI가 완전히 실시간 생성
 */

import { SupabaseClient } from '@supabase/supabase-js';
import { GuidedScenarioEngine, GuidedSession, GuidedMessage, getGuidedScenarioEngine } from './guided-scenario-engine';
import { DynamicScenarioEngine, DynamicSession, DynamicMessage, getDynamicScenarioEngine } from './dynamic-scenario-engine';

// ============================================
// 타입 정의
// ============================================

export type ScenarioMode = 'static' | 'guided' | 'dynamic';

export interface UnifiedScenarioSession {
  id: string;
  scenarioId: string;
  templateId?: string;
  userId: string;
  personaId: string;
  mode: ScenarioMode;
  state: 'active' | 'paused' | 'completed' | 'abandoned';
  progress: {
    currentStep: number;
    totalSteps: number;
    percentComplete: number;
  };
  context: {
    affection: number;
    relationshipStage: string;
  };
  startedAt: string;
  lastActivityAt: string;
}

export interface UnifiedScenarioMessage {
  id: string;
  role: 'persona' | 'user' | 'narration';
  content: string;
  emotion?: string;
  choices?: UnifiedChoice[];
  narration?: string;
  isScenarioComplete?: boolean;
}

export interface UnifiedChoice {
  id: string;
  text: string;
  tone: string;
  isPremium: boolean;
  affectionHint: number;
}

export interface ScenarioStartResult {
  success: boolean;
  session?: UnifiedScenarioSession;
  openingMessage?: UnifiedScenarioMessage;
  error?: string;
}

export interface ScenarioMessageResult {
  success: boolean;
  message?: UnifiedScenarioMessage;
  sessionComplete?: boolean;
  error?: string;
}

// ============================================
// 통합 시나리오 매니저
// ============================================

export class ScenarioSessionManager {
  private supabase: SupabaseClient;
  private guidedEngine: GuidedScenarioEngine;
  private dynamicEngine: DynamicScenarioEngine;

  constructor(supabase: SupabaseClient) {
    this.supabase = supabase;
    this.guidedEngine = getGuidedScenarioEngine(supabase);
    this.dynamicEngine = getDynamicScenarioEngine(supabase);
  }

  /**
   * 시나리오 시작 (모드에 따라 적절한 엔진 사용)
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
  ): Promise<ScenarioStartResult> {
    try {
      switch (mode) {
        case 'static':
          return this.startStaticScenario(scenarioId, userId, personaId);

        case 'guided':
          return this.startGuidedScenario(scenarioId, userId, personaId);

        case 'dynamic':
          if (!triggerContext) {
            return { success: false, error: 'Dynamic scenarios require triggerContext' };
          }
          return this.startDynamicScenario(scenarioId, userId, personaId, triggerContext);

        default:
          return { success: false, error: `Unknown scenario mode: ${mode}` };
      }
    } catch (error) {
      console.error('[ScenarioSessionManager] Error starting scenario:', error);
      return { success: false, error: String(error) };
    }
  }

  /**
   * 시나리오 메시지 처리
   */
  async processMessage(
    sessionId: string,
    mode: ScenarioMode,
    userMessage: string
  ): Promise<ScenarioMessageResult> {
    try {
      switch (mode) {
        case 'static':
          return this.processStaticMessage(sessionId, userMessage);

        case 'guided':
          return this.processGuidedMessage(sessionId, userMessage);

        case 'dynamic':
          return this.processDynamicMessage(sessionId, userMessage);

        default:
          return { success: false, error: `Unknown scenario mode: ${mode}` };
      }
    } catch (error) {
      console.error('[ScenarioSessionManager] Error processing message:', error);
      return { success: false, error: String(error) };
    }
  }

  /**
   * 활성 세션 조회
   */
  async getActiveSession(
    userId: string,
    personaId: string
  ): Promise<UnifiedScenarioSession | null> {
    // Guided 세션 체크
    const { data: guidedSession } = await this.supabase
      .from('guided_scenario_sessions')
      .select('*')
      .eq('user_id', userId)
      .eq('persona_id', personaId)
      .eq('session_state', 'active')
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (guidedSession) {
      return this.mapGuidedToUnified(guidedSession);
    }

    // Dynamic 세션 체크
    const { data: dynamicSession } = await this.supabase
      .from('dynamic_scenario_sessions')
      .select('*')
      .eq('user_id', userId)
      .eq('persona_id', personaId)
      .eq('session_state', 'active')
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (dynamicSession) {
      return this.mapDynamicToUnified(dynamicSession);
    }

    // Static 세션 체크 (기존 scenario_progress 테이블)
    const { data: staticSession } = await this.supabase
      .from('scenario_progress')
      .select('*')
      .eq('user_id', userId)
      .eq('persona_id', personaId)
      .eq('status', 'in_progress')
      .order('updated_at', { ascending: false })
      .limit(1)
      .single();

    if (staticSession) {
      return this.mapStaticToUnified(staticSession);
    }

    return null;
  }

  /**
   * 세션 일시정지
   */
  async pauseSession(sessionId: string, mode: ScenarioMode): Promise<void> {
    switch (mode) {
      case 'guided':
        await this.guidedEngine.pauseSession(sessionId);
        break;
      case 'dynamic':
        await this.dynamicEngine.pauseSession(sessionId);
        break;
      case 'static':
        await this.supabase
          .from('scenario_progress')
          .update({ status: 'paused' })
          .eq('id', sessionId);
        break;
    }
  }

  /**
   * 세션 재개
   */
  async resumeSession(sessionId: string, mode: ScenarioMode): Promise<UnifiedScenarioSession | null> {
    switch (mode) {
      case 'guided': {
        const session = await this.guidedEngine.resumeSession(sessionId);
        if (session) {
          return this.mapGuidedSessionToUnified(session);
        }
        break;
      }
      case 'dynamic': {
        const session = await this.dynamicEngine.resumeSession(sessionId);
        if (session) {
          return this.mapDynamicSessionToUnified(session);
        }
        break;
      }
      case 'static': {
        const { data } = await this.supabase
          .from('scenario_progress')
          .update({ status: 'in_progress' })
          .eq('id', sessionId)
          .select()
          .single();
        if (data) {
          return this.mapStaticToUnified(data);
        }
        break;
      }
    }
    return null;
  }

  /**
   * 세션 완료
   */
  async completeSession(sessionId: string, mode: ScenarioMode, reason?: string): Promise<void> {
    switch (mode) {
      case 'guided':
        await this.guidedEngine.completeSession(sessionId);
        break;
      case 'dynamic':
        await this.dynamicEngine.completeSession(sessionId, reason);
        break;
      case 'static':
        await this.supabase
          .from('scenario_progress')
          .update({ status: 'completed', completed_at: new Date().toISOString() })
          .eq('id', sessionId);
        break;
    }
  }

  // ============================================
  // Static 시나리오 처리
  // ============================================

  private async startStaticScenario(
    scenarioId: string,
    userId: string,
    personaId: string
  ): Promise<ScenarioStartResult> {
    // 시나리오 로드
    const { data: scenario, error } = await this.supabase
      .from('scenario_templates')
      .select('*')
      .eq('id', scenarioId)
      .single();

    if (error || !scenario) {
      return { success: false, error: 'Scenario not found' };
    }

    // 진행 상태 생성
    const { data: progress, error: progressError } = await this.supabase
      .from('scenario_progress')
      .insert({
        user_id: userId,
        persona_id: personaId,
        scenario_id: scenarioId,
        current_scene_index: 0,
        status: 'in_progress',
      })
      .select()
      .single();

    if (progressError) {
      return { success: false, error: 'Failed to create progress' };
    }

    // 첫 번째 씬 로드
    const scenes = scenario.content?.scenes || [];
    const firstScene = scenes[0];

    if (!firstScene) {
      return { success: false, error: 'No scenes in scenario' };
    }

    const session = this.mapStaticToUnified({
      ...progress,
      total_scenes: scenes.length,
    });

    const openingMessage: UnifiedScenarioMessage = {
      id: `msg-${Date.now()}`,
      role: firstScene.content?.speaker === 'user' ? 'user' : 'persona',
      content: firstScene.content?.text || '',
      emotion: firstScene.content?.emotion,
      narration: firstScene.narration,
      choices: firstScene.choices?.map((c: {
        id: string;
        text: string;
        next_scene_id: string;
        affection_change?: number;
        is_premium?: boolean;
      }) => ({
        id: c.id,
        text: c.text,
        tone: 'neutral',
        isPremium: c.is_premium || false,
        affectionHint: c.affection_change || 0,
      })),
    };

    return { success: true, session, openingMessage };
  }

  private async processStaticMessage(
    sessionId: string,
    userMessage: string
  ): Promise<ScenarioMessageResult> {
    // 현재 진행 상태 로드
    const { data: progress } = await this.supabase
      .from('scenario_progress')
      .select('*, scenario_templates(*)')
      .eq('id', sessionId)
      .single();

    if (!progress) {
      return { success: false, error: 'Progress not found' };
    }

    const scenarios = progress.scenario_templates;
    const scenes = scenarios?.content?.scenes || [];
    const currentIndex = progress.current_scene_index;

    // 선택지 매칭
    const currentScene = scenes[currentIndex];
    const selectedChoice = currentScene?.choices?.find(
      (c: { id: string; text: string }) => c.text === userMessage || c.id === userMessage
    );

    // 다음 씬 결정
    let nextIndex = currentIndex + 1;
    if (selectedChoice?.next_scene_id) {
      nextIndex = scenes.findIndex((s: { id: string }) => s.id === selectedChoice.next_scene_id);
      if (nextIndex === -1) nextIndex = currentIndex + 1;
    }

    // 시나리오 완료 체크
    if (nextIndex >= scenes.length) {
      await this.supabase
        .from('scenario_progress')
        .update({
          status: 'completed',
          completed_at: new Date().toISOString(),
        })
        .eq('id', sessionId);

      return {
        success: true,
        message: {
          id: `msg-${Date.now()}`,
          role: 'narration',
          content: '시나리오가 완료되었습니다.',
          isScenarioComplete: true,
        },
        sessionComplete: true,
      };
    }

    // 다음 씬 로드
    const nextScene = scenes[nextIndex];

    // 진행 상태 업데이트
    await this.supabase
      .from('scenario_progress')
      .update({
        current_scene_index: nextIndex,
        updated_at: new Date().toISOString(),
      })
      .eq('id', sessionId);

    const message: UnifiedScenarioMessage = {
      id: `msg-${Date.now()}`,
      role: nextScene.content?.speaker === 'user' ? 'user' : 'persona',
      content: nextScene.content?.text || '',
      emotion: nextScene.content?.emotion,
      narration: nextScene.narration,
      choices: nextScene.choices?.map((c: {
        id: string;
        text: string;
        is_premium?: boolean;
        affection_change?: number;
      }) => ({
        id: c.id,
        text: c.text,
        tone: 'neutral',
        isPremium: c.is_premium || false,
        affectionHint: c.affection_change || 0,
      })),
    };

    return { success: true, message };
  }

  // ============================================
  // Guided 시나리오 처리
  // ============================================

  private async startGuidedScenario(
    scenarioId: string,
    userId: string,
    personaId: string
  ): Promise<ScenarioStartResult> {
    const session = await this.guidedEngine.initializeSession(scenarioId, userId, personaId);

    if (!session) {
      return { success: false, error: 'Failed to initialize guided session' };
    }

    // 첫 번째 플롯 포인트 기반 오프닝 생성
    const result = await this.guidedEngine.generateNextExchange(session.id, '(시나리오 시작)');

    if (!result) {
      return { success: false, error: 'Failed to generate opening' };
    }

    return {
      success: true,
      session: this.mapGuidedSessionToUnified(session),
      openingMessage: this.mapGuidedMessageToUnified(result.message),
    };
  }

  private async processGuidedMessage(
    sessionId: string,
    userMessage: string
  ): Promise<ScenarioMessageResult> {
    const result = await this.guidedEngine.generateNextExchange(sessionId, userMessage);

    if (!result) {
      return { success: false, error: 'Failed to generate response' };
    }

    return {
      success: true,
      message: this.mapGuidedMessageToUnified(result.message, result.scenarioComplete),
      sessionComplete: result.scenarioComplete,
    };
  }

  // ============================================
  // Dynamic 시나리오 처리
  // ============================================

  private async startDynamicScenario(
    templateId: string,
    userId: string,
    personaId: string,
    triggerContext: {
      affection: number;
      relationshipStage: string;
      triggeredBy?: string;
    }
  ): Promise<ScenarioStartResult> {
    const session = await this.dynamicEngine.initializeSession(
      templateId,
      userId,
      personaId,
      {
        ...triggerContext,
        triggeredBy: triggerContext.triggeredBy || 'manual',
      }
    );

    if (!session) {
      return { success: false, error: 'Failed to initialize dynamic session' };
    }

    // 오프닝 메시지 생성
    const openingMessage = await this.dynamicEngine.generateOpeningMessage(session.id);

    if (!openingMessage) {
      return { success: false, error: 'Failed to generate opening message' };
    }

    return {
      success: true,
      session: this.mapDynamicSessionToUnified(session),
      openingMessage: this.mapDynamicMessageToUnified(openingMessage),
    };
  }

  private async processDynamicMessage(
    sessionId: string,
    userMessage: string
  ): Promise<ScenarioMessageResult> {
    const result = await this.dynamicEngine.generateNextMessage(sessionId, userMessage);

    if (!result) {
      return { success: false, error: 'Failed to generate response' };
    }

    return {
      success: true,
      message: this.mapDynamicMessageToUnified(result.message, !result.shouldContinue),
      sessionComplete: !result.shouldContinue,
    };
  }

  // ============================================
  // 매핑 헬퍼
  // ============================================

  private mapStaticToUnified(data: Record<string, unknown>): UnifiedScenarioSession {
    const totalScenes = (data.total_scenes as number) || 1;
    const currentIndex = (data.current_scene_index as number) || 0;

    return {
      id: data.id as string,
      scenarioId: data.scenario_id as string,
      userId: data.user_id as string,
      personaId: data.persona_id as string,
      mode: 'static',
      state: this.mapStatus(data.status as string),
      progress: {
        currentStep: currentIndex + 1,
        totalSteps: totalScenes,
        percentComplete: Math.round((currentIndex / totalScenes) * 100),
      },
      context: {
        affection: 0,
        relationshipStage: 'unknown',
      },
      startedAt: data.created_at as string,
      lastActivityAt: data.updated_at as string,
    };
  }

  private mapGuidedToUnified(data: Record<string, unknown>): UnifiedScenarioSession {
    const plotProgress = (data.plot_progress as { status: string }[]) || [];
    const totalPlots = plotProgress.length;
    const completedPlots = plotProgress.filter(p => p.status === 'completed').length;

    return {
      id: data.id as string,
      scenarioId: data.scenario_id as string,
      userId: data.user_id as string,
      personaId: data.persona_id as string,
      mode: 'guided',
      state: this.mapStatus(data.session_state as string),
      progress: {
        currentStep: (data.current_plot_index as number) + 1,
        totalSteps: totalPlots,
        percentComplete: totalPlots > 0 ? Math.round((completedPlots / totalPlots) * 100) : 0,
      },
      context: {
        affection: ((data.context as { affection?: number })?.affection) || 0,
        relationshipStage: ((data.context as { relationshipStage?: string })?.relationshipStage) || 'stranger',
      },
      startedAt: data.created_at as string,
      lastActivityAt: data.last_activity_at as string,
    };
  }

  private mapDynamicToUnified(data: Record<string, unknown>): UnifiedScenarioSession {
    return {
      id: data.id as string,
      scenarioId: '',
      templateId: data.template_id as string,
      userId: data.user_id as string,
      personaId: data.persona_id as string,
      mode: 'dynamic',
      state: this.mapStatus(data.session_state as string),
      progress: {
        currentStep: (data.turn_count as number) || 0,
        totalSteps: 10, // Dynamic은 max_turns 기준
        percentComplete: Math.round(((data.turn_count as number) / 10) * 100),
      },
      context: {
        affection: ((data.context as { affection?: number })?.affection) || 0,
        relationshipStage: ((data.context as { relationshipStage?: string })?.relationshipStage) || 'stranger',
      },
      startedAt: data.created_at as string,
      lastActivityAt: data.last_activity_at as string,
    };
  }

  private mapGuidedSessionToUnified(session: GuidedSession): UnifiedScenarioSession {
    const completedPlots = session.plotProgress.filter(p => p.status === 'completed').length;

    return {
      id: session.id,
      scenarioId: session.scenarioId,
      userId: session.userId,
      personaId: session.personaId,
      mode: 'guided',
      state: session.sessionState,
      progress: {
        currentStep: session.currentPlotIndex + 1,
        totalSteps: session.plotProgress.length,
        percentComplete: session.plotProgress.length > 0
          ? Math.round((completedPlots / session.plotProgress.length) * 100)
          : 0,
      },
      context: {
        affection: session.context.affection,
        relationshipStage: session.context.relationshipStage,
      },
      startedAt: session.startedAt,
      lastActivityAt: session.lastActivityAt,
    };
  }

  private mapDynamicSessionToUnified(session: DynamicSession): UnifiedScenarioSession {
    return {
      id: session.id,
      scenarioId: '',
      templateId: session.templateId,
      userId: session.userId,
      personaId: session.personaId,
      mode: 'dynamic',
      state: session.sessionState,
      progress: {
        currentStep: session.turnCount,
        totalSteps: 10,
        percentComplete: Math.round((session.turnCount / 10) * 100),
      },
      context: {
        affection: session.context.affection,
        relationshipStage: session.context.relationshipStage,
      },
      startedAt: session.startedAt,
      lastActivityAt: session.lastActivityAt,
    };
  }

  private mapGuidedMessageToUnified(message: GuidedMessage, isComplete?: boolean): UnifiedScenarioMessage {
    return {
      id: message.id,
      role: message.role,
      content: message.content,
      emotion: message.emotion,
      choices: message.choices?.map(c => ({
        id: c.id,
        text: c.text,
        tone: c.tone,
        isPremium: c.isPremium,
        affectionHint: c.affectionHint,
      })),
      isScenarioComplete: isComplete,
    };
  }

  private mapDynamicMessageToUnified(message: DynamicMessage, isComplete?: boolean): UnifiedScenarioMessage {
    return {
      id: message.id,
      role: message.role,
      content: message.content,
      emotion: message.emotion,
      narration: message.narration,
      choices: message.choices?.map(c => ({
        id: c.id,
        text: c.text,
        tone: c.tone,
        isPremium: c.isPremium,
        affectionHint: c.affectionHint,
      })),
      isScenarioComplete: isComplete,
    };
  }

  private mapStatus(status: string): 'active' | 'paused' | 'completed' | 'abandoned' {
    switch (status) {
      case 'active':
      case 'in_progress':
        return 'active';
      case 'paused':
        return 'paused';
      case 'completed':
        return 'completed';
      case 'abandoned':
        return 'abandoned';
      default:
        return 'active';
    }
  }
}

// 싱글톤 인스턴스
let sessionManagerInstance: ScenarioSessionManager | null = null;

export function getScenarioSessionManager(supabase: SupabaseClient): ScenarioSessionManager {
  if (!sessionManagerInstance) {
    sessionManagerInstance = new ScenarioSessionManager(supabase);
  }
  return sessionManagerInstance;
}
