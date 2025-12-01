/**
 * AI Agent System Types
 * 동적 시나리오 생성 + 이벤트 트리거 시스템
 */

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

export interface ScheduledEvent {
  id: string;
  userId: string;
  personaId: string;
  eventType: EventType;
  eventData: EventData;
  scheduledFor: Date;
  status: 'pending' | 'delivered' | 'cancelled' | 'expired';
  deliveryConditions: Record<string, unknown>;
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
  | 'choice_made'
  | 'premium_purchased'
  | 'episode_started'
  | 'episode_completed'
  | 'profile_viewed'
  | 'notification_clicked';
