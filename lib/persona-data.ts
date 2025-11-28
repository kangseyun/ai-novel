/**
 * 페르소나 데이터 - 온보딩용 캐릭터 정보
 */

export interface PersonaCard {
  id: string;
  name: string;
  tagline: string;
  image: string;
  archetype: string;  // "츤데레 아이돌", "미스터리한 선배" 등
  teaserLine: string;  // 후킹용 한 줄
  secretLine: string;  // 비밀스러운 한 줄
  tags: string[];
  color: string;  // 테마 컬러
  available: boolean;
}

export interface TeaserMessage {
  id: string;
  personaId: string;
  type: 'text' | 'image' | 'voice';
  content: string;
  emotion?: string;
  delay: number;  // ms
}

// ============================================
// PERSONA CARDS
// ============================================

export const PERSONAS: PersonaCard[] = [
  {
    id: 'jun',
    name: 'Jun',
    tagline: '당신만 볼 수 있는 새벽',
    image: 'https://images.unsplash.com/photo-1513956589380-bad6acb9b9d4?w=400&q=80',
    archetype: '비밀이 많은 아이돌',
    teaserLine: '"...잠이 안 와. 너도?"',
    secretLine: '무대 위에서는 완벽하지만, 새벽엔 외로워하는',
    tags: ['아이돌', '새벽감성', '비밀'],
    color: '#8B5CF6',
    available: true,
  },
  {
    id: 'minho',
    name: 'Minho',
    tagline: '차가운 척 하는 따뜻함',
    image: 'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=400&q=80',
    archetype: '츤데레 선배',
    teaserLine: '"귀찮게 왜 자꾸 신경 쓰이는 건데..."',
    secretLine: '무뚝뚝하지만 누구보다 당신을 챙기는',
    tags: ['츤데레', '선배', '보호'],
    color: '#3B82F6',
    available: false,
  },
  {
    id: 'hana',
    name: 'Hana',
    tagline: '해맑음 뒤에 숨긴 그림자',
    image: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=400&q=80',
    archetype: '반전 있는 여사친',
    teaserLine: '"오늘도 좋은 하루! ...거짓말이야, 사실은"',
    secretLine: '항상 웃지만, 가끔 눈물을 삼키는',
    tags: ['반전', '여사친', '위로'],
    color: '#EC4899',
    available: false,
  },
  {
    id: 'seojun',
    name: 'Seojun',
    tagline: '위험한 매력의 나쁜 남자',
    image: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=400&q=80',
    archetype: '나쁜 남자',
    teaserLine: '"왜 도망 안 가? 나 위험한 사람인데."',
    secretLine: '거친 겉모습 안에 상처받은 과거를 숨긴',
    tags: ['나쁜남자', '위험', '상처'],
    color: '#EF4444',
    available: false,
  },
  {
    id: 'yuna',
    name: 'Yuna',
    tagline: '당신만의 비밀 팬',
    image: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=400&q=80',
    archetype: '수줍은 후배',
    teaserLine: '"저... 선배 좋아해요. 비밀인데..."',
    secretLine: '멀리서 바라보다 용기 낸 고백',
    tags: ['후배', '순수', '첫사랑'],
    color: '#F472B6',
    available: false,
  },
];

// ============================================
// TEASER SEQUENCES - 선택 후 바로 보여줄 티저
// ============================================

export const TEASER_SEQUENCES: Record<string, TeaserMessage[]> = {
  jun: [
    {
      id: 't1',
      personaId: 'jun',
      type: 'image',
      content: 'https://images.unsplash.com/photo-1519681393784-d120267933ba?w=800&q=80',
      delay: 0,
    },
    {
      id: 't2',
      personaId: 'jun',
      type: 'text',
      content: '새벽 2:47',
      emotion: 'timestamp',
      delay: 800,
    },
    {
      id: 't3',
      personaId: 'jun',
      type: 'text',
      content: '...잠이 안 와',
      emotion: 'melancholy',
      delay: 1500,
    },
    {
      id: 't4',
      personaId: 'jun',
      type: 'text',
      content: '이런 얘기 할 사람이 없어서',
      emotion: 'lonely',
      delay: 2500,
    },
    {
      id: 't5',
      personaId: 'jun',
      type: 'text',
      content: '너한테 말해도 될까',
      emotion: 'hopeful',
      delay: 3500,
    },
  ],
  // 다른 캐릭터들의 티저도 추가 가능
};

// ============================================
// QUICK CHOICE - 티저 후 즉시 선택
// ============================================

export interface QuickChoice {
  id: string;
  text: string;
  reaction: string;  // 선택 후 캐릭터 반응
  affection: number;
  isPremium?: boolean;
}

export const TEASER_CHOICES: Record<string, QuickChoice[]> = {
  jun: [
    {
      id: 'q1',
      text: '응, 들을게',
      reaction: '진짜...? 고마워',
      affection: 10,
    },
    {
      id: 'q2',
      text: '나도 잠 안 와',
      reaction: '...같이 있어줘',
      affection: 8,
    },
    {
      id: 'q3',
      text: '무슨 일 있어?',
      reaction: '그냥... 네가 궁금했어',
      affection: 15,
      isPremium: true,
    },
  ],
};

// ============================================
// HELPERS
// ============================================

export function getAvailablePersonas(): PersonaCard[] {
  return PERSONAS.filter(p => p.available);
}

export function getPersonaById(id: string): PersonaCard | undefined {
  return PERSONAS.find(p => p.id === id);
}

export function getTeaserSequence(personaId: string): TeaserMessage[] {
  return TEASER_SEQUENCES[personaId] || [];
}

export function getTeaserChoices(personaId: string): QuickChoice[] {
  return TEASER_CHOICES[personaId] || [];
}
