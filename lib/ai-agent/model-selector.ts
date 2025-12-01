/**
 * Dynamic Model Selector
 * 작업 복잡도와 상황에 따라 최적의 LLM 모델을 동적으로 선택
 */

// ============================================
// 모델 정의
// ============================================

export interface ModelConfig {
  id: string;
  name: string;
  vendor: string;
  tier: ModelTier;
  costPer1kTokens: number; // USD (input/output 평균)
  maxTokens: number;
  strengths: string[];
  latencyMs: number; // 평균 응답 시간
}

export type ModelTier = 'premium' | 'standard' | 'economy';

// 티어별 모델 목록 (최신 모델)
export const MODEL_TIERS = {
  premium: [
    {
      id: 'anthropic/claude-sonnet-4.5',
      vendor: 'anthropic',
      approxCostPer1K: 0.012,
    },
    {
      id: 'openai/gpt-5.1',
      vendor: 'openai',
      approxCostPer1K: 0.008,
    },
    {
      id: 'google/gemini-3-pro-preview',
      vendor: 'google',
      approxCostPer1K: 0.010,
    },
  ],
  standard: [
    {
      id: 'anthropic/claude-haiku-4.5',
      vendor: 'anthropic',
      approxCostPer1K: 0.003,
    },
    {
      id: 'google/gemini-2.5-flash',
      vendor: 'google',
      approxCostPer1K: 0.0015,
    },
    {
      id: 'deepseek/deepseek-chat-v3.1',
      vendor: 'deepseek',
      approxCostPer1K: 0.0005,
    },
  ],
  economy: [
    {
      id: 'deepseek/deepseek-r1-distill-qwen3-8b',
      vendor: 'deepseek',
      approxCostPer1K: 0.00006,
    },
    {
      id: 'deepseek/deepseek-v3.2-exp',
      vendor: 'deepseek',
      approxCostPer1K: 0.00025,
    },
  ],
} as const;

// OpenRouter 모델 카탈로그
export const AVAILABLE_MODELS: Record<string, ModelConfig> = {
  // Premium Tier - 복잡한 추론, 감정적 뉘앙스, 중요한 스토리 분기점
  'anthropic/claude-sonnet-4.5': {
    id: 'anthropic/claude-sonnet-4.5',
    name: 'Claude Sonnet 4.5',
    vendor: 'anthropic',
    tier: 'premium',
    costPer1kTokens: 0.012,
    maxTokens: 8192,
    strengths: ['complex_reasoning', 'emotional_nuance', 'character_consistency', 'creative_writing'],
    latencyMs: 1800,
  },
  'openai/gpt-5.1': {
    id: 'openai/gpt-5.1',
    name: 'GPT-5.1',
    vendor: 'openai',
    tier: 'premium',
    costPer1kTokens: 0.008,
    maxTokens: 8192,
    strengths: ['complex_reasoning', 'instruction_following', 'nuanced_response', 'long_context'],
    latencyMs: 1200,
  },
  'google/gemini-3-pro-preview': {
    id: 'google/gemini-3-pro-preview',
    name: 'Gemini 3 Pro Preview',
    vendor: 'google',
    tier: 'premium',
    costPer1kTokens: 0.010,
    maxTokens: 16384,
    strengths: ['multimodal', 'complex_reasoning', 'creative_writing'],
    latencyMs: 1500,
  },

  // Standard Tier - 일반 대화, 선택지 생성
  'anthropic/claude-haiku-4.5': {
    id: 'anthropic/claude-haiku-4.5',
    name: 'Claude Haiku 4.5',
    vendor: 'anthropic',
    tier: 'standard',
    costPer1kTokens: 0.003,
    maxTokens: 4096,
    strengths: ['fast_response', 'good_quality', 'cost_effective', 'character_consistency'],
    latencyMs: 400,
  },
  'google/gemini-2.5-flash': {
    id: 'google/gemini-2.5-flash',
    name: 'Gemini 2.5 Flash',
    vendor: 'google',
    tier: 'standard',
    costPer1kTokens: 0.0015,
    maxTokens: 8192,
    strengths: ['very_fast', 'good_quality', 'long_context'],
    latencyMs: 300,
  },
  'deepseek/deepseek-chat-v3.1': {
    id: 'deepseek/deepseek-chat-v3.1',
    name: 'DeepSeek Chat V3.1',
    vendor: 'deepseek',
    tier: 'standard',
    costPer1kTokens: 0.0005,
    maxTokens: 8192,
    strengths: ['cost_effective', 'good_reasoning', 'fast'],
    latencyMs: 350,
  },

  // Economy Tier - 단순 작업, 높은 트래픽
  'deepseek/deepseek-r1-distill-qwen3-8b': {
    id: 'deepseek/deepseek-r1-distill-qwen3-8b',
    name: 'DeepSeek R1 Distill Qwen3 8B',
    vendor: 'deepseek',
    tier: 'economy',
    costPer1kTokens: 0.00006,
    maxTokens: 4096,
    strengths: ['ultra_cheap', 'fast', 'basic_tasks'],
    latencyMs: 150,
  },
  'deepseek/deepseek-v3.2-exp': {
    id: 'deepseek/deepseek-v3.2-exp',
    name: 'DeepSeek V3.2 Experimental',
    vendor: 'deepseek',
    tier: 'economy',
    costPer1kTokens: 0.00025,
    maxTokens: 8192,
    strengths: ['very_cheap', 'good_for_price', 'high_throughput'],
    latencyMs: 200,
  },
};

// ============================================
// 작업 유형 및 복잡도
// ============================================

export type TaskType =
  | 'dialogue_response'      // 페르소나 대화 응답
  | 'choice_generation'      // 선택지 생성
  | 'event_message'          // 이벤트/알림 메시지
  | 'conversation_summary'   // 대화 요약
  | 'emotion_analysis'       // 감정 분석
  | 'story_branching'        // 스토리 분기점 결정
  | 'feed_post';             // SNS 포스트 생성

export type TaskComplexity = 'critical' | 'high' | 'medium' | 'low';

export interface TaskContext {
  type: TaskType;
  // 관계 상태
  relationshipStage?: string;
  affection?: number;
  // 감정적 중요도
  emotionalIntensity?: 'low' | 'medium' | 'high';
  isVulnerableMoment?: boolean;
  // 스토리 관련
  isStoryBranching?: boolean;
  isPremiumContent?: boolean;
  // 트래픽/비용 관련
  isHighTraffic?: boolean;
  budgetConstraint?: 'strict' | 'moderate' | 'flexible';
  // 품질 요구사항
  requiresCreativity?: boolean;
  requiresConsistency?: boolean;
  // 대화 기록 길이
  conversationLength?: number;
}

// ============================================
// 모델 선택 엔진
// ============================================

export class ModelSelector {
  private static defaultModel = 'google/gemini-2.5-flash';

  /**
   * 작업 컨텍스트를 분석하여 최적의 모델 선택
   */
  static selectModel(context: TaskContext): ModelConfig {
    const complexity = this.assessComplexity(context);
    const constraints = this.analyzeConstraints(context);

    // 복잡도와 제약조건을 종합하여 모델 선택
    const selectedModelId = this.matchModelToRequirements(complexity, constraints, context);

    return AVAILABLE_MODELS[selectedModelId] || AVAILABLE_MODELS[this.defaultModel];
  }

  /**
   * 작업 복잡도 평가
   */
  private static assessComplexity(context: TaskContext): TaskComplexity {
    let score = 0;

    // 작업 유형별 기본 복잡도
    const typeComplexity: Record<TaskType, number> = {
      story_branching: 4,       // 스토리 분기는 항상 중요
      dialogue_response: 3,     // 대화 응답은 기본적으로 중요
      emotion_analysis: 2,      // 감정 분석
      choice_generation: 2,     // 선택지 생성
      event_message: 2,         // 이벤트 메시지
      conversation_summary: 1,  // 요약은 덜 복잡
      feed_post: 1,             // 피드 포스트
    };
    score += typeComplexity[context.type] || 2;

    // 관계 단계에 따른 가중치 (깊은 관계일수록 미묘한 뉘앙스 필요)
    const stageWeight: Record<string, number> = {
      stranger: 0,
      acquaintance: 1,
      friend: 2,
      close: 3,
      intimate: 4,
      lover: 4,
    };
    score += stageWeight[context.relationshipStage || 'stranger'] || 0;

    // 감정적 중요도
    if (context.emotionalIntensity === 'high') score += 3;
    else if (context.emotionalIntensity === 'medium') score += 1;

    // 취약한 순간 (캐릭터가 본심을 드러내는 순간)
    if (context.isVulnerableMoment) score += 3;

    // 스토리 분기점
    if (context.isStoryBranching) score += 4;

    // 프리미엄 콘텐츠 (유료 사용자에게 높은 품질)
    if (context.isPremiumContent) score += 2;

    // 창의성 요구
    if (context.requiresCreativity) score += 2;

    // 일관성 요구 (캐릭터 일관성)
    if (context.requiresConsistency) score += 1;

    // 긴 대화 기록 (컨텍스트 이해 필요)
    if (context.conversationLength && context.conversationLength > 10) score += 2;

    // 점수를 복잡도로 변환
    if (score >= 12) return 'critical';
    if (score >= 8) return 'high';
    if (score >= 4) return 'medium';
    return 'low';
  }

  /**
   * 제약 조건 분석
   */
  private static analyzeConstraints(context: TaskContext): {
    preferSpeed: boolean;
    preferCost: boolean;
    preferQuality: boolean;
  } {
    return {
      preferSpeed: context.isHighTraffic === true,
      preferCost: context.budgetConstraint === 'strict',
      preferQuality: context.isPremiumContent === true ||
                     context.emotionalIntensity === 'high' ||
                     context.isStoryBranching === true,
    };
  }

  /**
   * 요구사항에 맞는 모델 매칭
   */
  private static matchModelToRequirements(
    complexity: TaskComplexity,
    constraints: { preferSpeed: boolean; preferCost: boolean; preferQuality: boolean },
    context: TaskContext
  ): string {
    // Critical: 항상 프리미엄 모델
    if (complexity === 'critical') {
      // 감정적으로 섬세한 장면은 Claude가 우수
      if (context.emotionalIntensity === 'high' || context.isVulnerableMoment) {
        return 'anthropic/claude-sonnet-4.5';
      }
      // 복잡한 스토리 분기는 GPT-5.1
      if (context.isStoryBranching) {
        return 'openai/gpt-5.1';
      }
      return 'anthropic/claude-sonnet-4.5';
    }

    // High complexity
    if (complexity === 'high') {
      // 비용 제약이 심하면 standard tier (DeepSeek이 가장 저렴)
      if (constraints.preferCost) {
        return 'deepseek/deepseek-chat-v3.1';
      }
      // 품질 우선이면 premium
      if (constraints.preferQuality) {
        return 'anthropic/claude-sonnet-4.5';
      }
      // 기본적으로 Claude Haiku (품질/비용 밸런스)
      return 'anthropic/claude-haiku-4.5';
    }

    // Medium complexity
    if (complexity === 'medium') {
      // 속도 우선
      if (constraints.preferSpeed) {
        return 'google/gemini-2.5-flash';
      }
      // 비용 우선
      if (constraints.preferCost) {
        return 'deepseek/deepseek-chat-v3.1';
      }
      return 'google/gemini-2.5-flash';
    }

    // Low complexity - economy 모델
    if (constraints.preferCost) {
      return 'deepseek/deepseek-r1-distill-qwen3-8b'; // 가장 저렴
    }
    if (constraints.preferSpeed) {
      return 'deepseek/deepseek-r1-distill-qwen3-8b'; // 가장 빠름
    }
    return 'deepseek/deepseek-v3.2-exp';
  }

  /**
   * 특정 작업 유형에 대한 기본 컨텍스트 생성
   */
  static createTaskContext(
    type: TaskType,
    overrides: Partial<TaskContext> = {}
  ): TaskContext {
    const defaults: Record<TaskType, Partial<TaskContext>> = {
      dialogue_response: {
        requiresConsistency: true,
        requiresCreativity: true,
      },
      choice_generation: {
        requiresCreativity: true,
      },
      event_message: {
        emotionalIntensity: 'medium',
      },
      conversation_summary: {
        budgetConstraint: 'strict',
      },
      emotion_analysis: {
        budgetConstraint: 'moderate',
      },
      story_branching: {
        requiresConsistency: true,
        requiresCreativity: true,
        emotionalIntensity: 'high',
      },
      feed_post: {
        budgetConstraint: 'strict',
        isHighTraffic: true,
      },
    };

    return {
      type,
      ...defaults[type],
      ...overrides,
    };
  }
}

// ============================================
// 모델 선택 로깅 (분석용)
// ============================================

export interface ModelSelectionLog {
  timestamp: Date;
  taskType: TaskType;
  complexity: TaskComplexity;
  selectedModel: string;
  context: TaskContext;
  responseTimeMs?: number;
  tokenCount?: number;
  estimatedCost?: number;
}

export class ModelSelectionLogger {
  private static logs: ModelSelectionLog[] = [];
  private static maxLogs = 1000;

  static log(entry: Omit<ModelSelectionLog, 'timestamp'>): void {
    this.logs.push({
      ...entry,
      timestamp: new Date(),
    });

    // 로그 크기 제한
    if (this.logs.length > this.maxLogs) {
      this.logs = this.logs.slice(-this.maxLogs);
    }
  }

  static getStats(): {
    totalCalls: number;
    byModel: Record<string, number>;
    byComplexity: Record<TaskComplexity, number>;
    avgResponseTime: number;
    estimatedTotalCost: number;
  } {
    const byModel: Record<string, number> = {};
    const byComplexity: Record<TaskComplexity, number> = {
      critical: 0,
      high: 0,
      medium: 0,
      low: 0,
    };
    let totalResponseTime = 0;
    let responseTimeCount = 0;
    let totalCost = 0;

    for (const log of this.logs) {
      byModel[log.selectedModel] = (byModel[log.selectedModel] || 0) + 1;
      byComplexity[log.complexity]++;

      if (log.responseTimeMs) {
        totalResponseTime += log.responseTimeMs;
        responseTimeCount++;
      }

      if (log.estimatedCost) {
        totalCost += log.estimatedCost;
      }
    }

    return {
      totalCalls: this.logs.length,
      byModel,
      byComplexity,
      avgResponseTime: responseTimeCount > 0 ? totalResponseTime / responseTimeCount : 0,
      estimatedTotalCost: totalCost,
    };
  }

  static getRecentLogs(count: number = 100): ModelSelectionLog[] {
    return this.logs.slice(-count);
  }
}
