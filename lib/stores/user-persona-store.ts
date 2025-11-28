import { create } from 'zustand';
import { persist } from 'zustand/middleware';

// 유저 페르소나 타입
export interface UserPersona {
  // 기본 정보
  nickname: string;
  profileImage: string | null;
  bio: string;

  // 성격/성향
  personality: PersonalityType;
  communicationStyle: CommunicationStyle;
  emotionalTendency: EmotionalTendency;

  // 관심사
  interests: string[];

  // 연애 스타일
  loveLanguage: LoveLanguage;
  attachmentStyle: AttachmentStyle;
}

// 성격 타입
export type PersonalityType =
  | 'introverted'   // 내향적
  | 'extroverted'   // 외향적
  | 'ambivert';     // 양향적

// 소통 스타일
export type CommunicationStyle =
  | 'direct'        // 직접적
  | 'indirect'      // 간접적
  | 'playful'       // 장난스러운
  | 'serious';      // 진지한

// 감정 성향
export type EmotionalTendency =
  | 'expressive'    // 표현적
  | 'reserved'      // 절제적
  | 'empathetic';   // 공감적

// 사랑의 언어
export type LoveLanguage =
  | 'words'         // 언어적 표현
  | 'time'          // 함께하는 시간
  | 'gifts'         // 선물
  | 'service'       // 행동
  | 'touch';        // 스킨십

// 애착 유형
export type AttachmentStyle =
  | 'secure'        // 안정형
  | 'anxious'       // 불안형
  | 'avoidant'      // 회피형
  | 'fearful';      // 혼란형

// 기본값
const DEFAULT_PERSONA: UserPersona = {
  nickname: '',
  profileImage: null,
  bio: '',
  personality: 'ambivert',
  communicationStyle: 'direct',
  emotionalTendency: 'empathetic',
  interests: [],
  loveLanguage: 'words',
  attachmentStyle: 'secure',
};

// 선택지 라벨
export const PERSONALITY_LABELS: Record<PersonalityType, { label: string; description: string }> = {
  introverted: { label: '내향적', description: '혼자만의 시간을 좋아해요' },
  extroverted: { label: '외향적', description: '사람들과 어울리는 게 좋아요' },
  ambivert: { label: '양향적', description: '상황에 따라 달라요' },
};

export const COMMUNICATION_LABELS: Record<CommunicationStyle, { label: string; description: string }> = {
  direct: { label: '솔직하게', description: '하고 싶은 말은 바로 해요' },
  indirect: { label: '돌려서', description: '분위기를 보면서 말해요' },
  playful: { label: '장난스럽게', description: '가볍고 재밌게 대화해요' },
  serious: { label: '진지하게', description: '깊은 대화를 좋아해요' },
};

export const EMOTIONAL_LABELS: Record<EmotionalTendency, { label: string; description: string }> = {
  expressive: { label: '표현형', description: '감정을 솔직하게 표현해요' },
  reserved: { label: '절제형', description: '감정을 차분하게 다뤄요' },
  empathetic: { label: '공감형', description: '상대방 감정에 잘 공감해요' },
};

export const LOVE_LANGUAGE_LABELS: Record<LoveLanguage, { label: string; description: string }> = {
  words: { label: '말', description: '애정 표현을 말로 해요' },
  time: { label: '시간', description: '함께 있는 게 중요해요' },
  gifts: { label: '선물', description: '작은 선물로 마음을 전해요' },
  service: { label: '행동', description: '직접 해주는 걸로 표현해요' },
  touch: { label: '스킨십', description: '손잡기, 안아주기 좋아해요' },
};

export const ATTACHMENT_LABELS: Record<AttachmentStyle, { label: string; description: string }> = {
  secure: { label: '안정형', description: '관계에서 편안함을 느껴요' },
  anxious: { label: '불안형', description: '상대 반응에 민감해요' },
  avoidant: { label: '회피형', description: '거리를 두는 편이에요' },
  fearful: { label: '혼란형', description: '가까워지고 싶지만 두려워요' },
};

export const INTEREST_OPTIONS = [
  '음악', '영화', '독서', '게임', '운동',
  '요리', '여행', '패션', '예술', '사진',
  '카페', '밤바다', '새벽', '비오는 날', '드라이브',
];

interface UserPersonaState {
  persona: UserPersona;
  isOnboarded: boolean;

  // Actions
  setPersona: (updates: Partial<UserPersona>) => void;
  setNickname: (nickname: string) => void;
  setProfileImage: (image: string | null) => void;
  setBio: (bio: string) => void;
  setPersonality: (personality: PersonalityType) => void;
  setCommunicationStyle: (style: CommunicationStyle) => void;
  setEmotionalTendency: (tendency: EmotionalTendency) => void;
  setInterests: (interests: string[]) => void;
  toggleInterest: (interest: string) => void;
  setLoveLanguage: (language: LoveLanguage) => void;
  setAttachmentStyle: (style: AttachmentStyle) => void;
  completeOnboarding: () => void;
  resetPersona: () => void;
}

export const useUserPersonaStore = create<UserPersonaState>()(
  persist(
    (set) => ({
      persona: DEFAULT_PERSONA,
      isOnboarded: false,

      setPersona: (updates) =>
        set((state) => ({
          persona: { ...state.persona, ...updates },
        })),

      setNickname: (nickname) =>
        set((state) => ({
          persona: { ...state.persona, nickname },
        })),

      setProfileImage: (profileImage) =>
        set((state) => ({
          persona: { ...state.persona, profileImage },
        })),

      setBio: (bio) =>
        set((state) => ({
          persona: { ...state.persona, bio },
        })),

      setPersonality: (personality) =>
        set((state) => ({
          persona: { ...state.persona, personality },
        })),

      setCommunicationStyle: (communicationStyle) =>
        set((state) => ({
          persona: { ...state.persona, communicationStyle },
        })),

      setEmotionalTendency: (emotionalTendency) =>
        set((state) => ({
          persona: { ...state.persona, emotionalTendency },
        })),

      setInterests: (interests) =>
        set((state) => ({
          persona: { ...state.persona, interests },
        })),

      toggleInterest: (interest) =>
        set((state) => {
          const current = state.persona.interests;
          const newInterests = current.includes(interest)
            ? current.filter((i) => i !== interest)
            : [...current, interest].slice(0, 5); // 최대 5개
          return {
            persona: { ...state.persona, interests: newInterests },
          };
        }),

      setLoveLanguage: (loveLanguage) =>
        set((state) => ({
          persona: { ...state.persona, loveLanguage },
        })),

      setAttachmentStyle: (attachmentStyle) =>
        set((state) => ({
          persona: { ...state.persona, attachmentStyle },
        })),

      completeOnboarding: () => set({ isOnboarded: true }),

      resetPersona: () => set({ persona: DEFAULT_PERSONA, isOnboarded: false }),
    }),
    {
      name: 'user-persona-storage',
    }
  )
);
