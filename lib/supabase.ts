import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

// 클라이언트 사이드용 Supabase 클라이언트
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    storageKey: 'luminovel-auth',
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});

// 타입 정의
export interface User {
  id: string;
  email: string;
  nickname: string | null;
  profile_image: string | null;
  bio: string | null;
  tokens: number;
  created_at: string;
  onboarding_completed: boolean;
  onboarding_variant: string | null;
}

export interface UserPersona {
  id: string;
  user_id: string;
  personality_type: string | null;
  communication_style: string | null;
  emotional_tendency: string | null;
  interests: string[] | null;
  love_language: string | null;
  attachment_style: string | null;
  created_at: string;
}

export interface GameState {
  id: string;
  user_id: string;
  persona_id: string;
  affection: number;
  relationship_stage: string;
  completed_episodes: string[];
  unlocked_episodes: string[];
  story_flags: Record<string, boolean>;
  current_episode: string | null;
  current_scene: string | null;
  current_beat: number;
  last_interaction: string;
}

export interface GameSession {
  id: string;
  user_id: string;
  persona_id: string;
  episode_id: string;
  scene_id: string | null;
  beat_index: number;
  status: 'active' | 'completed' | 'abandoned';
  started_at: string;
  completed_at: string | null;
}

export interface ConversationHistory {
  id: string;
  user_id: string;
  persona_id: string;
  episode_id: string | null;
  scene_id: string | null;
  beat_id: string | null;
  speaker: 'user' | 'persona';
  content: string;
  emotion: string | null;
  choice_made: string | null;
  affection_change: number;
  created_at: string;
}

export interface FeedEvent {
  id: string;
  user_id: string;
  type: string;
  persona_id: string | null;
  title: string | null;
  preview: string | null;
  scenario_id: string | null;
  post_id: string | null;
  read: boolean;
  created_at: string;
}

export interface HackProgress {
  id: string;
  user_id: string;
  persona_id: string;
  level: number;
  xp: number;
  unlocked_content: string[];
  viewed_stories: string[];
}
