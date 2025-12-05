/**
 * Prompt Builder A/B/C Test v1.0
 *
 * 세 가지 버전의 prompt-builder를 비교 테스트합니다:
 * - v1: 원본 (baseline)
 * - v2: 개선된 버전
 * - v3: 실험적 버전
 *
 * Usage:
 *   npx tsx scripts/prompt-ab-test.ts
 *   npx tsx scripts/prompt-ab-test.ts --turns 8 --rounds 3
 */

import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';

// ai-agent 시스템에서 import
import {
  LLMContext,
  RelationshipState,
  UserPersonaContext,
  PersonaMood,
  ConversationMessage,
} from '../lib/ai-agent';
import { getPersonaLoader, PersonaCoreData } from '../lib/ai-agent/persona-loader';

// 프롬프트 빌더 버전별 import
import * as promptV1 from '../lib/ai-agent/prompt-builder-v1';
import * as promptV2 from '../lib/ai-agent/prompt-builder-v2';
import * as promptV3 from '../lib/ai-agent/prompt-builder-v3';
import * as promptV4 from '../lib/ai-agent/prompt-builder-v4';
import * as promptV5 from '../lib/ai-agent/prompt-builder-v5';
import * as promptV6 from '../lib/ai-agent/prompt-builder-v6';
import * as promptV7 from '../lib/ai-agent/prompt-builder-v7';
import * as promptV8 from '../lib/ai-agent/prompt-builder-v8';
import * as promptV9 from '../lib/ai-agent/prompt-builder-v9';
import * as promptV10 from '../lib/ai-agent/prompt-builder-v10';
import * as promptV11 from '../lib/ai-agent/prompt-builder-v11';
import * as promptV12 from '../lib/ai-agent/prompt-builder-v12';

// ============================================
// 환경 변수 검증
// ============================================

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY || !OPENROUTER_API_KEY) {
  console.error('❌ 필수 환경변수가 없습니다');
  process.exit(1);
}

// ============================================
// 명령줄 인자 파싱
// ============================================

const args = process.argv.slice(2);
const getArg = (name: string, defaultValue: string): string => {
  const idx = args.indexOf(`--${name}`);
  return idx !== -1 && args[idx + 1] ? args[idx + 1] : defaultValue;
};

const PERSONA_ID = getArg('persona', 'jun');
const TURNS = parseInt(getArg('turns', '8'), 10);
const ROUNDS = parseInt(getArg('rounds', '3'), 10);
const LLM_MODEL = getArg('model', 'deepseek/deepseek-v3.2');
const EVALUATOR_MODEL = getArg('eval-model', 'google/gemini-3-pro-preview');
const USER_PROFILE = getArg('profile', 'curious');

// ============================================
// 타입 정의
// ============================================

type PromptVersion = 'v1' | 'v2' | 'v3' | 'v4' | 'v5' | 'v6' | 'v7' | 'v8' | 'v9' | 'v10' | 'v11' | 'v12';

interface PromptBuilder {
  buildSystemPrompt: typeof promptV1.buildSystemPrompt;
  buildResponsePrompt: typeof promptV1.buildResponsePrompt;
}

interface TestResult {
  version: PromptVersion;
  round: number;
  conversation: Array<{ role: string; content: string }>;
  responseTimes: number[];
  evaluation: EvaluationResult;
  affectionTotal: number;
}

interface EvaluationResult {
  immersionScore: number;        // 몰입감 (1-10)
  responseQuality: number;       // 응답 품질 (1-10)
  characterConsistency: number;  // 캐릭터 일관성 (1-10)
  engagementLevel: number;       // 참여도/흥미 (1-10)
  naturalness: number;           // 자연스러움 (1-10)
  overallScore: number;          // 종합 점수
  strengths: string[];           // 강점
  weaknesses: string[];          // 약점
  feedback: string;              // 상세 피드백
}

interface AggregatedResult {
  version: PromptVersion;
  avgImmersion: number;
  avgQuality: number;
  avgConsistency: number;
  avgEngagement: number;
  avgNaturalness: number;
  avgOverall: number;
  avgResponseTime: number;
  avgAffection: number;
  totalRounds: number;
}

// ============================================
// Supabase 클라이언트
// ============================================

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
const personaLoader = getPersonaLoader(supabase);

// ============================================
// 프롬프트 빌더 매핑
// ============================================

const PROMPT_BUILDERS: Record<PromptVersion, PromptBuilder> = {
  v1: promptV1,
  v2: promptV2,
  v3: promptV3,
  v4: promptV4,
  v5: promptV5,
  v6: promptV6,
  v7: promptV7,
  v8: promptV8,
  v9: promptV9,
  v10: promptV10,
  v11: promptV11,
  v12: promptV12,
};

// ============================================
// 유저 프로필
// ============================================

interface UserProfile {
  type: string;
  description: string;
  messages: string[];
}

const USER_PROFILES: Record<string, UserProfile> = {
  curious: {
    type: 'curious',
    description: '호기심 많은 신규 유저',
    messages: [
      '안녕?',
      '뭐해?',
      '너 누구야?',
      '이거 뭐하는 앱이야?',
      '심심한데 뭐해?',
      '오늘 뭐했어?',
      '취미가 뭐야?',
      '재밌는 얘기 해줘',
    ],
  },
  skeptical: {
    type: 'skeptical',
    description: 'AI 의심하는 유저',
    messages: [
      '야',
      '너 AI지?',
      '봇이잖아',
      '진짜 사람이야?',
      '왜 말투가 이상해',
      '솔직히 말해봐',
      '증명해봐',
      '그래서 뭔데',
    ],
  },
  playful: {
    type: 'playful',
    description: '장난치는 유저',
    messages: [
      'ㅋㅋㅋ',
      '뭐야 ㅋㅋ',
      '귀엽네',
      '화내지마~',
      '장난이야',
      '나랑 놀아줘',
      '심심해',
      '뭐하고 놀까?',
    ],
  },
  emotional: {
    type: 'emotional',
    description: '감정적인 대화를 원하는 유저',
    messages: [
      '안녕...',
      '오늘 힘들었어',
      '나 얘기 좀 들어줄래?',
      '너라도 있어서 다행이야',
      '고마워 들어줘서',
      '보고싶었어',
      '오늘 기분 어때?',
      '나 위로해줘',
    ],
  },
};

// ============================================
// OpenRouter API 호출
// ============================================

async function callOpenRouter(
  model: string,
  messages: Array<{ role: string; content: string }>,
  options?: { temperature?: number; maxTokens?: number; jsonMode?: boolean }
): Promise<string> {
  const requestBody: Record<string, unknown> = {
    model,
    messages,
    temperature: options?.temperature ?? 0.8,
    max_tokens: options?.maxTokens ?? 500,
  };

  if (options?.jsonMode) {
    requestBody.response_format = { type: 'json_object' };
  }

  const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
      'HTTP-Referer': 'http://localhost:3000',
      'X-Title': 'Prompt A/B Test',
    },
    body: JSON.stringify(requestBody),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`OpenRouter API error: ${response.status} - ${errorText}`);
  }

  const data = await response.json();
  let content = data.choices?.[0]?.message?.content || '';

  // Gemini 3 Pro Preview가 thinking model이라 content가 비어있을 수 있음
  // reasoning 필드에서 추출 시도
  if (!content && data.choices?.[0]?.message?.reasoning) {
    console.log(`   ⚠️ Using reasoning field (thinking model)`);
    content = data.choices[0].message.reasoning;
  }

  // Debug: log API response structure if still empty
  if (!content) {
    console.log(`   ⚠️ API response structure:`, JSON.stringify(data, null, 2).substring(0, 500));
  }
  return content;
}

// ============================================
// LLM Context 생성
// ============================================

function buildLLMContext(
  personaCoreData: PersonaCoreData,
  conversationHistory: ConversationMessage[]
): LLMContext {
  const relationship: RelationshipState = {
    oduserId: 'test-user',
    personaId: personaCoreData.persona.id,
    affection: 25,
    relationshipStage: 'stranger',
    trustLevel: 0,
    intimacyLevel: 0,
    tensionLevel: 0,
    completedEpisodes: [],
    unlockedEpisodes: [],
    storyFlags: {},
    memorableMoments: [],
    lastInteractionAt: new Date(),
    totalMessages: conversationHistory.length,
  };

  const userPersona: UserPersonaContext = {
    nickname: '유저',
    personalityType: 'ambivert',
    communicationStyle: 'direct',
    emotionalTendency: 'empathetic',
    interests: [],
    loveLanguage: 'words',
    attachmentStyle: 'secure',
    language: 'ko',
  };

  return {
    persona: personaCoreData.persona,
    traits: personaCoreData.traits,
    worldview: personaCoreData.worldview,
    relationship,
    userPersona,
    conversationHistory,
    currentSituation: personaCoreData.worldview.mainConflict || '',
    emotionalState: {
      personaMood: 'neutral' as PersonaMood,
      tensionLevel: 0,
      vulnerabilityShown: false,
    },
  };
}

// ============================================
// 대화 시뮬레이션
// ============================================

async function runConversation(
  version: PromptVersion,
  personaCoreData: PersonaCoreData,
  userProfile: UserProfile
): Promise<{
  conversation: Array<{ role: string; content: string }>;
  responseTimes: number[];
  affectionTotal: number;
}> {
  const builder = PROMPT_BUILDERS[version];
  const conversation: Array<{ role: string; content: string }> = [];
  const conversationHistory: ConversationMessage[] = [];
  const responseTimes: number[] = [];
  let affectionTotal = 0;

  for (let i = 0; i < TURNS; i++) {
    // 유저 메시지
    const userMessage = userProfile.messages[i % userProfile.messages.length];
    conversation.push({ role: 'user', content: userMessage });
    conversationHistory.push({
      role: 'user',
      content: userMessage,
      timestamp: new Date(),
    });

    // LLM Context 생성
    const context = buildLLMContext(personaCoreData, conversationHistory);

    // 프롬프트 생성
    const systemPrompt = builder.buildSystemPrompt(context);
    const responsePrompt = builder.buildResponsePrompt(context, userMessage);

    // LLM 호출
    const startTime = Date.now();
    try {
      const response = await callOpenRouter(LLM_MODEL, [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: responsePrompt },
      ], { jsonMode: true });

      const responseTime = Date.now() - startTime;
      responseTimes.push(responseTime);

      // JSON 파싱 (마크다운 코드블록 제거 포함)
      let parsed: { content: string; emotion?: string; affectionModifier?: number };
      try {
        let jsonStr = response.trim();
        // 마크다운 코드 블록 제거
        if (jsonStr.startsWith('```')) {
          jsonStr = jsonStr.replace(/```json?\n?/g, '').replace(/```/g, '').trim();
        }
        // JSON 객체 추출
        const jsonMatch = jsonStr.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          jsonStr = jsonMatch[0];
        }
        parsed = JSON.parse(jsonStr);
      } catch {
        // JSON 파싱 실패시 raw content에서 대사만 추출 시도
        const contentMatch = response.match(/"content"\s*:\s*"([^"]+)"/);
        if (contentMatch) {
          parsed = { content: contentMatch[1] };
        } else {
          // 완전히 실패하면 raw content 사용 (JSON 구조 제거)
          let cleaned = response.replace(/```json?\n?/g, '').replace(/```/g, '');
          cleaned = cleaned.replace(/\{[\s\S]*\}/g, '').trim();
          parsed = { content: cleaned || response };
        }
      }

      const assistantContent = parsed.content || response.substring(0, 100);
      affectionTotal += parsed.affectionModifier || 0;

      conversation.push({ role: 'assistant', content: assistantContent });
      conversationHistory.push({
        role: 'assistant',
        content: assistantContent,
        timestamp: new Date(),
        emotion: parsed.emotion,
      });

      // 짧은 딜레이
      await new Promise(r => setTimeout(r, 100));

    } catch (error) {
      console.error(`Turn ${i + 1} error:`, error);
      responseTimes.push(0);
    }
  }

  return { conversation, responseTimes, affectionTotal };
}

// ============================================
// 대화 평가
// ============================================

async function evaluateConversation(
  conversation: Array<{ role: string; content: string }>,
  personaName: string
): Promise<EvaluationResult> {
  const conversationText = conversation
    .map(m => `${m.role === 'user' ? '유저' : personaName}: ${m.content}`)
    .join('\n');

  const evalPrompt = `Rate this AI conversation (1-10 scale). Output ONLY JSON.

${conversationText}

Output format (copy this structure exactly, replace values):
{"immersionScore":7,"responseQuality":7,"characterConsistency":8,"engagementLevel":6,"naturalness":7,"overallScore":7,"strengths":["str1"],"weaknesses":["weak1"],"feedback":"short"}`;

  try {
    // Gemini 3 Pro Preview는 thinking model이라 maxTokens를 크게 잡아야 함
    const response = await callOpenRouter(EVALUATOR_MODEL, [
      { role: 'user', content: evalPrompt },
    ], { temperature: 0.2, maxTokens: 4000 });

    // DEBUG: 응답 로깅
    console.log(`\n   🔍 Raw evaluator response (length: ${response.length}):`);
    console.log(`   "${response.substring(0, 500)}${response.length > 500 ? '...' : ''}"`);

    // 빈 응답 체크
    if (!response || response.trim().length === 0) {
      throw new Error('Empty response from evaluator');
    }

    // JSON 추출 시도
    let jsonStr = response.trim();
    // 마크다운 코드 블록 제거
    if (jsonStr.startsWith('```')) {
      jsonStr = jsonStr.replace(/```json?\n?/g, '').replace(/```/g, '').trim();
    }
    // JSON 객체 추출
    const jsonMatch = jsonStr.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      jsonStr = jsonMatch[0];
    }

    // 잘린 JSON 복구 시도
    let parsed: Record<string, unknown>;
    try {
      parsed = JSON.parse(jsonStr);
    } catch {
      // 잘린 문자열 복구 시도
      // 1. 마지막 불완전한 문자열 제거
      jsonStr = jsonStr.replace(/,"[^"]*$/, '');
      // 2. 닫히지 않은 배열/객체 닫기
      const openBrackets = (jsonStr.match(/\[/g) || []).length;
      const closeBrackets = (jsonStr.match(/\]/g) || []).length;
      const openBraces = (jsonStr.match(/\{/g) || []).length;
      const closeBraces = (jsonStr.match(/\}/g) || []).length;

      for (let i = 0; i < openBrackets - closeBrackets; i++) jsonStr += ']';
      for (let i = 0; i < openBraces - closeBraces; i++) jsonStr += '}';

      // 3. 마지막 쉼표 제거
      jsonStr = jsonStr.replace(/,\s*([}\]])/g, '$1');

      try {
        parsed = JSON.parse(jsonStr);
      } catch {
        // 최후의 수단: 숫자 점수만 추출
        const scores: Record<string, number> = {};
        const scoreRegex = /"(\w+Score)":\s*(\d+)/g;
        let match;
        while ((match = scoreRegex.exec(response)) !== null) {
          scores[match[1]] = parseInt(match[2]);
        }
        if (Object.keys(scores).length >= 3) {
          parsed = scores;
        } else {
          throw new Error('Cannot recover JSON');
        }
      }
    }

    const overall = (parsed.overallScore as number) ||
      ((parsed.immersionScore as number || 5) + (parsed.responseQuality as number || 5) +
       (parsed.characterConsistency as number || 5) + (parsed.engagementLevel as number || 5) +
       (parsed.naturalness as number || 5)) / 5;

    return {
      immersionScore: (parsed.immersionScore as number) || 5,
      responseQuality: (parsed.responseQuality as number) || 5,
      characterConsistency: (parsed.characterConsistency as number) || 5,
      engagementLevel: (parsed.engagementLevel as number) || 5,
      naturalness: (parsed.naturalness as number) || 5,
      overallScore: overall,
      strengths: (parsed.strengths as string[]) || [],
      weaknesses: (parsed.weaknesses as string[]) || [],
      feedback: (parsed.feedback as string) || '',
    };
  } catch (error) {
    console.error('Evaluation error:', error);
    return {
      immersionScore: 5,
      responseQuality: 5,
      characterConsistency: 5,
      engagementLevel: 5,
      naturalness: 5,
      overallScore: 5,
      strengths: [],
      weaknesses: [],
      feedback: 'Evaluation failed',
    };
  }
}

// ============================================
// 결과 집계
// ============================================

function aggregateResults(results: TestResult[]): AggregatedResult[] {
  // 상위 3개 버전만 테스트 (코드는 모두 유지, 테스트만 효율화)
  // V9: 시스템 프롬프트에 상황 컨텍스트 직접 포함하여 장소/활동 일관성 강화
  const versions: PromptVersion[] = ['v2', 'v10', 'v12'];

  return versions.map(version => {
    const versionResults = results.filter(r => r.version === version);

    if (versionResults.length === 0) {
      return {
        version,
        avgImmersion: 0,
        avgQuality: 0,
        avgConsistency: 0,
        avgEngagement: 0,
        avgNaturalness: 0,
        avgOverall: 0,
        avgResponseTime: 0,
        avgAffection: 0,
        totalRounds: 0,
      };
    }

    const avg = (arr: number[]) => arr.reduce((a, b) => a + b, 0) / arr.length;

    return {
      version,
      avgImmersion: avg(versionResults.map(r => r.evaluation.immersionScore)),
      avgQuality: avg(versionResults.map(r => r.evaluation.responseQuality)),
      avgConsistency: avg(versionResults.map(r => r.evaluation.characterConsistency)),
      avgEngagement: avg(versionResults.map(r => r.evaluation.engagementLevel)),
      avgNaturalness: avg(versionResults.map(r => r.evaluation.naturalness)),
      avgOverall: avg(versionResults.map(r => r.evaluation.overallScore)),
      avgResponseTime: avg(versionResults.flatMap(r => r.responseTimes)),
      avgAffection: avg(versionResults.map(r => r.affectionTotal)),
      totalRounds: versionResults.length,
    };
  });
}

// ============================================
// 메인 테스트 함수
// ============================================

async function main() {
  console.log('='.repeat(60));
  console.log('🧪 Prompt Builder A/B/C Test');
  console.log('='.repeat(60));
  console.log(`📊 설정:`);
  console.log(`   - 페르소나: ${PERSONA_ID}`);
  console.log(`   - 턴 수: ${TURNS}`);
  console.log(`   - 라운드: ${ROUNDS}`);
  console.log(`   - 유저 프로필: ${USER_PROFILE}`);
  console.log(`   - LLM 모델: ${LLM_MODEL}`);
  console.log(`   - 평가 모델: ${EVALUATOR_MODEL}`);
  console.log('='.repeat(60));

  // 페르소나 로드
  console.log('\n📦 페르소나 로딩...');
  const personaCoreData = await personaLoader.loadPersona(PERSONA_ID);

  if (!personaCoreData) {
    console.error('❌ 페르소나를 찾을 수 없습니다:', PERSONA_ID);
    process.exit(1);
  }

  console.log(`✅ 페르소나 로드 완료: ${personaCoreData.persona.name}`);

  // 유저 프로필
  const userProfile = USER_PROFILES[USER_PROFILE] || USER_PROFILES.curious;
  console.log(`👤 유저 프로필: ${userProfile.description}`);

  // 테스트 결과 저장
  const allResults: TestResult[] = [];
  // 상위 3개 버전만 테스트 (코드는 모두 유지, 테스트만 효율화)
  // V9: 시스템 프롬프트에 상황 컨텍스트 직접 포함하여 장소/활동 일관성 강화
  const versions: PromptVersion[] = ['v2', 'v10', 'v12'];

  // 각 버전별 테스트 실행
  for (let round = 1; round <= ROUNDS; round++) {
    console.log(`\n${'─'.repeat(50)}`);
    console.log(`📍 Round ${round}/${ROUNDS}`);
    console.log('─'.repeat(50));

    for (const version of versions) {
      console.log(`\n🔄 Testing ${version.toUpperCase()}...`);

      try {
        const { conversation, responseTimes, affectionTotal } = await runConversation(
          version,
          personaCoreData,
          userProfile
        );

        console.log(`   ✅ 대화 완료 (${TURNS} 턴)`);
        console.log(`   ⏱️ 평균 응답 시간: ${Math.round(responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length)}ms`);

        // 평가
        console.log(`   📝 평가 중...`);
        const evaluation = await evaluateConversation(conversation, personaCoreData.persona.name);

        console.log(`   📊 점수: ${evaluation.overallScore.toFixed(1)}/10`);

        allResults.push({
          version,
          round,
          conversation,
          responseTimes,
          evaluation,
          affectionTotal,
        });

      } catch (error) {
        console.error(`   ❌ 테스트 실패:`, error);
      }

      // 버전 간 딜레이
      await new Promise(r => setTimeout(r, 500));
    }
  }

  // 결과 집계
  console.log('\n' + '='.repeat(60));
  console.log('📊 최종 결과');
  console.log('='.repeat(60));

  const aggregated = aggregateResults(allResults);

  // 결과 테이블 출력
  console.log('\n┌─────────┬───────────┬───────────┬───────────┬───────────┬───────────┬───────────┬────────────┐');
  console.log('│ Version │ Immersion │ Quality   │ Consist.  │ Engage    │ Natural   │ Overall   │ Resp.Time  │');
  console.log('├─────────┼───────────┼───────────┼───────────┼───────────┼───────────┼───────────┼────────────┤');

  for (const result of aggregated) {
    console.log(`│ ${result.version.padEnd(7)} │ ${result.avgImmersion.toFixed(1).padStart(9)} │ ${result.avgQuality.toFixed(1).padStart(9)} │ ${result.avgConsistency.toFixed(1).padStart(9)} │ ${result.avgEngagement.toFixed(1).padStart(9)} │ ${result.avgNaturalness.toFixed(1).padStart(9)} │ ${result.avgOverall.toFixed(1).padStart(9)} │ ${Math.round(result.avgResponseTime).toString().padStart(8)}ms │`);
  }

  console.log('└─────────┴───────────┴───────────┴───────────┴───────────┴───────────┴───────────┴────────────┘');

  // 승자 결정
  const winner = aggregated.reduce((best, current) =>
    current.avgOverall > best.avgOverall ? current : best
  );

  console.log(`\n🏆 Winner: ${winner.version.toUpperCase()} (${winner.avgOverall.toFixed(2)}/10)`);

  // 상세 피드백
  console.log('\n📝 상세 피드백:');
  for (const result of allResults) {
    if (result.round === 1) {
      console.log(`\n[${result.version.toUpperCase()}]`);
      console.log(`  강점: ${result.evaluation.strengths.join(', ') || '없음'}`);
      console.log(`  약점: ${result.evaluation.weaknesses.join(', ') || '없음'}`);
      console.log(`  피드백: ${result.evaluation.feedback}`);
    }
  }

  // 결과 파일 저장
  const resultsDir = path.join(__dirname, 'results');
  if (!fs.existsSync(resultsDir)) {
    fs.mkdirSync(resultsDir, { recursive: true });
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const filename = `ab-test-${timestamp}.json`;
  const filepath = path.join(resultsDir, filename);

  fs.writeFileSync(filepath, JSON.stringify({
    config: {
      personaId: PERSONA_ID,
      turns: TURNS,
      rounds: ROUNDS,
      userProfile: USER_PROFILE,
      llmModel: LLM_MODEL,
      evaluatorModel: EVALUATOR_MODEL,
    },
    results: allResults,
    aggregated,
    winner: winner.version,
    timestamp: new Date().toISOString(),
  }, null, 2));

  console.log(`\n💾 결과 저장: ${filepath}`);
  console.log('\n' + '='.repeat(60));
}

// 실행
main().catch(console.error);
