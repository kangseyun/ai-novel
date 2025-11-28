/**
 * Scenario Data Types
 *
 * LLM 친화적 구조 설계 원칙:
 * 1. 명확한 계층 구조 (Persona > Episode > Scene > Beat)
 * 2. 자연어 설명 포함 (context, mood, purpose)
 * 3. 유연한 분기 시스템
 * 4. 메타데이터로 TTS/호감도 등 시스템 연동
 */

// ============================================
// 1. PERSONA (캐릭터 정의)
// ============================================
export interface Persona {
  id: string;
  name: string;
  fullName: string;
  age: number;
  occupation: string;

  // LLM이 이해할 수 있는 자연어 설명
  personality: {
    public: string;     // 대외적 성격
    private: string;    // 진짜 성격 (유저만 아는)
    quirks: string[];   // 특이한 습관/버릇
  };

  // 말투 가이드
  speechPattern: {
    style: string;        // 예: "존댓말, 가끔 반말 섞음"
    examples: string[];   // 예시 대사
    emotionalCues: Record<string, string>; // 감정별 말투 변화
  };

  // 외모 (이미지 생성용)
  appearance: {
    description: string;
    imageUrl: string;
  };

  // 관계 설정
  relationshipDynamic: string; // 유저와의 관계 역학 설명
}

// ============================================
// 2. EPISODE (에피소드)
// ============================================
export interface Episode {
  id: string;
  personaId: string;
  number: number;
  title: string;

  // LLM 컨텍스트
  premise: string;         // 에피소드 전제 (1-2문장)
  emotionalArc: string;    // 감정 곡선 설명
  keyMoments: string[];    // 핵심 순간들

  // 메타데이터
  isPremium: boolean;
  unlockCost?: number;
  estimatedMinutes: number;

  // 씬 목록
  scenes: Scene[];

  // 에피소드 레벨 분기 조건
  prerequisites?: {
    minAffection?: number;
    requiredFlags?: string[];
  };
}

// ============================================
// 3. SCENE (장면)
// ============================================
export interface Scene {
  id: string;
  episodeId: string;

  // 배경 설정
  setting: {
    location: string;      // 예: "새벽 편의점"
    time: string;          // 예: "새벽 3시"
    weather?: string;
    mood: string;          // 예: "고요하고 쓸쓸한"
    bgm?: string;          // BGM 키워드
  };

  // LLM 가이드
  purpose: string;         // 이 씬의 목적 (1문장)
  context: string;         // 상황 설명 (LLM에게 주는 컨텍스트)

  // 씬 구성 요소
  beats: Beat[];

  // 분기
  branches?: SceneBranch[];
}

// ============================================
// 4. BEAT (대화/액션 단위)
// ============================================
export type BeatType =
  | 'narration'      // 내레이션
  | 'dialogue'       // 캐릭터 대사
  | 'user_dialogue'  // 유저 선택 대사
  | 'choice'         // 선택지
  | 'dynamic'        // LLM 동적 생성
  | 'system'         // 시스템 메시지
  | 'transition';    // 장면 전환

export interface Beat {
  id: string;
  type: BeatType;

  // 콘텐츠
  content?: string;                // 고정 텍스트 (type이 dynamic이 아닌 경우)
  speaker?: 'jun' | 'user' | 'narrator';

  // 감정/스타일
  emotion?: Emotion;
  style?: 'normal' | 'whisper' | 'shout' | 'thought';

  // 동적 생성 가이드 (type: 'dynamic')
  dynamicPrompt?: {
    instruction: string;   // LLM에게 주는 지시
    constraints: string[]; // 제약 조건
    exampleOutputs?: string[];
  };

  // 선택지 (type: 'choice')
  choices?: Choice[];

  // TTS 설정
  tts?: {
    enabled: boolean;
    hookType: 'first_meeting' | 'confession' | 'cliffhanger' | 'emotional_peak' | 'whisper';
  };

  // 시스템 효과
  effects?: {
    affectionChange?: number;
    flagSet?: Record<string, boolean>;
    unlock?: string;        // 해금할 아이템/갤러리
    sound?: string;         // 효과음
    vibrate?: boolean;      // 진동
  };

  // 다음 비트로의 조건
  nextBeatId?: string;
  nextSceneId?: string;     // 다음 씬으로 이동
  conditionalNext?: {
    condition: string;      // 자연어 조건
    flagCheck?: string;
    nextBeatId: string;
  }[];
}

// ============================================
// 5. CHOICE (선택지)
// ============================================
export interface Choice {
  id: string;
  text: string;              // 선택지 텍스트

  // 메타데이터
  emotion?: Emotion;         // 이 선택의 감정 톤
  isPremium?: boolean;       // 유료 선택지
  unlockCost?: number;

  // 결과
  effects?: {
    affectionChange?: number;
    flagSet?: Record<string, boolean>;
  };

  // 분기
  nextBeatId?: string;
  nextSceneId?: string;

  // LLM 가이드 (동적 응답 생성 시)
  responseGuide?: string;    // 예: "Jun이 당황하며 반응"
}

// ============================================
// 6. BRANCH (분기)
// ============================================
export interface SceneBranch {
  id: string;
  condition: {
    type: 'flag' | 'affection' | 'choice';
    flag?: string;
    operator?: '>' | '<' | '==' | '>=' | '<=';
    value?: number | boolean | string;
  };
  targetSceneId: string;
  description?: string;      // LLM 참고용 설명
}

// ============================================
// 7. 감정 타입
// ============================================
export type Emotion =
  | 'neutral'
  | 'happy'
  | 'sad'
  | 'angry'
  | 'shy'
  | 'love'
  | 'anxious'
  | 'playful'
  | 'tired'
  | 'hurt';

// ============================================
// 8. GAME STATE (게임 상태)
// ============================================
export interface GameState {
  personaId: string;
  currentEpisodeId: string;
  currentSceneId: string;
  currentBeatIndex: number;

  // 진행 상태
  affection: number;
  flags: Record<string, boolean>;
  unlockedItems: string[];

  // 히스토리
  conversationHistory: {
    beatId: string;
    content: string;
    speaker: string;
    timestamp: number;
  }[];

  // 통계
  choicesMade: Record<string, string>;  // choiceId -> selected option
  ttsPlayed: string[];
}

// ============================================
// 9. LLM 컨텍스트 빌더
// ============================================
export interface LLMContext {
  // 캐릭터 정보
  persona: {
    name: string;
    personality: string;
    currentMood: string;
    speechStyle: string;
  };

  // 현재 상황
  scene: {
    location: string;
    time: string;
    mood: string;
    purpose: string;
  };

  // 대화 히스토리 (최근 N개)
  recentDialogue: {
    speaker: string;
    content: string;
  }[];

  // 유저 상태
  user: {
    affectionLevel: number;
    relationshipStage: string;  // 예: "처음 만남", "썸", "연인"
  };

  // 생성 지시
  instruction: string;
  constraints: string[];
}
