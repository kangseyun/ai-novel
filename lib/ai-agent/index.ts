/**
 * AI Agent System
 * Export all modules
 *
 * 핵심 원칙:
 * 1. 페르소나 일관성 - persona_core의 데이터는 절대 변하지 않음
 * 2. 기억 유지 - 모든 중요 대화는 영구 저장
 * 3. 컨텍스트 연속성 - 이전 대화를 기억하고 참조
 */

// Types
export * from './types';

// Core Agent
export { AIAgent, getAIAgent } from './ai-agent';

// LLM Client
export { LLMClient, getLLMClient } from './llm-client';
export type { LLMCallOptions } from './llm-client';

// Model Selection (Dynamic Model Routing)
export {
  ModelSelector,
  ModelSelectionLogger,
  AVAILABLE_MODELS,
} from './model-selector';
export type {
  ModelConfig,
  ModelTier,
  TaskType,
  TaskComplexity,
  TaskContext,
  ModelSelectionLog,
} from './model-selector';

// Usage Tracking & Budget Guard
export {
  UsageTracker,
  getUsageTracker,
  BudgetGuard,
  getBudgetGuard,
  SUBSCRIPTION_BUDGETS,
} from './usage-tracker';
export type {
  UsageRecord,
  UserBudget,
  UsageStats,
  BudgetCheckResult,
} from './usage-tracker';

// Event System
export {
  EventTriggerEngine,
  EventScheduler,
  RetentionAnalyzer,
} from './event-trigger-engine';

// Event Trigger Service (DB Connected)
export {
  EventTriggerService,
  getEventTriggerService,
} from './event-trigger-service';

// Prompt Builder
export {
  buildSystemPrompt,
  buildResponsePrompt,
  buildChoiceGenerationPrompt,
  buildEventMessagePrompt,
  buildSummaryPrompt,
  STAGE_TONE_GUIDE,
  suggestEmotionTransition,
} from './prompt-builder';

// Memory System (NEW)
export { MemoryManager } from './memory-system';
export type { PersonaMemory, ConversationSummary, MemoryType } from './memory-system';

// Memory Service (Enhanced)
export { MemoryService, getMemoryService } from './memory-service';
export type { Memory, MemoryExtractionResult } from './memory-service';

// Persona Loader (NEW)
export { PersonaLoader, getPersonaLoader } from './persona-loader';
export type { PersonaCoreData, PersonaBehavior } from './persona-loader';

// Scenario Service (NEW)
export { ScenarioService, getScenarioService } from './scenario-service';
export type {
  ScenarioTemplate,
  ScenarioContent,
  ScenarioScene,
  ScenarioChoice,
  UserScenarioProgress,
} from './scenario-service';

// Emotional State Tracker (일관성 유지의 핵심!)
export {
  EmotionalStateTracker,
  getEmotionalStateTracker,
} from './emotional-state-tracker';
export type {
  EmotionalSnapshot,
  EmotionalEvent,
  ConflictRecord,
  ConflictType,
  ResolutionType,
} from './emotional-state-tracker';

// Response Validator (응답 일관성 검증)
export {
  ResponseValidator,
  validateAndCorrectResponse,
} from './response-validator';
export type {
  ValidationResult,
  ValidationIssue,
} from './response-validator';

// Prompt Builder Types
export type { EmotionalContextForPrompt } from './prompt-builder';
