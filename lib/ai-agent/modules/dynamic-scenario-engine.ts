/**
 * Dynamic Scenario Engine
 * 완전히 AI가 실시간으로 생성하는 동적 시나리오 엔진
 *
 * 특징:
 * - 트리거 조건에 따라 시나리오 시작
 * - AI가 상황, 대사, 선택지를 모두 실시간 생성
 * - 가드레일을 통한 품질/안전성 보장
 * - 자연스러운 종료 지점 판단
 */

import { SupabaseClient } from '@supabase/supabase-js';
import { LLMClient } from '../core/llm-client';

// ============================================
// 타입 정의
// ============================================

export interface DynamicTemplate {
  id: string;
  name: string;
  description: string;
  personaId: string;
  triggerConditions: Record<string, unknown>;
  generationPrompt: string;
  blockedTopics: string[];
  requiredElements: string[];
  maxTurns: number;
  emotionalGuardrails: string[];
  fallbackResponses: string[];
  isActive: boolean;
}

export interface DynamicSession {
  id: string;
  templateId: string;
  userId: string;
  personaId: string;
  turnCount: number;
  sessionState: 'active' | 'paused' | 'completed' | 'abandoned';
  currentNarrative: {
    situation: string;
    emotionalTone: string;
    storyDirection: string;
  };
  conversationHistory: {
    role: 'persona' | 'user' | 'narration';
    content: string;
    emotion?: string;
  }[];
  context: {
    affection: number;
    relationshipStage: string;
    triggeredBy: string;
    sessionMemory: string[];
  };
  guardrailViolations: number;
  startedAt: string;
  lastActivityAt: string;
}

export interface DynamicMessage {
  id: string;
  role: 'persona' | 'user' | 'narration';
  content: string;
  emotion?: string;
  choices?: DynamicChoice[];
  narration?: string;
}

export interface DynamicChoice {
  id: string;
  text: string;
  tone: 'friendly' | 'romantic' | 'neutral' | 'playful' | 'serious';
  isPremium: boolean;
  affectionHint: number;
}

export interface DynamicGenerationResult {
  message: DynamicMessage;
  shouldContinue: boolean;
  suggestedEndReason?: string;
  turnCount: number;
  maxTurns: number;
}

// ============================================
// 프롬프트 템플릿
// ============================================

const DYNAMIC_SYSTEM_PROMPT = `You are generating a fully dynamic, AI-driven scenario for an interactive character experience.
Your task is to create engaging, contextually appropriate content in real-time.

# Core Rules
1. Stay true to the character's personality and established traits
2. Generate natural, emotionally resonant dialogue in Korean (한국어)
3. Create meaningful choices that affect the story direction
4. Respect all guardrails and blocked topics
5. Monitor for natural story conclusion points
6. Keep individual responses concise (2-4 sentences)

# Guardrails
{{guardrails}}

# Blocked Topics (NEVER include)
{{blockedTopics}}

# Required Story Elements (try to include naturally)
{{requiredElements}}

# Output JSON format:
{
  "narration": "상황 설명 (선택적)",
  "content": "캐릭터의 대사",
  "emotion": "현재 감정",
  "innerThought": "내면의 생각 (선택적)",
  "choices": [
    { "text": "선택지", "tone": "friendly|romantic|neutral|playful|serious", "affectionHint": 5, "isPremium": false }
  ],
  "storyDirection": "현재 스토리가 향하는 방향",
  "shouldContinue": true,
  "suggestedEndReason": "종료 이유 (shouldContinue가 false일 때)"
}`;

const DYNAMIC_USER_PROMPT = `# Character
Name: {{personaName}}
Personality: {{personality}}
Speech Style: {{speechStyle}}

# Scenario Context
Template: {{templateName}}
Description: {{templateDescription}}
Generation Prompt: {{generationPrompt}}

# Current State
Turn: {{turnCount}} / {{maxTurns}}
Relationship Stage: {{relationshipStage}}
Affection: {{affection}}
Emotional Tone: {{emotionalTone}}
Story Direction: {{storyDirection}}

# Conversation So Far
{{conversationHistory}}

# User's Message
{{userMessage}}

Generate the next part of this dynamic scenario.`;

// ============================================
// 엔진 구현
// ============================================

export class DynamicScenarioEngine {
  private supabase: SupabaseClient;
  private llmClient: LLMClient;

  constructor(supabase: SupabaseClient, llmClient?: LLMClient) {
    this.supabase = supabase;
    this.llmClient = llmClient || new LLMClient();
  }

  /**
   * 동적 시나리오 세션 시작
   */
  async initializeSession(
    templateId: string,
    userId: string,
    personaId: string,
    triggerContext: {
      affection: number;
      relationshipStage: string;
      triggeredBy: string;
    }
  ): Promise<DynamicSession | null> {
    try {
      // 템플릿 로드
      const { data: template, error: templateError } = await this.supabase
        .from('dynamic_scenario_templates')
        .select('*')
        .eq('id', templateId)
        .single();

      if (templateError || !template) {
        console.error('Failed to load dynamic template:', templateError);
        return null;
      }

      // 초기 상황 생성 (LLM 호출)
      const initialNarrative = await this.generateInitialNarrative(
        template,
        triggerContext
      );

      // 세션 생성
      const sessionData = {
        template_id: templateId,
        user_id: userId,
        persona_id: personaId,
        turn_count: 0,
        session_state: 'active',
        current_narrative: initialNarrative,
        conversation_history: [],
        context: {
          affection: triggerContext.affection,
          relationshipStage: triggerContext.relationshipStage,
          triggeredBy: triggerContext.triggeredBy,
          sessionMemory: [],
        },
        guardrail_violations: 0,
      };

      const { data: session, error: sessionError } = await this.supabase
        .from('dynamic_scenario_sessions')
        .insert(sessionData)
        .select()
        .single();

      if (sessionError) {
        console.error('Failed to create dynamic session:', sessionError);
        return null;
      }

      return this.mapSessionFromDb(session);
    } catch (error) {
      console.error('Error initializing dynamic session:', error);
      return null;
    }
  }

  /**
   * 초기 내러티브 생성
   */
  private async generateInitialNarrative(
    template: DynamicTemplate,
    triggerContext: {
      affection: number;
      relationshipStage: string;
      triggeredBy: string;
    }
  ): Promise<{
    situation: string;
    emotionalTone: string;
    storyDirection: string;
  }> {
    try {
      const prompt = `Generate an initial situation for this scenario:
Template: ${template.name}
Description: ${template.description}
Trigger: ${triggerContext.triggeredBy}
Relationship: ${triggerContext.relationshipStage} (Affection: ${triggerContext.affection})

Output JSON:
{
  "situation": "현재 상황 설명 (한국어)",
  "emotionalTone": "감정적 분위기",
  "storyDirection": "스토리 방향"
}`;

      const response = await (this.llmClient as unknown as {
        callLLM: (
          messages: { role: 'system' | 'user' | 'assistant'; content: string }[],
          options?: { temperature?: number; maxTokens?: number }
        ) => Promise<{ content: string }>;
      }).callLLM(
        [
          { role: 'system', content: 'Generate scenario narrative in JSON format.' },
          { role: 'user', content: prompt },
        ],
        { temperature: 0.8, maxTokens: 300 }
      );

      const parsed = JSON.parse(response.content);
      return {
        situation: parsed.situation || '새로운 이야기가 시작됩니다...',
        emotionalTone: parsed.emotionalTone || 'curious',
        storyDirection: parsed.storyDirection || 'exploration',
      };
    } catch (error) {
      console.error('Error generating initial narrative:', error);
      return {
        situation: '새로운 이야기가 시작됩니다...',
        emotionalTone: 'curious',
        storyDirection: 'exploration',
      };
    }
  }

  /**
   * 세션 조회
   */
  async getSession(sessionId: string): Promise<DynamicSession | null> {
    const { data, error } = await this.supabase
      .from('dynamic_scenario_sessions')
      .select('*')
      .eq('id', sessionId)
      .single();

    if (error || !data) return null;
    return this.mapSessionFromDb(data);
  }

  /**
   * 다음 메시지 생성
   */
  async generateNextMessage(
    sessionId: string,
    userMessage: string
  ): Promise<DynamicGenerationResult | null> {
    try {
      // 세션 로드
      const session = await this.getSession(sessionId);
      if (!session || session.sessionState !== 'active') {
        return null;
      }

      // 템플릿 로드
      const { data: template } = await this.supabase
        .from('dynamic_scenario_templates')
        .select('*')
        .eq('id', session.templateId)
        .single();

      if (!template) {
        return null;
      }

      // 가드레일 체크
      const guardrailViolation = this.checkGuardrails(
        userMessage,
        template.blocked_topics || [],
        template.emotional_guardrails || []
      );

      if (guardrailViolation) {
        // 가드레일 위반 시 폴백 응답
        const fallbackResponses = template.fallback_responses || ['음... 다른 이야기를 해볼까?'];
        const fallback = fallbackResponses[Math.floor(Math.random() * fallbackResponses.length)];

        await this.updateSessionViolations(sessionId, session.guardrailViolations + 1);

        return {
          message: {
            id: `msg-${Date.now()}`,
            role: 'persona',
            content: fallback,
            emotion: 'awkward',
          },
          shouldContinue: session.guardrailViolations < 2, // 3번 위반시 종료
          suggestedEndReason: session.guardrailViolations >= 2 ? 'too_many_violations' : undefined,
          turnCount: session.turnCount,
          maxTurns: template.max_turns,
        };
      }

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

      // 프롬프트 생성
      const systemPrompt = this.buildSystemPrompt(template);
      const userPrompt = this.buildUserPrompt(template, session, userMessage, persona);

      // LLM 호출
      const response = await (this.llmClient as unknown as {
        callLLM: (
          messages: { role: 'system' | 'user' | 'assistant'; content: string }[],
          options?: { temperature?: number; maxTokens?: number }
        ) => Promise<{ content: string }>;
      }).callLLM(
        [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        { temperature: 0.75, maxTokens: 600 }
      );

      // 응답 파싱
      const parsed = this.parseResponse(response.content);

      // 턴 수 체크
      const newTurnCount = session.turnCount + 1;
      const shouldContinue = parsed.shouldContinue !== false && newTurnCount < template.max_turns;

      // 세션 업데이트
      await this.updateSession(sessionId, {
        turnCount: newTurnCount,
        narrative: {
          ...session.currentNarrative,
          emotionalTone: parsed.emotion || session.currentNarrative.emotionalTone,
          storyDirection: parsed.storyDirection || session.currentNarrative.storyDirection,
        },
        newMessage: { role: 'user', content: userMessage },
        personaResponse: { role: 'persona', content: parsed.content, emotion: parsed.emotion },
        sessionState: shouldContinue ? 'active' : 'completed',
      });

      // 메시지 생성
      const message: DynamicMessage = {
        id: `msg-${Date.now()}`,
        role: 'persona',
        content: parsed.content,
        emotion: parsed.emotion,
        narration: parsed.narration,
        choices: parsed.choices?.map((c: {
          text: string;
          tone: string;
          affectionHint: number;
          isPremium?: boolean;
        }) => ({
          id: `choice-${Date.now()}-${Math.random().toString(36).slice(2)}`,
          text: c.text,
          tone: c.tone as DynamicChoice['tone'],
          isPremium: c.isPremium || false,
          affectionHint: c.affectionHint || 0,
        })),
      };

      return {
        message,
        shouldContinue,
        suggestedEndReason: !shouldContinue
          ? (newTurnCount >= template.max_turns ? 'max_turns_reached' : parsed.suggestedEndReason)
          : undefined,
        turnCount: newTurnCount,
        maxTurns: template.max_turns,
      };
    } catch (error) {
      console.error('Error generating dynamic message:', error);
      return null;
    }
  }

  /**
   * 시나리오 시작 메시지 생성
   */
  async generateOpeningMessage(sessionId: string): Promise<DynamicMessage | null> {
    try {
      const session = await this.getSession(sessionId);
      if (!session) return null;

      // 템플릿 로드
      const { data: template } = await this.supabase
        .from('dynamic_scenario_templates')
        .select('*')
        .eq('id', session.templateId)
        .single();

      if (!template) return null;

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

      // 오프닝 생성 프롬프트
      const prompt = `Generate the opening message for this scenario:
Character: ${persona?.name || 'Character'}
Situation: ${session.currentNarrative.situation}
Emotional Tone: ${session.currentNarrative.emotionalTone}
Relationship: ${session.context.relationshipStage}

Output JSON:
{
  "narration": "상황 설명 (선택적, 한국어)",
  "content": "캐릭터의 첫 대사 (한국어)",
  "emotion": "감정",
  "choices": [
    { "text": "선택지", "tone": "friendly", "affectionHint": 0 }
  ]
}`;

      const response = await (this.llmClient as unknown as {
        callLLM: (
          messages: { role: 'system' | 'user' | 'assistant'; content: string }[],
          options?: { temperature?: number; maxTokens?: number }
        ) => Promise<{ content: string }>;
      }).callLLM(
        [
          { role: 'system', content: 'Generate engaging opening content in JSON format.' },
          { role: 'user', content: prompt },
        ],
        { temperature: 0.8, maxTokens: 400 }
      );

      const parsed = this.parseResponse(response.content);

      // 대화 기록에 추가
      await this.updateSession(sessionId, {
        turnCount: 0,
        narrative: session.currentNarrative,
        personaResponse: { role: 'persona', content: parsed.content, emotion: parsed.emotion },
      });

      return {
        id: `msg-${Date.now()}`,
        role: 'persona',
        content: parsed.content,
        emotion: parsed.emotion,
        narration: parsed.narration,
        choices: parsed.choices?.map((c: {
          text: string;
          tone: string;
          affectionHint: number;
        }) => ({
          id: `choice-${Date.now()}-${Math.random().toString(36).slice(2)}`,
          text: c.text,
          tone: c.tone as DynamicChoice['tone'],
          isPremium: false,
          affectionHint: c.affectionHint || 0,
        })),
      };
    } catch (error) {
      console.error('Error generating opening message:', error);
      return null;
    }
  }

  /**
   * 세션 완료 처리
   */
  async completeSession(sessionId: string, reason: string = 'user_ended'): Promise<void> {
    await this.supabase
      .from('dynamic_scenario_sessions')
      .update({
        session_state: 'completed',
        completed_at: new Date().toISOString(),
        completion_reason: reason,
      })
      .eq('id', sessionId);
  }

  /**
   * 세션 일시정지
   */
  async pauseSession(sessionId: string): Promise<void> {
    await this.supabase
      .from('dynamic_scenario_sessions')
      .update({
        session_state: 'paused',
        last_activity_at: new Date().toISOString(),
      })
      .eq('id', sessionId);
  }

  /**
   * 세션 재개
   */
  async resumeSession(sessionId: string): Promise<DynamicSession | null> {
    const { data, error } = await this.supabase
      .from('dynamic_scenario_sessions')
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

  private checkGuardrails(
    message: string,
    blockedTopics: string[],
    emotionalGuardrails: string[]
  ): boolean {
    const lowerMessage = message.toLowerCase();

    // 차단 주제 체크
    for (const topic of blockedTopics) {
      if (lowerMessage.includes(topic.toLowerCase())) {
        console.log(`[DynamicEngine] Blocked topic detected: ${topic}`);
        return true;
      }
    }

    // 감정 가드레일 체크 (필요시 확장)
    // emotionalGuardrails는 허용된 감정 범위를 정의하지만
    // 여기서는 차단 목적으로는 사용하지 않음

    return false;
  }

  private buildSystemPrompt(template: DynamicTemplate): string {
    return DYNAMIC_SYSTEM_PROMPT
      .replace('{{guardrails}}', (template.emotionalGuardrails || []).join('\n- ') || 'None specified')
      .replace('{{blockedTopics}}', (template.blockedTopics || []).join(', ') || 'None')
      .replace('{{requiredElements}}', (template.requiredElements || []).join(', ') || 'None');
  }

  private buildUserPrompt(
    template: DynamicTemplate,
    session: DynamicSession,
    userMessage: string,
    persona: Record<string, unknown> | null
  ): string {
    const personality = (persona?.persona_personalities as { personality: Record<string, unknown> }[])?.[0]?.personality || {};
    const speechStyle = (persona?.persona_speech_styles as { speech_style: Record<string, unknown> }[])?.[0]?.speech_style || {};

    const historyText = session.conversationHistory
      .slice(-10)
      .map(m => `${m.role}: ${m.content}`)
      .join('\n');

    return DYNAMIC_USER_PROMPT
      .replace('{{personaName}}', (persona?.name as string) || 'Character')
      .replace('{{personality}}', JSON.stringify(personality))
      .replace('{{speechStyle}}', JSON.stringify(speechStyle))
      .replace('{{templateName}}', template.name)
      .replace('{{templateDescription}}', template.description)
      .replace('{{generationPrompt}}', template.generationPrompt)
      .replace('{{turnCount}}', String(session.turnCount))
      .replace('{{maxTurns}}', String(template.maxTurns))
      .replace('{{relationshipStage}}', session.context.relationshipStage)
      .replace('{{affection}}', String(session.context.affection))
      .replace('{{emotionalTone}}', session.currentNarrative.emotionalTone)
      .replace('{{storyDirection}}', session.currentNarrative.storyDirection)
      .replace('{{conversationHistory}}', historyText || '(새로운 대화)')
      .replace('{{userMessage}}', userMessage);
  }

  private parseResponse(response: string): {
    content: string;
    emotion?: string;
    narration?: string;
    choices?: { text: string; tone: string; affectionHint: number; isPremium?: boolean }[];
    storyDirection?: string;
    shouldContinue?: boolean;
    suggestedEndReason?: string;
  } {
    try {
      const parsed = JSON.parse(response);
      return {
        content: parsed.content || response,
        emotion: parsed.emotion,
        narration: parsed.narration,
        choices: parsed.choices,
        storyDirection: parsed.storyDirection,
        shouldContinue: parsed.shouldContinue !== false,
        suggestedEndReason: parsed.suggestedEndReason,
      };
    } catch {
      return {
        content: response,
        shouldContinue: true,
      };
    }
  }

  private async updateSession(
    sessionId: string,
    updates: {
      turnCount: number;
      narrative: DynamicSession['currentNarrative'];
      newMessage?: { role: string; content: string };
      personaResponse?: { role: string; content: string; emotion?: string };
      sessionState?: DynamicSession['sessionState'];
    }
  ): Promise<void> {
    const session = await this.getSession(sessionId);
    if (!session) return;

    const newHistory = [...session.conversationHistory];
    if (updates.newMessage) {
      newHistory.push(updates.newMessage as DynamicSession['conversationHistory'][0]);
    }
    if (updates.personaResponse) {
      newHistory.push(updates.personaResponse as DynamicSession['conversationHistory'][0]);
    }

    await this.supabase
      .from('dynamic_scenario_sessions')
      .update({
        turn_count: updates.turnCount,
        current_narrative: updates.narrative,
        conversation_history: newHistory,
        session_state: updates.sessionState || session.sessionState,
        last_activity_at: new Date().toISOString(),
      })
      .eq('id', sessionId);
  }

  private async updateSessionViolations(sessionId: string, violations: number): Promise<void> {
    await this.supabase
      .from('dynamic_scenario_sessions')
      .update({
        guardrail_violations: violations,
        last_activity_at: new Date().toISOString(),
      })
      .eq('id', sessionId);
  }

  private mapSessionFromDb(data: Record<string, unknown>): DynamicSession {
    return {
      id: data.id as string,
      templateId: data.template_id as string,
      userId: data.user_id as string,
      personaId: data.persona_id as string,
      turnCount: data.turn_count as number,
      sessionState: data.session_state as DynamicSession['sessionState'],
      currentNarrative: (data.current_narrative as DynamicSession['currentNarrative']) || {
        situation: '',
        emotionalTone: '',
        storyDirection: '',
      },
      conversationHistory: (data.conversation_history as DynamicSession['conversationHistory']) || [],
      context: (data.context as DynamicSession['context']) || {
        affection: 0,
        relationshipStage: 'stranger',
        triggeredBy: '',
        sessionMemory: [],
      },
      guardrailViolations: data.guardrail_violations as number || 0,
      startedAt: data.created_at as string,
      lastActivityAt: data.last_activity_at as string,
    };
  }
}

// 싱글톤 인스턴스
let dynamicEngineInstance: DynamicScenarioEngine | null = null;

export function getDynamicScenarioEngine(supabase: SupabaseClient): DynamicScenarioEngine {
  if (!dynamicEngineInstance) {
    dynamicEngineInstance = new DynamicScenarioEngine(supabase);
  }
  return dynamicEngineInstance;
}
