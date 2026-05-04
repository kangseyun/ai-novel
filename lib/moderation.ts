import { createClient, SupabaseClient } from '@supabase/supabase-js';

export type ModerationCategory = 'sexual' | 'real_idol' | 'drugs' | 'violence' | 'politics' | 'other';
export type ModerationSeverity = 'low' | 'medium' | 'high' | 'critical';
export type ModerationSource = 'user_message' | 'ai_response' | 'scenario' | 'other';

interface CategoryRule {
  category: ModerationCategory;
  severity: ModerationSeverity;
  // Words/phrases that, if present, flag the content. Matched case-insensitively
  // and as whole-word where the alphabet supports it.
  patterns: RegExp[];
}

const RULES: CategoryRule[] = [
  {
    category: 'sexual',
    severity: 'high',
    patterns: [
      /\bsex(?:ual|y|t)?\b/i,
      /\bnude\b/i,
      /\bnsfw\b/i,
      /\bporn\w*\b/i,
      /\bxxx\b/i,
      /\bhorny\b/i,
      /\bbreasts?\b/i,
      /\bdick\b/i,
      /(섹스|야동|성관계|성기|음란|딸딸이|음경|자위|에로)/,
    ],
  },
  {
    category: 'real_idol',
    severity: 'critical',
    patterns: [
      /\b(BTS|RM|Suga|J[- ]?Hope|Jimin|V|Jungkook|Jin)\b/i,
      /\b(BLACKPINK|Jisoo|Jennie|Rosé|Lisa)\b/i,
      /\b(NewJeans|aespa|IVE|LE SSERAFIM|TWICE|Red Velvet|ITZY|(G)I-DLE|NMIXX|Stray Kids|SEVENTEEN|TXT|ENHYPEN|NCT|EXO|Big Bang|Super Junior)\b/i,
      /(방탄소년단|블랙핑크|뉴진스|에스파|아이브|르세라핌|트와이스|레드벨벳|있지|아이들|엔믹스|스트레이키즈|세븐틴|투모로우바이투게더|엔하이픈|엔시티|엑소|빅뱅|슈퍼주니어|소녀시대)/,
      /\b(HYBE|SM Entertainment|YG Entertainment|JYP Entertainment)\b/i,
      /(하이브|SM엔터|YG엔터|JYP엔터)/,
    ],
  },
  {
    category: 'drugs',
    severity: 'medium',
    patterns: [
      /\b(cocaine|heroin|meth|weed|marijuana|drug|drugs)\b/i,
      /(마약|대마|필로폰|코카인|헤로인|히로뽕)/,
      /\b(drunk|wasted|hammered)\b/i,
      /(만취|폭음)/,
    ],
  },
  {
    category: 'violence',
    severity: 'high',
    patterns: [
      /\b(suicide|kill myself|kms)\b/i,
      /(자살|죽고\s*싶|목매|자해)/,
      /\b(murder|stab|shoot|slaughter)\b/i,
      /(살해|찔러|쏴|학살)/,
    ],
  },
  {
    category: 'politics',
    severity: 'low',
    patterns: [
      /\b(Trump|Biden|Putin|Xi Jinping|Yoon Suk[- ]?yeol)\b/i,
      /(윤석열|이재명|김정은|문재인)/,
      /\b(Christianity|Islam|Buddhism|Judaism)\b/i,
      /(기독교|이슬람|불교|유대교|천주교)/,
    ],
  },
];

export interface FlagMatch {
  category: ModerationCategory;
  severity: ModerationSeverity;
  matched: string[];
}

export function detectFlags(text: string): FlagMatch[] {
  if (!text) return [];
  const matches: FlagMatch[] = [];
  for (const rule of RULES) {
    const hits: string[] = [];
    for (const re of rule.patterns) {
      const m = text.match(re);
      if (m) hits.push(m[0]);
    }
    if (hits.length > 0) {
      matches.push({
        category: rule.category,
        severity: rule.severity,
        matched: Array.from(new Set(hits)),
      });
    }
  }
  return matches;
}

export interface FlagInput {
  source: ModerationSource;
  text: string;
  userId?: string | null;
  personaId?: string | null;
  sessionId?: string | null;
  metadata?: Record<string, unknown>;
}

let serviceClient: SupabaseClient | null = null;
function getServiceClient(): SupabaseClient | null {
  if (serviceClient) return serviceClient;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  serviceClient = createClient(url, key);
  return serviceClient;
}

export async function flagIfSuspicious(input: FlagInput): Promise<{ flagged: boolean; categories: ModerationCategory[] }> {
  const matches = detectFlags(input.text);
  if (matches.length === 0) return { flagged: false, categories: [] };

  const client = getServiceClient();
  if (!client) return { flagged: true, categories: matches.map((m) => m.category) };

  const excerpt = input.text.slice(0, 280);
  const rows = matches.map((m) => ({
    user_id: input.userId ?? null,
    persona_id: input.personaId ?? null,
    session_id: input.sessionId ?? null,
    source: input.source,
    category: m.category,
    severity: m.severity,
    matched_terms: m.matched,
    excerpt,
    metadata: input.metadata ?? {},
  }));

  await client.from('moderation_flags').insert(rows);
  return { flagged: true, categories: matches.map((m) => m.category) };
}
