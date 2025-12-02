/**
 * Zod Schemas for LLM Response Validation
 * LLM 응답 검증용 스키마 정의
 */

import { z } from 'zod';
import type { PersonaMood, ChoiceTone, LLMDialogueResponse, DialogueChoice } from './types';

// ============================================
// 기본 타입 스키마 (types.ts와 일치)
// ============================================

export const PersonaMoodSchema = z.enum([
  'neutral',
  'happy',
  'sad',
  'angry',
  'flirty',
  'vulnerable',
  'playful',
  'jealous',
  'worried',
  'excited',
]);

export const ChoiceToneSchema = z.enum([
  'neutral',
  'friendly',
  'flirty',
  'cold',
  'playful',
  'bold',
  'shy',
  'confrontational',
  'supportive',
]);

// ============================================
// LLM 응답 스키마
// ============================================

// 시나리오 트리거 스키마
export const ScenarioTriggerSchema = z.object({
  shouldStart: z.boolean(),
  scenarioType: z.string().optional(),
  scenarioContext: z.string().optional(),
  location: z.string().optional(),
  transitionMessage: z.string().optional(),
}).optional();

// 대화 응답 스키마
export const DialogueResponseSchema = z.object({
  content: z.string().min(1),
  emotion: PersonaMoodSchema.default('neutral'),
  innerThought: z.string().optional(),
  affectionModifier: z.number().min(-20).max(20).default(0),
  flagsToSet: z.record(z.string(), z.boolean()).optional(),
  suggestedChoices: z.array(z.object({
    id: z.string(),
    text: z.string(),
    tone: ChoiceToneSchema.optional(),
  })).optional(),
  scenarioTrigger: ScenarioTriggerSchema,
});

// 선택지 스키마
export const DialogueChoiceSchema = z.object({
  id: z.string(),
  text: z.string().min(1),
  tone: ChoiceToneSchema.default('neutral'),
  isPremium: z.boolean().default(false),
  premiumCost: z.number().optional(),
  estimatedAffectionChange: z.number().default(0),
  nextBeatHint: z.string().optional(),
});

export const ChoicesResponseSchema = z.object({
  choices: z.array(DialogueChoiceSchema).min(1).max(5),
});

// 이벤트 메시지 스키마
export const EventMessageResponseSchema = z.object({
  content: z.string().min(1),
  emotion: PersonaMoodSchema.default('neutral'),
  postType: z.string().optional(),
});

// 스토리 분기 스키마
export const StoryBranchResponseSchema = z.object({
  selectedBranch: z.string(),
  reasoning: z.string(),
  flagsToSet: z.record(z.string(), z.boolean()).default({}),
});

// ============================================
// 타입 (기존 types.ts와 호환)
// ============================================

export type StoryBranchResponseParsed = z.infer<typeof StoryBranchResponseSchema>;

// ============================================
// 안전한 파싱 헬퍼
// ============================================

/**
 * JSON 문자열에서 마크다운 코드블록 제거
 */
function extractJSON(response: string): string {
  const codeBlockMatch = response.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (codeBlockMatch) {
    return codeBlockMatch[1].trim();
  }
  return response.trim();
}

/**
 * 안전한 대화 응답 파싱
 */
export function parseDialogueResponse(response: string): LLMDialogueResponse {
  try {
    const jsonStr = extractJSON(response);
    const parsed = JSON.parse(jsonStr);
    const validated = DialogueResponseSchema.parse(parsed);

    // types.ts의 LLMDialogueResponse 형식으로 변환
    return {
      content: validated.content,
      emotion: validated.emotion as PersonaMood,
      innerThought: validated.innerThought,
      affectionModifier: validated.affectionModifier,
      flagsToSet: validated.flagsToSet as Record<string, boolean> | undefined,
      suggestedChoices: validated.suggestedChoices?.map(c => ({
        id: c.id,
        text: c.text,
        tone: (c.tone || 'neutral') as ChoiceTone,
        isPremium: false,
        estimatedAffectionChange: 0,
      })),
      scenarioTrigger: validated.scenarioTrigger?.shouldStart ? {
        shouldStart: true,
        scenarioType: (validated.scenarioTrigger.scenarioType || 'meeting') as 'meeting' | 'date' | 'confession' | 'conflict' | 'intimate' | 'custom',
        scenarioContext: validated.scenarioTrigger.scenarioContext || '',
        location: validated.scenarioTrigger.location,
        transitionMessage: validated.scenarioTrigger.transitionMessage,
      } : undefined,
    };
  } catch (error) {
    console.warn('[Zod] DialogueResponse parsing failed:', error);
    return {
      content: response,
      emotion: 'neutral',
      affectionModifier: 0,
    };
  }
}

/**
 * 안전한 선택지 응답 파싱
 */
export function parseChoicesResponse(response: string): DialogueChoice[] {
  try {
    const jsonStr = extractJSON(response);
    const parsed = JSON.parse(jsonStr);
    const result = ChoicesResponseSchema.parse(parsed);
    return result.choices.map(c => ({
      id: c.id,
      text: c.text,
      tone: c.tone as ChoiceTone,
      isPremium: c.isPremium,
      premiumCost: c.premiumCost,
      estimatedAffectionChange: c.estimatedAffectionChange,
      nextBeatHint: c.nextBeatHint,
    }));
  } catch (error) {
    console.warn('[Zod] ChoicesResponse parsing failed:', error);
    return [
      { id: 'default_1', text: '...', tone: 'neutral', isPremium: false, estimatedAffectionChange: 0 },
    ];
  }
}

/**
 * 안전한 이벤트 메시지 파싱
 */
export function parseEventMessageResponse(response: string): { content: string; emotion: PersonaMood; postType?: string } {
  try {
    const jsonStr = extractJSON(response);
    const parsed = JSON.parse(jsonStr);
    const validated = EventMessageResponseSchema.parse(parsed);
    return {
      content: validated.content,
      emotion: validated.emotion as PersonaMood,
      postType: validated.postType,
    };
  } catch (error) {
    console.warn('[Zod] EventMessageResponse parsing failed:', error);
    return {
      content: response,
      emotion: 'neutral',
    };
  }
}

/**
 * 안전한 스토리 분기 파싱
 */
export function parseStoryBranchResponse(
  response: string,
  defaultBranchId: string
): { selectedBranch: string; reasoning: string; flagsToSet: Record<string, boolean> } {
  try {
    const jsonStr = extractJSON(response);
    const parsed = JSON.parse(jsonStr);
    const validated = StoryBranchResponseSchema.parse(parsed);
    return {
      selectedBranch: validated.selectedBranch,
      reasoning: validated.reasoning,
      flagsToSet: validated.flagsToSet as Record<string, boolean>,
    };
  } catch (error) {
    console.warn('[Zod] StoryBranchResponse parsing failed:', error);
    return {
      selectedBranch: defaultBranchId,
      reasoning: 'Failed to parse response',
      flagsToSet: {},
    };
  }
}
