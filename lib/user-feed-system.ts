/**
 * 유저 피드 & 이벤트 트리거 시스템
 *
 * 유저가 포스팅 → 페르소나가 반응 → 새로운 DM 시나리오 발생
 */

// ============================================
// TYPES
// ============================================

export interface UserPost {
  id: string;
  type: 'photo' | 'text' | 'mood';
  content: string;           // 이미지 URL 또는 텍스트
  caption?: string;
  mood?: UserMood;           // 감정 상태
  location?: string;
  timestamp: number;
  triggeredEvents: string[]; // 이 포스트로 발생한 이벤트들
}

export type UserMood =
  | 'happy'
  | 'sad'
  | 'lonely'
  | 'excited'
  | 'tired'
  | 'romantic'
  | 'mysterious'
  | 'angry';

export interface PostTemplate {
  id: string;
  type: 'photo' | 'text' | 'mood';
  preview: string;           // 미리보기 이미지 또는 텍스트
  caption: string;
  mood: UserMood;
  category: 'daily' | 'night' | 'special' | 'provoke';
  isPremium?: boolean;
}

// 페르소나의 반응 조건
export interface ReactionTrigger {
  id: string;
  personaId: string;
  triggerType: 'post' | 'mood' | 'time' | 'progress';
  conditions: TriggerCondition[];
  priority: number;          // 높을수록 우선
  cooldown?: number;         // ms, 같은 트리거 재발동 쿨다운
  scenarioId: string;        // 발동될 DM 시나리오
  notification: {
    title: string;
    preview: string;
    type: 'dm' | 'story_reply' | 'comment' | 'like' | 'follow';
  };
}

export interface TriggerCondition {
  type: 'mood' | 'keyword' | 'time' | 'affection' | 'progress' | 'random';
  value: string | number;
  operator?: 'eq' | 'gt' | 'lt' | 'gte' | 'lte' | 'contains';
}

// 페르소나별 진행 상태
export interface PersonaProgress {
  personaId: string;
  stage: 'stranger' | 'acquaintance' | 'friend' | 'close' | 'romantic';
  affection: number;
  completedScenarios: string[];
  unlockedScenarios: string[];
  lastInteraction: number;
  flags: Record<string, boolean>;  // 스토리 플래그
}

// 알림/이벤트
export interface FeedEvent {
  id: string;
  personaId: string;
  type: 'dm' | 'story_reply' | 'comment' | 'like' | 'follow';
  title: string;
  preview: string;
  timestamp: number;
  isRead: boolean;
  scenarioId?: string;
  triggeredBy?: string;      // 어떤 포스트가 트리거했는지
}

// ============================================
// POST TEMPLATES (유저가 선택할 수 있는 포스팅들)
// ============================================

export const POST_TEMPLATES: PostTemplate[] = [
  // Daily - 일상
  {
    id: 'daily_coffee',
    type: 'photo',
    preview: 'https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?w=400&q=80',
    caption: '오늘의 커피 ☕',
    mood: 'happy',
    category: 'daily',
  },
  {
    id: 'daily_walk',
    type: 'photo',
    preview: 'https://images.unsplash.com/photo-1476820865390-c52aeebb9891?w=400&q=80',
    caption: '산책 중 🚶‍♀️',
    mood: 'happy',
    category: 'daily',
  },
  {
    id: 'daily_food',
    type: 'photo',
    preview: 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=400&q=80',
    caption: '맛있겠다 🍽️',
    mood: 'excited',
    category: 'daily',
  },

  // Night - 밤/감성
  {
    id: 'night_lonely',
    type: 'text',
    preview: '오늘따라 유독 조용한 밤...',
    caption: '오늘따라 유독 조용한 밤...',
    mood: 'lonely',
    category: 'night',
  },
  {
    id: 'night_insomnia',
    type: 'text',
    preview: '잠이 안 와요',
    caption: '새벽 감성 🌙',
    mood: 'sad',
    category: 'night',
  },
  {
    id: 'night_moon',
    type: 'photo',
    preview: 'https://images.unsplash.com/photo-1532767153582-b1a0e5145009?w=400&q=80',
    caption: '달이 예쁜 밤',
    mood: 'romantic',
    category: 'night',
  },

  // Special - 특별한 순간
  {
    id: 'special_selfie',
    type: 'photo',
    preview: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=400&q=80',
    caption: '오늘의 나 ✨',
    mood: 'happy',
    category: 'special',
  },
  {
    id: 'special_concert',
    type: 'photo',
    preview: 'https://images.unsplash.com/photo-1540039155733-5bb30b53aa14?w=400&q=80',
    caption: '드디어 콘서트! 🎤',
    mood: 'excited',
    category: 'special',
  },

  // Provoke - 도발적 (반응 유도용)
  {
    id: 'provoke_tired',
    type: 'text',
    preview: '지쳤어... 누가 좀 안아줬으면',
    caption: '지쳤어... 누가 좀 안아줬으면',
    mood: 'tired',
    category: 'provoke',
  },
  {
    id: 'provoke_mystery',
    type: 'text',
    preview: '오늘 이상한 일이 있었어...',
    caption: '무슨 일인지 궁금하면 DM 💭',
    mood: 'mysterious',
    category: 'provoke',
    isPremium: true,
  },
  {
    id: 'provoke_heart',
    type: 'text',
    preview: '요즘 자꾸 한 사람이 생각나',
    caption: '나만 그런 거 아니지...?',
    mood: 'romantic',
    category: 'provoke',
    isPremium: true,
  },
];

// ============================================
// JUN REACTION TRIGGERS
// ============================================

export const JUN_REACTION_TRIGGERS: ReactionTrigger[] = [
  // Stage: stranger (첫 만남 후)
  {
    id: 'jun_react_lonely_stranger',
    personaId: 'jun',
    triggerType: 'post',
    conditions: [
      { type: 'mood', value: 'lonely', operator: 'eq' },
      { type: 'progress', value: 'stranger', operator: 'eq' },
    ],
    priority: 10,
    cooldown: 3600000, // 1시간
    scenarioId: 'jun_ep2_lonely',
    notification: {
      title: 'Jun',
      preview: '저도 잠이 안 와서요...',
      type: 'dm',
    },
  },
  {
    id: 'jun_react_night_stranger',
    personaId: 'jun',
    triggerType: 'post',
    conditions: [
      { type: 'mood', value: 'sad', operator: 'eq' },
      { type: 'time', value: 'night', operator: 'eq' },
      { type: 'progress', value: 'stranger', operator: 'eq' },
    ],
    priority: 15,
    scenarioId: 'jun_ep2_night',
    notification: {
      title: 'Jun',
      preview: '괜찮아요...?',
      type: 'dm',
    },
  },
  {
    id: 'jun_react_concert',
    personaId: 'jun',
    triggerType: 'post',
    conditions: [
      { type: 'keyword', value: '콘서트', operator: 'contains' },
      { type: 'affection', value: 10, operator: 'gte' },
    ],
    priority: 20,
    scenarioId: 'jun_ep_concert',
    notification: {
      title: 'Jun',
      preview: '혹시... 오늘 왔어요?',
      type: 'dm',
    },
  },

  // Stage: acquaintance (아는 사이)
  {
    id: 'jun_react_tired_acq',
    personaId: 'jun',
    triggerType: 'post',
    conditions: [
      { type: 'mood', value: 'tired', operator: 'eq' },
      { type: 'progress', value: 'acquaintance', operator: 'eq' },
    ],
    priority: 10,
    scenarioId: 'jun_ep3_comfort',
    notification: {
      title: 'Jun',
      preview: '힘들어요? 저한테 얘기해요',
      type: 'dm',
    },
  },
  {
    id: 'jun_react_selfie_acq',
    personaId: 'jun',
    triggerType: 'post',
    conditions: [
      { type: 'keyword', value: '셀카', operator: 'contains' },
      { type: 'progress', value: 'acquaintance', operator: 'eq' },
    ],
    priority: 5,
    scenarioId: 'jun_ep3_compliment',
    notification: {
      title: 'Jun',
      preview: '❤️ 님이 게시물을 좋아합니다',
      type: 'like',
    },
  },

  // Stage: friend (친구)
  {
    id: 'jun_react_romantic_friend',
    personaId: 'jun',
    triggerType: 'post',
    conditions: [
      { type: 'mood', value: 'romantic', operator: 'eq' },
      { type: 'progress', value: 'friend', operator: 'eq' },
      { type: 'affection', value: 30, operator: 'gte' },
    ],
    priority: 25,
    scenarioId: 'jun_ep5_jealous',
    notification: {
      title: 'Jun',
      preview: '...누구 생각하는 거예요?',
      type: 'dm',
    },
  },

  // Random events (확률 기반)
  {
    id: 'jun_random_check',
    personaId: 'jun',
    triggerType: 'post',
    conditions: [
      { type: 'random', value: 0.3, operator: 'lt' }, // 30% 확률
      { type: 'affection', value: 5, operator: 'gte' },
    ],
    priority: 1,
    cooldown: 7200000, // 2시간
    scenarioId: 'jun_random_check',
    notification: {
      title: 'Jun',
      preview: '뭐해요?',
      type: 'dm',
    },
  },
];

// ============================================
// HELPER FUNCTIONS
// ============================================

export function checkTriggerConditions(
  trigger: ReactionTrigger,
  post: UserPost,
  progress: PersonaProgress,
  currentTime: Date
): boolean {
  return trigger.conditions.every(condition => {
    switch (condition.type) {
      case 'mood':
        return post.mood === condition.value;

      case 'keyword':
        const content = `${post.content} ${post.caption || ''}`.toLowerCase();
        return content.includes((condition.value as string).toLowerCase());

      case 'time':
        const hour = currentTime.getHours();
        if (condition.value === 'night') {
          return hour >= 22 || hour < 5;
        }
        if (condition.value === 'morning') {
          return hour >= 6 && hour < 12;
        }
        return true;

      case 'affection':
        return compareValue(progress.affection, condition.value as number, condition.operator);

      case 'progress':
        return progress.stage === condition.value;

      case 'random':
        return Math.random() < (condition.value as number);

      default:
        return true;
    }
  });
}

function compareValue(a: number, b: number, op?: string): boolean {
  switch (op) {
    case 'gt': return a > b;
    case 'lt': return a < b;
    case 'gte': return a >= b;
    case 'lte': return a <= b;
    case 'eq':
    default: return a === b;
  }
}

export function findMatchingTriggers(
  personaId: string,
  post: UserPost,
  progress: PersonaProgress,
  triggers: ReactionTrigger[],
  currentTime: Date = new Date()
): ReactionTrigger[] {
  return triggers
    .filter(t => t.personaId === personaId)
    .filter(t => checkTriggerConditions(t, post, progress, currentTime))
    .sort((a, b) => b.priority - a.priority);
}

export function getProgressStage(affection: number): PersonaProgress['stage'] {
  if (affection < 10) return 'stranger';
  if (affection < 30) return 'acquaintance';
  if (affection < 60) return 'friend';
  if (affection < 100) return 'close';
  return 'romantic';
}

// ============================================
// SCENARIO TEMPLATES FOR REACTIONS
// ============================================

export const JUN_REACTION_SCENARIOS = {
  jun_ep2_lonely: {
    id: 'jun_ep2_lonely',
    title: '외로운 밤',
    context: '당신의 포스팅을 본 Jun이 먼저 연락했다',
    openingMessage: '저도 잠이 안 와서요...\n그 포스팅 봤어요',
  },
  jun_ep2_night: {
    id: 'jun_ep2_night',
    title: '걱정되는 밤',
    context: '당신의 우울한 포스팅을 본 Jun',
    openingMessage: '괜찮아요...?\n무슨 일 있어요?',
  },
  jun_ep_concert: {
    id: 'jun_ep_concert',
    title: '콘서트에서',
    context: 'Jun이 당신의 콘서트 포스팅을 발견했다',
    openingMessage: '혹시... 오늘 왔어요?\n어디 앉았어요?',
  },
  jun_ep3_comfort: {
    id: 'jun_ep3_comfort',
    title: '위로',
    context: '지친 당신을 걱정하는 Jun',
    openingMessage: '힘들어요?\n저한테 얘기해요... 들을게요',
  },
  jun_ep5_jealous: {
    id: 'jun_ep5_jealous',
    title: '질투',
    context: '당신의 로맨틱한 포스팅에 동요한 Jun',
    openingMessage: '...누구 생각하는 거예요?\n갑자기 그런 글 올리니까...',
  },
  jun_random_check: {
    id: 'jun_random_check',
    title: '안부',
    context: 'Jun이 그냥 연락했다',
    openingMessage: '뭐해요?\n갑자기 궁금해서...',
  },
};
