/**
 * LLM Client
 * OpenRouter를 통한 LLM 호출 + 동적 모델 선택
 */

import {
  LLMContext,
  LLMDialogueResponse,
  DialogueChoice,
  PersonaMood,
} from './types';
import {
  buildSystemPrompt,
  buildResponsePrompt,
  buildChoiceGenerationPrompt,
  buildEventMessagePrompt,
} from './prompt-builder';
import {
  ModelSelector,
  ModelSelectionLogger,
  ModelConfig,
  AVAILABLE_MODELS,
} from './model-selector';
import type { TaskContext } from './model-selector';
import { getBudgetGuard } from './usage-tracker';
import type { BudgetGuard } from './usage-tracker';

const OPENROUTER_API_URL = 'https://openrouter.ai/api/v1/chat/completions';

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
}

// ============================================
// LLM 클라이언트
// ============================================

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
    this.apiKey = apiKey || process.env.OPENROUTER_API_KEY || '';
    this.defaultModel = options?.defaultModel || 'google/gemini-2.5-flash';
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
   * 대화 응답 생성 (동적 모델 선택)
   * @param context - LLM 컨텍스트 (기억과 요약 포함 가능)
   * @param userMessage - 유저 메시지
   * @param options - LLM 호출 옵션
   */
  async generateResponse(
    context: LLMContext & { memories?: string; previousSummaries?: string },
    userMessage: string,
    options?: LLMCallOptions
  ): Promise<LLMDialogueResponse> {
    const systemPrompt = buildSystemPrompt(context);
    // 기억과 요약을 프롬프트에 포함
    const userPrompt = buildResponsePrompt(
      context,
      userMessage,
      context.memories,
      context.previousSummaries
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

    const response = await this.callLLM(
      [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      { ...options, taskContext }
    );

    return this.parseDialogueResponse(response.content);
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
    const systemPrompt = buildSystemPrompt(context);
    const userPrompt = buildChoiceGenerationPrompt(context, situation, choiceCount);

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

    return this.parseChoicesResponse(response.content);
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
    const systemPrompt = buildSystemPrompt(context);
    const userPrompt = buildEventMessagePrompt(context, eventType, contextHint);

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

    return this.parseEventMessageResponse(response.content);
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
    const systemPrompt = buildSystemPrompt(context);
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

    try {
      return JSON.parse(response.content);
    } catch {
      return {
        selectedBranch: branchOptions[0]?.id || 'default',
        reasoning: 'Failed to parse response',
        flagsToSet: {},
      };
    }
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
        temperature: options?.temperature ?? 0.8,
        max_tokens: options?.maxTokens ?? (modelConfig?.maxTokens || 1000),
        response_format: { type: 'json_object' },
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`LLM API error (${selectedModel}): ${error}`);
    }

    const data: OpenRouterResponse = await response.json();
    const responseTimeMs = Date.now() - startTime;

    // 로깅
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
    if (context.relationshipStage === 'intimate' || context.relationshipStage === 'lover') return 'high';
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

  /**
   * LLM 응답에서 JSON 추출 (마크다운 코드블록 제거)
   */
  private extractJSON(response: string): string {
    // 마크다운 코드블록 제거: ```json ... ``` 또는 ``` ... ```
    const codeBlockMatch = response.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (codeBlockMatch) {
      return codeBlockMatch[1].trim();
    }
    // 코드블록이 없으면 원본 반환
    return response.trim();
  }

  private parseDialogueResponse(response: string): LLMDialogueResponse {
    try {
      const jsonStr = this.extractJSON(response);
      const parsed = JSON.parse(jsonStr);
      return {
        content: parsed.content || '',
        emotion: parsed.emotion || 'neutral',
        innerThought: parsed.innerThought,
        affectionModifier: parsed.affectionModifier || 0,
        flagsToSet: parsed.flagsToSet,
        suggestedChoices: parsed.suggestedChoices,
        // 시나리오 전환 트리거 파싱
        scenarioTrigger: parsed.scenarioTrigger?.shouldStart ? {
          shouldStart: true,
          scenarioType: parsed.scenarioTrigger.scenarioType || 'meeting',
          scenarioContext: parsed.scenarioTrigger.scenarioContext || '',
          location: parsed.scenarioTrigger.location,
          transitionMessage: parsed.scenarioTrigger.transitionMessage,
        } : undefined,
      };
    } catch {
      // JSON 파싱 실패 시 기본 응답
      console.warn('[LLM] Failed to parse dialogue response as JSON:', response.slice(0, 200));
      return {
        content: response,
        emotion: 'neutral',
        affectionModifier: 0,
      };
    }
  }

  private parseChoicesResponse(response: string): DialogueChoice[] {
    try {
      const jsonStr = this.extractJSON(response);
      const parsed = JSON.parse(jsonStr);
      return (parsed.choices || []).map((choice: Record<string, unknown>, index: number) => ({
        id: choice.id || `choice_${index}`,
        text: choice.text || '',
        tone: choice.tone || 'neutral',
        isPremium: choice.isPremium || false,
        premiumCost: choice.premiumCost,
        estimatedAffectionChange: choice.estimatedAffectionChange || 0,
        nextBeatHint: choice.nextBeatHint,
      }));
    } catch {
      // 파싱 실패 시 기본 선택지
      return [
        { id: 'default_1', text: '...', tone: 'neutral', isPremium: false, estimatedAffectionChange: 0 },
      ];
    }
  }

  private parseEventMessageResponse(response: string): {
    content: string;
    emotion: PersonaMood;
    postType?: string;
  } {
    try {
      const jsonStr = this.extractJSON(response);
      const parsed = JSON.parse(jsonStr);
      return {
        content: parsed.content || '',
        emotion: parsed.emotion || 'neutral',
        postType: parsed.postType,
      };
    } catch {
      return {
        content: response,
        emotion: 'neutral',
      };
    }
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
