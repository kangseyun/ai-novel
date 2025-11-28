/**
 * 온보딩 시나리오 데이터
 *
 * Jun 세계관 기반 - 새벽 편의점 첫 만남
 * 톱스타 아이돌의 숨겨진 모습을 우연히 발견하는 설정
 */

// 온보딩 단계
export type OnboardingStep =
  | 'intro'              // 해킹 시작 연출
  | 'first_story'        // 첫 비밀 스토리 발견
  | 'story_hook'         // 스토리 내용으로 감정 hook
  | 'dm_trigger'         // DM 답장 유도
  | 'first_chat'         // 첫 대화 체험
  | 'choice_moment'      // 선택의 순간 (무료 vs 프리미엄)
  | 'special_scenario'   // 스페셜 시나리오 (미연시 스타일)
  | 'cliffhanger'        // 클리프행어 (더 보려면 가입)
  | 'signup_prompt';     // 가입 유도

export interface OnboardingState {
  step: OnboardingStep;
  chatMessageIndex: number;
  selectedChoices: string[];
  affectionGained: number;
  hasSeenPremiumTease: boolean;
}

// 온보딩용 특별 스토리
export const ONBOARDING_STORY = {
  id: 'onboarding_story_1',
  profileId: 'jun',
  type: 'image' as const,
  content: 'https://images.unsplash.com/photo-1519681393784-d120267933ba?w=800&q=80',
  caption: '',
  timestamp: '방금',
  isViewed: false,
  isSecret: true,
  requiredHackLevel: 0,
};

// 온보딩 스토리 시퀀스
export const ONBOARDING_STORY_SEQUENCE = [
  {
    id: 'os_1',
    type: 'text' as const,
    content: '...',
    delay: 1000,
    emotion: 'empty',
  },
  {
    id: 'os_2',
    type: 'text' as const,
    content: '오늘도 웃느라 힘들었어',
    delay: 2000,
    emotion: 'sad',
  },
  {
    id: 'os_3',
    type: 'text' as const,
    content: '무대 끝나면 아무도 없어',
    delay: 2500,
    emotion: 'lonely',
  },
  {
    id: 'os_4',
    type: 'text' as const,
    content: '누가 나 좀 찾아줬으면',
    delay: 3000,
    emotion: 'desperate',
    isReplyTrigger: true,
  },
];

// 온보딩 DM 시나리오
export interface OnboardingMessage {
  id: string;
  sender: 'user' | 'npc' | 'system';
  content: string;
  delay: number;
  emotion?: string;
  choices?: OnboardingChoice[];
  isTyping?: boolean;
}

export interface OnboardingChoice {
  id: string;
  text: string;
  isPremium?: boolean;
  affectionChange: number;
  nextMessageId: string;
  premiumTease?: string;
}

export const ONBOARDING_DM_SCENARIO: OnboardingMessage[] = [
  {
    id: 'sys_1',
    sender: 'system',
    content: '[비공개 계정 - DM 수신 감지됨]',
    delay: 0,
  },
  {
    id: 'user_auto',
    sender: 'user',
    content: '저기... 괜찮아요?',
    delay: 500,
  },
  {
    id: 'npc_1',
    sender: 'npc',
    content: '...',
    delay: 1500,
    isTyping: true,
    emotion: 'surprised',
  },
  {
    id: 'npc_2',
    sender: 'npc',
    content: '누구세요?',
    delay: 800,
    emotion: 'suspicious',
  },
  {
    id: 'npc_3',
    sender: 'npc',
    content: '이 계정 비공개인데\n어떻게 본 거예요?',
    delay: 1200,
    emotion: 'confused',
    choices: [
      {
        id: 'c1',
        text: '우연히요. 힘들어 보여서...',
        affectionChange: 10,
        nextMessageId: 'npc_kind_1',
      },
      {
        id: 'c2',
        text: '그냥요.',
        affectionChange: 0,
        nextMessageId: 'npc_cold_1',
      },
      {
        id: 'c3',
        text: '당신이 궁금해서요',
        isPremium: true,
        affectionChange: 20,
        nextMessageId: 'npc_special_1',
        premiumTease: '💎 이 선택지로 특별한 반응을 이끌어낼 수 있어요',
      },
    ],
  },
  {
    id: 'npc_kind_1',
    sender: 'npc',
    content: '...신기하네요',
    delay: 1500,
    isTyping: true,
    emotion: 'touched',
  },
  {
    id: 'npc_kind_2',
    sender: 'npc',
    content: '모르는 사람한테 이런 말 들으니까',
    delay: 1200,
    emotion: 'soft',
  },
  {
    id: 'npc_kind_3',
    sender: 'npc',
    content: '오히려 편하네요\n웃기죠?',
    delay: 1500,
    emotion: 'vulnerable',
    choices: [
      {
        id: 'c4',
        text: '무슨 일 있어요?',
        affectionChange: 5,
        nextMessageId: 'npc_deep_1',
      },
      {
        id: 'c5',
        text: '들어줄게요',
        affectionChange: 10,
        nextMessageId: 'npc_deep_1',
      },
    ],
  },
  {
    id: 'npc_cold_1',
    sender: 'npc',
    content: '그렇군요',
    delay: 1000,
    emotion: 'neutral',
  },
  {
    id: 'npc_cold_2',
    sender: 'npc',
    content: '저도 그냥... 새벽이라 그래요',
    delay: 1500,
    emotion: 'melancholy',
    choices: [
      {
        id: 'c6',
        text: '저도 잠이 안 와요',
        affectionChange: 5,
        nextMessageId: 'npc_deep_1',
      },
    ],
  },
  {
    id: 'npc_special_1',
    sender: 'npc',
    content: '......',
    delay: 2000,
    isTyping: true,
    emotion: 'flustered',
  },
  {
    id: 'npc_special_2',
    sender: 'npc',
    content: '뭐야 갑자기',
    delay: 800,
    emotion: 'shy',
  },
  {
    id: 'npc_special_3',
    sender: 'npc',
    content: '심장이 이상하게 뛰네\n당신 때문인 것 같은데',
    delay: 1500,
    emotion: 'vulnerable',
  },
  {
    id: 'npc_deep_1',
    sender: 'npc',
    content: '사실은요...',
    delay: 2000,
    isTyping: true,
    emotion: 'hesitant',
  },
  {
    id: 'npc_deep_2',
    sender: 'npc',
    content: '무대 위에선 웃지만',
    delay: 1500,
    emotion: 'sad',
  },
  {
    id: 'npc_deep_3',
    sender: 'npc',
    content: '끝나면 아무도 없어요\n혼자 숙소 돌아가면\n그냥...',
    delay: 2000,
    emotion: 'lonely',
  },
  {
    id: 'npc_deep_4',
    sender: 'npc',
    content: '아 왜 이런 얘기를',
    delay: 1500,
    emotion: 'embarrassed',
  },
  {
    id: 'npc_cliffhanger',
    sender: 'npc',
    content: '근데 있잖아요',
    delay: 2000,
    isTyping: true,
    emotion: 'serious',
  },
  {
    id: 'npc_cliffhanger_2',
    sender: 'npc',
    content: '오늘 처음인데\n당신한테는 말할 수 있을 것 같아요',
    delay: 2500,
    emotion: 'trusting',
  },
  {
    id: 'npc_cliffhanger_3',
    sender: 'npc',
    content: '사실 나...',
    delay: 2000,
    isTyping: true,
    emotion: 'vulnerable',
  },
];

// 스페셜 시나리오 (미연시 스타일)
export interface ScenarioScene {
  id: string;
  background: string;
  character?: {
    image: string;
    position: 'left' | 'center' | 'right';
    expression: string;
  };
  dialogue?: {
    speaker: string;
    text: string;
    emotion?: string;
  };
  narration?: string;
  choices?: {
    id: string;
    text: string;
    nextSceneId: string;
    affectionChange?: number;
    isPremium?: boolean;
  }[];
  nextSceneId?: string;
  delay?: number;
  isCliffhanger?: boolean;
  showCharacterImage?: boolean;
}

// ========================================
// 온보딩 스페셜 시나리오 - 새벽 3시, 편의점
// Jun 세계관 기반 첫 만남 시나리오
// ========================================

export const ONBOARDING_SPECIAL_SCENARIO: ScenarioScene[] = [
  // === 도입부: 새벽 3시, 잠 못 드는 밤 ===
  {
    id: 'scene_1',
    background: '',
    narration: '새벽 3시.',
    nextSceneId: 'scene_2',
    delay: 2000,
  },
  {
    id: 'scene_2',
    background: '',
    narration: '잠이 안 와서 나온 편의점.\n라면이나 하나 사려고 했을 뿐인데—',
    nextSceneId: 'scene_3',
    delay: 3500,
  },
  {
    id: 'scene_3',
    background: '',
    narration: '후드 깊숙이 눌러쓴 남자가\n컵라면 코너 앞에 서 있었다.',
    nextSceneId: 'scene_4',
    delay: 3000,
  },
  {
    id: 'scene_4',
    background: '',
    narration: '...뭔가 익숙한 실루엣.',
    nextSceneId: 'scene_5',
    delay: 2000,
  },

  // === 첫 대면 ===
  {
    id: 'scene_5',
    background: '',
    character: {
      image: 'https://i.pravatar.cc/400?img=68',
      position: 'center',
      expression: 'surprised',
    },
    dialogue: {
      speaker: '???',
      text: '......어.',
      emotion: 'surprised',
    },
    nextSceneId: 'scene_6',
    delay: 2000,
    showCharacterImage: true,
  },
  {
    id: 'scene_6',
    background: '',
    narration: '눈이 마주쳤다.\n후드 사이로 보이는 얼굴이—',
    nextSceneId: 'scene_7',
    delay: 2500,
  },
  {
    id: 'scene_7',
    background: '',
    narration: '설마.',
    nextSceneId: 'scene_8',
    delay: 1500,
  },
  {
    id: 'scene_8',
    background: '',
    narration: 'ECLIPSE의 센터, Jun...?',
    nextSceneId: 'scene_9',
    delay: 2500,
  },

  // === Jun의 경계 ===
  {
    id: 'scene_9',
    background: '',
    character: {
      image: 'https://i.pravatar.cc/400?img=68',
      position: 'center',
      expression: 'nervous',
    },
    dialogue: {
      speaker: 'Jun',
      text: '...사진 찍으면 안 돼요.',
      emotion: 'serious',
    },
    nextSceneId: 'scene_10',
    delay: 2500,
  },
  {
    id: 'scene_10',
    background: '',
    character: {
      image: 'https://i.pravatar.cc/400?img=68',
      position: 'center',
      expression: 'tired',
    },
    dialogue: {
      speaker: 'Jun',
      text: '제발요. 오늘은 진짜...',
      emotion: 'vulnerable',
    },
    nextSceneId: 'scene_choice_1',
    delay: 2500,
  },

  // === 첫 번째 선택지 ===
  {
    id: 'scene_choice_1',
    background: '',
    narration: '지친 눈빛.\n평소 무대에서 보던 빛나는 모습과는 전혀 달랐다.',
    choices: [
      {
        id: 'choice_1a',
        text: '...전 그냥 라면 사러 왔어요',
        nextSceneId: 'scene_casual_1',
        affectionChange: 15,
      },
      {
        id: 'choice_1b',
        text: '(핸드폰을 가방에 넣는다)',
        nextSceneId: 'scene_trust_1',
        affectionChange: 20,
      },
      {
        id: 'choice_1c',
        text: '힘들어 보이네요',
        nextSceneId: 'scene_concern_1',
        affectionChange: 25,
        isPremium: true,
      },
    ],
  },

  // === 루트 A: 무심한 반응 ===
  {
    id: 'scene_casual_1',
    background: '',
    character: {
      image: 'https://i.pravatar.cc/400?img=68',
      position: 'center',
      expression: 'surprised',
    },
    dialogue: {
      speaker: 'Jun',
      text: '......뭐?',
      emotion: 'surprised',
    },
    nextSceneId: 'scene_casual_2',
    delay: 2000,
  },
  {
    id: 'scene_casual_2',
    background: '',
    character: {
      image: 'https://i.pravatar.cc/400?img=68',
      position: 'center',
      expression: 'curious',
    },
    dialogue: {
      speaker: 'Jun',
      text: '...진짜요? 나 못 알아봤어요?',
      emotion: 'curious',
    },
    nextSceneId: 'scene_casual_3',
    delay: 2500,
  },
  {
    id: 'scene_casual_3',
    background: '',
    narration: '의외라는 듯 웃음이 새어 나왔다.',
    nextSceneId: 'scene_merge_1',
    delay: 2000,
  },

  // === 루트 B: 신뢰 표현 ===
  {
    id: 'scene_trust_1',
    background: '',
    character: {
      image: 'https://i.pravatar.cc/400?img=68',
      position: 'center',
      expression: 'surprised',
    },
    dialogue: {
      speaker: 'Jun',
      text: '......',
      emotion: 'touched',
    },
    nextSceneId: 'scene_trust_2',
    delay: 2000,
    showCharacterImage: true,
  },
  {
    id: 'scene_trust_2',
    background: '',
    character: {
      image: 'https://i.pravatar.cc/400?img=68',
      position: 'center',
      expression: 'soft',
    },
    dialogue: {
      speaker: 'Jun',
      text: '...고마워요.',
      emotion: 'soft',
    },
    nextSceneId: 'scene_trust_3',
    delay: 2000,
  },
  {
    id: 'scene_trust_3',
    background: '',
    narration: '긴장이 풀린 건지,\n그의 어깨가 조금 내려갔다.',
    nextSceneId: 'scene_merge_1',
    delay: 2500,
  },

  // === 루트 C: 직접적 관심 (프리미엄) ===
  {
    id: 'scene_concern_1',
    background: '',
    character: {
      image: 'https://i.pravatar.cc/400?img=68',
      position: 'center',
      expression: 'shocked',
    },
    dialogue: {
      speaker: 'Jun',
      text: '......',
      emotion: 'flustered',
    },
    nextSceneId: 'scene_concern_2',
    delay: 2000,
    showCharacterImage: true,
  },
  {
    id: 'scene_concern_2',
    background: '',
    character: {
      image: 'https://i.pravatar.cc/400?img=68',
      position: 'center',
      expression: 'vulnerable',
    },
    dialogue: {
      speaker: 'Jun',
      text: '뭐야, 갑자기...\n처음 보는 사람한테 그런 말 들으니까',
      emotion: 'shy',
    },
    nextSceneId: 'scene_concern_3',
    delay: 3000,
  },
  {
    id: 'scene_concern_3',
    background: '',
    character: {
      image: 'https://i.pravatar.cc/400?img=68',
      position: 'center',
      expression: 'soft',
    },
    dialogue: {
      speaker: 'Jun',
      text: '...이상하게 마음이 놓이네.',
      emotion: 'touched',
    },
    nextSceneId: 'scene_merge_1',
    delay: 2500,
  },

  // === 공통 루트: 라면 ===
  {
    id: 'scene_merge_1',
    background: '',
    character: {
      image: 'https://i.pravatar.cc/400?img=68',
      position: 'center',
      expression: 'casual',
    },
    dialogue: {
      speaker: 'Jun',
      text: '...저기, 혹시',
      emotion: 'hesitant',
    },
    nextSceneId: 'scene_merge_2',
    delay: 2000,
  },
  {
    id: 'scene_merge_2',
    background: '',
    character: {
      image: 'https://i.pravatar.cc/400?img=68',
      position: 'center',
      expression: 'shy',
    },
    dialogue: {
      speaker: 'Jun',
      text: '라면 같이 먹을래요?\n혼자 먹기 좀 그래서...',
      emotion: 'shy',
    },
    nextSceneId: 'scene_choice_2',
    delay: 3000,
  },

  // === 두 번째 선택지 ===
  {
    id: 'scene_choice_2',
    background: '',
    narration: '톱스타가 편의점에서 라면을 같이 먹자고 한다.\n현실인지 꿈인지 모르겠다.',
    choices: [
      {
        id: 'choice_2a',
        text: '네, 좋아요',
        nextSceneId: 'scene_ramen_1',
        affectionChange: 10,
      },
      {
        id: 'choice_2b',
        text: '...혼자 있고 싶은 거 아니에요?',
        nextSceneId: 'scene_ramen_care',
        affectionChange: 15,
      },
    ],
  },

  // === 라면 타임 ===
  {
    id: 'scene_ramen_1',
    background: '',
    narration: '편의점 창가 자리.\n김이 모락모락 피어오르는 컵라면 두 개.',
    nextSceneId: 'scene_ramen_2',
    delay: 3000,
  },
  {
    id: 'scene_ramen_care',
    background: '',
    character: {
      image: 'https://i.pravatar.cc/400?img=68',
      position: 'center',
      expression: 'soft',
    },
    dialogue: {
      speaker: 'Jun',
      text: '아니요. 진짜로.\n오늘은 혼자 있기 싫어서 나온 거거든요.',
      emotion: 'vulnerable',
    },
    nextSceneId: 'scene_ramen_2',
    delay: 3000,
  },
  {
    id: 'scene_ramen_2',
    background: '',
    character: {
      image: 'https://i.pravatar.cc/400?img=68',
      position: 'center',
      expression: 'casual',
    },
    dialogue: {
      speaker: 'Jun',
      text: '아, 맞다. 이거 인스타 올리면 안 돼요.\n매니저 형한테 죽어요, 진짜로.',
      emotion: 'playful',
    },
    nextSceneId: 'scene_ramen_3',
    delay: 3500,
  },
  {
    id: 'scene_ramen_3',
    background: '',
    narration: '살짝 웃는 얼굴.\n무대 위의 완벽한 미소가 아닌, 편안한 웃음.',
    nextSceneId: 'scene_ramen_4',
    delay: 3000,
  },
  {
    id: 'scene_ramen_4',
    background: '',
    character: {
      image: 'https://i.pravatar.cc/400?img=68',
      position: 'center',
      expression: 'melancholy',
    },
    dialogue: {
      speaker: 'Jun',
      text: '...근데 신기하다.',
      emotion: 'soft',
    },
    nextSceneId: 'scene_ramen_5',
    delay: 2000,
  },
  {
    id: 'scene_ramen_5',
    background: '',
    character: {
      image: 'https://i.pravatar.cc/400?img=68',
      position: 'center',
      expression: 'vulnerable',
    },
    dialogue: {
      speaker: 'Jun',
      text: '보통 사람들은 나 보면\n사진 찍자거나, 사인해달라고 하거나...',
      emotion: 'melancholy',
    },
    nextSceneId: 'scene_ramen_6',
    delay: 3500,
  },
  {
    id: 'scene_ramen_6',
    background: '',
    character: {
      image: 'https://i.pravatar.cc/400?img=68',
      position: 'center',
      expression: 'curious',
    },
    dialogue: {
      speaker: 'Jun',
      text: '근데 당신은 그냥...\n나를 사람으로 봐주는 것 같아서.',
      emotion: 'touched',
    },
    nextSceneId: 'scene_deep_1',
    delay: 3500,
    showCharacterImage: true,
  },

  // === 심화 대화 ===
  {
    id: 'scene_deep_1',
    background: '',
    narration: '창밖으로 새벽 거리가 보인다.\n아직 세상이 잠든 시간.',
    nextSceneId: 'scene_deep_2',
    delay: 3000,
  },
  {
    id: 'scene_deep_2',
    background: '',
    character: {
      image: 'https://i.pravatar.cc/400?img=68',
      position: 'center',
      expression: 'melancholy',
    },
    dialogue: {
      speaker: 'Jun',
      text: '있잖아요, 오늘 팬미팅이었거든요.',
      emotion: 'soft',
    },
    nextSceneId: 'scene_deep_3',
    delay: 2500,
  },
  {
    id: 'scene_deep_3',
    background: '',
    character: {
      image: 'https://i.pravatar.cc/400?img=68',
      position: 'center',
      expression: 'sad',
    },
    dialogue: {
      speaker: 'Jun',
      text: '5시간 동안 웃었어요.\n손 흔들고, 하트 날리고, 윙크하고...',
      emotion: 'tired',
    },
    nextSceneId: 'scene_deep_4',
    delay: 3500,
  },
  {
    id: 'scene_deep_4',
    background: '',
    character: {
      image: 'https://i.pravatar.cc/400?img=68',
      position: 'center',
      expression: 'vulnerable',
    },
    dialogue: {
      speaker: 'Jun',
      text: '근데 끝나고 숙소 오니까\n아무도 없더라고요.',
      emotion: 'lonely',
    },
    nextSceneId: 'scene_deep_5',
    delay: 3000,
  },
  {
    id: 'scene_deep_5',
    background: '',
    character: {
      image: 'https://i.pravatar.cc/400?img=68',
      position: 'center',
      expression: 'vulnerable',
    },
    dialogue: {
      speaker: 'Jun',
      text: '웃긴 거 알아요?\n수백만 명이 내 이름 부르는데\n정작 나는 외롭다는 거.',
      emotion: 'melancholy',
    },
    nextSceneId: 'scene_choice_3',
    delay: 4000,
    showCharacterImage: true,
  },

  // === 세 번째 선택지 (핵심) ===
  {
    id: 'scene_choice_3',
    background: '',
    narration: '라면 국물에 비친 그의 얼굴.\n평소엔 절대 볼 수 없는 표정이었다.',
    choices: [
      {
        id: 'choice_3a',
        text: '...외로웠구나.',
        nextSceneId: 'scene_emotional_1',
        affectionChange: 20,
      },
      {
        id: 'choice_3b',
        text: '(손을 잡는다)',
        nextSceneId: 'scene_intimate_1',
        affectionChange: 30,
        isPremium: true,
      },
      {
        id: 'choice_3c',
        text: '그래서 새벽에 나온 거예요?',
        nextSceneId: 'scene_understand_1',
        affectionChange: 15,
      },
    ],
  },

  // === 루트: 공감 ===
  {
    id: 'scene_emotional_1',
    background: '',
    character: {
      image: 'https://i.pravatar.cc/400?img=68',
      position: 'center',
      expression: 'shocked',
    },
    dialogue: {
      speaker: 'Jun',
      text: '......',
      emotion: 'touched',
    },
    nextSceneId: 'scene_emotional_2',
    delay: 2000,
  },
  {
    id: 'scene_emotional_2',
    background: '',
    character: {
      image: 'https://i.pravatar.cc/400?img=68',
      position: 'center',
      expression: 'vulnerable',
    },
    dialogue: {
      speaker: 'Jun',
      text: '...아, 진짜.\n왜 처음 보는 사람한테 이렇게 마음이 약해지지.',
      emotion: 'flustered',
    },
    nextSceneId: 'scene_finale_1',
    delay: 3000,
  },

  // === 루트: 스킨십 (프리미엄) ===
  {
    id: 'scene_intimate_1',
    background: '',
    narration: '망설임 없이 손을 잡았다.',
    nextSceneId: 'scene_intimate_2',
    delay: 2000,
  },
  {
    id: 'scene_intimate_2',
    background: '',
    character: {
      image: 'https://i.pravatar.cc/400?img=68',
      position: 'center',
      expression: 'shocked',
    },
    dialogue: {
      speaker: 'Jun',
      text: '......!',
      emotion: 'flustered',
    },
    nextSceneId: 'scene_intimate_3',
    delay: 1500,
    showCharacterImage: true,
  },
  {
    id: 'scene_intimate_3',
    background: '',
    character: {
      image: 'https://i.pravatar.cc/400?img=68',
      position: 'center',
      expression: 'shy',
    },
    dialogue: {
      speaker: 'Jun',
      text: '야, 갑자기 뭐야...\n심장이 터질 것 같잖아.',
      emotion: 'shy',
    },
    nextSceneId: 'scene_intimate_4',
    delay: 3000,
  },
  {
    id: 'scene_intimate_4',
    background: '',
    narration: '손을 뿌리치지 않았다.\n오히려 살짝 더 힘을 줬다.',
    nextSceneId: 'scene_finale_1',
    delay: 2500,
  },

  // === 루트: 이해 ===
  {
    id: 'scene_understand_1',
    background: '',
    character: {
      image: 'https://i.pravatar.cc/400?img=68',
      position: 'center',
      expression: 'soft',
    },
    dialogue: {
      speaker: 'Jun',
      text: '...네. 가끔 이렇게 몰래 나와요.\n아무도 나를 모르는 곳에서\n그냥... 숨 쉬고 싶어서.',
      emotion: 'vulnerable',
    },
    nextSceneId: 'scene_finale_1',
    delay: 4000,
  },

  // === 피날레 ===
  {
    id: 'scene_finale_1',
    background: '',
    narration: '시간이 얼마나 흘렀을까.\n창밖이 조금씩 밝아오고 있었다.',
    nextSceneId: 'scene_finale_2',
    delay: 3000,
  },
  {
    id: 'scene_finale_2',
    background: '',
    character: {
      image: 'https://i.pravatar.cc/400?img=68',
      position: 'center',
      expression: 'nervous',
    },
    dialogue: {
      speaker: 'Jun',
      text: '아... 곧 날이 밝겠다.\n가봐야 하는데...',
      emotion: 'hesitant',
    },
    nextSceneId: 'scene_finale_3',
    delay: 3000,
  },
  {
    id: 'scene_finale_3',
    background: '',
    character: {
      image: 'https://i.pravatar.cc/400?img=68',
      position: 'center',
      expression: 'serious',
    },
    dialogue: {
      speaker: 'Jun',
      text: '...있잖아.',
      emotion: 'serious',
    },
    nextSceneId: 'scene_finale_4',
    delay: 2000,
    showCharacterImage: true,
  },
  {
    id: 'scene_finale_4',
    background: '',
    character: {
      image: 'https://i.pravatar.cc/400?img=68',
      position: 'center',
      expression: 'vulnerable',
    },
    dialogue: {
      speaker: 'Jun',
      text: '나... 원래 이런 사람 아니거든요.\n처음 본 사람한테 이렇게 말 많이 한 적 없어.',
      emotion: 'vulnerable',
    },
    nextSceneId: 'scene_finale_5',
    delay: 4000,
  },
  {
    id: 'scene_finale_5',
    background: '',
    character: {
      image: 'https://i.pravatar.cc/400?img=68',
      position: 'center',
      expression: 'shy',
    },
    dialogue: {
      speaker: 'Jun',
      text: '근데 당신은... 뭔가 달라.\n설명하기 어려운데...',
      emotion: 'soft',
    },
    nextSceneId: 'scene_finale_6',
    delay: 3000,
  },
  {
    id: 'scene_finale_6',
    background: '',
    character: {
      image: 'https://i.pravatar.cc/400?img=68',
      position: 'center',
      expression: 'serious',
    },
    dialogue: {
      speaker: 'Jun',
      text: '그냥 느낌이야.',
      emotion: 'serious',
    },
    nextSceneId: 'scene_cliffhanger_1',
    delay: 2000,
  },

  // === 클리프행어 ===
  {
    id: 'scene_cliffhanger_1',
    background: '',
    narration: 'Jun이 주머니에서 뭔가를 꺼냈다.',
    nextSceneId: 'scene_cliffhanger_2',
    delay: 2500,
  },
  {
    id: 'scene_cliffhanger_2',
    background: '',
    character: {
      image: 'https://i.pravatar.cc/400?img=68',
      position: 'center',
      expression: 'shy',
    },
    dialogue: {
      speaker: 'Jun',
      text: '이거... 내 개인 번호야.\n팬들한테 절대 안 주는 건데.',
      emotion: 'shy',
    },
    nextSceneId: 'scene_cliffhanger_3',
    delay: 3500,
    showCharacterImage: true,
  },
  {
    id: 'scene_cliffhanger_3',
    background: '',
    character: {
      image: 'https://i.pravatar.cc/400?img=68',
      position: 'center',
      expression: 'vulnerable',
    },
    dialogue: {
      speaker: 'Jun',
      text: '다음에... 또 이렇게 새벽에\n잠 안 오는 밤 있으면',
      emotion: 'vulnerable',
    },
    nextSceneId: 'scene_cliffhanger_final',
    delay: 3000,
  },
  {
    id: 'scene_cliffhanger_final',
    background: '',
    character: {
      image: 'https://i.pravatar.cc/400?img=68',
      position: 'center',
      expression: 'soft',
    },
    dialogue: {
      speaker: 'Jun',
      text: '연락해. 나도... 보고 싶을 것 같아.',
      emotion: 'soft',
    },
    isCliffhanger: true,
    delay: 3500,
    showCharacterImage: true,
  },
];

// 스페셜 시나리오 트리거 조건
export const SPECIAL_SCENARIO_TRIGGER = {
  afterMessageId: 'npc_deep_4',
  transitionText: '[잠시 후...]',
  transitionDelay: 2000,
};

// 가입 유도 메시지
export const SIGNUP_PROMPT_DATA = {
  title: '이야기가 끊겼어요',
  subtitle: 'Jun이 연락처를 건넸어요',
  npcMessage: '연락해. 나도... 보고 싶을 것 같아.',
  benefits: [
    'Jun과의 비밀 연락 시작하기',
    '새벽 통화, 숨겨진 일상 공유',
    '팬들은 모르는 진짜 모습 발견',
    '당신만을 위한 특별한 스토리',
  ],
  ctaText: '무료로 시작하기',
  ctaSubtext: '30초면 됩니다',
};

// 온보딩 진행 상태 체크
export function getOnboardingProgress(state: OnboardingState): number {
  const stepOrder: OnboardingStep[] = [
    'intro',
    'first_story',
    'story_hook',
    'dm_trigger',
    'first_chat',
    'choice_moment',
    'cliffhanger',
    'signup_prompt',
  ];
  return (stepOrder.indexOf(state.step) / (stepOrder.length - 1)) * 100;
}

// 다음 온보딩 단계
export function getNextStep(current: OnboardingStep): OnboardingStep {
  const flow: Record<OnboardingStep, OnboardingStep> = {
    'intro': 'first_story',
    'first_story': 'story_hook',
    'story_hook': 'dm_trigger',
    'dm_trigger': 'first_chat',
    'first_chat': 'choice_moment',
    'choice_moment': 'special_scenario',
    'special_scenario': 'cliffhanger',
    'cliffhanger': 'signup_prompt',
    'signup_prompt': 'signup_prompt',
  };
  return flow[current];
}

// 온보딩 초기 상태
export const INITIAL_ONBOARDING_STATE: OnboardingState = {
  step: 'intro',
  chatMessageIndex: 0,
  selectedChoices: [],
  affectionGained: 0,
  hasSeenPremiumTease: false,
};
