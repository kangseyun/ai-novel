import { Novel, Character, Message } from '@/types';

// 5 Main Personas
export const MOCK_NOVELS: Novel[] = [
  {
    id: 'daniel',
    title: "The Contract Marriage",
    description: "You signed a contract with the ruthless CEO. He owns your debt, but does he own your heart?",
    cover_url: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=800&q=80',
    author: 'Lumina',
    genre: 'Romance',
    tags: ['CEO', 'Obsessive', 'Contract'],
    status: 'Ongoing',
    created_at: new Date().toISOString(),
  },
  // ... other novels (keeping same for brevity, just focusing on Daniel for demo)
  {
    id: 'kael',
    title: "Silent Protector",
    description: "Your father's enemy sent a killer. Now that killer is your only bodyguard.",
    cover_url: 'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=800&q=80',
    author: 'Lumina',
    genre: 'Thriller',
    tags: ['Bodyguard', 'Action', 'Slow Burn'],
    status: 'Ongoing',
    created_at: new Date().toISOString(),
  },
  {
    id: 'adrian',
    title: "The Regretful Genius",
    description: "Five years ago, he chose fame over you. Now he's back, begging for forgiveness.",
    cover_url: 'https://images.unsplash.com/photo-1496345875659-11f7dd282d1d?w=800&q=80',
    author: 'Lumina',
    genre: 'Romance',
    tags: ['Ex-Husband', 'Regret', 'Music'],
    status: 'Ongoing',
    created_at: new Date().toISOString(),
  },
  {
    id: 'ren',
    title: "Dangerous Debt",
    description: "You walked into the lion's den to pay your debt. He wants you as payment instead.",
    cover_url: 'https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?w=800&q=80',
    author: 'Lumina',
    genre: 'Thriller',
    tags: ['Mafia', 'Yandere', 'Toxic'],
    status: 'Ongoing',
    created_at: new Date().toISOString(),
  },
  {
    id: 'jun',
    title: "Secret Idol",
    description: "The world loves him on stage. But backstage, he only has eyes for you.",
    cover_url: 'https://images.unsplash.com/photo-1513956589380-bad6acb9b9d4?w=800&q=80',
    author: 'Lumina',
    genre: 'Romance',
    tags: ['Idol', 'Secret Dating', 'Younger Man'],
    status: 'Ongoing',
    created_at: new Date().toISOString(),
  }
];

export const MOCK_CHARACTERS: Record<string, Character> = {
  'daniel_char': { id: 'daniel_char', novel_id: 'daniel', name: 'Daniel', role: 'love_interest', avatar_url: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=200&q=80' },
  'kael_char': { id: 'kael_char', novel_id: 'kael', name: 'Kael', role: 'love_interest', avatar_url: 'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=200&q=80' },
  'adrian_char': { id: 'adrian_char', novel_id: 'adrian', name: 'Adrian', role: 'love_interest', avatar_url: 'https://images.unsplash.com/photo-1496345875659-11f7dd282d1d?w=200&q=80' },
  'ren_char': { id: 'ren_char', novel_id: 'ren', name: 'Ren', role: 'love_interest', avatar_url: 'https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?w=200&q=80' },
  'jun_char': { id: 'jun_char', novel_id: 'jun', name: 'Jun', role: 'love_interest', avatar_url: 'https://images.unsplash.com/photo-1513956589380-bad6acb9b9d4?w=200&q=80' },
  'user': { id: 'user', novel_id: 'any', name: 'Sophie', role: 'protagonist', avatar_url: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=200&q=80' }
};

export const MOCK_MESSAGES: Record<string, Message[]> = {
  'daniel': [
    { id: 'd1', novel_id: 'daniel', character_id: 'daniel_char', content: "Sit down.", type: 'text', emotion: 'neutral', created_at: '2023-01-01T20:00:00Z', order_index: 1 },
    { id: 'd2', novel_id: 'daniel', character_id: 'daniel_char', content: "We are NOT done discussing this.", type: 'text', emotion: 'urgent', created_at: '2023-01-01T20:00:05Z', order_index: 2 },
    { id: 'd3', novel_id: 'daniel', character_id: 'daniel_char', content: "LOOK AT ME WHEN I'M TALKING TO YOU!", type: 'text', emotion: 'angry', created_at: '2023-01-01T20:00:10Z', order_index: 3 },
    { id: 'd4', novel_id: 'daniel', character_id: 'daniel_char', content: "...please.", type: 'text', emotion: 'whisper', created_at: '2023-01-01T20:00:15Z', order_index: 4 },
    { id: 'd5', novel_id: 'daniel', character_id: 'daniel_char', content: "Don't leave me alone in this darkness.", type: 'text', emotion: 'sad', created_at: '2023-01-01T20:00:20Z', order_index: 5 },
  ],
  'kael': [
    { id: 'k1', novel_id: 'kael', character_id: 'kael_char', content: "Get down.", type: 'text', emotion: 'urgent', created_at: '2023-01-01T20:00:00Z', order_index: 1 },
    { id: 'k2', novel_id: 'kael', character_id: 'kael_char', content: "I said GET DOWN!", type: 'text', emotion: 'angry', created_at: '2023-01-01T20:00:10Z', order_index: 2 },
  ],
};