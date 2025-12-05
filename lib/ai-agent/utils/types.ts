/**
 * AI Agent System Types
 * 동적 시나리오 생성 + 이벤트 트리거 시스템
 */

import type { DeliveryConditions } from './schemas';

// ============================================
// 페르소나 관련 타입
// ============================================

export interface Persona {
  id: string;
  name: string;
  fullName: string;
  role: string;
  age: number;
  ethnicity: string;
  appearance: PersonaAppearance;
  voiceDescription: string;
}

export interface PersonaAppearance {
  hair: string;
  eyes: string;
  build: string;
  style: string;
  distinguishingFeatures: string[];
}

export interface PersonaTraits {
  surfacePersonality: string[];
  hiddenPersonality: string[];
  coreTrope: string;
  likes: string[];
  dislikes: string[];
  speechPatterns: SpeechPatterns;
  behaviorByStage: Record<RelationshipStage, StageBehavior>;
}

export interface SpeechPatterns {
  formality: 'high' | 'medium' | 'low' | 'minimal' | 'cute_informal' | 'mock_polite';
  petNames: string[];
  verbalTics: string[];
  emotionalRange: string;
}

export interface StageBehavior {
  tone: string;
  distance: string;
  [key: string]: string;
}

export interface PersonaWorldview {
  settings: string[];
  timePeriod: string;
  defaultRelationship: string;
  relationshipAlternatives: string[];
  mainConflict: string;
  conflictStakes: string;
  openingLine: string;
  storyHooks: string[];
  boundaries: string[];
}

// ============================================
// 관계 상태 타입
// ============================================

export type RelationshipStage =
  | 'stranger'
  | 'acquaintance'
  | 'friend'
  | 'close'
  | 'intimate'
  | 'lover';

export interface RelationshipState {
  oduserId: string;
  personaId: string;
  affection: number;  // 0-100
  relationshipStage: RelationshipStage;
  trustLevel: number;
  intimacyLevel: number;
  tensionLevel: number;
  completedEpisodes: string[];
  unlockedEpisodes: string[];
  storyFlags: Record<string, boolean>;
  memorableMoments: MemorableMoment[];
  lastInteractionAt: Date | null;
  // 통계 필드
  totalMessages?: number;
  firstInteractionAt?: Date | null;
}

export interface MemorableMoment {
  type: string;
  summary: string;
  affectionAtTime: number;
  timestamp: Date;
}

// ============================================
// 대화 시스템 타입
// ============================================

export interface ConversationSession {
  id: string;
  userId: string;
  personaId: string;
  status: 'active' | 'paused' | 'completed';
  currentScenario: ScenarioContext;
  affectionAtStart: number;
  relationshipStage: RelationshipStage;
  conversationSummary: string | null;
  activeFlags: Record<string, boolean>;
  emotionalState: EmotionalState;
}

export interface ScenarioContext {
  episodeId?: string;
  sceneId?: string;
  beatIndex?: number;
  situationDescription?: string;
}

export interface EmotionalState {
  personaMood: PersonaMood;
  tensionLevel: number;  // 0-10
  vulnerabilityShown: boolean;
}

export type PersonaMood =
  | 'neutral'
  | 'happy'
  | 'sad'
  | 'angry'
  | 'flirty'
  | 'vulnerable'
  | 'playful'
  | 'jealous'
  | 'worried'
  | 'excited';

export interface ConversationMessage {
  id: string;
  sessionId: string;
  role: 'user' | 'persona' | 'system' | 'narrator';
  content: string;
  emotion?: PersonaMood;
  innerThought?: string;
  choiceData?: ChoiceData;
  affectionChange: number;
  flagsChanged: Record<string, boolean>;
  sequenceNumber: number;
  createdAt: Date;
}

export interface ChoiceData {
  choiceId: string;
  choiceText: string;
  wasPremium: boolean;
}

// ============================================
// 선택지 시스템 타입
// ============================================

export interface DialogueChoice {
  id: string;
  text: string;
  tone: ChoiceTone;
  isPremium: boolean;
  premiumCost?: number;
  estimatedAffectionChange: number;
  flagsToSet?: Record<string, boolean>;
  nextBeatHint?: string;
}

export type ChoiceTone =
  | 'neutral'
  | 'friendly'
  | 'flirty'
  | 'cold'
  | 'playful'
  | 'bold'
  | 'shy'
  | 'confrontational'
  | 'supportive';

// ============================================
// 이벤트 트리거 시스템 타입
// ============================================

export interface EventTriggerRule {
  id: string;
  personaId: string | null;
  eventType: EventType;
  triggerConditions: TriggerConditions;
  baseProbability: number;
  probabilityModifiers: ProbabilityModifiers;
  eventTemplate: EventTemplate;
  cooldownMinutes: number;
  priority: number;
}

export type EventType =
  | 'dm_message'
  | 'feed_post'
  | 'story_update'
  | 'special_event'
  | 'notification';

export interface TriggerConditions {
  userAction?: string;
  actionData?: Record<string, unknown>;
  minAffection?: number;
  maxAffection?: number;
  relationshipStage?: RelationshipStage[];
  hoursSinceLastActivity?: { min?: number; max?: number };
  timeRange?: { start: string; end: string };
  randomDaily?: boolean;
  minMinutesAfter?: number;
  maxMinutesAfter?: number;
}

export interface ProbabilityModifiers {
  affectionPer10?: number;
  intimateSageBonus?: number;
  nightTimeBonus?: number;
  userOnlineBonus?: number;
  daysInactiveBonus?: number;
  consecutivePremiumBonus?: number;
  daysSinceLastPostBonus?: number;
  maxProbability?: number;
}

export interface EventTemplate {
  requireLlmGeneration: boolean;
  llmContextHint: string;
  fallbackTemplates?: string[];
  themes?: string[];
  mood?: PersonaMood;
  emotionalIntensity?: 'low' | 'medium' | 'high';
  postTypes?: string[];
  referenceEpisode?: boolean;
}

// DeliveryConditions is exported from ./schemas via Zod inference

export interface ScheduledEvent {
  id: string;
  userId: string;
  personaId: string;
  eventType: EventType;
  eventData: EventData;
  scheduledFor: Date;
  status: 'pending' | 'delivered' | 'cancelled' | 'expired';
  deliveryConditions: DeliveryConditions;
}

export interface EventData {
  messageContent?: string;
  postContent?: PostContent;
  triggerRuleId?: string;
  generatedBy: 'llm' | 'template' | 'system';
}

export interface PostContent {
  type: 'mood' | 'photo' | 'thought' | 'teaser';
  text: string;
  imageUrl?: string;
  mood?: string;
}

// ============================================
// LLM 요청/응답 타입
// ============================================

export interface LLMContext {
  persona: Persona;
  traits: PersonaTraits;
  worldview: PersonaWorldview;
  relationship: RelationshipState;
  userPersona: UserPersonaContext;
  conversationHistory: ConversationMessage[];
  currentSituation: string;
  emotionalState: EmotionalState;
}

export interface UserPersonaContext {
  nickname: string;
  personalityType: string;
  communicationStyle: string;
  emotionalTendency: string;
  interests: string[];
  loveLanguage: string;
  attachmentStyle: string;
  language: string; // 'ko', 'en', 'ja' 등
}

export interface LLMDialogueRequest {
  context: LLMContext;
  promptType: 'response' | 'choice_generation' | 'event_message' | 'feed_post';
  additionalInstructions?: string;
}

export interface LLMDialogueResponse {
  content: string;
  emotion: PersonaMood;
  innerThought?: string;
  suggestedChoices?: DialogueChoice[];
  affectionModifier: number;
  flagsToSet?: Record<string, boolean>;
  // 시나리오 전환 트리거
  scenarioTrigger?: {
    shouldStart: boolean;
    scenarioType: 'meeting' | 'date' | 'confession' | 'conflict' | 'intimate' | 'custom';
    scenarioContext: string; // 시나리오 배경 설명
    location?: string;
    transitionMessage?: string; // "10분 후..." 같은 전환 메시지
  };
}

// ============================================
// 유저 행동 로그 타입
// ============================================

export interface UserActivity {
  userId: string;
  personaId?: string;
  actionType: UserActionType;
  actionData: Record<string, unknown>;
  sessionId?: string;
  timestamp: Date;
}

export type UserActionType =
  | 'app_open'
  | 'feed_view'
  | 'post_created'
  | 'message_sent'
  | 'message_received'
  | 'choice_made'
  | 'premium_purchased'
  | 'episode_started'
  | 'episode_completed'
  | 'profile_viewed'
  | 'notification_clicked';

// ============================================
// 메모리 시스템 타입 (통합)
// ============================================

/**
 * 메모리 타입 - 14가지 기억 카테고리
 * memory-system.ts와 memory-service.ts에서 공통으로 사용
 */
export type MemoryType =
  | 'first_meeting'       // 첫 만남
  | 'promise'             // 유저와의 약속
  | 'secret_shared'       // 공유된 비밀
  | 'conflict'            // 갈등/다툼
  | 'reconciliation'      // 화해
  | 'intimate_moment'     // 친밀한 순간
  | 'gift_received'       // 선물 받음
  | 'milestone'           // 관계 마일스톤
  | 'user_preference'     // 유저 취향/선호도
  | 'emotional_event'     // 감정적 사건
  | 'location_memory'     // 함께 간 장소
  | 'nickname'            // 별명
  | 'inside_joke'         // 둘만의 농담
  | 'important_date';     // 중요한 날짜

/**
 * 메모리 타입별 라벨 (UI 표시용)
 */
export const MEMORY_TYPE_LABELS: Record<MemoryType, string> = {
  first_meeting: '첫 만남',
  promise: '약속',
  secret_shared: '공유된 비밀',
  conflict: '갈등',
  reconciliation: '화해',
  intimate_moment: '친밀한 순간',
  gift_received: '받은 선물',
  milestone: '관계 마일스톤',
  user_preference: '유저 취향',
  emotional_event: '감정적 사건',
  location_memory: '함께 간 장소',
  nickname: '별명',
  inside_joke: '둘만의 농담',
  important_date: '중요한 날짜',
};

/**
 * 통합 메모리 인터페이스
 * PersonaMemory(memory-system)와 Memory(memory-service)를 통합
 */
export interface PersonaMemory {
  id: string;
  userId: string;
  personaId: string;
  memoryType: MemoryType;
  summary: string;
  details: Record<string, unknown>;
  emotionalWeight: number;       // 감정적 가중치 (1-10)
  affectionAtTime: number;       // 기억 생성 시점의 호감도
  importanceScore?: number;      // 중요도 점수 (1-10)
  isActive?: boolean;            // 활성 상태 (기본: true)
  sourceType?: MemorySourceType; // 기억 출처
  sourceId?: string;             // 출처 ID (세션 ID 등)
  lastReferencedAt: Date | null;
  referenceCount: number;
  expiresAt?: Date | null;       // 만료일 (null이면 영구)
  createdAt: Date;
}

/**
 * 메모리 출처 타입
 */
export type MemorySourceType = 'dm' | 'scenario' | 'event' | 'system';

/**
 * 대화 요약 인터페이스
 */
export interface ConversationSummary {
  id: string;
  userId: string;
  personaId: string;
  sessionId: string | null;
  summaryType: 'session' | 'daily' | 'weekly' | 'relationship_arc';
  summary: string;
  topics: string[];
  emotionalArc: Record<string, unknown>;
  affectionStart: number;
  affectionEnd: number;
  flagsSet: Record<string, boolean>;
  periodStart: Date;
  periodEnd: Date;
  createdAt: Date;
}

/**
 * 메모리 추출 결과
 */
export interface MemoryExtractionResult {
  shouldSave: boolean;
  memoryType?: MemoryType;
  summary?: string;
  details?: Record<string, unknown>;
  emotionalWeight?: number;
  importanceScore?: number;
}

/**
 * 메모리 저장 옵션
 */
export interface MemorySaveOptions {
  emotionalWeight?: number;
  importanceScore?: number;
  sourceType?: MemorySourceType;
  sourceId?: string;
}

/**
 * 메모리 조회 옵션
 */
export interface MemoryQueryOptions {
  types?: MemoryType[];
  limit?: number;
  minEmotionalWeight?: number;
  minImportance?: number;
  activeOnly?: boolean;
}
