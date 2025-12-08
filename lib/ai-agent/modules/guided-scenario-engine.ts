/**
 * Guided Scenario Engine
 * 플롯 포인트 기반의 가이드 시나리오 실행 엔진
 *
 * 특징:
 * - 플롯 구조는 사전 정의, 대사는 AI가 실시간 생성
 * - 각 플롯 포인트에서 AI가 상황에 맞는 대화 생성
 * - 유저 선택에 따라 플롯 진행 조절
 */

import { SupabaseClient } from '@supabase/supabase-js';
import { LLMClient } from '../core/llm-client';

// ============================================
// 타입 정의
// ============================================

export interface GuidedPlotPoint {
  id: string;
  plotPointNumber: number;
  plotType: 'opening' | 'rising_action' | 'climax' | 'falling_action' | 'resolution';
  description: string;
  emotionalBeat: string;
  speakerGuidance: string;
  userChoiceGuidance?: string;
  transitionHint?: string;
  minExchanges?: number;
  maxExchanges?: number;
}

export interface GuidedSession {
  id: string;
  scenarioId: string;
  userId: string;
  personaId: string;
  currentPlotIndex: number;
  currentExchangeCount: number;
  sessionState: 'active' | 'paused' | 'completed' | 'abandoned';
  plotProgress: PlotProgress[];
  context: {
    affection: number;
    relationshipStage: string;
    sessionMemory: string[];
  };
  startedAt: string;
  lastActivityAt: string;
}

export interface PlotProgress {
  plotPointId: string;
  status: 'pending' | 'in_progress' | 'completed' | 'skipped';
  exchangeCount: number;
  userChoices: string[];
  emotionalOutcome?: string;
}

export interface GuidedMessage {
  id: string;
  role: 'persona' | 'user' | 'narration';
  content: string;
  emotion?: string;
  plotPointId: string;
  choices?: GuidedChoice[];
}

export interface GuidedChoice {
  id: string;
  text: string;
  tone: 'friendly' | 'romantic' | 'neutral' | 'playful' | 'serious';
  isPremium: boolean;
  affectionHint: number;
  advancesPlot: boolean;
}

export interface GenerationResult {
  message: GuidedMessage;
  shouldAdvancePlot: boolean;
  plotComplete: boolean;
  scenarioComplete: boolean;
}

// ============================================
// 프롬프트 템플릿
// ============================================

const GUIDED_GENERATION_SYSTEM_PROMPT = `You are generating dialogue for an interactive character scenario.
Your task is to generate natural, emotionally engaging dialogue that fits the current plot point.

# Rules
1. Stay true to the character's personality and speech patterns
2. Follow the emotional beat specified for this plot point
3. Generate dialogue that naturally progresses the plot
4. Respond in Korean (한국어)
5. Keep responses concise (2-4 sentences)
6. Include appropriate emotion tags

Output JSON format:
{
  "content": "캐릭터의 대사",
  "emotion": "현재 감정",
  "innerThought": "내면의 생각 (선택적)",
  "suggestedChoices": [
    { "text": "선택지", "tone": "friendly|romantic|neutral|playful|serious", "affectionHint": 5, "advancesPlot": false }
  ],
  "shouldAdvancePlot": false
}`;

const GUIDED_GENERATION_USER_PROMPT = `# Character
Name: {{personaName}}
Personality: {{personality}}
Speech Style: {{speechStyle}}

# Current Plot Point
Type: {{plotType}}
Description: {{plotDescription}}
Emotional Beat: {{emotionalBeat}}
Speaker Guidance: {{speakerGuidance}}
{{#if userChoiceGuidance}}User Choice Guidance: {{userChoiceGuidance}}{{/if}}

# Context
Relationship Stage: {{relationshipStage}}
Affection Level: {{affection}}
Exchange Count: {{exchangeCount}} / {{maxExchanges}}
Session Memory: {{sessionMemory}}

# User's Last Message
{{userMessage}}

Generate the character's response that fits this plot point.`;

// ============================================
// 엔진 구현
// ============================================

export class GuidedScenarioEngine {
  private supabase: SupabaseClient;
  private llmClient: LLMClient;

  constructor(supabase: SupabaseClient, llmClient?: LLMClient) {
    this.supabase = supabase;
    this.llmClient = llmClient || new LLMClient();
  }

  /**
   * 가이드 시나리오 세션 시작
   */
  async initializeSession(
    scenarioId: string,
    userId: string,
    personaId: string
  ): Promise<GuidedSession | null> {
    try {
      // 플롯 포인트 로드
      const { data: plotPoints, error: plotError } = await this.supabase
        .from('guided_scenario_plots')
        .select('*')
        .eq('scenario_id', scenarioId)
        .order('plot_point_number');

      if (plotError || !plotPoints || plotPoints.length === 0) {
        console.error('Failed to load plot points:', plotError);
        return null;
      }

      // 관계 상태 조회
      const { data: relationship } = await this.supabase
        .from('user_persona_relationships')
        .select('affection, relationship_stage')
        .eq('user_id', userId)
        .eq('persona_id', personaId)
        .single();

      // 세션 생성
      const sessionData = {
        scenario_id: scenarioId,
        user_id: userId,
        persona_id: personaId,
        current_plot_index: 0,
        current_exchange_count: 0,
        session_state: 'active',
        plot_progress: plotPoints.map(pp => ({
          plotPointId: pp.id,
          status: 'pending',
          exchangeCount: 0,
          userChoices: [],
        })),
        context: {
          affection: relationship?.affection || 0,
          relationshipStage: relationship?.relationship_stage || 'stranger',
          sessionMemory: [],
        },
      };

      const { data: session, error: sessionError } = await this.supabase
        .from('guided_scenario_sessions')
        .insert(sessionData)
        .select()
        .single();

      if (sessionError) {
        console.error('Failed to create session:', sessionError);
        return null;
      }

      return this.mapSessionFromDb(session);
    } catch (error) {
      console.error('Error initializing guided session:', error);
      return null;
    }
  }

  /**
   * 세션 조회
   */
  async getSession(sessionId: string): Promise<GuidedSession | null> {
    const { data, error } = await this.supabase
      .from('guided_scenario_sessions')
      .select('*')
      .eq('id', sessionId)
      .single();

    if (error || !data) return null;
    return this.mapSessionFromDb(data);
  }

  /**
   * 다음 대화 생성
   */
  async generateNextExchange(
    sessionId: string,
    userMessage: string
  ): Promise<GenerationResult | null> {
    try {
      // 세션 로드
      const session = await this.getSession(sessionId);
      if (!session || session.sessionState !== 'active') {
        return null;
      }

      // 현재 플롯 포인트 로드
      const { data: plotPoints } = await this.supabase
        .from('guided_scenario_plots')
        .select('*')
        .eq('scenario_id', session.scenarioId)
        .order('plot_point_number');

      if (!plotPoints || session.currentPlotIndex >= plotPoints.length) {
        // 시나리오 완료
        await this.completeSession(sessionId);
        return {
          message: {
            id: `msg-${Date.now()}`,
            role: 'narration',
            content: '시나리오가 완료되었습니다.',
            plotPointId: 'end',
          },
          shouldAdvancePlot: false,
          plotComplete: true,
          scenarioComplete: true,
        };
      }

      const currentPlot = plotPoints[session.currentPlotIndex];
      const plotPoint = this.mapPlotPointFromDb(currentPlot);

      // 페르소나 정보 로드
      const { data: persona } = await this.supabase
        .from('persona_core')
        .select(`
          name,
          persona_personalities (personality),
          persona_speech_styles (speech_style)
        `)
        .eq('id', session.personaId)
        .single();

      // LLM 프롬프트 생성
      const prompt = this.buildGenerationPrompt(
        plotPoint,
        session,
        userMessage,
        persona
      );

      // LLM 호출
      const response = await this.callLLMForDialogue(prompt);

      // 응답 파싱
      const parsedResponse = this.parseGenerationResponse(response);

      // 세션 상태 업데이트
      const newExchangeCount = session.currentExchangeCount + 1;
      const maxExchanges = plotPoint.maxExchanges || 5;
      const shouldAdvance = parsedResponse.shouldAdvancePlot ||
        newExchangeCount >= maxExchanges;

      await this.updateSessionProgress(
        sessionId,
        session.currentPlotIndex,
        newExchangeCount,
        userMessage,
        shouldAdvance
      );

      // 메모리에 대화 추가
      await this.addToSessionMemory(sessionId, userMessage, parsedResponse.content);

      // 메시지 생성
      const message: GuidedMessage = {
        id: `msg-${Date.now()}`,
        role: 'persona',
        content: parsedResponse.content,
        emotion: parsedResponse.emotion,
        plotPointId: plotPoint.id,
        choices: parsedResponse.suggestedChoices?.map((c: {
          text: string;
          tone: string;
          affectionHint: number;
          advancesPlot: boolean;
        }) => ({
          id: `choice-${Date.now()}-${Math.random().toString(36).slice(2)}`,
          text: c.text,
          tone: c.tone as GuidedChoice['tone'],
          isPremium: false,
          affectionHint: c.affectionHint || 0,
          advancesPlot: c.advancesPlot || false,
        })),
      };

      const isLastPlot = session.currentPlotIndex >= plotPoints.length - 1;

      return {
        message,
        shouldAdvancePlot: shouldAdvance,
        plotComplete: shouldAdvance,
        scenarioComplete: shouldAdvance && isLastPlot,
      };
    } catch (error) {
      console.error('Error generating exchange:', error);
      return null;
    }
  }

  /**
   * 플롯 진행 상태 평가
   */
  evaluatePlotProgress(session: GuidedSession): {
    currentPlot: number;
    totalPlots: number;
    percentComplete: number;
    currentPlotStatus: string;
  } {
    const completedPlots = session.plotProgress.filter(
      p => p.status === 'completed'
    ).length;

    return {
      currentPlot: session.currentPlotIndex + 1,
      totalPlots: session.plotProgress.length,
      percentComplete: Math.round((completedPlots / session.plotProgress.length) * 100),
      currentPlotStatus: session.plotProgress[session.currentPlotIndex]?.status || 'unknown',
    };
  }

  /**
   * 세션 완료 처리
   */
  async completeSession(sessionId: string): Promise<void> {
    await this.supabase
      .from('guided_scenario_sessions')
      .update({
        session_state: 'completed',
        completed_at: new Date().toISOString(),
      })
      .eq('id', sessionId);
  }

  /**
   * 세션 일시정지
   */
  async pauseSession(sessionId: string): Promise<void> {
    await this.supabase
      .from('guided_scenario_sessions')
      .update({
        session_state: 'paused',
        last_activity_at: new Date().toISOString(),
      })
      .eq('id', sessionId);
  }

  /**
   * 세션 재개
   */
  async resumeSession(sessionId: string): Promise<GuidedSession | null> {
    const { data, error } = await this.supabase
      .from('guided_scenario_sessions')
      .update({
        session_state: 'active',
        last_activity_at: new Date().toISOString(),
      })
      .eq('id', sessionId)
      .select()
      .single();

    if (error || !data) return null;
    return this.mapSessionFromDb(data);
  }

  // ============================================
  // Private Helper Methods
  // ============================================

  private mapSessionFromDb(data: Record<string, unknown>): GuidedSession {
    return {
      id: data.id as string,
      scenarioId: data.scenario_id as string,
      userId: data.user_id as string,
      personaId: data.persona_id as string,
      currentPlotIndex: data.current_plot_index as number,
      currentExchangeCount: data.current_exchange_count as number,
      sessionState: data.session_state as GuidedSession['sessionState'],
      plotProgress: (data.plot_progress as PlotProgress[]) || [],
      context: (data.context as GuidedSession['context']) || {
        affection: 0,
        relationshipStage: 'stranger',
        sessionMemory: [],
      },
      startedAt: data.created_at as string,
      lastActivityAt: data.last_activity_at as string,
    };
  }

  private mapPlotPointFromDb(data: Record<string, unknown>): GuidedPlotPoint {
    return {
      id: data.id as string,
      plotPointNumber: data.plot_point_number as number,
      plotType: data.plot_type as GuidedPlotPoint['plotType'],
      description: data.description as string,
      emotionalBeat: data.emotional_beat as string,
      speakerGuidance: data.speaker_guidance as string,
      userChoiceGuidance: data.user_choice_guidance as string | undefined,
      transitionHint: data.transition_hint as string | undefined,
      minExchanges: data.min_exchanges as number | undefined,
      maxExchanges: data.max_exchanges as number | undefined,
    };
  }

  private buildGenerationPrompt(
    plotPoint: GuidedPlotPoint,
    session: GuidedSession,
    userMessage: string,
    persona: Record<string, unknown> | null
  ): string {
    const personality = (persona?.persona_personalities as { personality: Record<string, unknown> }[])?.[0]?.personality || {};
    const speechStyle = (persona?.persona_speech_styles as { speech_style: Record<string, unknown> }[])?.[0]?.speech_style || {};

    return GUIDED_GENERATION_USER_PROMPT
      .replace('{{personaName}}', (persona?.name as string) || 'Character')
      .replace('{{personality}}', JSON.stringify(personality))
      .replace('{{speechStyle}}', JSON.stringify(speechStyle))
      .replace('{{plotType}}', plotPoint.plotType)
      .replace('{{plotDescription}}', plotPoint.description)
      .replace('{{emotionalBeat}}', plotPoint.emotionalBeat)
      .replace('{{speakerGuidance}}', plotPoint.speakerGuidance)
      .replace('{{#if userChoiceGuidance}}User Choice Guidance: {{userChoiceGuidance}}{{/if}}',
        plotPoint.userChoiceGuidance ? `User Choice Guidance: ${plotPoint.userChoiceGuidance}` : '')
      .replace('{{relationshipStage}}', session.context.relationshipStage)
      .replace('{{affection}}', String(session.context.affection))
      .replace('{{exchangeCount}}', String(session.currentExchangeCount))
      .replace('{{maxExchanges}}', String(plotPoint.maxExchanges || 5))
      .replace('{{sessionMemory}}', session.context.sessionMemory.slice(-5).join(' | '))
      .replace('{{userMessage}}', userMessage);
  }

  private async callLLMForDialogue(prompt: string): Promise<string> {
    const messages = [
      { role: 'system' as const, content: GUIDED_GENERATION_SYSTEM_PROMPT },
      { role: 'user' as const, content: prompt },
    ];

    const response = await (this.llmClient as unknown as {
      callLLM: (
        messages: { role: 'system' | 'user' | 'assistant'; content: string }[],
        options?: { temperature?: number; maxTokens?: number }
      ) => Promise<{ content: string }>;
    }).callLLM(messages, {
      temperature: 0.7,
      maxTokens: 500,
    });

    return response.content;
  }

  private parseGenerationResponse(response: string): {
    content: string;
    emotion: string;
    innerThought?: string;
    suggestedChoices?: { text: string; tone: string; affectionHint: number; advancesPlot: boolean }[];
    shouldAdvancePlot: boolean;
  } {
    try {
      const parsed = JSON.parse(response);
      return {
        content: parsed.content || response,
        emotion: parsed.emotion || 'neutral',
        innerThought: parsed.innerThought,
        suggestedChoices: parsed.suggestedChoices,
        shouldAdvancePlot: parsed.shouldAdvancePlot || false,
      };
    } catch {
      return {
        content: response,
        emotion: 'neutral',
        shouldAdvancePlot: false,
      };
    }
  }

  private async updateSessionProgress(
    sessionId: string,
    currentPlotIndex: number,
    newExchangeCount: number,
    userMessage: string,
    shouldAdvance: boolean
  ): Promise<void> {
    const session = await this.getSession(sessionId);
    if (!session) return;

    const updatedProgress = [...session.plotProgress];
    if (updatedProgress[currentPlotIndex]) {
      updatedProgress[currentPlotIndex].exchangeCount = newExchangeCount;
      updatedProgress[currentPlotIndex].userChoices.push(userMessage);
      if (shouldAdvance) {
        updatedProgress[currentPlotIndex].status = 'completed';
        if (updatedProgress[currentPlotIndex + 1]) {
          updatedProgress[currentPlotIndex + 1].status = 'in_progress';
        }
      } else {
        updatedProgress[currentPlotIndex].status = 'in_progress';
      }
    }

    await this.supabase
      .from('guided_scenario_sessions')
      .update({
        current_plot_index: shouldAdvance ? currentPlotIndex + 1 : currentPlotIndex,
        current_exchange_count: shouldAdvance ? 0 : newExchangeCount,
        plot_progress: updatedProgress,
        last_activity_at: new Date().toISOString(),
      })
      .eq('id', sessionId);
  }

  private async addToSessionMemory(
    sessionId: string,
    userMessage: string,
    personaResponse: string
  ): Promise<void> {
    const session = await this.getSession(sessionId);
    if (!session) return;

    const newMemory = [
      ...session.context.sessionMemory,
      `User: ${userMessage.slice(0, 50)}`,
      `Persona: ${personaResponse.slice(0, 50)}`,
    ].slice(-10); // 최근 10개만 유지

    await this.supabase
      .from('guided_scenario_sessions')
      .update({
        context: {
          ...session.context,
          sessionMemory: newMemory,
        },
      })
      .eq('id', sessionId);
  }
}

// 싱글톤 인스턴스
let guidedEngineInstance: GuidedScenarioEngine | null = null;

export function getGuidedScenarioEngine(supabase: SupabaseClient): GuidedScenarioEngine {
  if (!guidedEngineInstance) {
    guidedEngineInstance = new GuidedScenarioEngine(supabase);
  }
  return guidedEngineInstance;
}
