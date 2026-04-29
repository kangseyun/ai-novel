/**
 * 온보딩 시나리오 데이터 (LUMIN IP)
 *
 * Variant A: HAEON (안정형 리더) — 새벽 연습 끝, "안 잤어?"
 * Variant B: JUN (감성 작곡) — 새벽 데모 트랙, "첫 청중이 돼줘"
 *
 * Tone: K-pop 클린 로맨스 + 디즈니 채널 감성 (전연령)
 * LUMIN 7인조 멤버 케미 기반. 성적 묘사·약물·폭력 금지.
 */

// ========================================
// 공통 타입 (기존 시그니처 유지)
// ========================================

// 온보딩 단계
export type OnboardingStep =
  | 'intro'
  | 'first_story'
  | 'story_hook'
  | 'dm_trigger'
  | 'first_chat'
  | 'choice_moment'
  | 'special_scenario'
  | 'cliffhanger'
  | 'signup_prompt';

export interface OnboardingState {
  step: OnboardingStep;
  chatMessageIndex: number;
  selectedChoices: string[];
  affectionGained: number;
  hasSeenPremiumTease: boolean;
}

// 온보딩 DM 메시지
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

// 비주얼 노벨 스타일 씬
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

// 변형 키
export type OnboardingVariant = 'a' | 'b';

// 변형 묶음 (외부에서 한 번에 가져갈 수 있게)
export interface OnboardingScenario {
  variant: OnboardingVariant;
  personaId: 'haeon' | 'jun';
  personaName: string;
  story: typeof ONBOARDING_STORY_VARIANT_A;
  storySequence: typeof ONBOARDING_STORY_SEQUENCE_VARIANT_A;
  dmScenario: OnboardingMessage[];
  specialScenario: ScenarioScene[];
  signupPrompt: typeof SIGNUP_PROMPT_VARIANT_A;
}

// ========================================
// VARIANT A — HAEON (안정형 리더)
// 새벽 연습 끝, 리더가 너에게 "안 잤어?"
// ========================================

export const ONBOARDING_STORY_VARIANT_A = {
  id: 'onboarding_story_haeon',
  profileId: 'haeon',
  type: 'image' as const,
  content: 'https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=800&q=80',
  caption: '',
  timestamp: '방금',
  isViewed: false,
  isSecret: false,
  requiredHackLevel: 0,
};

export const ONBOARDING_STORY_SEQUENCE_VARIANT_A = [
  {
    id: 'osa_1',
    type: 'text' as const,
    content: '연습 끝.',
    delay: 1500,
    emotion: 'soft',
  },
  {
    id: 'osa_2',
    type: 'text' as const,
    content: '오늘도 우리 멤버들 다들 고생했어',
    delay: 2500,
    emotion: 'warm',
  },
  {
    id: 'osa_3',
    type: 'text' as const,
    content: '...근데 너는 잘 자고 있나',
    delay: 2500,
    emotion: 'curious',
  },
  {
    id: 'osa_4',
    type: 'text' as const,
    content: '잠 안 오면 톡 해도 돼',
    delay: 3000,
    emotion: 'warm',
    isReplyTrigger: true,
  },
];

export const ONBOARDING_DM_SCENARIO_VARIANT_A: OnboardingMessage[] = [
  {
    id: 'sys_1',
    sender: 'system',
    content: '[새벽 2:47 — HAEON 님이 메시지를 보냈어요]',
    delay: 0,
  },
  {
    id: 'npc_1',
    sender: 'npc',
    content: '...안 잤어?',
    delay: 1200,
    emotion: 'soft',
  },
  {
    id: 'npc_2',
    sender: 'npc',
    content: '연습 끝나고 보니까\n네 이름이 떠올라서.',
    delay: 1500,
    emotion: 'warm',
    choices: [
      {
        id: 'a_c1',
        text: '안 잤어요. 오늘 연습 어땠어요?',
        affectionChange: 10,
        nextMessageId: 'a_npc_kind_1',
      },
      {
        id: 'a_c2',
        text: '왜 새벽까지 연습해요. 몸 챙겨요.',
        affectionChange: 15,
        nextMessageId: 'a_npc_caring_1',
      },
      {
        id: 'a_c3',
        text: '제 이름을 어떻게 알아요?',
        affectionChange: 5,
        nextMessageId: 'a_npc_playful_1',
      },
    ],
  },

  // Route: 일상 관심
  {
    id: 'a_npc_kind_1',
    sender: 'npc',
    content: '음... 오늘은 안무 동선 다시 짰어',
    delay: 1500,
    emotion: 'soft',
  },
  {
    id: 'a_npc_kind_2',
    sender: 'npc',
    content: '컴백 한 달 남았거든',
    delay: 1200,
    emotion: 'warm',
  },
  {
    id: 'a_npc_kind_3',
    sender: 'npc',
    content: '근데 너 진짜 안 졸려?\n걱정되네 ☕️',
    delay: 1500,
    emotion: 'caring',
    choices: [
      {
        id: 'a_c4',
        text: '오빠 응원하느라 못 자요',
        affectionChange: 15,
        nextMessageId: 'a_npc_deep_1',
      },
      {
        id: 'a_c5',
        text: '오빠야말로 자야죠',
        affectionChange: 10,
        nextMessageId: 'a_npc_deep_1',
      },
    ],
  },

  // Route: 케어 응답
  {
    id: 'a_npc_caring_1',
    sender: 'npc',
    content: '...야',
    delay: 1200,
    emotion: 'flustered',
  },
  {
    id: 'a_npc_caring_2',
    sender: 'npc',
    content: '내가 챙겨야 하는 입장인데\n네가 먼저 그러면 어떡해',
    delay: 1500,
    emotion: 'soft',
  },
  {
    id: 'a_npc_caring_3',
    sender: 'npc',
    content: '...고마워.\n진짜.',
    delay: 2000,
    emotion: 'touched',
    choices: [
      {
        id: 'a_c6',
        text: '리더는 외롭잖아요',
        affectionChange: 15,
        nextMessageId: 'a_npc_deep_1',
      },
      {
        id: 'a_c7',
        text: '저도 응원받고 싶을 때 있어요',
        affectionChange: 10,
        nextMessageId: 'a_npc_deep_1',
      },
    ],
  },

  // Route: 장난
  {
    id: 'a_npc_playful_1',
    sender: 'npc',
    content: '...비밀.',
    delay: 1200,
    emotion: 'playful',
  },
  {
    id: 'a_npc_playful_2',
    sender: 'npc',
    content: '농담이고\n네가 항상 댓글 달아주잖아',
    delay: 1500,
    emotion: 'warm',
  },
  {
    id: 'a_npc_playful_3',
    sender: 'npc',
    content: '연습실에서 가끔 보고 있어 🌙',
    delay: 1500,
    emotion: 'soft',
    choices: [
      {
        id: 'a_c8',
        text: '...들켰네요',
        affectionChange: 10,
        nextMessageId: 'a_npc_deep_1',
      },
    ],
  },

  // 공통 깊은 대화
  {
    id: 'a_npc_deep_1',
    sender: 'npc',
    content: '있잖아',
    delay: 1500,
    isTyping: true,
    emotion: 'hesitant',
  },
  {
    id: 'a_npc_deep_2',
    sender: 'npc',
    content: '리더 하면서 늘 멤버들 챙기고\n팬들한테 웃어주고',
    delay: 1800,
    emotion: 'soft',
  },
  {
    id: 'a_npc_deep_3',
    sender: 'npc',
    content: '근데 새벽엔\n나도 누구한테 안부 묻고 싶어지더라',
    delay: 2200,
    emotion: 'vulnerable',
  },
  {
    id: 'a_npc_deep_4',
    sender: 'npc',
    content: '오늘은 네가 먼저 떠올랐어',
    delay: 1800,
    emotion: 'warm',
  },

  // 클리프행어
  {
    id: 'a_npc_cliffhanger',
    sender: 'npc',
    content: '아 갑자기 무슨 말을',
    delay: 1500,
    isTyping: true,
    emotion: 'flustered',
  },
  {
    id: 'a_npc_cliffhanger_2',
    sender: 'npc',
    content: '근데 진짜야.\n앞으로도 종종 이렇게 얘기해도 돼?',
    delay: 2200,
    emotion: 'soft',
  },
  {
    id: 'a_npc_cliffhanger_3',
    sender: 'npc',
    content: '내일 컴백 무대 응원봉 흔들어줘 🤍',
    delay: 2000,
    emotion: 'warm',
  },
];

export const ONBOARDING_SPECIAL_SCENARIO_VARIANT_A: ScenarioScene[] = [
  // 인트로
  {
    id: 'a_scene_1',
    background: '',
    narration: '새벽 두 시 사십칠 분.',
    nextSceneId: 'a_scene_2',
    delay: 2000,
  },
  {
    id: 'a_scene_2',
    background: '',
    narration: '핸드폰이 짧게 울렸다.\nLUMIN 리더, HAEON.',
    nextSceneId: 'a_scene_3',
    delay: 3000,
  },
  {
    id: 'a_scene_3',
    background: '',
    narration: '연습실에서 보낸 메시지였다.',
    nextSceneId: 'a_scene_4',
    delay: 2200,
  },

  // 첫 등장
  {
    id: 'a_scene_4',
    background: '',
    character: {
      image: '',
      position: 'center',
      expression: 'soft',
    },
    dialogue: {
      speaker: 'HAEON',
      text: '...안 잤어?',
      emotion: 'soft',
    },
    nextSceneId: 'a_scene_5',
    delay: 2200,
    showCharacterImage: true,
  },
  {
    id: 'a_scene_5',
    background: '',
    character: {
      image: '',
      position: 'center',
      expression: 'warm',
    },
    dialogue: {
      speaker: 'HAEON',
      text: '연습 막 끝났어.\n불 끄려는데 네 생각이 나서.',
      emotion: 'soft',
    },
    nextSceneId: 'a_choice_1',
    delay: 2800,
  },

  // 첫 선택지
  {
    id: 'a_choice_1',
    background: '',
    narration: '리더가 새벽에 나에게 안부를 물어왔다.\n뭐라고 답해야 할까.',
    choices: [
      {
        id: 'a_ch_1a',
        text: '오빠야말로 잘 챙겨야죠',
        nextSceneId: 'a_scene_care_1',
        affectionChange: 15,
      },
      {
        id: 'a_ch_1b',
        text: '오빠 톡 기다리고 있었어요',
        nextSceneId: 'a_scene_warm_1',
        affectionChange: 20,
      },
      {
        id: 'a_ch_1c',
        text: '연습 끝나고 따뜻한 차 한 잔 어때요?',
        nextSceneId: 'a_scene_premium_1',
        affectionChange: 25,
        isPremium: true,
      },
    ],
  },

  // Route: 케어
  {
    id: 'a_scene_care_1',
    background: '',
    character: {
      image: '',
      position: 'center',
      expression: 'flustered',
    },
    dialogue: {
      speaker: 'HAEON',
      text: '...야.',
      emotion: 'flustered',
    },
    nextSceneId: 'a_scene_care_2',
    delay: 1800,
  },
  {
    id: 'a_scene_care_2',
    background: '',
    character: {
      image: '',
      position: 'center',
      expression: 'soft',
    },
    dialogue: {
      speaker: 'HAEON',
      text: '내가 너 챙기려고 톡 한 건데\n역공 들어왔네.',
      emotion: 'soft',
    },
    nextSceneId: 'a_scene_merge_1',
    delay: 2500,
  },

  // Route: 따뜻
  {
    id: 'a_scene_warm_1',
    background: '',
    character: {
      image: '',
      position: 'center',
      expression: 'touched',
    },
    dialogue: {
      speaker: 'HAEON',
      text: '...진짜?',
      emotion: 'touched',
    },
    nextSceneId: 'a_scene_warm_2',
    delay: 1800,
    showCharacterImage: true,
  },
  {
    id: 'a_scene_warm_2',
    background: '',
    character: {
      image: '',
      position: 'center',
      expression: 'soft',
    },
    dialogue: {
      speaker: 'HAEON',
      text: '그 말 들으니까\n오늘 피로가 다 풀린다.',
      emotion: 'warm',
    },
    nextSceneId: 'a_scene_merge_1',
    delay: 2500,
  },

  // Route: 프리미엄
  {
    id: 'a_scene_premium_1',
    background: '',
    character: {
      image: '',
      position: 'center',
      expression: 'shy',
    },
    dialogue: {
      speaker: 'HAEON',
      text: '...너 지금 나 데이트 신청한 거야?',
      emotion: 'shy',
    },
    nextSceneId: 'a_scene_premium_2',
    delay: 2200,
  },
  {
    id: 'a_scene_premium_2',
    background: '',
    character: {
      image: '',
      position: 'center',
      expression: 'soft',
    },
    dialogue: {
      speaker: 'HAEON',
      text: '농담이야.\n근데... 컴백 끝나면 진짜 차 한 잔 하자.',
      emotion: 'soft',
    },
    nextSceneId: 'a_scene_merge_1',
    delay: 3000,
  },

  // 공통 머지
  {
    id: 'a_scene_merge_1',
    background: '',
    narration: '연습실 창밖으로 도시 불빛이 깜빡였다.\n새벽은 그에게도 드문 시간이었다.',
    nextSceneId: 'a_scene_merge_2',
    delay: 3000,
  },
  {
    id: 'a_scene_merge_2',
    background: '',
    character: {
      image: '',
      position: 'center',
      expression: 'soft',
    },
    dialogue: {
      speaker: 'HAEON',
      text: '있잖아.',
      emotion: 'hesitant',
    },
    nextSceneId: 'a_scene_merge_3',
    delay: 1800,
  },
  {
    id: 'a_scene_merge_3',
    background: '',
    character: {
      image: '',
      position: 'center',
      expression: 'vulnerable',
    },
    dialogue: {
      speaker: 'HAEON',
      text: '리더 6년 차인데\n아직도 새벽이 되면 좀 외롭더라.',
      emotion: 'vulnerable',
    },
    nextSceneId: 'a_scene_merge_4',
    delay: 3000,
  },
  {
    id: 'a_scene_merge_4',
    background: '',
    character: {
      image: '',
      position: 'center',
      expression: 'warm',
    },
    dialogue: {
      speaker: 'HAEON',
      text: '근데 너랑 톡하니까\n그 외로움이 좀 작아진다.',
      emotion: 'soft',
    },
    nextSceneId: 'a_choice_2',
    delay: 3500,
    showCharacterImage: true,
  },

  // 두 번째 선택지
  {
    id: 'a_choice_2',
    background: '',
    narration: '핸드폰 화면 너머로\n그의 목소리가 들리는 것 같았다.',
    choices: [
      {
        id: 'a_ch_2a',
        text: '저도 오빠 톡 받으면 외롭지 않아요',
        nextSceneId: 'a_scene_finale_1',
        affectionChange: 20,
      },
      {
        id: 'a_ch_2b',
        text: '내일도 톡 해줘요',
        nextSceneId: 'a_scene_finale_1',
        affectionChange: 15,
      },
    ],
  },

  // 피날레
  {
    id: 'a_scene_finale_1',
    background: '',
    character: {
      image: '',
      position: 'center',
      expression: 'touched',
    },
    dialogue: {
      speaker: 'HAEON',
      text: '...그래.',
      emotion: 'touched',
    },
    nextSceneId: 'a_scene_finale_2',
    delay: 1800,
  },
  {
    id: 'a_scene_finale_2',
    background: '',
    character: {
      image: '',
      position: 'center',
      expression: 'warm',
    },
    dialogue: {
      speaker: 'HAEON',
      text: '내일 컴백 쇼케이스야.\n응원봉 흔들어줄 거지?',
      emotion: 'warm',
    },
    nextSceneId: 'a_scene_finale_3',
    delay: 2500,
  },
  {
    id: 'a_scene_finale_3',
    background: '',
    character: {
      image: '',
      position: 'center',
      expression: 'soft',
    },
    dialogue: {
      speaker: 'HAEON',
      text: '내가 무대에서 너 바로 찾을 수 있게 🤍',
      emotion: 'soft',
    },
    isCliffhanger: true,
    delay: 3500,
    showCharacterImage: true,
  },
];

export const SIGNUP_PROMPT_VARIANT_A = {
  title: '대화가 끊겼어요',
  subtitle: 'HAEON이 컴백 무대에서 당신을 찾고 있어요',
  npcMessage: '내가 무대에서 너 바로 찾을 수 있게 🤍',
  benefits: [
    'HAEON과 매일 안부 톡 이어가기',
    '컴백 D-day 카운트다운 함께 보기',
    'LUMIN 단톡방 멤버 7인 케미',
    '당신의 생일에 LUMIN 합창 음성 편지',
  ],
  ctaText: '무료로 시작하기',
  ctaSubtext: '30초면 됩니다',
};

// ========================================
// VARIANT B — JUN (감성 작곡)
// 새벽 데모 트랙, "첫 청중이 돼줘"
// ========================================

export const ONBOARDING_STORY_VARIANT_B = {
  id: 'onboarding_story_jun',
  profileId: 'jun',
  type: 'image' as const,
  content: 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=800&q=80',
  caption: '',
  timestamp: '방금',
  isViewed: false,
  isSecret: false,
  requiredHackLevel: 0,
};

export const ONBOARDING_STORY_SEQUENCE_VARIANT_B = [
  {
    id: 'osb_1',
    type: 'text' as const,
    content: '데모 한 곡 만들었어 🎹',
    delay: 1500,
    emotion: 'soft',
  },
  {
    id: 'osb_2',
    type: 'text' as const,
    content: '제목은 아직 못 정했고...',
    delay: 2200,
    emotion: 'shy',
  },
  {
    id: 'osb_3',
    type: 'text' as const,
    content: '근데 누구한테 먼저 들려줄지 정했어',
    delay: 2500,
    emotion: 'warm',
  },
  {
    id: 'osb_4',
    type: 'text' as const,
    content: '...너한테 ☁️',
    delay: 2800,
    emotion: 'shy',
    isReplyTrigger: true,
  },
];

export const ONBOARDING_DM_SCENARIO_VARIANT_B: OnboardingMessage[] = [
  {
    id: 'sys_1',
    sender: 'system',
    content: '[새벽 3:12 — JUN 님이 메시지를 보냈어요]',
    delay: 0,
  },
  {
    id: 'npc_1',
    sender: 'npc',
    content: '저기...',
    delay: 1200,
    emotion: 'shy',
  },
  {
    id: 'npc_2',
    sender: 'npc',
    content: '내가 만든 곡\n첫 번째로 들어줄래? 너만.',
    delay: 1800,
    emotion: 'soft',
    choices: [
      {
        id: 'b_c1',
        text: '당연하지! 보내줘',
        affectionChange: 15,
        nextMessageId: 'b_npc_excited_1',
      },
      {
        id: 'b_c2',
        text: '왜 나야?',
        affectionChange: 10,
        nextMessageId: 'b_npc_shy_1',
      },
      {
        id: 'b_c3',
        text: '준이 곡이라면 무조건 좋아요',
        affectionChange: 20,
        nextMessageId: 'b_npc_touched_1',
      },
    ],
  },

  // Route: 신남
  {
    id: 'b_npc_excited_1',
    sender: 'npc',
    content: '진짜? 잠깐만 ㅠㅠ',
    delay: 1500,
    emotion: 'excited',
  },
  {
    id: 'b_npc_excited_2',
    sender: 'npc',
    content: '심장 떨려서 손 떨고 있어 🥺',
    delay: 1800,
    emotion: 'shy',
  },
  {
    id: 'b_npc_excited_3',
    sender: 'npc',
    content: '들어보고 솔직하게 말해줘\n혹시 별로면... 그래도 괜찮아',
    delay: 2200,
    emotion: 'vulnerable',
    choices: [
      {
        id: 'b_c4',
        text: '준이가 만든 거면 다 좋아',
        affectionChange: 15,
        nextMessageId: 'b_npc_deep_1',
      },
      {
        id: 'b_c5',
        text: '솔직하게 들을게',
        affectionChange: 10,
        nextMessageId: 'b_npc_deep_1',
      },
    ],
  },

  // Route: 수줍음
  {
    id: 'b_npc_shy_1',
    sender: 'npc',
    content: '...어',
    delay: 1500,
    emotion: 'shy',
  },
  {
    id: 'b_npc_shy_2',
    sender: 'npc',
    content: '말하기 좀 부끄러운데',
    delay: 1500,
    emotion: 'shy',
  },
  {
    id: 'b_npc_shy_3',
    sender: 'npc',
    content: '곡 쓸 때\n네 생각하면서 썼거든 🌸',
    delay: 2200,
    emotion: 'vulnerable',
    choices: [
      {
        id: 'b_c6',
        text: '...정말?',
        affectionChange: 15,
        nextMessageId: 'b_npc_deep_1',
      },
      {
        id: 'b_c7',
        text: '나도 준이 노래 들으면서 자',
        affectionChange: 20,
        nextMessageId: 'b_npc_deep_1',
      },
    ],
  },

  // Route: 감동
  {
    id: 'b_npc_touched_1',
    sender: 'npc',
    content: '...',
    delay: 1500,
    isTyping: true,
    emotion: 'touched',
  },
  {
    id: 'b_npc_touched_2',
    sender: 'npc',
    content: '왜 자꾸 울컥하게 만들어 ㅠ',
    delay: 1800,
    emotion: 'touched',
  },
  {
    id: 'b_npc_touched_3',
    sender: 'npc',
    content: '진짜 너밖에 없는 것 같아',
    delay: 1800,
    emotion: 'soft',
    choices: [
      {
        id: 'b_c8',
        text: '나도 준이가 처음이야',
        affectionChange: 15,
        nextMessageId: 'b_npc_deep_1',
      },
    ],
  },

  // 공통 깊은 대화
  {
    id: 'b_npc_deep_1',
    sender: 'npc',
    content: '있잖아',
    delay: 1500,
    isTyping: true,
    emotion: 'hesitant',
  },
  {
    id: 'b_npc_deep_2',
    sender: 'npc',
    content: '곡 쓰다 보면 가끔 외로워져',
    delay: 1800,
    emotion: 'melancholy',
  },
  {
    id: 'b_npc_deep_3',
    sender: 'npc',
    content: '내 마음이 잘 전달될까\n사람들이 좋아해 줄까',
    delay: 2200,
    emotion: 'vulnerable',
  },
  {
    id: 'b_npc_deep_4',
    sender: 'npc',
    content: '근데 너한테 먼저 들려주면\n그 불안이 줄어들더라',
    delay: 2500,
    emotion: 'warm',
  },

  // 클리프행어
  {
    id: 'b_npc_cliffhanger',
    sender: 'npc',
    content: '있지...',
    delay: 1500,
    isTyping: true,
    emotion: 'shy',
  },
  {
    id: 'b_npc_cliffhanger_2',
    sender: 'npc',
    content: '이번 컴백 타이틀곡\n네가 처음 들어줬으면 좋겠어',
    delay: 2500,
    emotion: 'soft',
  },
  {
    id: 'b_npc_cliffhanger_3',
    sender: 'npc',
    content: '계속 내 첫 청중 해줄래? 🎹',
    delay: 2200,
    emotion: 'vulnerable',
  },
];

export const ONBOARDING_SPECIAL_SCENARIO_VARIANT_B: ScenarioScene[] = [
  // 인트로
  {
    id: 'b_scene_1',
    background: '',
    narration: '새벽 세 시 십이 분.',
    nextSceneId: 'b_scene_2',
    delay: 2000,
  },
  {
    id: 'b_scene_2',
    background: '',
    narration: '핸드폰 화면이 부드럽게 켜졌다.\n작업실에서 보낸 메시지.',
    nextSceneId: 'b_scene_3',
    delay: 3000,
  },
  {
    id: 'b_scene_3',
    background: '',
    narration: '보낸 사람: LUMIN의 작곡 담당, JUN.',
    nextSceneId: 'b_scene_4',
    delay: 2500,
  },

  // 첫 등장
  {
    id: 'b_scene_4',
    background: '',
    character: {
      image: '',
      position: 'center',
      expression: 'shy',
    },
    dialogue: {
      speaker: 'JUN',
      text: '저기... 안 자고 있을 줄 알았어 🌸',
      emotion: 'shy',
    },
    nextSceneId: 'b_scene_5',
    delay: 2500,
    showCharacterImage: true,
  },
  {
    id: 'b_scene_5',
    background: '',
    character: {
      image: '',
      position: 'center',
      expression: 'soft',
    },
    dialogue: {
      speaker: 'JUN',
      text: '오늘 데모 한 곡 다 만들었거든.\n근데 이상하게...',
      emotion: 'soft',
    },
    nextSceneId: 'b_scene_6',
    delay: 2800,
  },
  {
    id: 'b_scene_6',
    background: '',
    character: {
      image: '',
      position: 'center',
      expression: 'vulnerable',
    },
    dialogue: {
      speaker: 'JUN',
      text: '너한테 가장 먼저 들려주고 싶어.',
      emotion: 'soft',
    },
    nextSceneId: 'b_choice_1',
    delay: 2800,
  },

  // 첫 선택지
  {
    id: 'b_choice_1',
    background: '',
    narration: '7명 중에 가장 섬세하다는 멤버.\n그가 만든 곡의 첫 청중이 되는 일.',
    choices: [
      {
        id: 'b_ch_1a',
        text: '나여도 괜찮아?',
        nextSceneId: 'b_scene_shy_1',
        affectionChange: 15,
      },
      {
        id: 'b_ch_1b',
        text: '응. 너무 영광이야',
        nextSceneId: 'b_scene_warm_1',
        affectionChange: 20,
      },
      {
        id: 'b_ch_1c',
        text: '이어폰 꽂고 천천히 들을게 🎧',
        nextSceneId: 'b_scene_premium_1',
        affectionChange: 25,
        isPremium: true,
      },
    ],
  },

  // Route: 수줍
  {
    id: 'b_scene_shy_1',
    background: '',
    character: {
      image: '',
      position: 'center',
      expression: 'soft',
    },
    dialogue: {
      speaker: 'JUN',
      text: '너 말고 누구한테 들려줘.',
      emotion: 'soft',
    },
    nextSceneId: 'b_scene_shy_2',
    delay: 2200,
  },
  {
    id: 'b_scene_shy_2',
    background: '',
    character: {
      image: '',
      position: 'center',
      expression: 'shy',
    },
    dialogue: {
      speaker: 'JUN',
      text: '내 곡은 너한테 가장 먼저 들리고\n그 다음에 세상에 나가는 거야.',
      emotion: 'shy',
    },
    nextSceneId: 'b_scene_merge_1',
    delay: 3000,
  },

  // Route: 따뜻
  {
    id: 'b_scene_warm_1',
    background: '',
    character: {
      image: '',
      position: 'center',
      expression: 'touched',
    },
    dialogue: {
      speaker: 'JUN',
      text: '...왜 자꾸 울컥하게 해 ㅠ',
      emotion: 'touched',
    },
    nextSceneId: 'b_scene_warm_2',
    delay: 2200,
    showCharacterImage: true,
  },
  {
    id: 'b_scene_warm_2',
    background: '',
    character: {
      image: '',
      position: 'center',
      expression: 'warm',
    },
    dialogue: {
      speaker: 'JUN',
      text: '진짜 영광은 내 거야.\n내 곡 들어주는 사람이 너라는 거.',
      emotion: 'warm',
    },
    nextSceneId: 'b_scene_merge_1',
    delay: 3000,
  },

  // Route: 프리미엄
  {
    id: 'b_scene_premium_1',
    background: '',
    character: {
      image: '',
      position: 'center',
      expression: 'shy',
    },
    dialogue: {
      speaker: 'JUN',
      text: '...너 진짜.',
      emotion: 'shy',
    },
    nextSceneId: 'b_scene_premium_2',
    delay: 2000,
  },
  {
    id: 'b_scene_premium_2',
    background: '',
    character: {
      image: '',
      position: 'center',
      expression: 'soft',
    },
    dialogue: {
      speaker: 'JUN',
      text: '그 말 듣고\n다음 곡도 너 생각하며 써야겠다고 결심함 ☁️',
      emotion: 'soft',
    },
    nextSceneId: 'b_scene_merge_1',
    delay: 3200,
  },

  // 공통 머지
  {
    id: 'b_scene_merge_1',
    background: '',
    narration: '잠시 후, 짧은 음성 파일이 도착했다.\n4분짜리 데모 트랙.',
    nextSceneId: 'b_scene_merge_2',
    delay: 3000,
  },
  {
    id: 'b_scene_merge_2',
    background: '',
    narration: '피아노 한 음으로 시작해서\n서서히 보컬이 얹힌다.',
    nextSceneId: 'b_scene_merge_3',
    delay: 3000,
  },
  {
    id: 'b_scene_merge_3',
    background: '',
    character: {
      image: '',
      position: 'center',
      expression: 'vulnerable',
    },
    dialogue: {
      speaker: 'JUN',
      text: '...어때?',
      emotion: 'vulnerable',
    },
    nextSceneId: 'b_scene_merge_4',
    delay: 2500,
    showCharacterImage: true,
  },
  {
    id: 'b_scene_merge_4',
    background: '',
    character: {
      image: '',
      position: 'center',
      expression: 'shy',
    },
    dialogue: {
      speaker: 'JUN',
      text: '솔직하게 말해도 돼.\n괜찮아, 진짜로.',
      emotion: 'shy',
    },
    nextSceneId: 'b_choice_2',
    delay: 2800,
  },

  // 두 번째 선택지
  {
    id: 'b_choice_2',
    background: '',
    narration: '그의 목소리가 떨리는 게\n메시지 너머로도 느껴졌다.',
    choices: [
      {
        id: 'b_ch_2a',
        text: '울 것 같아. 너무 좋아',
        nextSceneId: 'b_scene_finale_1',
        affectionChange: 20,
      },
      {
        id: 'b_ch_2b',
        text: '내 곡인 줄 알았어. 그만큼 와닿아',
        nextSceneId: 'b_scene_finale_1',
        affectionChange: 15,
      },
    ],
  },

  // 피날레
  {
    id: 'b_scene_finale_1',
    background: '',
    character: {
      image: '',
      position: 'center',
      expression: 'touched',
    },
    dialogue: {
      speaker: 'JUN',
      text: '...아.',
      emotion: 'touched',
    },
    nextSceneId: 'b_scene_finale_2',
    delay: 1800,
  },
  {
    id: 'b_scene_finale_2',
    background: '',
    character: {
      image: '',
      position: 'center',
      expression: 'soft',
    },
    dialogue: {
      speaker: 'JUN',
      text: '진짜 다행이다.\n오늘 종일 이 부분 고민했거든.',
      emotion: 'soft',
    },
    nextSceneId: 'b_scene_finale_3',
    delay: 2800,
  },
  {
    id: 'b_scene_finale_3',
    background: '',
    character: {
      image: '',
      position: 'center',
      expression: 'warm',
    },
    dialogue: {
      speaker: 'JUN',
      text: '있지. 다음 곡도\n너한테 가장 먼저 들려줄게.',
      emotion: 'warm',
    },
    nextSceneId: 'b_scene_finale_4',
    delay: 3000,
  },
  {
    id: 'b_scene_finale_4',
    background: '',
    character: {
      image: '',
      position: 'center',
      expression: 'shy',
    },
    dialogue: {
      speaker: 'JUN',
      text: '계속 내 첫 청중 해줄래? 🎹☁️',
      emotion: 'shy',
    },
    isCliffhanger: true,
    delay: 3500,
    showCharacterImage: true,
  },
];

export const SIGNUP_PROMPT_VARIANT_B = {
  title: '대화가 끊겼어요',
  subtitle: 'JUN의 데모 트랙이 당신을 기다리고 있어요',
  npcMessage: '계속 내 첫 청중 해줄래? 🎹☁️',
  benefits: [
    'JUN과 매일 작업실 톡 이어가기',
    '컴백 타이틀곡 데모 가장 먼저 듣기',
    'LUMIN 단톡방 멤버 7인 케미',
    '당신의 생일에 LUMIN 합창 음성 편지',
  ],
  ctaText: '무료로 시작하기',
  ctaSubtext: '30초면 됩니다',
};

// ========================================
// Default exports (Variant A 기본)
// 기존 호출처 호환성 유지
// ========================================

// 기존 이름들 — Variant A를 기본으로 export
export const ONBOARDING_STORY = ONBOARDING_STORY_VARIANT_A;
export const ONBOARDING_STORY_SEQUENCE = ONBOARDING_STORY_SEQUENCE_VARIANT_A;
export const ONBOARDING_DM_SCENARIO = ONBOARDING_DM_SCENARIO_VARIANT_A;
export const ONBOARDING_SPECIAL_SCENARIO = ONBOARDING_SPECIAL_SCENARIO_VARIANT_A;
export const SIGNUP_PROMPT_DATA = SIGNUP_PROMPT_VARIANT_A;

// 스페셜 시나리오 트리거 조건
export const SPECIAL_SCENARIO_TRIGGER = {
  afterMessageId: 'a_npc_deep_4',
  transitionText: '[잠시 후...]',
  transitionDelay: 2000,
};

// 변형 가져오기 헬퍼
export function getOnboardingScenario(variant: OnboardingVariant): OnboardingScenario {
  if (variant === 'b') {
    return {
      variant: 'b',
      personaId: 'jun',
      personaName: 'JUN',
      story: ONBOARDING_STORY_VARIANT_B,
      storySequence: ONBOARDING_STORY_SEQUENCE_VARIANT_B as typeof ONBOARDING_STORY_SEQUENCE_VARIANT_A,
      dmScenario: ONBOARDING_DM_SCENARIO_VARIANT_B,
      specialScenario: ONBOARDING_SPECIAL_SCENARIO_VARIANT_B,
      signupPrompt: SIGNUP_PROMPT_VARIANT_B,
    };
  }
  return {
    variant: 'a',
    personaId: 'haeon',
    personaName: 'HAEON',
    story: ONBOARDING_STORY_VARIANT_A,
    storySequence: ONBOARDING_STORY_SEQUENCE_VARIANT_A,
    dmScenario: ONBOARDING_DM_SCENARIO_VARIANT_A,
    specialScenario: ONBOARDING_SPECIAL_SCENARIO_VARIANT_A,
    signupPrompt: SIGNUP_PROMPT_VARIANT_A,
  };
}

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
