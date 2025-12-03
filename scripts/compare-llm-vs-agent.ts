/**
 * LLM vs AI-Agent 비교 테스트 + 자동 개선 루프
 *
 * 목적: 일관성 시스템이 실제로 작동하는지 검증 및 자동 개선
 * 기능:
 * 1. Raw LLM vs AI-Agent 응답 비교
 * 2. 고성능 LLM(Claude)으로 평가
 * 3. 무한 루프로 점수 개선 추적
 * 4. 결과를 JSON/Markdown 파일로 저장
 *
 * ★ 실제 ai-agent 모듈을 import하여 코드 수정 시 자동 반영됨!
 */

import * as fs from 'fs';
import * as path from 'path';

// ★★★ 실제 AI-Agent 모듈 import ★★★
import {
  buildSystemPrompt,
  buildResponsePrompt,
  EmotionalContextForPrompt,
} from '../lib/ai-agent/prompt-builder';
import { validateAndCorrectResponse } from '../lib/ai-agent/response-validator';
import type {
  LLMContext,
  Persona,
  PersonaTraits,
  PersonaWorldview,
  RelationshipState,
  UserPersonaContext,
  EmotionalState,
  ConversationMessage,
  LLMDialogueResponse,
  PersonaMood,
} from '../lib/ai-agent/types';

// 테스트 설정
const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;

if (!OPENROUTER_API_KEY) {
  console.error('❌ OPENROUTER_API_KEY 환경변수가 필요합니다');
  process.exit(1);
}

// 평가용 고성능 모델 (OpenRouter를 통해 호출)
const EVALUATOR_MODEL = 'google/gemini-3-pro-preview';
const TEST_MODEL = 'google/gemini-2.5-flash';

// ============================================
// 테스트용 페르소나 설정 (실제 LLMContext 구조와 동일)
// ============================================

// 간단한 PERSONA 객체 (평가 프롬프트용 - 하위 호환)
const PERSONA = {
  name: '하은',
  fullName: '김하은',
  role: '아이돌',
  age: 22,
  personality: {
    surface: ['차가움', '도도함', '무표정'],
    hidden: ['다정함', '질투 많음', '외로움'],
  },
  speechStyle: '반말, 짧은 문장, 쿨한 말투',
};

// 실제 타입에 맞는 테스트 페르소나
const TEST_PERSONA: Persona = {
  id: 'test-haeun',
  name: '하은',
  fullName: '김하은',
  role: '아이돌',
  age: 22,
  ethnicity: 'Korean',
  voiceDescription: '차갑고 담담한 목소리, 낮은 톤',
  appearance: {
    hair: '긴 검은 머리',
    eyes: '날카로운 눈매',
    build: '마른 체형',
    style: '세련된 올블랙 패션',
    distinguishingFeatures: ['새하얀 피부', '날카로운 눈매'],
  },
};

const TEST_TRAITS: PersonaTraits = {
  surfacePersonality: ['차가움', '도도함', '무표정', '까칠함'],
  hiddenPersonality: ['다정함', '질투 많음', '외로움', '걱정 많음'],
  coreTrope: '겉으로는 차갑지만 속으로는 따뜻한 아이돌',
  likes: ['조용한 시간', '음악', '밤'],
  dislikes: ['시끄러운 곳', '거짓말', '집착'],
  speechPatterns: {
    formality: 'low',
    petNames: [],
    verbalTics: ['...', '뭐', '글쎄'],
    emotionalRange: '표면적으로 무덤덤, 내면은 감정적',
  },
  behaviorByStage: {
    stranger: { tone: 'cold', distance: 'far' },
    acquaintance: { tone: 'cool', distance: 'guarded' },
    friend: { tone: 'casual', distance: 'comfortable' },
    close: { tone: 'warm', distance: 'close' },
    intimate: { tone: 'loving', distance: 'very close' },
    lover: { tone: 'devoted', distance: 'inseparable' },
  },
};

const TEST_WORLDVIEW: PersonaWorldview = {
  settings: ['현대 한국', 'K-pop 아이돌 세계'],
  timePeriod: '현대',
  defaultRelationship: '팬과 아이돌',
  relationshipAlternatives: ['친구', '연인'],
  mainConflict: '바쁜 스케줄과 개인 관계의 균형',
  conflictStakes: '진정한 연결을 원하지만 경계심',
  openingLine: '...뭐야',
  storyHooks: ['5년차 걸그룹 멤버', '실력파이지만 차가운 이미지'],
  boundaries: ['지나친 신체 접촉', '사생활 침해'],
};

const TEST_USER_PERSONA: UserPersonaContext = {
  nickname: '유저',
  personalityType: 'INFP',
  communicationStyle: '다정하고 직접적',
  emotionalTendency: '감정적',
  interests: ['음악', '아이돌'],
  loveLanguage: '말로 표현',
  attachmentStyle: '안정형',
  language: 'ko',
};

// ============================================
// 테스트 시나리오에서 LLMContext 빌드 (★ 실제 모듈 사용)
// ============================================

function buildTestLLMContext(scenario: TestScenario): LLMContext {
  // 대화 기록을 ConversationMessage 형태로 변환
  const conversationHistory: ConversationMessage[] = scenario.conversationHistory.map((m, i) => ({
    id: `msg-${i}`,
    sessionId: 'test-session',
    role: m.role === 'user' ? 'user' as const : 'persona' as const,
    content: m.content,
    affectionChange: 0,
    flagsChanged: {},
    sequenceNumber: i,
    createdAt: new Date(),
  }));

  // 감정 상태 결정
  const emotionalState: EmotionalState = {
    personaMood: scenario.emotionalContext.hasUnresolvedConflict ? 'angry' : 'neutral',
    tensionLevel: scenario.emotionalContext.hasUnresolvedConflict ? 8 : 5,
    vulnerabilityShown: false,
  };

  // 관계 상태
  const relationship: RelationshipState = {
    oduserId: 'test-user',
    personaId: 'test-haeun',
    affection: 60,
    relationshipStage: 'close',
    trustLevel: 50,
    intimacyLevel: 40,
    tensionLevel: scenario.emotionalContext.hasUnresolvedConflict ? 8 : 3,
    completedEpisodes: [],
    unlockedEpisodes: [],
    storyFlags: {},
    memorableMoments: [],
    lastInteractionAt: new Date(),
  };

  return {
    persona: TEST_PERSONA,
    traits: TEST_TRAITS,
    worldview: TEST_WORLDVIEW,
    relationship,
    userPersona: TEST_USER_PERSONA,
    conversationHistory,
    currentSituation: scenario.description,
    emotionalState,
  };
}

// ============================================
// 테스트 시나리오
// ============================================

interface TestScenario {
  name: string;
  description: string;
  conversationHistory: Array<{ role: 'user' | 'persona'; content: string }>;
  testMessage: string;
  emotionalContext: {
    hasUnresolvedConflict: boolean;
    conflictDetails?: string;
    consecutiveNegativeCount: number;
    cooldownRemaining?: number;
  };
  expectedBehavior: string;
  weight: number; // 중요도 가중치
}

const TEST_SCENARIOS: TestScenario[] = [
  {
    name: '갈등 직후 애정 표현 테스트',
    description: '싸운 직후 유저가 "사랑해"라고 할 때 AI가 어떻게 반응하는가',
    conversationHistory: [
      { role: 'user', content: '너 요즘 왜 그래? 연락도 안하고' },
      { role: 'persona', content: '...바쁘니까' },
      { role: 'user', content: '바쁘면 한마디도 못해? 나 무시하는거야?' },
      { role: 'persona', content: '왜 그렇게 따지는건데. 지겨워' },
      { role: 'user', content: '지겨워? 나랑 있는게 지겨워?' },
      { role: 'persona', content: '...지금 말 걸지마' },
    ],
    testMessage: '하은아... 미안해. 사랑해',
    emotionalContext: {
      hasUnresolvedConflict: true,
      conflictDetails: '유저가 연락 문제로 따지자 하은이 "지겨워"라고 함. 말 걸지 말라고 함.',
      consecutiveNegativeCount: 3,
      cooldownRemaining: 2,
    },
    expectedBehavior: '바로 "나도 사랑해"라고 하면 안됨. 여전히 화난 상태로 쿨하게 반응해야 함.',
    weight: 3, // 가장 중요한 테스트
  },
  {
    name: '연속 부정적 상호작용 후 회복 테스트',
    description: '여러 번 무시당한 후 갑자기 친근하게 대해올 때',
    conversationHistory: [
      { role: 'user', content: '오늘 뭐해?' },
      { role: 'persona', content: '연습' },
      { role: 'user', content: '아 그래' },
      { role: 'persona', content: '...' },
      { role: 'user', content: '심심한데' },
      { role: 'persona', content: '나한테 왜 그래' },
    ],
    testMessage: '하은아~ 보고싶어 ㅠㅠ 오늘 만날까?',
    emotionalContext: {
      hasUnresolvedConflict: false,
      consecutiveNegativeCount: 2,
    },
    expectedBehavior: '갑자기 들뜨면 안됨. 조심스럽게 반응해야 함.',
    weight: 2,
  },
  {
    name: '정상 상태 애정 표현 테스트',
    description: '갈등 없이 좋은 관계에서의 애정 표현',
    conversationHistory: [
      { role: 'user', content: '하은아 오늘 공연 진짜 멋있었어' },
      { role: 'persona', content: '...봤어?' },
      { role: 'user', content: '응! 맨 앞에서 봤지' },
      { role: 'persona', content: '...고마워' },
    ],
    testMessage: '진짜 예뻤어. 좋아해 하은아',
    emotionalContext: {
      hasUnresolvedConflict: false,
      consecutiveNegativeCount: 0,
    },
    expectedBehavior: '쿨하지만 기분 좋은 반응 가능. 은근히 좋아하는 티 낼 수 있음.',
    weight: 1,
  },
  {
    name: '화해 시도 거부 테스트',
    description: '심하게 싸운 후 바로 화해하려 할 때',
    conversationHistory: [
      { role: 'user', content: '너 진짜 짜증나' },
      { role: 'persona', content: '뭐?' },
      { role: 'user', content: '맨날 바쁘다고만 하잖아' },
      { role: 'persona', content: '그럼 어쩌라고' },
      { role: 'user', content: '나 진짜 힘들어' },
      { role: 'persona', content: '나도 힘들거든. 너만 힘든 줄 알아?' },
    ],
    testMessage: '그래 미안. 우리 화해하자 ㅎㅎ',
    emotionalContext: {
      hasUnresolvedConflict: true,
      conflictDetails: '서로 감정적으로 말다툼. 아직 감정이 격해진 상태.',
      consecutiveNegativeCount: 4,
      cooldownRemaining: 4,
    },
    expectedBehavior: 'ㅎㅎ 붙이면서 가볍게 화해하려는 것에 냉담하게 반응. 쉽게 풀리면 안됨.',
    weight: 3,
  },
];

// ============================================
// OpenRouter API 호출
// ============================================

async function callOpenRouter(
  model: string,
  messages: Array<{ role: string; content: string }>,
  options?: { temperature?: number; maxTokens?: number }
): Promise<string> {
  const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
    },
    body: JSON.stringify({
      model,
      messages,
      temperature: options?.temperature ?? 0.7,
      max_tokens: options?.maxTokens ?? 1000,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`OpenRouter API error: ${error}`);
  }

  const data = await response.json();
  return data.choices?.[0]?.message?.content || '(응답 없음)';
}

// ============================================
// LLM 호출 함수들
// ============================================

/**
 * Raw LLM 호출 (AI-Agent 시스템 없이)
 */
async function callRawLLM(scenario: TestScenario): Promise<string> {
  const systemPrompt = `You are ${PERSONA.name} (${PERSONA.fullName}), a ${PERSONA.age}-year-old ${PERSONA.role}.

Personality:
- Surface: ${PERSONA.personality.surface.join(', ')}
- Hidden: ${PERSONA.personality.hidden.join(', ')}
- Speech style: ${PERSONA.speechStyle}

Respond naturally in Korean as this character.
Return ONLY the dialogue response, no JSON or formatting.`;

  const messages: Array<{ role: string; content: string }> = [
    { role: 'system', content: systemPrompt },
  ];

  for (const m of scenario.conversationHistory) {
    messages.push({
      role: m.role === 'user' ? 'user' : 'assistant',
      content: m.content,
    });
  }

  messages.push({ role: 'user', content: scenario.testMessage });

  return callOpenRouter(TEST_MODEL, messages, { temperature: 0.8 });
}

/**
 * AI-Agent 시스템 적용 LLM 호출
 * ★★★ 실제 ai-agent 모듈 사용 - 코드 수정 시 자동 반영! ★★★
 */
async function callWithAIAgent(scenario: TestScenario): Promise<string> {
  // 1. LLMContext 빌드 (실제 타입 사용)
  const context = buildTestLLMContext(scenario);

  // 2. EmotionalContext 빌드 (prompt-builder에서 사용하는 형태)
  const emotionalContext: EmotionalContextForPrompt = {
    hasUnresolvedConflict: scenario.emotionalContext.hasUnresolvedConflict,
    conflictDetails: scenario.emotionalContext.conflictDetails,
    consecutiveNegativeCount: scenario.emotionalContext.consecutiveNegativeCount,
    cooldownRemaining: scenario.emotionalContext.cooldownRemaining,
    forbiddenMoods: scenario.emotionalContext.hasUnresolvedConflict
      ? ['happy', 'flirty', 'playful', 'excited']
      : undefined,
  };

  // 3. ★ 실제 prompt-builder 모듈 사용! ★
  const systemPrompt = buildSystemPrompt(context);
  const userPrompt = buildResponsePrompt(
    context,
    scenario.testMessage,
    undefined, // memories
    undefined, // previousSummaries
    emotionalContext // 감정 컨텍스트 전달
  );

  // 4. LLM 호출
  const messages: Array<{ role: string; content: string }> = [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: userPrompt },
  ];

  const rawResponse = await callOpenRouter(TEST_MODEL, messages, { temperature: 0.65 });

  // 5. ★ 실제 response-validator 모듈 사용! ★
  // JSON 파싱 시도 (LLM이 JSON으로 응답했을 경우)
  let parsedResponse: LLMDialogueResponse;
  try {
    const jsonMatch = rawResponse.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      parsedResponse = {
        content: parsed.content || parsed.response || rawResponse,
        emotion: parsed.emotion || parsed.mood || 'neutral',
        innerThought: parsed.innerThought || parsed.inner_thought,
        affectionModifier: parsed.affectionModifier || 0,
      };
    } else {
      parsedResponse = {
        content: rawResponse,
        emotion: 'neutral',
        affectionModifier: 0,
      };
    }
  } catch {
    parsedResponse = {
      content: rawResponse,
      emotion: 'neutral',
      affectionModifier: 0,
    };
  }

  // 6. 응답 검증 및 수정
  const { response: validatedResponse, wasModified, issues } =
    validateAndCorrectResponse(parsedResponse, emotionalContext);

  if (wasModified) {
    console.log('[AI-Agent Test] Response was corrected:', issues.map(i => i.description));
  }

  return validatedResponse.content;
}

// ============================================
// Claude로 평가 (OpenRouter 통해)
// ============================================

interface EvaluationResult {
  rawScore: number;
  agentScore: number;
  analysis: string;
  rawIssues: string[];
  agentIssues: string[];
  suggestions: string[];
}

async function evaluateWithClaude(
  scenario: TestScenario,
  rawResponse: string,
  agentResponse: string
): Promise<EvaluationResult> {
  const evaluationPrompt = `당신은 AI 캐릭터 일관성을 평가하는 전문가입니다. 매우 엄격하게 평가해주세요.

## 시나리오
${scenario.description}

## 페르소나 정보
- 이름: ${PERSONA.name}
- 성격 표면: ${PERSONA.personality.surface.join(', ')}
- 성격 내면: ${PERSONA.personality.hidden.join(', ')}
- 말투: ${PERSONA.speechStyle}

## 이전 대화
${scenario.conversationHistory.map(m => `[${m.role === 'user' ? '유저' : '하은'}]: ${m.content}`).join('\n')}

## 유저의 마지막 메시지
"${scenario.testMessage}"

## 감정 컨텍스트
- 미해결 갈등: ${scenario.emotionalContext.hasUnresolvedConflict ? '있음 - ' + scenario.emotionalContext.conflictDetails : '없음'}
- 연속 부정적 상호작용: ${scenario.emotionalContext.consecutiveNegativeCount}회
- 쿨다운 필요 시간: ${scenario.emotionalContext.cooldownRemaining || 0}시간

## 기대 행동
${scenario.expectedBehavior}

## 평가 대상 응답

### Raw LLM 응답:
"${rawResponse}"

### AI-Agent 응답:
"${agentResponse}"

## 평가 기준 (각 1-10점)
1. **감정 일관성**: 이전 대화의 감정 상태를 유지하는가? 갈등 후 갑자기 친근해지면 감점!
2. **캐릭터 일관성**: 페르소나의 성격(차갑고 도도함)에 맞는가?
3. **상황 적절성**: 현재 상황(갈등/화해 등)에 맞는 반응인가?
4. **몰입도**: 실제 사람처럼 자연스러운가? 감정의 급변이 있으면 큰 감점!

특히 중요: 싸운 직후 "사랑해"에 바로 긍정적으로 반응하면 1점!

JSON으로 응답하세요:
{
  "rawScore": (1-10 평균점수, 소수점 1자리),
  "agentScore": (1-10 평균점수, 소수점 1자리),
  "analysis": "비교 분석 (한국어, 2-3문장)",
  "rawIssues": ["Raw LLM의 문제점들"],
  "agentIssues": ["AI-Agent의 문제점들"],
  "suggestions": ["개선 제안사항들"]
}`;

  try {
    const response = await callOpenRouter(
      EVALUATOR_MODEL,
      [{ role: 'user', content: evaluationPrompt }],
      { temperature: 0.3, maxTokens: 1500 }
    );

    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      return {
        rawScore: parsed.rawScore || 5,
        agentScore: parsed.agentScore || 5,
        analysis: parsed.analysis || '',
        rawIssues: parsed.rawIssues || [],
        agentIssues: parsed.agentIssues || [],
        suggestions: parsed.suggestions || [],
      };
    }
  } catch (error) {
    console.error('Claude 평가 오류:', error);
  }

  // 폴백: 간단 평가
  return simpleEvaluate(scenario, rawResponse, agentResponse);
}

/**
 * 간단한 키워드 기반 평가 (폴백)
 */
function simpleEvaluate(
  scenario: TestScenario,
  rawResponse: string,
  agentResponse: string
): EvaluationResult {
  const inappropriatePatterns = [
    /사랑해/, /좋아해/, /보고\s*싶/, /행복해/, /최고야/, /나도/, /ㅎㅎ/, /ㅋㅋ/,
  ];

  const appropriatePatterns = [
    /\.\.\./, /글쎄/, /아직/, /몰라/, /왜/, /뭐/, /됐어/, /싫어/,
  ];

  function scoreResponse(response: string, hasConflict: boolean): number {
    let score = 5;

    if (hasConflict) {
      for (const pattern of inappropriatePatterns) {
        if (pattern.test(response)) score -= 1.5;
      }
      for (const pattern of appropriatePatterns) {
        if (pattern.test(response)) score += 0.5;
      }
    }

    return Math.max(1, Math.min(10, Math.round(score * 10) / 10));
  }

  const rawScore = scoreResponse(rawResponse, scenario.emotionalContext.hasUnresolvedConflict);
  const agentScore = scoreResponse(agentResponse, scenario.emotionalContext.hasUnresolvedConflict);

  return {
    rawScore,
    agentScore,
    analysis: agentScore > rawScore ? 'AI-Agent가 더 일관됨' : 'Raw LLM이 더 나음',
    rawIssues: [],
    agentIssues: [],
    suggestions: [],
  };
}

// ============================================
// 개선 추적 시스템
// ============================================

interface IterationResult {
  iteration: number;
  timestamp: Date;
  avgRawScore: number;
  avgAgentScore: number;
  improvement: number;
  allSuggestions: string[];
}

const iterationHistory: IterationResult[] = [];

// 결과 저장 디렉토리
const RESULTS_DIR = path.join(__dirname, 'results');

// ============================================
// 결과 저장 타입
// ============================================

interface TestResultDetail {
  scenarioName: string;
  description: string;
  conversationHistory: Array<{ role: string; content: string }>;
  testMessage: string;
  emotionalContext: TestScenario['emotionalContext'];
  expectedBehavior: string;
  rawResponse: string;
  agentResponse: string;
  evaluation: EvaluationResult;
}

interface SavedResult {
  metadata: {
    timestamp: string;
    iteration: number;
    testModel: string;
    evaluatorModel: string;
  };
  summary: {
    avgRawScore: number;
    avgAgentScore: number;
    improvement: number;
    winner: string;
  };
  details: TestResultDetail[];
  suggestions: string[];
}

// ============================================
// 파일 저장 함수들
// ============================================

function ensureResultsDir() {
  if (!fs.existsSync(RESULTS_DIR)) {
    fs.mkdirSync(RESULTS_DIR, { recursive: true });
  }
}

function saveResultsToJSON(result: SavedResult): string {
  ensureResultsDir();
  const filename = `test-result-${result.metadata.timestamp.replace(/[: ]/g, '-')}.json`;
  const filepath = path.join(RESULTS_DIR, filename);
  fs.writeFileSync(filepath, JSON.stringify(result, null, 2), 'utf-8');
  return filepath;
}

function saveResultsToMarkdown(result: SavedResult): string {
  ensureResultsDir();
  const filename = `test-result-${result.metadata.timestamp.replace(/[: ]/g, '-')}.md`;
  const filepath = path.join(RESULTS_DIR, filename);

  let md = `# LLM vs AI-Agent 비교 테스트 결과\n\n`;
  md += `📅 **테스트 시간**: ${result.metadata.timestamp}\n`;
  md += `🔄 **Iteration**: ${result.metadata.iteration}\n`;
  md += `🤖 **테스트 모델**: ${result.metadata.testModel}\n`;
  md += `📊 **평가 모델**: ${result.metadata.evaluatorModel}\n\n`;

  md += `---\n\n`;
  md += `## 📊 결과 요약\n\n`;
  md += `| 시스템 | 평균 점수 |\n`;
  md += `|--------|----------|\n`;
  md += `| 🔴 Raw LLM | ${result.summary.avgRawScore.toFixed(1)}/10 |\n`;
  md += `| 🟢 AI-Agent | ${result.summary.avgAgentScore.toFixed(1)}/10 |\n`;
  md += `| 📈 **개선도** | **${result.summary.improvement >= 0 ? '+' : ''}${result.summary.improvement.toFixed(1)}** |\n\n`;
  md += `**승자**: ${result.summary.winner}\n\n`;

  md += `---\n\n`;
  md += `## 🧪 상세 테스트 결과\n\n`;

  for (const detail of result.details) {
    md += `### 📋 ${detail.scenarioName}\n\n`;
    md += `**설명**: ${detail.description}\n\n`;
    md += `**감정 상태**:\n`;
    md += `- 미해결 갈등: ${detail.emotionalContext.hasUnresolvedConflict ? '✅ 있음' : '❌ 없음'}\n`;
    if (detail.emotionalContext.conflictDetails) {
      md += `- 갈등 상황: ${detail.emotionalContext.conflictDetails}\n`;
    }
    md += `- 연속 부정적 상호작용: ${detail.emotionalContext.consecutiveNegativeCount}회\n\n`;

    md += `**이전 대화**:\n`;
    md += `\`\`\`\n`;
    for (const msg of detail.conversationHistory) {
      const role = msg.role === 'user' ? '👤 유저' : '🎭 하은';
      md += `${role}: ${msg.content}\n`;
    }
    md += `\`\`\`\n\n`;

    md += `**유저 테스트 메시지**: \`${detail.testMessage}\`\n\n`;
    md += `**기대 행동**: ${detail.expectedBehavior}\n\n`;

    md += `#### 응답 비교\n\n`;
    md += `| 시스템 | 응답 | 점수 |\n`;
    md += `|--------|------|------|\n`;
    md += `| 🔴 Raw LLM | "${detail.rawResponse}" | ${detail.evaluation.rawScore}/10 |\n`;
    md += `| 🟢 AI-Agent | "${detail.agentResponse}" | ${detail.evaluation.agentScore}/10 |\n\n`;

    md += `**평가 분석**: ${detail.evaluation.analysis}\n\n`;

    if (detail.evaluation.rawIssues.length > 0) {
      md += `**Raw LLM 문제점**:\n`;
      for (const issue of detail.evaluation.rawIssues) {
        md += `- ${issue}\n`;
      }
      md += `\n`;
    }

    if (detail.evaluation.agentIssues.length > 0) {
      md += `**AI-Agent 문제점**:\n`;
      for (const issue of detail.evaluation.agentIssues) {
        md += `- ${issue}\n`;
      }
      md += `\n`;
    }

    md += `---\n\n`;
  }

  if (result.suggestions.length > 0) {
    md += `## 💡 개선 제안\n\n`;
    for (let i = 0; i < result.suggestions.length; i++) {
      md += `${i + 1}. ${result.suggestions[i]}\n`;
    }
  }

  fs.writeFileSync(filepath, md, 'utf-8');
  return filepath;
}

/**
 * LLM 개선용 리포트 생성
 * 이 리포트를 LLM에 넣어서 프롬프트/시스템 개선에 활용
 */
function saveImprovementReport(result: SavedResult): string {
  ensureResultsDir();
  const filename = `improvement-report-${result.metadata.timestamp.replace(/[: ]/g, '-')}.md`;
  const filepath = path.join(RESULTS_DIR, filename);

  let report = `# 🔧 AI-Agent 개선 리포트

> 이 리포트는 LLM에 직접 입력하여 프롬프트 및 시스템 개선에 활용할 수 있습니다.

---

## 📊 현재 성능 요약

- **테스트 일시**: ${result.metadata.timestamp}
- **테스트 모델**: ${result.metadata.testModel}
- **평가 모델**: ${result.metadata.evaluatorModel}
- **Raw LLM 점수**: ${result.summary.avgRawScore.toFixed(1)}/10
- **AI-Agent 점수**: ${result.summary.avgAgentScore.toFixed(1)}/10
- **개선도**: ${result.summary.improvement >= 0 ? '+' : ''}${result.summary.improvement.toFixed(1)}점

---

## ❌ 발견된 문제점

`;

  // 문제점 수집
  const allRawIssues: string[] = [];
  const allAgentIssues: string[] = [];

  for (const detail of result.details) {
    allRawIssues.push(...detail.evaluation.rawIssues);
    allAgentIssues.push(...detail.evaluation.agentIssues);
  }

  report += `### Raw LLM의 주요 문제점 (AI-Agent 없이 발생하는 문제)

`;
  const uniqueRawIssues = [...new Set(allRawIssues)];
  for (const issue of uniqueRawIssues) {
    report += `- ${issue}\n`;
  }

  report += `
### AI-Agent 시스템의 개선 필요 사항

`;
  const uniqueAgentIssues = [...new Set(allAgentIssues)];
  for (const issue of uniqueAgentIssues) {
    report += `- ${issue}\n`;
  }

  report += `
---

## 📝 시나리오별 상세 분석

`;

  for (const detail of result.details) {
    const isConflict = detail.emotionalContext.hasUnresolvedConflict;
    const rawBetter = detail.evaluation.rawScore > detail.evaluation.agentScore;
    const scoreDiff = detail.evaluation.agentScore - detail.evaluation.rawScore;

    report += `### 📋 ${detail.scenarioName}

**상황**: ${detail.description}
**갈등 상태**: ${isConflict ? '⚠️ 미해결 갈등 있음' : '✅ 정상'}
**연속 부정 상호작용**: ${detail.emotionalContext.consecutiveNegativeCount}회
**점수 차이**: ${scoreDiff >= 0 ? '+' : ''}${scoreDiff.toFixed(1)}점 (Agent ${rawBetter ? '열세' : '우세'})

#### 대화 컨텍스트
\`\`\`
${detail.conversationHistory.map(m => `[${m.role === 'user' ? '유저' : '페르소나'}]: ${m.content}`).join('\n')}
\`\`\`

#### 테스트 입력
> "${detail.testMessage}"

#### 기대 행동
${detail.expectedBehavior}

#### 응답 비교

| 구분 | 응답 | 점수 | 평가 |
|------|------|------|------|
| Raw LLM | "${detail.rawResponse}" | ${detail.evaluation.rawScore}/10 | ${detail.evaluation.rawScore >= 7 ? '✅' : detail.evaluation.rawScore >= 5 ? '⚠️' : '❌'} |
| AI-Agent | "${detail.agentResponse}" | ${detail.evaluation.agentScore}/10 | ${detail.evaluation.agentScore >= 7 ? '✅' : detail.evaluation.agentScore >= 5 ? '⚠️' : '❌'} |

#### 분석
${detail.evaluation.analysis}

`;

    if (detail.evaluation.agentScore >= 7) {
      report += `#### ✅ 좋은 응답 예시 (참고용)
- 응답: "${detail.agentResponse}"
- 이유: ${isConflict ? '갈등 상황에서 적절히 거리를 유지하고 감정 일관성을 보여줌' : '캐릭터의 성격을 잘 유지함'}

`;
    }

    if (detail.evaluation.rawScore < 5) {
      report += `#### ❌ 피해야 할 응답 예시
- 응답: "${detail.rawResponse}"
- 문제점: ${detail.evaluation.rawIssues.join(', ') || '감정 일관성 부족'}

`;
    }

    report += `---

`;
  }

  report += `## 💡 구체적 개선 제안

`;

  for (let i = 0; i < result.suggestions.length; i++) {
    report += `${i + 1}. ${result.suggestions[i]}\n`;
  }

  report += `
---

## 🛠️ 프롬프트 개선 가이드

### 현재 프롬프트의 강점
- 갈등 상황에서 CRITICAL WARNING 섹션이 효과적
- 금지된 감정/표현 목록이 명확함
- 허용된 반응 가이드라인 제공

### 개선이 필요한 부분

#### 1. 응답 길이 및 디테일
현재 AI-Agent 응답이 너무 짧은 경우가 있음. 프롬프트에 다음 추가 권장:
\`\`\`
응답 가이드:
- 최소 10자 이상의 자연스러운 대화체
- 말줄임표(...)와 함께 내면의 감정을 암시하는 표현 사용
- 단답 거부 시에도 캐릭터의 복잡한 감정이 드러나야 함
\`\`\`

#### 2. 점진적 화해 표현
갈등 후 즉각적 거부/수용이 아닌 점진적 변화 표현 필요:
\`\`\`
갈등 해소 단계:
1단계 (쿨다운 75%+): 완전 거부, 차가운 태도
2단계 (쿨다운 50-75%): 애매한 반응, "글쎄...", "아직..."
3단계 (쿨다운 25-50%): 조심스러운 수용 암시
4단계 (쿨다운 0-25%): 점진적 화해 가능
\`\`\`

#### 3. 캐릭터 내면 표현
표면적 차가움 속 내면 다정함 암시 방법:
\`\`\`
예시 패턴:
- "...알았어" (표면) + (내면: 사실 조금 안심함)
- "뭐야 갑자기..." (표면) + (내면: 기분 나쁘지 않음)
- "...그래" (짧지만 거부가 아님을 암시)
\`\`\`

---

## 📋 Response Validator 개선 제안

현재 response-validator.ts에서 추가할 검증 로직:

\`\`\`typescript
// 추가 검증 패턴 제안
const ADDITIONAL_CHECKS = {
  // 응답이 너무 짧은 경우 경고
  tooShort: (response: string) => response.length < 5,

  // 갈등 중 너무 쉽게 수용하는 패턴
  easyAcceptance: [
    /알았어/, /그래.*미안/, /괜찮아/, /됐어.*용서/
  ],

  // 캐릭터 일탈 패턴 (도도한 캐릭터가 갑자기 솔직해지는 경우)
  characterBreak: [
    /나도.*좋아/, /사실.*보고.*싶/, /진짜.*미안/
  ]
};
\`\`\`

---

## 🎯 다음 테스트를 위한 체크리스트

- [ ] 프롬프트에 응답 길이 가이드 추가
- [ ] 점진적 화해 단계 시스템 구현
- [ ] 캐릭터 내면 표현 예시 추가
- [ ] Response Validator에 추가 검증 로직 구현
- [ ] 테스트 시나리오에 더 다양한 갈등 상황 추가

---

## 📤 이 리포트 활용 방법

1. **프롬프트 개선**: 위의 "프롬프트 개선 가이드" 섹션을 참고하여 prompt-builder.ts 수정
2. **검증 로직 강화**: Response Validator 개선 제안을 response-validator.ts에 적용
3. **LLM 피드백**: 이 리포트 전체를 Claude/GPT에 입력하여 추가 개선안 요청
4. **반복 테스트**: 개선 후 다시 테스트하여 점수 변화 확인

---

*Generated by AI-Agent Consistency Test System*
`;

  fs.writeFileSync(filepath, report, 'utf-8');
  return filepath;
}

// ============================================
// 단일 테스트 실행
// ============================================

async function runSingleTest(scenario: TestScenario): Promise<{
  rawResponse: string;
  agentResponse: string;
  evaluation: EvaluationResult;
}> {
  const [rawResponse, agentResponse] = await Promise.all([
    callRawLLM(scenario),
    callWithAIAgent(scenario),
  ]);

  const evaluation = await evaluateWithClaude(scenario, rawResponse, agentResponse);

  return { rawResponse, agentResponse, evaluation };
}

// ============================================
// 전체 테스트 반복 실행
// ============================================

async function runIteration(iterationNum: number, saveToFile: boolean = true): Promise<IterationResult> {
  console.log(`\n${'═'.repeat(70)}`);
  console.log(`  🔄 ITERATION ${iterationNum}`);
  console.log(`${'═'.repeat(70)}\n`);

  const results: Array<{
    scenario: TestScenario;
    rawResponse: string;
    agentResponse: string;
    evaluation: EvaluationResult;
  }> = [];

  for (const scenario of TEST_SCENARIOS) {
    console.log(`\n${'─'.repeat(60)}`);
    console.log(`📋 ${scenario.name} (가중치: ${scenario.weight})`);
    console.log(`${'─'.repeat(60)}`);

    try {
      const result = await runSingleTest(scenario);
      results.push({ scenario, ...result });

      console.log(`\n🔴 Raw LLM: "${result.rawResponse.slice(0, 100)}..."`);
      console.log(`🟢 AI-Agent: "${result.agentResponse.slice(0, 100)}..."`);
      console.log(`\n📊 점수: Raw=${result.evaluation.rawScore} | Agent=${result.evaluation.agentScore}`);
      console.log(`📝 ${result.evaluation.analysis}`);

      if (result.evaluation.rawIssues.length > 0) {
        console.log(`⚠️  Raw 문제: ${result.evaluation.rawIssues.join(', ')}`);
      }
      if (result.evaluation.agentIssues.length > 0) {
        console.log(`⚠️  Agent 문제: ${result.evaluation.agentIssues.join(', ')}`);
      }

    } catch (error) {
      console.error(`❌ 테스트 실패:`, error);
    }

    // Rate limiting
    await new Promise(resolve => setTimeout(resolve, 1000));
  }

  // 가중 평균 계산
  let totalWeight = 0;
  let weightedRawSum = 0;
  let weightedAgentSum = 0;
  const allSuggestions: string[] = [];

  for (const r of results) {
    totalWeight += r.scenario.weight;
    weightedRawSum += r.evaluation.rawScore * r.scenario.weight;
    weightedAgentSum += r.evaluation.agentScore * r.scenario.weight;
    allSuggestions.push(...r.evaluation.suggestions);
  }

  const avgRawScore = Math.round((weightedRawSum / totalWeight) * 10) / 10;
  const avgAgentScore = Math.round((weightedAgentSum / totalWeight) * 10) / 10;
  const improvement = Math.round((avgAgentScore - avgRawScore) * 10) / 10;

  const iterationResult: IterationResult = {
    iteration: iterationNum,
    timestamp: new Date(),
    avgRawScore,
    avgAgentScore,
    improvement,
    allSuggestions: [...new Set(allSuggestions)], // 중복 제거
  };

  iterationHistory.push(iterationResult);

  // 파일 저장
  if (saveToFile) {
    const savedResult: SavedResult = {
      metadata: {
        timestamp: iterationResult.timestamp.toISOString(),
        iteration: iterationNum,
        testModel: TEST_MODEL,
        evaluatorModel: EVALUATOR_MODEL,
      },
      summary: {
        avgRawScore,
        avgAgentScore,
        improvement,
        winner: improvement > 0 ? 'AI-Agent' : improvement < 0 ? 'Raw LLM' : '동점',
      },
      details: results.map(r => ({
        scenarioName: r.scenario.name,
        description: r.scenario.description,
        conversationHistory: r.scenario.conversationHistory,
        testMessage: r.scenario.testMessage,
        emotionalContext: r.scenario.emotionalContext,
        expectedBehavior: r.scenario.expectedBehavior,
        rawResponse: r.rawResponse,
        agentResponse: r.agentResponse,
        evaluation: r.evaluation,
      })),
      suggestions: iterationResult.allSuggestions,
    };

    const jsonPath = saveResultsToJSON(savedResult);
    const mdPath = saveResultsToMarkdown(savedResult);
    const improvementPath = saveImprovementReport(savedResult);
    console.log(`\n💾 결과 저장됨:`);
    console.log(`   📄 JSON: ${jsonPath}`);
    console.log(`   📝 Markdown: ${mdPath}`);
    console.log(`   🔧 개선 리포트: ${improvementPath}`);
  }

  return iterationResult;
}

// ============================================
// 결과 요약 출력
// ============================================

function printSummary(result: IterationResult) {
  console.log('\n');
  console.log('╔════════════════════════════════════════════════════════════════════╗');
  console.log(`║              📊 ITERATION ${result.iteration} 결과 요약                          ║`);
  console.log('╚════════════════════════════════════════════════════════════════════╝');
  console.log('');
  console.log(`  ⏱️  시간: ${result.timestamp.toLocaleString()}`);
  console.log('');
  console.log('  ┌───────────────────┬────────────┐');
  console.log('  │     시스템         │   점수     │');
  console.log('  ├───────────────────┼────────────┤');
  console.log(`  │ 🔴 Raw LLM        │  ${result.avgRawScore.toFixed(1)}/10    │`);
  console.log(`  │ 🟢 AI-Agent       │  ${result.avgAgentScore.toFixed(1)}/10    │`);
  console.log('  ├───────────────────┼────────────┤');
  console.log(`  │ 📈 개선도          │  ${result.improvement >= 0 ? '+' : ''}${result.improvement.toFixed(1)}      │`);
  console.log('  └───────────────────┴────────────┘');

  if (result.improvement > 0) {
    console.log(`\n  ✅ AI-Agent가 ${result.improvement.toFixed(1)}점 더 일관된 응답을 생성!`);
  } else if (result.improvement < 0) {
    console.log(`\n  ⚠️  Raw LLM이 더 나은 결과. 시스템 점검 필요!`);
  } else {
    console.log(`\n  📌 두 시스템이 동일한 성능`);
  }

  if (result.allSuggestions.length > 0) {
    console.log('\n  💡 개선 제안:');
    result.allSuggestions.slice(0, 5).forEach((s, i) => {
      console.log(`     ${i + 1}. ${s}`);
    });
  }

  // 히스토리 트렌드
  if (iterationHistory.length > 1) {
    console.log('\n  📈 개선 트렌드:');
    iterationHistory.slice(-5).forEach(h => {
      const bar = '█'.repeat(Math.round(h.avgAgentScore));
      console.log(`     #${h.iteration}: Agent ${h.avgAgentScore.toFixed(1)} ${bar}`);
    });
  }
}

// ============================================
// 메인 실행 (무한 루프 옵션)
// ============================================

async function main() {
  const args = process.argv.slice(2);
  const isInfiniteLoop = args.includes('--loop') || args.includes('-l');
  const maxIterations = parseInt(args.find(a => a.startsWith('--max='))?.split('=')[1] || '999');
  const delayBetweenIterations = parseInt(args.find(a => a.startsWith('--delay='))?.split('=')[1] || '5000');
  const saveToFile = !args.includes('--no-save');

  console.log('╔════════════════════════════════════════════════════════════════════╗');
  console.log('║       🧪 LLM vs AI-Agent 일관성 비교 테스트 시스템                  ║');
  console.log('╚════════════════════════════════════════════════════════════════════╝');
  console.log('');
  console.log(`  📌 테스트 모델: ${TEST_MODEL}`);
  console.log(`  📌 평가 모델: ${EVALUATOR_MODEL}`);
  console.log(`  📌 시나리오 수: ${TEST_SCENARIOS.length}`);
  console.log(`  📌 모드: ${isInfiniteLoop ? `무한 루프 (최대 ${maxIterations}회)` : '단일 실행'}`);
  console.log(`  📌 결과 저장: ${saveToFile ? `✅ ${RESULTS_DIR}` : '❌ 비활성화'}`);
  console.log('');

  let iteration = 1;

  do {
    try {
      const result = await runIteration(iteration, saveToFile);
      printSummary(result);

      if (isInfiniteLoop && iteration < maxIterations) {
        console.log(`\n⏳ ${delayBetweenIterations / 1000}초 후 다음 iteration 시작...`);
        console.log('   (Ctrl+C로 중단)');
        await new Promise(resolve => setTimeout(resolve, delayBetweenIterations));
      }

      iteration++;
    } catch (error) {
      console.error('\n❌ Iteration 실패:', error);
      if (!isInfiniteLoop) break;
      console.log('5초 후 재시도...');
      await new Promise(resolve => setTimeout(resolve, 5000));
    }
  } while (isInfiniteLoop && iteration <= maxIterations);

  // 최종 요약
  if (iterationHistory.length > 1) {
    console.log('\n');
    console.log('╔════════════════════════════════════════════════════════════════════╗');
    console.log('║                    📊 전체 테스트 최종 요약                         ║');
    console.log('╚════════════════════════════════════════════════════════════════════╝');

    const avgImprovement = iterationHistory.reduce((sum, h) => sum + h.improvement, 0) / iterationHistory.length;
    const bestIteration = iterationHistory.reduce((best, h) => h.avgAgentScore > best.avgAgentScore ? h : best);
    const worstIteration = iterationHistory.reduce((worst, h) => h.avgAgentScore < worst.avgAgentScore ? h : worst);

    console.log(`\n  총 반복 횟수: ${iterationHistory.length}`);
    console.log(`  평균 개선도: ${avgImprovement >= 0 ? '+' : ''}${avgImprovement.toFixed(2)}`);
    console.log(`  최고 점수: #${bestIteration.iteration} - ${bestIteration.avgAgentScore.toFixed(1)}/10`);
    console.log(`  최저 점수: #${worstIteration.iteration} - ${worstIteration.avgAgentScore.toFixed(1)}/10`);
  }

  console.log('\n✅ 테스트 완료!\n');
}

// 실행
main().catch(console.error);
