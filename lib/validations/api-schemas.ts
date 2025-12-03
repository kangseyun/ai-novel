/**
 * API 입력 검증 스키마
 * Zod를 사용한 타입 안전한 검증
 */

import { z } from 'zod';

// ============================================
// 공통 스키마
// ============================================

export const UUIDSchema = z.string().uuid();
export const PersonaIdSchema = z.string().min(1).max(100).regex(/^[a-z0-9_-]+$/i);

// ============================================
// Chat API 스키마
// ============================================

export const ChatRequestSchema = z.object({
  personaId: PersonaIdSchema,
  message: z.string().min(1).max(10000).trim(),
  sessionId: UUIDSchema.optional(),
  choiceData: z.object({
    choiceId: z.string(),
    wasPremium: z.boolean(),
  }).optional(),
});

export type ChatRequest = z.infer<typeof ChatRequestSchema>;

// ============================================
// Memory API 스키마
// ============================================

export const MemoryQuerySchema = z.object({
  personaId: PersonaIdSchema,
  limit: z.number().min(1).max(100).optional().default(10),
  memoryType: z.enum([
    'first_meeting', 'promise', 'secret_shared', 'conflict',
    'reconciliation', 'intimate_moment', 'gift_received', 'milestone',
    'user_preference', 'emotional_event', 'location_memory',
    'nickname', 'inside_joke', 'important_date'
  ]).optional(),
});

export type MemoryQuery = z.infer<typeof MemoryQuerySchema>;

// ============================================
// Event Check API 스키마
// ============================================

export const EventCheckSchema = z.object({
  personaId: PersonaIdSchema,
  actionType: z.enum([
    'app_open', 'dm_view', 'profile_view',
    'scenario_complete', 'purchase', 'share',
    'message_sent', 'message_received', 'premium_purchased'
  ]).optional(),
});

export type EventCheck = z.infer<typeof EventCheckSchema>;

// ============================================
// Scenario API 스키마
// ============================================

export const ScenarioStartSchema = z.object({
  personaId: PersonaIdSchema,
  scenarioId: UUIDSchema,
});

export type ScenarioStart = z.infer<typeof ScenarioStartSchema>;

export const ScenarioAdvanceSchema = z.object({
  personaId: PersonaIdSchema,
  scenarioId: UUIDSchema,
  nextSceneId: z.string().min(1),
  choiceMade: z.object({
    sceneId: z.string(),
    choiceId: z.string(),
  }).optional(),
});

export type ScenarioAdvance = z.infer<typeof ScenarioAdvanceSchema>;

// ============================================
// DM API 스키마
// ============================================

export const DMListQuerySchema = z.object({
  limit: z.number().min(1).max(50).optional().default(20),
  offset: z.number().min(0).optional().default(0),
});

export type DMListQuery = z.infer<typeof DMListQuerySchema>;

export const DMMessagesQuerySchema = z.object({
  personaId: PersonaIdSchema,
  sessionId: UUIDSchema.optional(),
  limit: z.number().min(1).max(100).optional().default(50),
  before: z.string().datetime().optional(),
});

export type DMMessagesQuery = z.infer<typeof DMMessagesQuerySchema>;

// ============================================
// User Profile 스키마
// ============================================

export const UserProfileUpdateSchema = z.object({
  nickname: z.string().min(1).max(50).optional(),
  personalityType: z.string().optional(),
  communicationStyle: z.string().optional(),
  emotionalTendency: z.string().optional(),
  interests: z.array(z.string()).max(20).optional(),
  loveLanguage: z.string().optional(),
  attachmentStyle: z.string().optional(),
  locale: z.string().max(10).optional(),
});

export type UserProfileUpdate = z.infer<typeof UserProfileUpdateSchema>;
