/**
 * LUMIN Canon Loader
 *
 * docs/LUMIN.md 를 파싱해 멤버별 ### 섹션과 그룹 글로벌 섹션을 메모리에 캐시.
 * LLM lint 시 시나리오의 persona_id 에 맞는 캐논 섹션만 시스템 프롬프트에 주입한다.
 *
 * 변경 감지는 하지 않음 — Next.js 빌드 / 재배포 시 새 인스턴스가 다시 읽는다.
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const CANON_PATH = join(process.cwd(), 'docs', 'LUMIN.md');

// CLAUDE.md 와 일치 — 7명 멤버 ID
export const LUMIN_MEMBER_IDS = [
  'haeon',
  'kael',
  'ren',
  'jun',
  'adrian',
  'sol',
  'noa',
] as const;

export type LuminMemberId = (typeof LUMIN_MEMBER_IDS)[number];

interface CanonCache {
  members: Map<LuminMemberId, string>;
  globalOverview: string; // ## 1. Group Overview ~ ## 2. 직전
  toneGuide: string;      // ## 4. 콘텐츠 톤 가이드 섹션
}

let cache: CanonCache | null = null;

/**
 * `### 1. HAEON (해온) — 리더 / 메인보컬` 같은 헤더에서 멤버 ID 추출.
 * 대문자 영문 토큰을 ID 후보로 보고 LUMIN_MEMBER_IDS 와 매칭.
 */
function extractMemberIdFromHeader(line: string): LuminMemberId | null {
  const upperToken = line.match(/###\s*\d+\.\s*([A-Z]+)/)?.[1];
  if (!upperToken) return null;
  const lower = upperToken.toLowerCase() as LuminMemberId;
  return LUMIN_MEMBER_IDS.includes(lower) ? lower : null;
}

function parseCanon(markdown: string): CanonCache {
  const lines = markdown.split('\n');
  const members = new Map<LuminMemberId, string>();

  let currentMemberId: LuminMemberId | null = null;
  let currentBuffer: string[] = [];
  const globalOverviewBuffer: string[] = [];
  const toneGuideBuffer: string[] = [];
  let mode: 'idle' | 'global_overview' | 'tone_guide' | 'member' = 'idle';

  const flushMember = () => {
    if (currentMemberId && currentBuffer.length > 0) {
      members.set(currentMemberId, currentBuffer.join('\n').trim());
    }
    currentMemberId = null;
    currentBuffer = [];
  };

  for (const line of lines) {
    // ## level header — 모드 결정
    if (line.startsWith('## ') && !line.startsWith('### ')) {
      flushMember();
      if (line.includes('Group Overview')) {
        mode = 'global_overview';
        globalOverviewBuffer.push(line);
      } else if (line.includes('콘텐츠 톤 가이드')) {
        mode = 'tone_guide';
        toneGuideBuffer.push(line);
      } else {
        mode = 'idle';
      }
      continue;
    }

    // ### level header — 멤버 섹션 시작
    if (line.startsWith('### ')) {
      flushMember();
      const memberId = extractMemberIdFromHeader(line);
      if (memberId) {
        mode = 'member';
        currentMemberId = memberId;
        currentBuffer.push(line);
      } else {
        // global_overview / tone_guide 안의 ### 서브섹션은 그대로 누적
        if (mode === 'global_overview') globalOverviewBuffer.push(line);
        else if (mode === 'tone_guide') toneGuideBuffer.push(line);
      }
      continue;
    }

    // 일반 라인
    if (mode === 'member' && currentMemberId) {
      currentBuffer.push(line);
    } else if (mode === 'global_overview') {
      globalOverviewBuffer.push(line);
    } else if (mode === 'tone_guide') {
      toneGuideBuffer.push(line);
    }
  }

  flushMember();

  return {
    members,
    globalOverview: globalOverviewBuffer.join('\n').trim(),
    toneGuide: toneGuideBuffer.join('\n').trim(),
  };
}

function ensureCache(): CanonCache {
  if (!cache) {
    const markdown = readFileSync(CANON_PATH, 'utf-8');
    cache = parseCanon(markdown);
    if (cache.members.size !== LUMIN_MEMBER_IDS.length) {
      const missing = LUMIN_MEMBER_IDS.filter((id) => !cache!.members.has(id));
      throw new Error(
        `LUMIN canon parse incomplete: missing members ${missing.join(', ')}. ` +
          `Check docs/LUMIN.md ### N. NAME headers.`
      );
    }
  }
  return cache;
}

/**
 * 멤버 ID 에 해당하는 ### 섹션 전문을 반환. 알 수 없는 ID는 null.
 * 글로벌 시나리오(persona_id null)는 별도로 globalCanonSection() 사용.
 */
export function getMemberCanonSection(personaId: string | null | undefined): string | null {
  if (!personaId) return null;
  const id = personaId.toLowerCase() as LuminMemberId;
  if (!LUMIN_MEMBER_IDS.includes(id)) return null;
  return ensureCache().members.get(id) ?? null;
}

/**
 * 그룹 전체 캐논 (Overview + 톤 가이드). persona_id null 시나리오의 검수에 사용.
 */
export function getGlobalCanonSection(): string {
  const c = ensureCache();
  return [c.globalOverview, c.toneGuide].filter(Boolean).join('\n\n');
}

/**
 * 테스트/스크립트용 — 캐시 강제 무효화.
 */
export function resetCanonCache(): void {
  cache = null;
}
