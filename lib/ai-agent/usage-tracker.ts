/**
 * Usage Tracker
 * 유저별 LLM 토큰 사용량 및 비용 추적
 */

import { createClient } from '@supabase/supabase-js';
import { AVAILABLE_MODELS, ModelConfig } from './model-selector';

// ============================================
// 타입 정의
// ============================================

export interface UsageRecord {
  id?: string;
  userId: string;
  modelId: string;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  estimatedCost: number; // USD
  taskType: string;
  createdAt: Date;
}

export interface UserBudget {
  userId: string;
  // 구독 플랜 기반 한도
  monthlyBudgetUsd: number;
  // 현재 월 사용량
  currentMonthUsageUsd: number;
  // 일일 한도 (급격한 사용 방지)
  dailyBudgetUsd: number;
  currentDayUsageUsd: number;
  // 마지막 업데이트
  lastResetDate: string; // YYYY-MM-DD
  updatedAt: Date;
}

export interface UsageStats {
  totalCalls: number;
  totalTokens: number;
  totalCostUsd: number;
  byModel: Record<string, { calls: number; tokens: number; cost: number }>;
  byTaskType: Record<string, { calls: number; tokens: number; cost: number }>;
}

export interface BudgetCheckResult {
  allowed: boolean;
  reason?: string;
  remainingBudgetUsd: number;
  usagePercentage: number;
}

// ============================================
// 구독 플랜별 예산
// ============================================

export const SUBSCRIPTION_BUDGETS: Record<string, { monthly: number; daily: number }> = {
  free: {
    monthly: 0.50,   // $0.50/월 (체험용)
    daily: 0.05,     // $0.05/일
  },
  basic: {
    monthly: 5.00,   // $5/월
    daily: 0.30,     // $0.30/일
  },
  premium: {
    monthly: 20.00,  // $20/월
    daily: 1.00,     // $1/일
  },
  unlimited: {
    monthly: 100.00, // $100/월 (사실상 무제한)
    daily: 10.00,    // $10/일
  },
};

// ============================================
// Usage Tracker 클래스
// ============================================

export class UsageTracker {
  private supabase;
  private memoryCache: Map<string, UserBudget> = new Map();
  private pendingRecords: UsageRecord[] = [];
  private flushInterval: NodeJS.Timeout | null = null;

  constructor() {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (supabaseUrl && supabaseKey) {
      this.supabase = createClient(supabaseUrl, supabaseKey);
      // 5초마다 배치 저장
      this.flushInterval = setInterval(() => this.flushPendingRecords(), 5000);
    }
  }

  /**
   * 토큰 사용 전 예산 체크 (로깅용 - 차단하지 않음)
   */
  async checkBudget(
    userId: string,
    estimatedTokens: number,
    modelId: string
  ): Promise<BudgetCheckResult> {
    const budget = await this.getUserBudget(userId);
    const modelConfig = AVAILABLE_MODELS[modelId];

    const costPer1k = modelConfig?.costPer1kTokens || 0.001;
    const estimatedCost = (estimatedTokens / 1000) * costPer1k;

    const remainingMonthly = budget.monthlyBudgetUsd - budget.currentMonthUsageUsd;
    const remainingDaily = budget.dailyBudgetUsd - budget.currentDayUsageUsd;
    const remainingBudget = Math.min(remainingMonthly, remainingDaily);
    const usagePercentage = (budget.currentMonthUsageUsd / budget.monthlyBudgetUsd) * 100;

    // 예산 초과 여부 체크 (실제 차단은 하지 않고 로깅용)
    if (estimatedCost > remainingBudget) {
      return {
        allowed: false,
        reason: remainingDaily < estimatedCost
          ? 'daily_budget_exceeded'
          : 'monthly_budget_exceeded',
        remainingBudgetUsd: remainingBudget,
        usagePercentage,
      };
    }

    return {
      allowed: true,
      remainingBudgetUsd: remainingBudget,
      usagePercentage,
    };
  }

  /**
   * 토큰 사용 기록
   */
  async recordUsage(
    userId: string,
    modelId: string,
    usage: { prompt_tokens: number; completion_tokens: number; total_tokens: number },
    taskType: string
  ): Promise<void> {
    const modelConfig = AVAILABLE_MODELS[modelId];
    const estimatedCost = modelConfig
      ? (usage.total_tokens / 1000) * modelConfig.costPer1kTokens
      : 0;

    const record: UsageRecord = {
      userId,
      modelId,
      promptTokens: usage.prompt_tokens,
      completionTokens: usage.completion_tokens,
      totalTokens: usage.total_tokens,
      estimatedCost,
      taskType,
      createdAt: new Date(),
    };

    // 메모리 캐시 업데이트
    await this.updateBudgetCache(userId, estimatedCost);

    // 배치 저장을 위해 큐에 추가
    this.pendingRecords.push(record);
  }

  /**
   * 유저 예산 정보 조회
   */
  async getUserBudget(userId: string): Promise<UserBudget> {
    // 캐시 확인
    const cached = this.memoryCache.get(userId);
    const today = new Date().toISOString().split('T')[0];

    if (cached && cached.lastResetDate === today) {
      return cached;
    }

    // DB에서 조회
    if (this.supabase) {
      try {
        const { data } = await this.supabase
          .from('user_llm_budgets')
          .select('*')
          .eq('user_id', userId)
          .single();

        if (data) {
          const budget = this.mapDbToBudget(data, today);
          this.memoryCache.set(userId, budget);
          return budget;
        }
      } catch {
        // DB 에러시 기본값 사용
      }
    }

    // 기본값 (free tier)
    const defaultBudget: UserBudget = {
      userId,
      monthlyBudgetUsd: SUBSCRIPTION_BUDGETS.free.monthly,
      currentMonthUsageUsd: 0,
      dailyBudgetUsd: SUBSCRIPTION_BUDGETS.free.daily,
      currentDayUsageUsd: 0,
      lastResetDate: today,
      updatedAt: new Date(),
    };

    this.memoryCache.set(userId, defaultBudget);
    return defaultBudget;
  }

  /**
   * 유저 사용 통계 조회
   */
  async getUserStats(
    userId: string,
    startDate?: Date,
    endDate?: Date
  ): Promise<UsageStats> {
    const stats: UsageStats = {
      totalCalls: 0,
      totalTokens: 0,
      totalCostUsd: 0,
      byModel: {},
      byTaskType: {},
    };

    if (!this.supabase) return stats;

    try {
      let query = this.supabase
        .from('llm_usage_records')
        .select('*')
        .eq('user_id', userId);

      if (startDate) {
        query = query.gte('created_at', startDate.toISOString());
      }
      if (endDate) {
        query = query.lte('created_at', endDate.toISOString());
      }

      const { data } = await query;

      if (data) {
        for (const record of data) {
          stats.totalCalls++;
          stats.totalTokens += record.total_tokens;
          stats.totalCostUsd += record.estimated_cost;

          // By model
          if (!stats.byModel[record.model_id]) {
            stats.byModel[record.model_id] = { calls: 0, tokens: 0, cost: 0 };
          }
          stats.byModel[record.model_id].calls++;
          stats.byModel[record.model_id].tokens += record.total_tokens;
          stats.byModel[record.model_id].cost += record.estimated_cost;

          // By task type
          if (!stats.byTaskType[record.task_type]) {
            stats.byTaskType[record.task_type] = { calls: 0, tokens: 0, cost: 0 };
          }
          stats.byTaskType[record.task_type].calls++;
          stats.byTaskType[record.task_type].tokens += record.total_tokens;
          stats.byTaskType[record.task_type].cost += record.estimated_cost;
        }
      }
    } catch (error) {
      console.error('Failed to get usage stats:', error);
    }

    return stats;
  }

  /**
   * 구독 플랜 변경시 예산 업데이트
   */
  async updateSubscription(userId: string, plan: keyof typeof SUBSCRIPTION_BUDGETS): Promise<void> {
    const budgetConfig = SUBSCRIPTION_BUDGETS[plan];

    if (this.supabase) {
      await this.supabase
        .from('user_llm_budgets')
        .upsert({
          user_id: userId,
          monthly_budget_usd: budgetConfig.monthly,
          daily_budget_usd: budgetConfig.daily,
          updated_at: new Date().toISOString(),
        });
    }

    // 캐시 업데이트
    const cached = this.memoryCache.get(userId);
    if (cached) {
      cached.monthlyBudgetUsd = budgetConfig.monthly;
      cached.dailyBudgetUsd = budgetConfig.daily;
    }
  }

  // ============================================
  // Private Methods
  // ============================================

  private async updateBudgetCache(userId: string, cost: number): Promise<void> {
    const budget = await this.getUserBudget(userId);
    budget.currentMonthUsageUsd += cost;
    budget.currentDayUsageUsd += cost;
    budget.updatedAt = new Date();
    this.memoryCache.set(userId, budget);
  }

  private async flushPendingRecords(): Promise<void> {
    if (this.pendingRecords.length === 0 || !this.supabase) return;

    const records = [...this.pendingRecords];
    this.pendingRecords = [];

    try {
      await this.supabase
        .from('llm_usage_records')
        .insert(records.map(r => ({
          user_id: r.userId,
          model_id: r.modelId,
          prompt_tokens: r.promptTokens,
          completion_tokens: r.completionTokens,
          total_tokens: r.totalTokens,
          estimated_cost: r.estimatedCost,
          task_type: r.taskType,
          created_at: r.createdAt.toISOString(),
        })));

      // 유저별 예산도 DB에 반영
      const userCosts = new Map<string, number>();
      for (const record of records) {
        const current = userCosts.get(record.userId) || 0;
        userCosts.set(record.userId, current + record.estimatedCost);
      }

      for (const [userId, cost] of userCosts) {
        await this.supabase.rpc('increment_user_usage', {
          p_user_id: userId,
          p_cost: cost,
        });
      }
    } catch (error) {
      // 실패한 레코드는 다시 큐에 추가
      this.pendingRecords.push(...records);
      console.error('Failed to flush usage records:', error);
    }
  }

  private mapDbToBudget(data: Record<string, unknown>, today: string): UserBudget {
    const lastResetDate = data.last_reset_date as string;
    const isNewDay = lastResetDate !== today;
    const isNewMonth = !lastResetDate || lastResetDate.slice(0, 7) !== today.slice(0, 7);

    return {
      userId: data.user_id as string,
      monthlyBudgetUsd: data.monthly_budget_usd as number,
      currentMonthUsageUsd: isNewMonth ? 0 : (data.current_month_usage_usd as number || 0),
      dailyBudgetUsd: data.daily_budget_usd as number,
      currentDayUsageUsd: isNewDay ? 0 : (data.current_day_usage_usd as number || 0),
      lastResetDate: today,
      updatedAt: new Date(data.updated_at as string),
    };
  }

  /**
   * 클린업
   */
  async cleanup(): Promise<void> {
    if (this.flushInterval) {
      clearInterval(this.flushInterval);
    }
    await this.flushPendingRecords();
  }
}

// ============================================
// 싱글톤 인스턴스
// ============================================

let usageTrackerInstance: UsageTracker | null = null;

export function getUsageTracker(): UsageTracker {
  if (!usageTrackerInstance) {
    usageTrackerInstance = new UsageTracker();
  }
  return usageTrackerInstance;
}

// ============================================
// Budget Guard (로깅용 - 차단하지 않음)
// ============================================

export class BudgetGuard {
  private tracker: UsageTracker;

  constructor() {
    this.tracker = getUsageTracker();
  }

  /**
   * 호출 전 예산 체크 (로깅용 - 차단하지 않음)
   * 가격 정책은 별도로 설정하고, 여기서는 통계만 수집
   */
  async preCallCheck(
    userId: string,
    requestedModel: string,
    estimatedTokens: number = 2000
  ): Promise<{
    budgetStatus: BudgetCheckResult;
    warning?: string;
  }> {
    const result = await this.tracker.checkBudget(userId, estimatedTokens, requestedModel);

    // 경고 메시지 생성 (로깅용)
    let warning: string | undefined;
    if (!result.allowed) {
      warning = result.reason === 'daily_budget_exceeded'
        ? `[LOG] Daily budget exceeded for user ${userId}`
        : `[LOG] Monthly budget exceeded for user ${userId}`;
    } else if (result.usagePercentage >= 80) {
      warning = `[LOG] User ${userId} has used ${result.usagePercentage.toFixed(0)}% of monthly budget`;
    }

    if (warning) {
      console.warn(warning);
    }

    return {
      budgetStatus: result,
      warning,
    };
  }

  /**
   * 호출 후 사용량 기록
   */
  async postCallRecord(
    userId: string,
    modelId: string,
    usage: { prompt_tokens: number; completion_tokens: number; total_tokens: number },
    taskType: string
  ): Promise<void> {
    await this.tracker.recordUsage(userId, modelId, usage, taskType);
  }
}

export function getBudgetGuard(): BudgetGuard {
  return new BudgetGuard();
}
