/**
 * LLM Client
 * OpenRouter를 통한 LLM 호출 + 동적 모델 선택
 */

import {
  LLMContext,
  DialogueChoice,
  PersonaMood,
} from '../utils/types';
import { validateAndCorrectResponse, EmotionalContextForPrompt } from '../utils/response-validator';
import {
  ModelSelector,
  ModelSelectionLogger,
  ModelConfig,
  AVAILABLE_MODELS,
} from './model-selector';
import type { TaskContext } from './model-selector';
import { getBudgetGuard } from '../utils/usage-tracker';
import type { BudgetGuard } from '../utils/usage-tracker';
import {
  parseDialogueResponse,
  parseChoicesResponse,
  parseEventMessageResponse,
  parseStoryBranchResponse,
  LLMDialogueResponseWithChoices,
} from '../utils/schemas';

const OPENROUTER_API_URL = 'https://openrouter.ai/api/v1/chat/completions';

// 타임스탬프 헬퍼 함수 (밀리초 단위까지 표시)
function getTimestamp(): string {
  const now = new Date();
  return now.toISOString().replace('T', ' ').replace('Z', '');
}

interface OpenRouterMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

interface OpenRouterResponse {
  choices: Array<{
    message: {
      content: string;
    };
  }>;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

// ============================================
// LLM 호출 옵션
// ============================================

export interface LLMCallOptions {
  taskContext?: TaskContext;
  forceModel?: string;
  temperature?: number;
  maxTokens?: number;
  userId?: string; // 예산 체크용
  skipBudgetCheck?: boolean; // 예산 체크 스킵 (시스템 호출용)
  systemPromptOverride?: string; // 시스템 프롬프트 오버라이드
}

// ============================================
// LLM 클라이언트
// ============================================

// ============================================
// 에러 클래스
// ============================================

export class LLMConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'LLMConfigError';
  }
}

export class LLMAPIError extends Error {
  constructor(
    message: string,
    public statusCode?: number,
    public model?: string
  ) {
    super(message);
    this.name = 'LLMAPIError';
  }
}

export class LLMClient {
  private apiKey: string;
  private defaultModel: string;
  private enableDynamicSelection: boolean;
  private enableBudgetGuard: boolean;
  private budgetGuard: BudgetGuard | null = null;

  constructor(apiKey?: string, options?: {
    defaultModel?: string;
    enableDynamicSelection?: boolean;
    enableBudgetGuard?: boolean;
  }) {
    // API 키 검증
    const resolvedApiKey = apiKey || process.env.OPENROUTER_API_KEY;

    if (!resolvedApiKey) {
      throw new LLMConfigError(
        'OPENROUTER_API_KEY is required. Set it in environment variables or pass it to constructor.'
      );
    }

    if (resolvedApiKey.length < 10) {
      throw new LLMConfigError('Invalid API key format: key is too short');
    }

    // 프로덕션 환경에서 테스트 키 사용 방지
    if (process.env.NODE_ENV === 'production' && resolvedApiKey.startsWith('sk-test-')) {
      throw new LLMConfigError('Test API key cannot be used in production environment');
    }

    this.apiKey = resolvedApiKey;
    this.defaultModel = options?.defaultModel || 'deepseek/deepseek-v3.2';
    this.enableDynamicSelection = options?.enableDynamicSelection ?? true;
    this.enableBudgetGuard = options?.enableBudgetGuard ?? true;
  }

  private getBudgetGuardInstance(): BudgetGuard {
    if (!this.budgetGuard) {
      this.budgetGuard = getBudgetGuard();
    }
    return this.budgetGuard;
  }

  /**
   * 시스템 프롬프트 생성 (레거시 호환용)
   */
  private buildSystemPrompt(context: LLMContext): string {
    return `You are ${context.persona.name}, a ${context.persona.role}.
Current relationship stage: ${context.relationship.relationshipStage}
Affection: ${context.relationship.affection}/100
Current situation: ${context.currentSituation || 'casual conversation'}

Respond naturally as the character. Keep responses concise (1-3 sentences).
Output JSON: { "content": "...", "emotion": "...", "affectionModifier": 0 }`;
  }

  /**
   * 응답 프롬프트 생성 (레거시 호환용)
   */
  private buildResponsePrompt(
    context: LLMContext,
    userMessage: string,
    memories?: string,
    previousSummaries?: string,
    emotionalContext?: EmotionalContextForPrompt
  ): string {
    const parts: string[] = [];

    if (memories) {
      parts.push(`Relevant memories: ${memories}`);
    }
    if (previousSummaries) {
      parts.push(`Previous context: ${previousSummaries}`);
    }
    if (emotionalContext?.hasUnresolvedConflict) {
      parts.push(`Warning: There is unresolved conflict. Be emotionally restrained.`);
    }

    const recentHistory = context.conversationHistory.slice(-5)
      .map(m => `${m.role}: ${m.content}`).join('\n');

    parts.push(`Recent conversation:\n${recentHistory}`);
    parts.push(`User: ${userMessage}`);
    parts.push('Respond as the character in JSON format.');

    return parts.join('\n\n');
  }

  /**
   * 선택지 생성 프롬프트 (레거시 호환용)
   */
  private buildChoiceGenerationPrompt(
    context: LLMContext,
    situation: string,
    choiceCount: number
  ): string {
    return `Generate ${choiceCount} dialogue choices for the user in this situation: ${situation}
Relationship: ${context.relationship.relationshipStage}, Affection: ${context.relationship.affection}
Output JSON: { "choices": [{ "id": "...", "text": "...", "tone": "...", "isPremium": false, "estimatedAffectionChange": 0 }] }`;
  }

  /**
   * 이벤트 메시지 프롬프트 (레거시 호환용)
   */
  private buildEventMessagePrompt(
    context: LLMContext,
    eventType: string,
    contextHint: string
  ): string {
    return `Generate an event message from ${context.persona.name}.
Event type: ${eventType}
Context: ${contextHint}
Relationship: ${context.relationship.relationshipStage}
Output JSON: { "content": "...", "emotion": "neutral" }`;
  }

  /**
   * 컨텍스트 프롬프트 생성 (메모리, 이전 요약, 감정 컨텍스트)
   */
  private buildContextPrompt(
    memories?: string,
    previousSummaries?: string,
    emotionalContext?: EmotionalContextForPrompt
  ): string | null {
    const parts: string[] = [];

    if (memories) {
      parts.push(`# Relevant Memories\n${memories}`);
    }
    if (previousSummaries) {
      parts.push(`# Previous Context\n${previousSummaries}`);
    }
    if (emotionalContext?.hasUnresolvedConflict) {
      parts.push(`# Warning\nThere is unresolved conflict. Be emotionally restrained and consistent with previous statements.`);
    }

    return parts.length > 0 ? parts.join('\n\n') : null;
  }

  /**
   * 대화 응답 + 선택지 통합 생성 (단일 LLM 호출)
   */
  async generateResponse(
    context: LLMContext & {
      memories?: string;
      previousSummaries?: string;
      emotionalContext?: EmotionalContextForPrompt;
    },
    userMessage: string,
    options?: LLMCallOptions
  ): Promise<LLMDialogueResponseWithChoices> {
    const systemPrompt = options?.systemPromptOverride || this.buildSystemPrompt(context);

    // 메모리와 컨텍스트 정보를 담은 컨텍스트 프롬프트
    const contextPrompt = this.buildContextPrompt(
      context.memories,
      context.previousSummaries,
      context.emotionalContext
    );

    // 작업 컨텍스트 구성
    const taskContext: TaskContext = options?.taskContext || {
      type: 'dialogue_response',
      relationshipStage: context.relationship.relationshipStage,
      affection: context.relationship.affection,
      emotionalIntensity: context.emotionalState.tensionLevel > 7 ? 'high' :
                          context.emotionalState.tensionLevel > 4 ? 'medium' : 'low',
      isVulnerableMoment: context.emotionalState.vulnerabilityShown,
      conversationLength: context.conversationHistory.length,
      requiresConsistency: true,
      requiresCreativity: true,
    };

    // 메시지 배열 구성: 시스템 + 컨텍스트 + 대화 히스토리 + 현재 메시지
    const messages: OpenRouterMessage[] = [
      { role: 'system', content: systemPrompt },
    ];

    // 컨텍스트 정보가 있으면 시스템 메시지로 추가
    if (contextPrompt) {
      messages.push({ role: 'system', content: contextPrompt });
    }

    // 대화 히스토리를 messages 배열로 추가 (최근 30개)
    const historyMessages = context.conversationHistory.slice(-30);
    for (const msg of historyMessages) {
      messages.push({
        role: msg.role === 'user' ? 'user' : 'assistant',
        content: msg.content,
      });
    }

    // 현재 사용자 메시지 추가
    messages.push({ role: 'user', content: userMessage });

    const response = await this.callLLM(
      messages,
      { ...options, taskContext }
    );

    const parsedResponse = parseDialogueResponse(response.content);

    // 응답 일관성 검증 및 수정 (감정 컨텍스트가 있는 경우)
    if (context.emotionalContext) {
      const { response: validatedResponse } =
        validateAndCorrectResponse(parsedResponse, context.emotionalContext);

      return validatedResponse;
    }

    return parsedResponse;
  }

  /**
   * 선택지 생성 (standard tier 사용)
   */
  async generateChoices(
    context: LLMContext,
    situation: string,
    choiceCount: number = 3,
    options?: LLMCallOptions
  ): Promise<DialogueChoice[]> {
    const systemPrompt = this.buildSystemPrompt(context);
    const userPrompt = this.buildChoiceGenerationPrompt(context, situation, choiceCount);

    // 선택지 생성은 중간 복잡도
    const taskContext: TaskContext = options?.taskContext || {
      type: 'choice_generation',
      relationshipStage: context.relationship.relationshipStage,
      affection: context.relationship.affection,
      requiresCreativity: true,
    };

    const response = await this.callLLM(
      [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      { ...options, taskContext }
    );

    return parseChoicesResponse(response.content);
  }

  /**
   * 이벤트 메시지 생성 (상황에 따라 모델 선택)
   */
  async generateEventMessage(
    context: LLMContext,
    eventType: string,
    contextHint: string,
    options?: LLMCallOptions
  ): Promise<{ content: string; emotion: PersonaMood; postType?: string }> {
    const systemPrompt = this.buildSystemPrompt(context);
    const userPrompt = this.buildEventMessagePrompt(context, eventType, contextHint);

    // 감정적 이벤트인지 판단
    const isEmotional = ['comfort_user_sad_mood', 'late_night_intimate', 'react_to_premium_choice']
      .includes(contextHint);

    const taskContext: TaskContext = options?.taskContext || {
      type: 'event_message',
      relationshipStage: context.relationship.relationshipStage,
      affection: context.relationship.affection,
      emotionalIntensity: isEmotional ? 'high' : 'medium',
      isVulnerableMoment: contextHint === 'late_night_intimate',
    };

    const response = await this.callLLM(
      [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      { ...options, taskContext }
    );

    return parseEventMessageResponse(response.content);
  }

  /**
   * 대화 요약 생성 (economy tier - 비용 효율)
   */
  async summarizeConversation(
    personaName: string,
    messages: Array<{ role: string; content: string }>,
    previousSummary?: string,
    options?: LLMCallOptions
  ): Promise<string> {
    const prompt = `
${previousSummary ? `Previous summary: ${previousSummary}\n\n` : ''}
Summarize the following conversation between ${personaName} and the user.
Focus on:
1. Key emotional moments
2. Important revelations or promises
3. Changes in relationship dynamic
4. Any flags or events that should be remembered

Conversation:
${messages.map(m => `[${m.role}]: ${m.content}`).join('\n')}

Provide a concise summary (max 200 words) that captures the essential context for future conversations.
`;

    // 요약은 비용 효율적인 모델 사용
    const taskContext: TaskContext = options?.taskContext || {
      type: 'conversation_summary',
      budgetConstraint: 'strict',
    };

    const response = await this.callLLM(
      [{ role: 'user', content: prompt }],
      { ...options, taskContext }
    );

    return response.content.trim();
  }

  /**
   * 스토리 분기점 결정 (premium tier - 중요한 판단)
   */
  async decideStoryBranch(
    context: LLMContext,
    branchOptions: Array<{ id: string; description: string; conditions?: string }>,
    userChoice: string,
    options?: LLMCallOptions
  ): Promise<{ selectedBranch: string; reasoning: string; flagsToSet: Record<string, boolean> }> {
    const systemPrompt = this.buildSystemPrompt(context);
    const userPrompt = `
## STORY BRANCHING DECISION

The user made this choice: "${userChoice}"

Available story branches:
${branchOptions.map(b => `- ${b.id}: ${b.description}${b.conditions ? ` (requires: ${b.conditions})` : ''}`).join('\n')}

Current story flags: ${JSON.stringify(context.relationship.storyFlags)}
Relationship stage: ${context.relationship.relationshipStage}
Affection: ${context.relationship.affection}/100

Decide which branch fits best based on:
1. The user's choice and intent
2. Current relationship dynamics
3. Story coherence and character consistency

Respond in JSON:
{
  "selectedBranch": "branch_id",
  "reasoning": "brief explanation",
  "flagsToSet": { "flag_name": true/false }
}
`;

    // 스토리 분기는 항상 프리미엄 모델
    const taskContext: TaskContext = options?.taskContext || {
      type: 'story_branching',
      relationshipStage: context.relationship.relationshipStage,
      affection: context.relationship.affection,
      isStoryBranching: true,
      requiresConsistency: true,
      requiresCreativity: true,
    };

    const response = await this.callLLM(
      [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      { ...options, taskContext }
    );

    return parseStoryBranchResponse(response.content, branchOptions[0]?.id || 'default');
  }

  // ============================================
  // Private Methods
  // ============================================

  /**
   * LLM 호출 (동적 모델 선택 + 예산 체크 포함)
   */
  private async callLLM(
    messages: OpenRouterMessage[],
    options?: LLMCallOptions
  ): Promise<{ content: string; model: string; usage?: OpenRouterResponse['usage']; budgetWarning?: string }> {
    const startTime = Date.now();
    const callId = `llm-${Date.now().toString(36)}`;

    // 모델 선택
    let selectedModel: string;
    let modelConfig: ModelConfig | undefined;

    if (options?.forceModel) {
      selectedModel = options.forceModel;
      modelConfig = AVAILABLE_MODELS[selectedModel];
    } else if (this.enableDynamicSelection && options?.taskContext) {
      modelConfig = ModelSelector.selectModel(options.taskContext);
      selectedModel = modelConfig.id;
    } else {
      selectedModel = this.defaultModel;
      modelConfig = AVAILABLE_MODELS[selectedModel];
    }

    // 예산 체크 (로깅용 - 차단하지 않음)
    let budgetWarning: string | undefined;
    if (this.enableBudgetGuard && options?.userId && !options?.skipBudgetCheck) {
      const guard = this.getBudgetGuardInstance();
      const estimatedTokens = options?.maxTokens ?? (modelConfig?.maxTokens || 1000);
      const budgetCheck = await guard.preCallCheck(options.userId, selectedModel, estimatedTokens);
      budgetWarning = budgetCheck.warning;
      // 참고: 실제 차단은 하지 않음 - 가격 정책으로 관리
    }

    const response = await fetch(OPENROUTER_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.apiKey}`,
        'HTTP-Referer': process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000',
        'X-Title': 'Luminovel.ai',
      },
      body: JSON.stringify({
        model: selectedModel,
        messages,
        // 온도 0.65로 조정: 일관성 유지를 위해 낮춤 (0.8 → 0.65)
        // 너무 낮으면 창의성 저하, 너무 높으면 캐릭터 일탈
        temperature: options?.temperature ?? 0.65,
        max_tokens: options?.maxTokens ?? (modelConfig?.maxTokens || 1000),
        response_format: { type: 'json_object' },
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      let errorMessage = `LLM API error (${selectedModel})`;

      try {
        const errorJson = JSON.parse(errorText);
        errorMessage = errorJson.error?.message || errorJson.message || errorText;
      } catch {
        errorMessage = errorText || `HTTP ${response.status}`;
      }

      console.error(`[${getTimestamp()}][${callId}] ❌ API Error:`, {
        model: selectedModel,
        status: response.status,
        error: errorMessage,
        taskType: options?.taskContext?.type,
        duration: `${Date.now() - startTime}ms`,
      });

      throw new LLMAPIError(errorMessage, response.status, selectedModel);
    }

    const data: OpenRouterResponse = await response.json();
    const responseTimeMs = Date.now() - startTime;

    // 모델 선택 로깅 (분석용)
    if (options?.taskContext) {
      const complexity = this.assessComplexityForLog(options.taskContext);
      ModelSelectionLogger.log({
        taskType: options.taskContext.type,
        complexity,
        selectedModel,
        context: options.taskContext,
        responseTimeMs,
        tokenCount: data.usage?.total_tokens,
        estimatedCost: this.calculateCost(data.usage, modelConfig),
      });
    }

    // 사용량 기록 (userId가 있는 경우)
    if (this.enableBudgetGuard && options?.userId && data.usage) {
      const guard = this.getBudgetGuardInstance();
      await guard.postCallRecord(
        options.userId,
        selectedModel,
        data.usage,
        options?.taskContext?.type || 'unknown'
      );
    }

    return {
      content: data.choices[0]?.message?.content || '',
      model: selectedModel,
      usage: data.usage,
      budgetWarning,
    };
  }

  /**
   * 복잡도 평가 (로깅용 간소화 버전)
   */
  private assessComplexityForLog(context: TaskContext): 'critical' | 'high' | 'medium' | 'low' {
    if (context.isStoryBranching || context.isVulnerableMoment) return 'critical';
    if (context.emotionalIntensity === 'high' || context.isPremiumContent) return 'high';
    if (context.relationshipStage === 'close' || context.relationshipStage === 'heart') return 'high';
    if (context.budgetConstraint === 'strict') return 'low';
    return 'medium';
  }

  /**
   * 비용 계산
   */
  private calculateCost(
    usage: OpenRouterResponse['usage'],
    modelConfig?: ModelConfig
  ): number {
    if (!usage || !modelConfig) return 0;
    return (usage.total_tokens / 1000) * modelConfig.costPer1kTokens;
  }

}

// ============================================
// 싱글톤 인스턴스
// ============================================

let llmClientInstance: LLMClient | null = null;

export function getLLMClient(): LLMClient {
  if (!llmClientInstance) {
    llmClientInstance = new LLMClient();
  }
  return llmClientInstance;
}
