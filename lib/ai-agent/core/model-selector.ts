/**
 * Dynamic Model Selector
 * 2가지 모델만 사용: DeepSeek V3.2 (기본), Gemini 3 Pro (고품질)
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

export type ModelTier = 'premium' | 'standard';

// 사용 가능한 모델 (2개만)
export const AVAILABLE_MODELS: Record<string, ModelConfig> = {
  // Premium - 고품질 (High complexity)
  'google/gemini-3-pro-preview': {
    id: 'google/gemini-3-pro-preview',
    name: 'Gemini 3 Pro Preview',
    vendor: 'google',
    tier: 'premium',
    costPer1kTokens: 0.005625, // $1.25/1M input, $10/1M output 평균
    maxTokens: 16384,
    strengths: ['complex_reasoning', 'creative_writing', 'character_consistency'],
    latencyMs: 1500,
  },

  // Standard - 기본 (빠르고 저렴, 품질도 좋음)
  'deepseek/deepseek-v3.2': {
    id: 'deepseek/deepseek-v3.2',
    name: 'DeepSeek V3.2',
    vendor: 'deepseek',
    tier: 'standard',
    costPer1kTokens: 0.00021, // $0.14/1M input, $0.28/1M output 평균
    maxTokens: 8192,
    strengths: ['very_fast', 'very_cost_effective', 'good_quality', 'character_consistency'],
    latencyMs: 450,
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
// 모델 선택 엔진 (2개 모델만)
// ============================================

export class ModelSelector {
  private static defaultModel = 'deepseek/deepseek-v3.2';
  private static premiumModel = 'google/gemini-3-pro-preview';

  /**
   * 작업 컨텍스트를 분석하여 최적의 모델 선택
   */
  static selectModel(context: TaskContext): ModelConfig {
    const complexity = this.assessComplexity(context);

    // High complexity면 Gemini 3 Pro
    if (complexity === 'high') {
      return AVAILABLE_MODELS[this.premiumModel];
    }

    // 그 외 모든 경우: DeepSeek V3.2 (빠르고 저렴하고 품질도 좋음)
    return AVAILABLE_MODELS[this.defaultModel];
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
    if (score >= 10) return 'high';
    if (score >= 5) return 'medium';
    return 'low';
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
