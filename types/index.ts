export type Profile = {
  id: string;
  username: string;
  avatar_url?: string;
  coins: number; // User currency
};

export type Novel = {
  id: string;
  title: string;
  description: string;
  cover_url: string;
  author: string;
  genre: 'Romance' | 'Thriller' | 'Fantasy';
  tags: string[];
  status: 'Ongoing' | 'Completed';
  created_at: string;
};

export type Character = {
  id: string;
  novel_id: string;
  name: string;
  avatar_url: string;
  role: 'protagonist' | 'love_interest' | 'system';
  description?: string;
};

export type MessageEmotion = 'neutral' | 'angry' | 'whisper' | 'urgent' | 'love' | 'sad';

export type Message = {
  id: string;
  novel_id: string;
  character_id: string; // 'user' if sent by user
  content: string; // Text content or Image URL
  type: 'text' | 'image' | 'system'; // Removed 'voice'
  emotion?: MessageEmotion; // New: Controls text animation
  is_locked?: boolean; // If true, content is hidden/blurred
  unlock_price?: number; // Cost to unlock
  created_at: string;
  order_index: number;
};
