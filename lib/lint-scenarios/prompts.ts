/**
 * LLM Lint Prompts (v1.0)
 *
 * OOC + CANON_CONSISTENCY 두 차원만 평가하도록 프롬프트를 좁힌다.
 * 시스템 프롬프트는 멤버 캐논을 진실원으로 박고, 사용자 프롬프트는
 * 시나리오 텍스트를 path-라벨링해 LLM 이 위치를 짚을 수 있게 한다.
 */

import { getGlobalCanonSection, getMemberCanonSection } from './canon-loader';

export const LLM_LINT_VERSION = 'v1.0';

export interface LLMLintInput {
  scenarioId: string;
  personaId: string | null;
  title: string;
  description: string | null;
  content: unknown;
  scenarioType: string;
  generationMode: 'static' | 'guided' | 'dynamic';
}

export function buildSystemPrompt(personaId: string | null): string {
  const personaSection = getMemberCanonSection(personaId);
  const globalSection = getGlobalCanonSection();

  const canonBlock = personaSection
    ? `[멤버 캐논 — ${personaId}]\n${personaSection}\n\n[그룹 글로벌 캐논]\n${globalSection}`
    : `[그룹 글로벌 캐논 — 멤버 미지정 시나리오]\n${globalSection}`;

  const oocRule = personaSection
    ? '- ooc: 위 멤버의 톤·말투·이모지·자주 쓰는 말과 명백히 충돌하는 대사/지문'
    : '- ooc: (멤버 미지정이라 OOC 검사는 생략. canon_consistency 만 검사)';

  return `당신은 LUMIN K-pop 가상 아이돌 시뮬레이터의 시나리오 캐논 검수자입니다.
다음 두 가지 차원만 평가하세요:

${oocRule}
- canon_consistency: MBTI/나이/포지션/컬러/케미/이모지/시그니처 대사·이벤트 같은 캐논 사실 위반

${canonBlock}

【출력 형식 — 반드시 단일 JSON 객체】
{
  "findings": [
    {
      "category": "ooc" | "canon_consistency",
      "severity": "low" | "medium" | "high",
      "path": "content.scenes[2].dialogue[0]",
      "evidence": "문제가 된 원문 발췌 (≤120자)",
      "reason": "캐논의 어떤 사실과 충돌하는지 (≤200자)",
      "suggestion": "수정안 한 줄 (≤200자, 선택)",
      "confidence": 0.0
    }
  ],
  "summary": "한 줄 요약 (위반 없으면 '캐논 충돌 없음')"
}

【엄격 규칙】
1. 추측·취향 기반 지적 금지. 위 캐논 블록의 명문화된 사실과 충돌할 때만.
2. confidence < 0.6 인 항목은 출력하지 말 것.
3. 최대 5건. 가장 명백한 것부터.
4. severity 기준:
   - high: 명백히 다른 멤버 톤이거나, 캐논 사실(MBTI/나이/포지션/컬러)과 정면 충돌
   - medium: 톤이 흐릿하지만 해당 멤버답지 않음 / 캐논 부속 정보 충돌
   - low: 거의 OK 지만 더 멤버답게 다듬을 여지
5. 위반이 없으면 findings 는 빈 배열.
6. JSON 외 텍스트(설명, 코드펜스 등) 일체 금지.`;
}

export function buildUserPrompt(input: LLMLintInput): string {
  const flattened = flattenContentForReview(input.content);
  const desc = input.description ? input.description.trim() : '(없음)';

  return `시나리오 ID: ${input.scenarioId}
타입: ${input.scenarioType} / 생성모드: ${input.generationMode}
타겟 멤버 ID: ${input.personaId ?? 'global'}

[title]
${input.title}

[description]
${desc}

[content]
${flattened}`;
}

/**
 * 시나리오 content JSONB 를 path-라벨링된 평문으로 펼친다.
 * LLM 이 finding.path 를 정확히 지목할 수 있도록 같은 path 표기를
 * 정규식 lint 의 extractText 와 일치시킨다 (e.g. content.scenes[2].dialogue[0]).
 *
 * 노이즈를 줄이기 위해 4자 미만 문자열은 건너뛴다 (정규식 lint 와 동일 규칙).
 */
export function flattenContentForReview(value: unknown): string {
  const lines: string[] = [];
  const walk = (v: unknown, path: string) => {
    if (v == null) return;
    if (typeof v === 'string') {
      if (v.length >= 4) lines.push(`${path}: ${v}`);
      return;
    }
    if (typeof v === 'number' || typeof v === 'boolean') return;
    if (Array.isArray(v)) {
      v.forEach((item, idx) => walk(item, `${path}[${idx}]`));
      return;
    }
    if (typeof v === 'object') {
      for (const [key, child] of Object.entries(v as Record<string, unknown>)) {
        walk(child, path ? `${path}.${key}` : key);
      }
    }
  };
  walk(value, 'content');
  return lines.length > 0 ? lines.join('\n') : '(content empty)';
}
