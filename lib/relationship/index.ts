/**
 * Relationship System
 * Export all modules
 */

// Types
export * from './types';

// Stats Calculator
export {
  calculateRelationshipStage,
  getStageIndex,
  getAffectionForNextStage,
  calculateRelationshipStats,
  calculateProgressInfo,
  getArcLabel,
  applyAffectionChange,
  applyTrustChange,
  applyIntimacyChange,
  getDefaultEmotionalWeight,
  isSecretMemory,
} from './stats-calculator';

// Memory Formatter
export {
  getMemoryTitle,
  getRelationshipLabel,
  getRelationshipLabelEn,
  getSummaryTypeLabel,
  getUnlockCondition,
  canUnlockMemoryType,
  formatMemory,
  createLockedMemory,
  getLockedMemories,
  getLockedMemoriesForPersona,
  getPersonaMemoryTitle,
  getPersonaMemoryEmoji,
  formatSummary,
  getMemoryEmoji,
  getStageEmoji,
  formatRelativeTime,
  formatShortDate,
  formatFullDate,
} from './memory-formatter';

// Relationship Manager
export {
  RelationshipManager,
  getRelationshipManager,
  createRelationshipManager,
} from './relationship-manager';

// Memory Extractor (DM 자동 기억 추출)
export {
  MemoryExtractor,
  getMemoryExtractor,
  type ExtractedMemory,
  type ExtractionResult,
} from './memory-extractor';

// Session Summarizer (세션 요약 생성)
export {
  SessionSummarizer,
  getSessionSummarizer,
  type SessionMessage,
  type SessionSummaryResult,
} from './session-summarizer';

// Memory Unlock System (기억 해금 시스템)
export {
  MemoryUnlockSystem,
  getMemoryUnlockSystem,
  getPersonaMemoryTypes,
  getPersonaUnlockStatus,
  MEMORY_UNLOCK_RULES,
  type UnlockCondition,
  type MemoryUnlockRule,
  type UnlockProgress,
  type PersonaUnlockProgress,
} from './memory-unlock-system';
