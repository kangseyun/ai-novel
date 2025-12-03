/**
 * Zod Schemas for LLM Response Validation
 * LLM 응답 검증용 스키마 정의
 */

import { z } from 'zod';
import type { PersonaMood, ChoiceTone, LLMDialogueResponse, DialogueChoice, RelationshipStage } from './types';

// ============================================
// 검증 에러 타입
// ============================================

export interface ValidationError {
  type: 'JSON_PARSE_ERROR' | 'VALIDATION_ERROR' | 'UNKNOWN_ERROR';
  message: string;
  field?: string;
  rawResponse?: string;
  timestamp: Date;
}

export interface ParseResult<T> {
  success: boolean;
  data: T | null;
  errors: ValidationError[];
  rawResponse: string;
}

// ============================================
// 사용자 입력 검증 스키마
// ============================================

/** 세션 ID 스키마 */
export const SessionIdSchema = z.string().uuid('Invalid session ID format');

/** 사용자 메시지 스키마 */
export const UserMessageSchema = z.string()
  .min(1, 'Message cannot be empty')
  .max(2000, 'Message exceeds maximum length of 2000 characters')
  .transform(s => s.trim());

/** 선택지 데이터 스키마 */
export const ChoiceDataSchema = z.object({
  choiceId: z.string().min(1, 'Choice ID is required'),
  wasPremium: z.boolean(),
}).optional();

/** 메시지 처리 요청 스키마 */
export const ProcessMessageRequestSchema = z.object({
  sessionId: SessionIdSchema,
  userMessage: UserMessageSchema,
  choiceData: ChoiceDataSchema,
});

/** 관계 단계 스키마 */
export const RelationshipStageSchema = z.enum([
  'stranger',
  'acquaintance',
  'friend',
  'close',
  'intimate',
  'lover',
]);

/** 시간 범위 스키마 */
export const TimeRangeSchema = z.object({
  start: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/, 'Invalid time format (HH:mm)'),
  end: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/, 'Invalid time format (HH:mm)'),
});

/** 배달 조건 스키마 */
export const DeliveryConditionsSchema = z.object({
  minAffection: z.number().min(0).max(100).optional(),
  maxAffection: z.number().min(0).max(100).optional(),
  relationshipStage: z.array(RelationshipStageSchema).optional(),
  timeRange: TimeRangeSchema.optional(),
  requiredFlags: z.array(z.string()).optional(),
  excludeFlags: z.array(z.string()).optional(),
  hoursSinceLastActivity: z.object({
    min: z.number().min(0).optional(),
    max: z.number().min(0).optional(),
  }).optional(),
});

/** 배달 조건 타입 */
export type DeliveryConditions = z.infer<typeof DeliveryConditionsSchema>;

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
 * 에러 로깅 헬퍼
 */
function logParseError(
  context: string,
  error: unknown,
  rawResponse: string
): ValidationError {
  const errorMessage = error instanceof Error ? error.message : String(error);
  const isJsonError = error instanceof SyntaxError;
  const isZodError = error instanceof z.ZodError;

  // ZodError의 첫 번째 필드 경로 추출
  let fieldPath: string | undefined;
  if (isZodError) {
    const zodError = error as z.ZodError;
    fieldPath = zodError.issues[0]?.path.join('.');
  }

  const validationError: ValidationError = {
    type: isJsonError ? 'JSON_PARSE_ERROR' : isZodError ? 'VALIDATION_ERROR' : 'UNKNOWN_ERROR',
    message: errorMessage,
    field: fieldPath,
    rawResponse: rawResponse.substring(0, 500), // 로그 크기 제한
    timestamp: new Date(),
  };

  console.error(`[Schema] ${context} parsing failed:`, {
    errorType: validationError.type,
    message: validationError.message,
    field: validationError.field,
    responsePreview: rawResponse.substring(0, 200),
  });

  return validationError;
}

/**
 * 부분 복구 시도 - content 필드만이라도 추출
 */
function attemptPartialRecovery(response: string): Partial<LLMDialogueResponse> | null {
  try {
    // JSON에서 content 필드만 추출 시도
    const contentMatch = response.match(/"content"\s*:\s*"([^"]+)"/);
    if (contentMatch) {
      return {
        content: contentMatch[1],
        emotion: 'neutral',
        affectionModifier: 0,
      };
    }

    // JSON이 아닌 경우 전체를 content로 사용
    const cleanResponse = response.replace(/```json|```/g, '').trim();
    if (cleanResponse.length > 0 && !cleanResponse.startsWith('{')) {
      return {
        content: cleanResponse,
        emotion: 'neutral',
        affectionModifier: 0,
      };
    }
  } catch {
    // 복구 실패
  }
  return null;
}

/**
 * 안전한 대화 응답 파싱 (개선된 에러 로깅)
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
    logParseError('DialogueResponse', error, response);

    // 부분 복구 시도
    const recovered = attemptPartialRecovery(response);
    if (recovered && recovered.content) {
      console.warn('[Schema] Partial recovery successful for DialogueResponse');
      return {
        content: recovered.content,
        emotion: recovered.emotion || 'neutral',
        affectionModifier: recovered.affectionModifier || 0,
      };
    }

    // 최후의 폴백
    return {
      content: response.substring(0, 500) || '응답을 처리할 수 없습니다.',
      emotion: 'neutral',
      affectionModifier: 0,
    };
  }
}

/**
 * 안전한 대화 응답 파싱 (상세 결과 반환)
 */
export function parseDialogueResponseWithDetails(response: string): ParseResult<LLMDialogueResponse> {
  try {
    const jsonStr = extractJSON(response);
    const parsed = JSON.parse(jsonStr);
    const validated = DialogueResponseSchema.parse(parsed);

    return {
      success: true,
      data: {
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
      },
      errors: [],
      rawResponse: response,
    };
  } catch (error) {
    const validationError = logParseError('DialogueResponse', error, response);

    return {
      success: false,
      data: null,
      errors: [validationError],
      rawResponse: response,
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
    logParseError('ChoicesResponse', error, response);
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
    logParseError('EventMessageResponse', error, response);

    // 부분 복구 시도
    const recovered = attemptPartialRecovery(response);
    if (recovered && recovered.content) {
      return {
        content: recovered.content,
        emotion: 'neutral',
      };
    }

    return {
      content: response.substring(0, 500) || '메시지를 생성할 수 없습니다.',
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
    logParseError('StoryBranchResponse', error, response);
    return {
      selectedBranch: defaultBranchId,
      reasoning: 'Failed to parse response - using default branch',
      flagsToSet: {},
    };
  }
}

// ============================================
// 입력 검증 헬퍼 함수
// ============================================

/**
 * 사용자 메시지 처리 요청 검증
 */
export function validateProcessMessageRequest(data: unknown): {
  valid: boolean;
  data?: z.infer<typeof ProcessMessageRequestSchema>;
  error?: string;
} {
  const result = ProcessMessageRequestSchema.safeParse(data);
  if (result.success) {
    return { valid: true, data: result.data };
  }
  return {
    valid: false,
    error: result.error.issues.map((e: z.ZodIssue) => `${e.path.join('.')}: ${e.message}`).join(', '),
  };
}

/**
 * 배달 조건 검증
 */
export function validateDeliveryConditions(data: unknown): {
  valid: boolean;
  data?: DeliveryConditions;
  error?: string;
} {
  const result = DeliveryConditionsSchema.safeParse(data);
  if (result.success) {
    return { valid: true, data: result.data };
  }
  return {
    valid: false,
    error: result.error.issues.map((e: z.ZodIssue) => `${e.path.join('.')}: ${e.message}`).join(', '),
  };
}
