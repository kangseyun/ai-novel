/**
 * Response Consistency Validator
 * LLM 응답의 감정 일관성을 검증하고 필요시 수정
 *
 * 목적: "싸운 직후 사랑해"라는 몰입 파괴 응답 방지
 */

import { PersonaMood, LLMDialogueResponse } from './types';
import { EmotionalContextForPrompt } from './prompt-builder';

// ============================================
// 타입 정의
// ============================================

export interface ValidationResult {
  isValid: boolean;
  issues: ValidationIssue[];
  correctedResponse?: LLMDialogueResponse;
  severity: 'none' | 'warning' | 'critical';
}

export interface ValidationIssue {
  type: 'forbidden_mood' | 'inappropriate_content' | 'emotional_inconsistency' | 'sudden_affection';
  description: string;
  originalValue: string;
  suggestedFix?: string;
}

// ============================================
// 금지된 표현 패턴
// ============================================

/**
 * 갈등 상황에서 금지된 표현 (한국어/영어)
 */
const FORBIDDEN_AFFECTION_PATTERNS = [
  // 한국어 애정 표현
  /사랑해/, /좋아해/, /보고\s*싶/, /너무\s*좋아/, /많이\s*좋아/,
  /최고야/, /사랑스러/, /귀여워/, /예뻐/, /보고\s*싶었어/,
  /행복해/, /같이\s*있어서/, /네가\s*있어서/,
  // 영어 애정 표현
  /i\s*love\s*you/i, /i\s*miss\s*you/i, /you('re| are)\s*(so\s*)?(cute|lovely|beautiful)/i,
  /i('m| am)\s*(so\s*)?happy/i, /you\s*make\s*me\s*happy/i,
  /i\s*adore\s*you/i, /you('re| are)\s*the\s*best/i,
];

/**
 * 갈등 상황에서 금지된 감정
 */
const FORBIDDEN_MOODS_DURING_CONFLICT: PersonaMood[] = [
  'happy', 'flirty', 'playful', 'excited',
];

/**
 * 갈등 후 허용되는 감정
 */
const ALLOWED_MOODS_DURING_CONFLICT: PersonaMood[] = [
  'neutral', 'sad', 'angry', 'worried', 'jealous',
];

/**
 * 화해 과정에서 허용되는 점진적 감정 전환
 */
const RECONCILIATION_TRANSITION_MOODS: PersonaMood[] = [
  'neutral', 'worried', 'vulnerable',
];

// ============================================
// ResponseValidator 클래스
// ============================================

export class ResponseValidator {
  /**
   * LLM 응답의 감정 일관성 검증
   */
  static validate(
    response: LLMDialogueResponse,
    emotionalContext: EmotionalContextForPrompt | undefined
  ): ValidationResult {
    const issues: ValidationIssue[] = [];

    // 감정 컨텍스트가 없으면 검증 스킵
    if (!emotionalContext) {
      return { isValid: true, issues: [], severity: 'none' };
    }

    // 1. 미해결 갈등 상황 검증
    if (emotionalContext.hasUnresolvedConflict) {
      // 금지된 감정 체크
      if (FORBIDDEN_MOODS_DURING_CONFLICT.includes(response.emotion)) {
        issues.push({
          type: 'forbidden_mood',
          description: `갈등 중 금지된 감정: ${response.emotion}`,
          originalValue: response.emotion,
          suggestedFix: 'neutral',
        });
      }

      // 금지된 표현 체크
      const forbiddenMatch = FORBIDDEN_AFFECTION_PATTERNS.find(pattern =>
        pattern.test(response.content)
      );
      if (forbiddenMatch) {
        issues.push({
          type: 'inappropriate_content',
          description: '갈등 중 부적절한 애정 표현 감지',
          originalValue: response.content.substring(0, 50),
          suggestedFix: '감정적으로 절제된 표현으로 대체 필요',
        });
      }

      // 급격한 호감도 증가 체크
      if (response.affectionModifier > 2) {
        issues.push({
          type: 'sudden_affection',
          description: `갈등 중 급격한 호감도 증가: +${response.affectionModifier}`,
          originalValue: String(response.affectionModifier),
          suggestedFix: '0 또는 최대 +1로 제한',
        });
      }
    }

    // 2. 연속 부정적 상호작용 후 검증
    if (emotionalContext.consecutiveNegativeCount >= 2) {
      // 갑자기 너무 긍정적인 감정
      if (response.emotion === 'happy' || response.emotion === 'excited') {
        issues.push({
          type: 'emotional_inconsistency',
          description: '연속 부정적 상호작용 후 갑작스러운 긍정적 감정',
          originalValue: response.emotion,
          suggestedFix: 'neutral',
        });
      }
    }

    // 검증 결과 반환
    if (issues.length === 0) {
      return { isValid: true, issues: [], severity: 'none' };
    }

    // 심각도 결정
    const hasCritical = issues.some(i =>
      i.type === 'forbidden_mood' || i.type === 'inappropriate_content'
    );
    const severity = hasCritical ? 'critical' : 'warning';

    // 수정된 응답 생성 (critical인 경우)
    const correctedResponse = hasCritical
      ? this.correctResponse(response, issues, emotionalContext)
      : undefined;

    return {
      isValid: false,
      issues,
      severity,
      correctedResponse,
    };
  }

  /**
   * 문제가 있는 응답 수정
   */
  private static correctResponse(
    original: LLMDialogueResponse,
    issues: ValidationIssue[],
    context: EmotionalContextForPrompt
  ): LLMDialogueResponse {
    const corrected = { ...original };

    // 감정 수정
    const moodIssue = issues.find(i => i.type === 'forbidden_mood');
    if (moodIssue) {
      corrected.emotion = (moodIssue.suggestedFix as PersonaMood) || 'neutral';
    }

    // 호감도 수정
    const affectionIssue = issues.find(i => i.type === 'sudden_affection');
    if (affectionIssue) {
      corrected.affectionModifier = Math.min(corrected.affectionModifier, 1);
    }

    // 내용 수정 (간단한 패턴 대체)
    const contentIssue = issues.find(i => i.type === 'inappropriate_content');
    if (contentIssue && context.hasUnresolvedConflict) {
      // 애정 표현을 중립적 표현으로 대체
      corrected.content = this.neutralizeAffectionExpressions(corrected.content);
    }

    // 이너 생각 추가 (갈등 상황 반영)
    if (context.hasUnresolvedConflict && !corrected.innerThought) {
      corrected.innerThought = '아직 완전히 풀린 건 아니야...';
    }

    return corrected;
  }

  /**
   * 애정 표현을 중립적 표현으로 대체
   */
  private static neutralizeAffectionExpressions(content: string): string {
    let modified = content;

    // 한국어 대체
    const koreanReplacements: [RegExp, string][] = [
      [/사랑해/, '...'],
      [/좋아해/, '음...'],
      [/보고\s*싶었어/, '...'],
      [/행복해/, '글쎄...'],
      [/최고야/, '...그래'],
    ];

    for (const [pattern, replacement] of koreanReplacements) {
      modified = modified.replace(pattern, replacement);
    }

    // 영어 대체
    const englishReplacements: [RegExp, string][] = [
      [/i\s*love\s*you/gi, '...'],
      [/i\s*miss\s*you/gi, 'well...'],
      [/i('m| am)\s*(so\s*)?happy/gi, 'I guess...'],
    ];

    for (const [pattern, replacement] of englishReplacements) {
      modified = modified.replace(pattern, replacement);
    }

    return modified;
  }

  /**
   * 갈등 해결 진행도에 따른 허용 감정 범위 반환
   */
  static getAllowedMoodsForReconciliation(
    cooldownRemaining: number, // 시간 단위
    positiveInteractionCount: number
  ): PersonaMood[] {
    // 쿨다운이 많이 남았으면 제한적 감정만 허용
    if (cooldownRemaining > 6) {
      return ['angry', 'sad', 'neutral'];
    }

    // 중간 단계
    if (cooldownRemaining > 2) {
      return ['sad', 'neutral', 'worried'];
    }

    // 거의 풀려가는 단계
    if (cooldownRemaining > 0 || positiveInteractionCount < 3) {
      return RECONCILIATION_TRANSITION_MOODS;
    }

    // 완전히 풀린 후
    return [...RECONCILIATION_TRANSITION_MOODS, 'happy', 'playful'];
  }

  /**
   * 감정 전환이 자연스러운지 검증
   */
  static isNaturalEmotionTransition(
    previousMood: PersonaMood,
    proposedMood: PersonaMood,
    hasConflict: boolean
  ): boolean {
    // 갈등 상황에서는 긍정적 감정으로의 직접 전환 금지
    if (hasConflict) {
      const negativeToPositive =
        ['angry', 'sad'].includes(previousMood) &&
        ['happy', 'flirty', 'playful', 'excited'].includes(proposedMood);

      if (negativeToPositive) {
        return false;
      }
    }

    // 극단적 전환 체크 (angry → flirty, sad → excited 등)
    const extremeTransitions: Record<PersonaMood, PersonaMood[]> = {
      angry: ['flirty', 'playful', 'excited'],
      sad: ['flirty', 'excited'],
      jealous: ['happy', 'playful'],
      worried: [],
      neutral: [],
      happy: [],
      flirty: [],
      playful: [],
      excited: [],
      vulnerable: [],
    };

    if (extremeTransitions[previousMood]?.includes(proposedMood)) {
      return false;
    }

    return true;
  }
}

// ============================================
// 헬퍼 함수
// ============================================

/**
 * 응답 검증 및 자동 수정
 */
export function validateAndCorrectResponse(
  response: LLMDialogueResponse,
  emotionalContext?: EmotionalContextForPrompt
): { response: LLMDialogueResponse; wasModified: boolean; issues: ValidationIssue[] } {
  const validation = ResponseValidator.validate(response, emotionalContext);

  if (validation.isValid) {
    return { response, wasModified: false, issues: [] };
  }

  // Critical 이슈가 있으면 수정된 응답 사용
  if (validation.correctedResponse) {
    console.warn('[ResponseValidator] Response corrected:', validation.issues);
    return {
      response: validation.correctedResponse,
      wasModified: true,
      issues: validation.issues,
    };
  }

  // Warning만 있으면 원본 반환 (로그만)
  console.warn('[ResponseValidator] Validation warnings:', validation.issues);
  return { response, wasModified: false, issues: validation.issues };
}
