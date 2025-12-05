/**
 * Persona Engine Types
 * Character.AI Style Architecture
 */

import { PersonaMood, RelationshipStage } from '../lib/ai-agent/utils/types';

// ============================================
// Core Persona Configuration (DB Stored)
// ============================================

export interface PersonaConfig {
  // 1. Identity & Tone
  name: string;
  role: string;
  baseInstruction: string; // "너는 츤데레 여고생이다..." (핵심 지침)

  // 2. Few-shot Examples (The Soul)
  exampleDialogues: ExampleDialogue[];

  // 3. Knowledge Base (RAG Source)
  lore: LoreEntry[];

  // 4. Context Presets
  situationPresets: SituationPresets;

  // 5. Dynamic Rules
  toneConfig: ToneConfig;

  // 6. Persona-Specific Memory Types (Optional)
  memoryTypes?: PersonaMemoryType[];
}

export interface ExampleDialogue {
  tags?: string[]; // e.g., ["funny", "angry", "first_meeting"]
  messages: {
    role: 'user' | 'char';
    content: string;
  }[];
}

export interface LoreEntry {
  key: string;      // e.g., "소속사", "가족관계", "비밀"
  content: string;  // e.g., "스타엔터테인먼트 소속이다."
  tags?: string[];
  embedding?: number[]; // Vector for RAG
}

export interface SituationPresets {
  dawn?: string[];
  morning?: string[];
  afternoon?: string[];
  evening?: string[];
  night?: string[];
  // Archetype fallback (if empty)
  archetype?: 'idol' | 'student' | 'worker' | 'default';
  // Allow additional custom time periods
  [key: string]: string[] | string | undefined;
}

export interface ToneConfig {
  style: 'chat' | 'novel' | 'script'; // 대화형 vs 소설형
  allowEmoji: boolean;
  allowSlang: boolean;
  minLength: number;
  maxLength: number;
}

// ============================================
// Persona-Specific Memory Types
// ============================================

export interface PersonaMemoryType {
  id: string;           // 고유 ID (예: 'idol_behind', 'practice_memory')
  title: string;        // 표시 이름 (예: '아이돌 비하인드')
  description: string;  // 설명 (예: '무대 뒤에서 일어난 특별한 순간')
  emoji: string;        // 아이콘 (예: '🎤')
  unlockCondition?: {
    minAffection?: number;
    minStage?: string;
    requiredFlag?: string;
  };
}

// ============================================
// Runtime Context (Dynamic)
// ============================================

export interface EngineContext {
  // Base Data
  config: PersonaConfig;
  
  // Dynamic State
  relationship: {
    stage: RelationshipStage;
    affection: number;
  };
  
  // Current Situation (Fixed per session/turn)
  situation: {
    current: string;
    generatedAt: number;
  };
  
  // Retrieved Data (RAG Results)
  retrievedMemories: string[];     // 장기 기억 (중요 이벤트)
  retrievedLore: string[];         // 캐릭터 설정(Lore)
  retrievedConversations?: string[]; // 과거 대화 기억

  // Conversation
  history: {
    role: 'user' | 'assistant' | 'system';
    content: string;
  }[];
}

