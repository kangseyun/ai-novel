/**
 * Relationship System Types
 * UI 기억 페이지 및 관계 관리용 타입 정의
 */

// ============================================
// 관계 단계
// ============================================

export type RelationshipStage =
  | 'stranger'      // 처음
  | 'acquaintance'  // 아는 사이
  | 'friend'        // 친구
  | 'close'         // 가까운 사이
  | 'intimate'      // 특별한 사이
  | 'lover';        // 연인

export const RELATIONSHIP_STAGES: RelationshipStage[] = [
  'stranger',
  'acquaintance',
  'friend',
  'close',
  'intimate',
  'lover',
];

// ============================================
// 기억 타입
// ============================================

export type MemoryType =
  | 'first_meeting'     // 첫 만남
  | 'promise'           // 약속
  | 'secret_shared'     // 비밀 공유
  | 'conflict'          // 갈등
  | 'reconciliation'    // 화해
  | 'intimate_moment'   // 특별한 순간
  | 'gift_received'     // 선물
  | 'milestone'         // 마일스톤
  | 'user_preference'   // 유저 취향
  | 'emotional_event'   // 감정적 사건
  | 'location_memory'   // 함께 간 장소
  | 'nickname'          // 별명
  | 'inside_joke'       // 둘만의 농담
  | 'important_date';   // 중요한 날짜

export const ALL_MEMORY_TYPES: MemoryType[] = [
  'first_meeting',
  'promise',
  'secret_shared',
  'conflict',
  'reconciliation',
  'intimate_moment',
  'gift_received',
  'milestone',
  'user_preference',
  'emotional_event',
  'location_memory',
  'nickname',
  'inside_joke',
  'important_date',
];

// UI에서 카드로 표시할 기본 기억 타입 (fallback)
export const DEFAULT_DISPLAYABLE_MEMORY_TYPES: MemoryType[] = [
  'first_meeting',
  'promise',
  'secret_shared',
  'conflict',
  'reconciliation',
  'intimate_moment',
  'gift_received',
  'milestone',
];

// @deprecated - Use persona-specific memory types from PersonaConfig instead
export const DISPLAYABLE_MEMORY_TYPES = DEFAULT_DISPLAYABLE_MEMORY_TYPES;

// ============================================
// 관계 상태
// ============================================

export interface RelationshipState {
  userId: string;
  personaId: string;

  // 수치
  affection: number;        // 호감도 (0-100)
  trustLevel: number;       // 신뢰도 (0-100)
  intimacyLevel: number;    // 친밀도 (0-100)
  tensionLevel: number;     // 긴장감 (0-100)

  // 단계
  stage: RelationshipStage;

  // 별명
  userNickname: string | null;    // 페르소나가 유저를 부르는 별명
  personaNickname: string | null; // 유저가 페르소나를 부르는 별명

  // 플래그
  storyFlags: Record<string, boolean>;

  // 진행도
  completedScenarios: string[];
  unlockedSecrets: string[];

  // 통계
  totalMessages: number;
  longestConversationLength: number;
  sharedSecretsCount: number;
  conflictsResolved: number;

  // 시간
  firstInteractionAt: Date | null;
  lastInteractionAt: Date | null;
}

// ============================================
// 기억 (Memory)
// ============================================

export interface Memory {
  id: string;
  userId: string;
  personaId: string;

  type: MemoryType;
  summary: string;
  details: Record<string, unknown>;

  emotionalWeight: number;    // 1-10
  importanceScore: number;    // 1-10
  affectionAtTime: number;    // 기억 형성 시점의 호감도

  referenceCount: number;     // 참조 횟수
  lastReferencedAt: Date | null;

  sourceType: 'dm' | 'scenario' | 'event' | 'manual';
  sourceId: string | null;

  isActive: boolean;
  createdAt: Date;
}

export interface LockedMemory {
  id: string;
  type: MemoryType;
  title: string;
  unlockCondition: string;
  isLocked: true;
}

// ============================================
// 대화 요약
// ============================================

export type SummaryType = 'session' | 'daily' | 'weekly' | 'relationship_arc';

export interface ConversationSummary {
  id: string;
  userId: string;
  personaId: string;
  sessionId: string | null;

  type: SummaryType;
  summary: string;
  topics: string[];

  emotionalArc: {
    start: string;
    end: string;
    keyMoments: string[];
  };

  affectionStart: number;
  affectionEnd: number;
  flagsSet: Record<string, boolean>;

  periodStart: Date;
  periodEnd: Date;
  createdAt: Date;
}

// ============================================
// 스탯 (레이더 차트용)
// ============================================

export interface RelationshipStats {
  trust: number;      // 신뢰 (0-100)
  intimacy: number;   // 친밀도 (0-100)
  mystery: number;    // 미스터리 (0-100) - 비밀 해금할수록 감소
  chemistry: number;  // 케미 (0-100)
  loyalty: number;    // 충성도 (0-100)
}

// ============================================
// 진행도
// ============================================

export interface ProgressInfo {
  storyProgress: number;      // 완료한 시나리오 수
  totalStories: number;       // 총 시나리오 수
  currentArc: string;         // 현재 챕터 (예: "Chapter 2: 가까워지는 마음")
  unlockedSecrets: number;    // 해금된 비밀 수
  totalSecrets: number;       // 총 비밀 수
}

// ============================================
// UI용 통합 데이터
// ============================================

export interface PersonaRelationshipSummary {
  // 페르소나 정보
  id: string;
  name: string;
  fullName: string;
  role: string;
  image: string;

  // 관계 수치
  affection: number;
  trust: number;
  intimacy: number;
  stage: RelationshipStage;
  stageLabel: string;

  // 진행도
  storyProgress: number;
  totalStories: number;
  unlockedSecrets: number;
  totalSecrets: number;
  currentArc: string;

  // 별명
  userNickname: string | null;
  personaNickname: string | null;

  // 통계
  totalMessages: number;
  firstInteractionAt: string | null;
  lastInteractionAt: string | null;

  // 기억 목록 (해금된 것만)
  memories: FormattedMemory[];
}

export interface FormattedMemory {
  id: string;
  type: MemoryType;
  title: string;
  content: string;
  details: Record<string, unknown>;
  emotionalWeight: number;
  createdAt: string;
  isLocked: false;
}

export interface PersonaRelationshipDetail extends PersonaRelationshipSummary {
  // 상세 스탯
  stats: RelationshipStats;

  // 잠긴 메모
  lockedMemos: LockedMemory[];

  // 최근 대화 요약
  recentSummaries: FormattedSummary[];
}

export interface FormattedSummary {
  id: string;
  type: SummaryType;
  summary: string;
  topics: string[];
  emotionalArc: Record<string, unknown>;
  periodStart: string;
  periodEnd: string;
}

// ============================================
// API 응답 타입
// ============================================

export interface MemoryListResponse {
  personas: PersonaRelationshipSummary[];
  stats: {
    totalCharacters: number;
    totalSecrets: number;
    totalStories: number;
  };
}

export interface MemoryDetailResponse {
  exists: boolean;
  persona?: {
    id: string;
    name: string;
    fullName: string;
    role: string;
    image: string;
  };
  relationship?: {
    stage: RelationshipStage;
    stageLabel: string;
    affection: number;
    trust: number;
    intimacy: number;
    totalMessages: number;
    firstInteractionAt: string | null;
    lastInteractionAt: string | null;
    userNickname: string | null;
    personaNickname: string | null;
  };
  stats?: RelationshipStats;
  progress?: ProgressInfo;
  memories?: FormattedMemory[];
  lockedMemos?: LockedMemory[];
  recentSummaries?: FormattedSummary[];
}

// ============================================
// 입력 타입
// ============================================

export interface SaveMemoryInput {
  type: MemoryType;
  summary: string;
  details?: Record<string, unknown>;
  emotionalWeight?: number;
  sourceType?: 'dm' | 'scenario' | 'event' | 'manual';
  sourceId?: string;
}

export interface UpdateRelationshipInput {
  affectionChange?: number;
  trustChange?: number;
  intimacyChange?: number;
  tensionChange?: number;
  flagsToSet?: Record<string, boolean>;
  incrementMessages?: boolean;
}

export interface SetNicknameInput {
  type: 'user' | 'persona';  // user = 페르소나가 부르는, persona = 유저가 부르는
  nickname: string;
}
