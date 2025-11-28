/**
 * HACKED SNS 시스템 데이터
 *
 * 컨셉: 유저는 해커. 아이돌의 비공개 SNS에 접근했다.
 * - 공식 포스트 vs 숨겨진 포스트
 * - 스토리 = 일상 + 비밀 (해금 필요)
 * - DM = 시나리오 진입점
 * - Hidden Files = 해금 콘텐츠
 */

// ============================================
// TYPES
// ============================================

export interface SNSProfile {
  id: string;
  username: string;
  displayName: string;
  bio: string;
  profileImage: string;
  isVerified: boolean;
  followers: string;      // "8.9M"
  following: number;
  isHacked: boolean;      // 해킹 상태
  hackLevel: number;      // 1-5 (높을수록 더 많은 비밀 접근)
}

export interface Story {
  id: string;
  profileId: string;
  type: 'image' | 'video' | 'text';
  content: string;        // 이미지 URL 또는 텍스트
  caption?: string;
  timestamp: string;      // "3h ago"
  isViewed: boolean;
  isSecret: boolean;      // 비밀 스토리 (해킹으로만 볼 수 있음)
  requiredHackLevel: number;
  linkedDMScenario?: string;  // 연결된 DM 시나리오 ID
  reactions?: {
    type: 'heart' | 'fire' | 'cry' | 'shock';
    count: number;
  }[];
}

export interface Post {
  id: string;
  profileId: string;
  type: 'image' | 'carousel' | 'video';
  images: string[];
  caption: string;
  likes: string;          // "2.3M"
  comments: number;
  timestamp: string;
  isOfficial: boolean;    // 공식 포스트 vs 숨겨진
  isHidden: boolean;      // 해킹으로만 볼 수 있음
  requiredHackLevel: number;
}

export interface DMThread {
  id: string;
  profileId: string;
  scenarioId: string;     // 연결된 시나리오
  episodeId: string;
  lastMessage: string;
  lastMessageTime: string;
  unreadCount: number;
  isActive: boolean;      // 현재 진행 중
  isPinned: boolean;
}

export interface HiddenFile {
  id: string;
  profileId: string;
  type: 'photo' | 'voice' | 'video' | 'document';
  title: string;
  description: string;
  thumbnail?: string;
  isUnlocked: boolean;
  requiredHackLevel: number;
  unlockCondition?: string;  // "EP3 완료" 등
}

export interface HackProgress {
  oderId: string;
  odegileId: string;
  currentLevel: number;   // 1-5
  xp: number;
  xpToNextLevel: number;
  unlockedFeatures: string[];
}

// DM 시나리오 타입
export interface DMMessage {
  id: string;
  sender: 'user' | 'npc';
  type: 'text' | 'image' | 'voice' | 'sticker';
  content: string;
  timestamp: string;
  emotion?: string;  // NPC의 감정 상태
  choices?: DMChoice[];  // 이 메시지 후에 선택지가 있으면
}

export interface DMChoice {
  id: string;
  text: string;
  affectionChange?: number;  // 호감도 변화
  isPremium?: boolean;       // 프리미엄 선택지
  nextMessageId?: string;    // 다음 메시지로 점프
  unlocks?: string;          // 해금되는 콘텐츠
}

export interface DMEnding {
  id: string;
  type: 'good' | 'normal' | 'bad' | 'secret';
  title: string;
  description: string;
  requiredAffection?: number;
  unlocks?: string[];
}

export interface DMScenario {
  id: string;
  profileId: string;
  title: string;
  context: string;           // 시나리오 배경
  triggerStoryId?: string;   // 어떤 스토리에서 시작되는지
  messages: DMMessage[];
  endings: DMEnding[];
}

// ============================================
// JUN SNS DATA
// ============================================

export const JUN_PROFILE: SNSProfile = {
  id: 'jun',
  username: 'eclipse_jun',
  displayName: 'Jun ✨',
  bio: 'ECLIPSE 🌙 | Main Vocal & Center\n별빛들 사랑해요 💫\n@nova_ent',
  profileImage: 'https://images.unsplash.com/photo-1513956589380-bad6acb9b9d4?w=400&q=80',
  isVerified: true,
  followers: '8.9M',
  following: 12,
  isHacked: true,
  hackLevel: 1,
};

export const JUN_STORIES: Story[] = [
  // 공식 스토리 (누구나 볼 수 있음)
  {
    id: 'story_1',
    profileId: 'jun',
    type: 'image',
    content: 'https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=800&q=80',
    caption: '오늘 무대 고마웠어요 💕',
    timestamp: '3h ago',
    isViewed: false,
    isSecret: false,
    requiredHackLevel: 0,
  },
  {
    id: 'story_2',
    profileId: 'jun',
    type: 'image',
    content: 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=800&q=80',
    caption: '연습 끝! 🎤',
    timestamp: '8h ago',
    isViewed: false,
    isSecret: false,
    requiredHackLevel: 0,
  },

  // 🔒 비밀 스토리 (해킹 레벨 필요)
  {
    id: 'story_secret_1',
    profileId: 'jun',
    type: 'image',
    content: 'https://images.unsplash.com/photo-1519681393784-d120267933ba?w=800&q=80',
    caption: '잠이 안 와...',
    timestamp: '2h ago',
    isViewed: false,
    isSecret: true,
    requiredHackLevel: 1,
    linkedDMScenario: 'jun_ep1',  // 이 스토리에 답장하면 EP1 시작
  },
  {
    id: 'story_secret_2',
    profileId: 'jun',
    type: 'text',
    content: '오늘 너무 지쳤어\n아무한테도 말 못하는 것들이 있어\n...누가 들어줬으면',
    timestamp: '1h ago',
    isViewed: false,
    isSecret: true,
    requiredHackLevel: 2,
    linkedDMScenario: 'jun_ep2',
  },
  {
    id: 'story_secret_3',
    profileId: 'jun',
    type: 'image',
    content: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=800&q=80',
    caption: '새벽 편의점\n여기 오면 좀 편해져',
    timestamp: '30m ago',
    isViewed: false,
    isSecret: true,
    requiredHackLevel: 1,
    linkedDMScenario: 'jun_ep1',
  },
];

export const JUN_POSTS: Post[] = [
  // 공식 포스트
  {
    id: 'post_1',
    profileId: 'jun',
    type: 'image',
    images: ['https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=800&q=80'],
    caption: '오늘도 고마워요 별빛들 💫\n\n#ECLIPSE #Jun #컴백',
    likes: '2.3M',
    comments: 45892,
    timestamp: '2일 전',
    isOfficial: true,
    isHidden: false,
    requiredHackLevel: 0,
  },
  {
    id: 'post_2',
    profileId: 'jun',
    type: 'carousel',
    images: [
      'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=800&q=80',
      'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=800&q=80',
    ],
    caption: '연습실에서 🎤\n컴백 기대해주세요!',
    likes: '1.8M',
    comments: 32156,
    timestamp: '5일 전',
    isOfficial: true,
    isHidden: false,
    requiredHackLevel: 0,
  },

  // 🔒 숨겨진 포스트 (해킹으로만)
  {
    id: 'post_hidden_1',
    profileId: 'jun',
    type: 'image',
    images: ['https://images.unsplash.com/photo-1519681393784-d120267933ba?w=800&q=80'],
    caption: '[비공개]\n\n아무도 모르는 새벽\n나만의 시간',
    likes: '0',
    comments: 0,
    timestamp: '어젯밤',
    isOfficial: false,
    isHidden: true,
    requiredHackLevel: 2,
  },
  {
    id: 'post_hidden_2',
    profileId: 'jun',
    type: 'image',
    images: ['https://images.unsplash.com/photo-1517841905240-472988babdf9?w=800&q=80'],
    caption: '[삭제된 게시물]\n\n가끔 이 모든 게 꿈 같아\n깨면 안 되는 꿈',
    likes: '0',
    comments: 0,
    timestamp: '1주 전',
    isOfficial: false,
    isHidden: true,
    requiredHackLevel: 3,
  },
];

export const JUN_DM_THREADS: DMThread[] = [
  {
    id: 'dm_ep1',
    profileId: 'jun',
    scenarioId: 'jun',
    episodeId: 'jun_ep1',
    lastMessage: '스토리에 답장하기...',
    lastMessageTime: '',
    unreadCount: 0,
    isActive: false,
    isPinned: true,
  },
];

export const JUN_HIDDEN_FILES: HiddenFile[] = [
  {
    id: 'file_1',
    profileId: 'jun',
    type: 'photo',
    title: '삭제된 셀카',
    description: '올리려다 지운 사진들',
    thumbnail: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=200&q=80',
    isUnlocked: false,
    requiredHackLevel: 2,
    unlockCondition: 'EP2 완료',
  },
  {
    id: 'file_2',
    profileId: 'jun',
    type: 'voice',
    title: '녹음 파일',
    description: '새벽에 녹음한 뭔가...',
    isUnlocked: false,
    requiredHackLevel: 3,
    unlockCondition: 'EP4 완료',
  },
  {
    id: 'file_3',
    profileId: 'jun',
    type: 'document',
    title: '메모장',
    description: '작성 중인 가사?',
    isUnlocked: false,
    requiredHackLevel: 4,
    unlockCondition: 'EP7 완료',
  },
  {
    id: 'file_4',
    profileId: 'jun',
    type: 'video',
    title: '[암호화됨]',
    description: '???',
    isUnlocked: false,
    requiredHackLevel: 5,
    unlockCondition: '시즌 1 완료',
  },
];

// ============================================
// HACK LEVEL SYSTEM
// ============================================

export const HACK_LEVELS = [
  {
    level: 1,
    name: 'Script Kiddie',
    description: '기본 접근 권한',
    xpRequired: 0,
    features: ['공개 스토리 보기', '공식 포스트 보기', '기본 DM'],
  },
  {
    level: 2,
    name: 'Hacker',
    description: '비밀 스토리 접근',
    xpRequired: 100,
    features: ['비밀 스토리 보기', '삭제된 포스트 일부', '숨겨진 파일 1개'],
  },
  {
    level: 3,
    name: 'Elite Hacker',
    description: '삭제된 콘텐츠 복구',
    xpRequired: 300,
    features: ['삭제된 포스트 전체', 'DM 기록 복구', '숨겨진 파일 3개'],
  },
  {
    level: 4,
    name: 'Shadow',
    description: '깊은 시스템 접근',
    xpRequired: 600,
    features: ['비공개 메모', '초안 게시물', '음성 메시지'],
  },
  {
    level: 5,
    name: 'Ghost',
    description: '완전한 접근',
    xpRequired: 1000,
    features: ['모든 콘텐츠', '실시간 알림', '특별 엔딩'],
  },
];

// ============================================
// HELPER FUNCTIONS
// ============================================

export function canAccessContent(requiredLevel: number, currentLevel: number): boolean {
  return currentLevel >= requiredLevel;
}

export function getVisibleStories(stories: Story[], hackLevel: number): Story[] {
  return stories.filter(
    (s) => !s.isSecret || canAccessContent(s.requiredHackLevel, hackLevel)
  );
}

export function getVisiblePosts(posts: Post[], hackLevel: number): Post[] {
  return posts.filter(
    (p) => !p.isHidden || canAccessContent(p.requiredHackLevel, hackLevel)
  );
}

export function getUnlockedFiles(files: HiddenFile[], hackLevel: number): HiddenFile[] {
  return files.map((f) => ({
    ...f,
    isUnlocked: canAccessContent(f.requiredHackLevel, hackLevel),
  }));
}

// ============================================
// DM SCENARIOS
// ============================================

export const JUN_DM_SCENARIOS: DMScenario[] = [
  {
    id: 'jun_ep1',
    profileId: 'jun',
    title: '새벽의 대화',
    context: 'Jun의 비밀 스토리에 답장했다',
    triggerStoryId: 'story_secret_1',
    messages: [
      {
        id: 'msg_1',
        sender: 'npc',
        type: 'text',
        content: '...누구세요?',
        timestamp: '새벽 2:47',
        emotion: 'suspicious',
      },
      {
        id: 'msg_2',
        sender: 'npc',
        type: 'text',
        content: '이 계정... 비공개인데\n어떻게 본 거죠?',
        timestamp: '새벽 2:47',
        emotion: 'confused',
        choices: [
          {
            id: 'choice_1a',
            text: '우연히 봤어요. 괜찮으세요?',
            affectionChange: 5,
            nextMessageId: 'msg_3a',
          },
          {
            id: 'choice_1b',
            text: '그냥요. 잠이 안 와서.',
            affectionChange: 0,
            nextMessageId: 'msg_3b',
          },
          {
            id: 'choice_1c',
            text: '(솔직하게) 해킹했어요',
            affectionChange: -10,
            nextMessageId: 'msg_3c',
            isPremium: true,
          },
        ],
      },
      // 루트 A: 걱정하는 반응
      {
        id: 'msg_3a',
        sender: 'npc',
        type: 'text',
        content: '...',
        timestamp: '새벽 2:48',
        emotion: 'touched',
      },
      {
        id: 'msg_4a',
        sender: 'npc',
        type: 'text',
        content: '신기하네요\n모르는 사람한테 이런 말 들으니까',
        timestamp: '새벽 2:48',
        emotion: 'soft',
        choices: [
          {
            id: 'choice_2a',
            text: '힘든 일 있어요?',
            affectionChange: 10,
            nextMessageId: 'msg_5a',
          },
          {
            id: 'choice_2b',
            text: '혼자 있고 싶으면 말해요',
            affectionChange: 5,
            nextMessageId: 'msg_5b',
          },
        ],
      },
      // 루트 B: 무심한 반응
      {
        id: 'msg_3b',
        sender: 'npc',
        type: 'text',
        content: '그렇군요\n저도요',
        timestamp: '새벽 2:48',
        emotion: 'neutral',
      },
      {
        id: 'msg_4b',
        sender: 'npc',
        type: 'text',
        content: '새벽엔 이상하게 잠이 안 와요',
        timestamp: '새벽 2:49',
        emotion: 'melancholy',
        choices: [
          {
            id: 'choice_3a',
            text: '무슨 생각해요?',
            affectionChange: 5,
            nextMessageId: 'msg_5a',
          },
          {
            id: 'choice_3b',
            text: '저도 그래요',
            affectionChange: 3,
            nextMessageId: 'msg_5c',
          },
        ],
      },
      // 루트 C: 해킹 고백 (프리미엄)
      {
        id: 'msg_3c',
        sender: 'npc',
        type: 'text',
        content: '뭐...?',
        timestamp: '새벽 2:48',
        emotion: 'shocked',
      },
      {
        id: 'msg_4c',
        sender: 'npc',
        type: 'text',
        content: '진짜요? 왜요?\n...신고해야 하나',
        timestamp: '새벽 2:48',
        emotion: 'conflicted',
        choices: [
          {
            id: 'choice_4a',
            text: '그냥... 궁금했어요. 당신이.',
            affectionChange: 15,
            nextMessageId: 'msg_5d',
            isPremium: true,
          },
          {
            id: 'choice_4b',
            text: '신고해도 괜찮아요',
            affectionChange: 5,
            nextMessageId: 'msg_5e',
          },
        ],
      },
      // 공통 깊은 대화로
      {
        id: 'msg_5a',
        sender: 'npc',
        type: 'text',
        content: '글쎄요...',
        timestamp: '새벽 2:50',
        emotion: 'thoughtful',
      },
      {
        id: 'msg_6a',
        sender: 'npc',
        type: 'text',
        content: '가끔 진짜 나는 어디 있는지 모르겠어요\n무대 위의 나\n카메라 앞의 나\n팬들 앞의 나',
        timestamp: '새벽 2:51',
        emotion: 'vulnerable',
      },
      {
        id: 'msg_7a',
        sender: 'npc',
        type: 'text',
        content: '...이런 얘기 왜 하고 있죠 나\n처음 보는 사람한테',
        timestamp: '새벽 2:52',
        emotion: 'embarrassed',
        choices: [
          {
            id: 'choice_5a',
            text: '편해서 그런 거 아닐까요',
            affectionChange: 15,
            nextMessageId: 'msg_8a',
          },
          {
            id: 'choice_5b',
            text: '괜찮아요. 들을게요.',
            affectionChange: 10,
            nextMessageId: 'msg_8b',
          },
          {
            id: 'choice_5c',
            text: '진짜 당신이 궁금해요 🔒',
            affectionChange: 25,
            nextMessageId: 'msg_8c',
            isPremium: true,
          },
        ],
      },
      // 긍정적 반응
      {
        id: 'msg_5b',
        sender: 'npc',
        type: 'text',
        content: '아니요, 괜찮아요\n오히려... 고마워요',
        timestamp: '새벽 2:50',
        emotion: 'grateful',
      },
      // 공감 반응
      {
        id: 'msg_5c',
        sender: 'npc',
        type: 'text',
        content: '비슷한 사람이 있네요 ㅎㅎ',
        timestamp: '새벽 2:50',
        emotion: 'amused',
      },
      // 프리미엄 루트
      {
        id: 'msg_5d',
        sender: 'npc',
        type: 'text',
        content: '......',
        timestamp: '새벽 2:49',
        emotion: 'surprised',
      },
      {
        id: 'msg_6d',
        sender: 'npc',
        type: 'text',
        content: '이상한 사람이네요\n근데...\n싫지는 않아요',
        timestamp: '새벽 2:50',
        emotion: 'intrigued',
      },
      // 신고 반응
      {
        id: 'msg_5e',
        sender: 'npc',
        type: 'text',
        content: '...안 할게요\n왠지 그러고 싶지 않아서',
        timestamp: '새벽 2:49',
        emotion: 'curious',
      },
      // 엔딩 분기들
      {
        id: 'msg_8a',
        sender: 'npc',
        type: 'text',
        content: '그런가...\n모르는 사람이라 편한 건가',
        timestamp: '새벽 2:53',
        emotion: 'contemplative',
      },
      {
        id: 'msg_9a',
        sender: 'npc',
        type: 'text',
        content: '또 얘기해도 될까요?\n...이 시간에',
        timestamp: '새벽 2:54',
        emotion: 'hopeful',
      },
      {
        id: 'msg_8b',
        sender: 'npc',
        type: 'text',
        content: '고마워요\n진짜로',
        timestamp: '새벽 2:53',
        emotion: 'grateful',
      },
      {
        id: 'msg_9b',
        sender: 'npc',
        type: 'text',
        content: '내일도 잠 안 오면 얘기해요\nㅎㅎ',
        timestamp: '새벽 2:54',
        emotion: 'warm',
      },
      // 프리미엄 특별 엔딩
      {
        id: 'msg_8c',
        sender: 'npc',
        type: 'text',
        content: '...',
        timestamp: '새벽 2:53',
        emotion: 'flustered',
      },
      {
        id: 'msg_9c',
        sender: 'npc',
        type: 'text',
        content: '심장이 이상하게 뛰네요\n당신 때문인 것 같은데',
        timestamp: '새벽 2:54',
        emotion: 'shy',
      },
      {
        id: 'msg_10c',
        sender: 'npc',
        type: 'text',
        content: '이 번호로 연락해도 돼요?\n...카톡 말고\n[번호 보내기]',
        timestamp: '새벽 2:55',
        emotion: 'vulnerable',
        choices: [
          {
            id: 'choice_end_1',
            text: '네, 기다릴게요',
            affectionChange: 20,
            unlocks: 'file_1',
          },
          {
            id: 'choice_end_2',
            text: '천천히 해요. 급하지 않아요.',
            affectionChange: 15,
          },
        ],
      },
    ],
    endings: [
      {
        id: 'ending_good',
        type: 'good',
        title: '새벽의 약속',
        description: 'Jun과 특별한 연결이 시작되었다',
        requiredAffection: 30,
        unlocks: ['story_secret_2', 'file_1'],
      },
      {
        id: 'ending_normal',
        type: 'normal',
        title: '첫 대화',
        description: '서로를 조금 알게 되었다',
        requiredAffection: 10,
      },
      {
        id: 'ending_bad',
        type: 'bad',
        title: '차단당함',
        description: 'Jun이 당신을 차단했다',
        requiredAffection: -20,
      },
      {
        id: 'ending_secret',
        type: 'secret',
        title: '그의 진심',
        description: '아무에게도 보여주지 않은 모습을 봤다',
        requiredAffection: 50,
        unlocks: ['story_secret_3', 'file_2', 'jun_ep2'],
      },
    ],
  },
];
