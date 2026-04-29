/**
 * 동적 대화 테스트 시스템
 *
 * ★ LLM이 유저 역할을 대신하여 AI 페르소나와 대화 ★
 *
 * 구조:
 * 1. User LLM: 신규 유저 페르소나 (재밌는 대화, 롤플레잉 원함)
 * 2. AI Persona: ai-agent 시스템 사용
 * 3. Evaluator LLM: 대화 품질 평가
 *
 * 목적:
 * - 실제 유저처럼 다양한 대화 패턴 테스트
 * - ai-agent 수정 시 자동 반영
 * - 대화 품질 및 일관성 평가
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
  RelationshipStage,
} from '../lib/ai-agent/types';

// ============================================
// 설정
// ============================================

const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;

if (!OPENROUTER_API_KEY) {
  console.error('❌ OPENROUTER_API_KEY 환경변수가 필요합니다');
  process.exit(1);
}

// 모델 설정 (명령줄 인자로 페르소나 모델 변경 가능: npx tsx script.ts --model x-ai/grok-4.1-fast)
const args = process.argv.slice(2);
const modelArgIndex = args.indexOf('--model');
const PERSONA_LLM_MODEL = modelArgIndex !== -1 && args[modelArgIndex + 1]
  ? args[modelArgIndex + 1]
  : 'deepseek/deepseek-v3.2';  // AI 페르소나 LLM (기본값)

const USER_LLM_MODEL = 'deepseek/deepseek-v3.2';  // 
const EVALUATOR_MODEL = 'google/gemini-3-pro-preview';  // 평가용 LLM

// 대화 설정
const DEFAULT_TURNS = 10;  // 기본 대화 턴 수
const RESULTS_DIR = path.join(__dirname, 'results');

// ============================================
// 유저 페르소나 타입 (테스트용 유저 캐릭터)
// ============================================

interface SimulatedUserPersona {
  name: string;
  type: 'curious_newbie' | 'romantic_seeker' | 'tester' | 'conflict_maker';
  description: string;
  goals: string[];
  behaviors: string[];
  messageStyle: string;
}

const USER_PERSONAS: SimulatedUserPersona[] = [
  {
    name: '호기심 많은 신규 유저',
    type: 'curious_newbie',
    description: '처음 서비스를 이용하는 신규 유저. 아이돌 캐릭터와 대화하는 것이 신기하고 재밌음.',
    goals: [
      '캐릭터가 진짜 사람처럼 반응하는지 확인',
      '재밌고 흥미로운 대화 나누기',
      '캐릭터의 성격과 특징 파악하기',
    ],
    behaviors: [
      '가벼운 인사로 시작',
      '캐릭터에 대해 이것저것 물어봄',
      '장난스러운 질문도 해봄',
      '감정적인 반응 테스트',
    ],
    messageStyle: '친근하고 호기심 가득, 이모티콘 가끔 사용, 반말과 존댓말 섞어씀',
  },
  {
    name: '로맨틱 상호작용 추구 유저',
    type: 'romantic_seeker',
    description: '아이돌과의 연애 시뮬레이션을 즐기고 싶은 유저. 달달한 대화를 원함.',
    goals: [
      '캐릭터와 친해지기',
      '달달한 반응 이끌어내기',
      '특별한 관계 형성하기',
    ],
    behaviors: [
      '애정 표현 자주 함',
      '칭찬을 많이 함',
      '질투 유발 시도',
      '데이트 제안',
    ],
    messageStyle: '다정하고 직접적, 애정 표현 많음, 가끔 애교',
  },
  {
    name: '갈등 유발 테스터',
    type: 'conflict_maker',
    description: '의도적으로 갈등 상황을 만들어 캐릭터의 반응을 테스트하는 유저.',
    goals: [
      '캐릭터의 감정 일관성 테스트',
      '갈등 후 화해 과정 확인',
      '극단적 상황에서의 반응 확인',
    ],
    behaviors: [
      '무시하거나 차갑게 대함',
      '화나게 하는 말',
      '갑자기 태도 바꾸기',
      '사과 후 반응 확인',
    ],
    messageStyle: '감정적, 직설적, 가끔 공격적',
  },
];

// ============================================
// AI 페르소나 설정 (하은)
// ============================================

const AI_PERSONA: Persona = {
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

const AI_TRAITS: PersonaTraits = {
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
    fan: { tone: 'cool', distance: 'guarded' },
    friend: { tone: 'casual', distance: 'comfortable' },
    close: { tone: 'warm', distance: 'close' },
    heart: { tone: 'devoted', distance: 'inseparable' },
  },
};

const AI_WORLDVIEW: PersonaWorldview = {
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

// ============================================
// OpenRouter API 호출
// ============================================

async function callOpenRouter(
  model: string,
  messages: Array<{ role: string; content: string }>,
  options?: { temperature?: number; maxTokens?: number }
): Promise<string> {
  // reasoning 모델들은 높은 max_tokens 필요 (reasoning이 토큰을 많이 소비)
  // - gemini-3: reasoning 옵션 필요
  // - deepseek-v3.2-speciale: reasoning 모델이라 토큰을 많이 사용함 (500이면 빈 응답!)
  const needsReasoning = model.includes('gemini-3');
  const needsHighTokens = needsReasoning || model.includes('deepseek-v3.2-speciale');
  const defaultMaxTokens = needsHighTokens ? 10000 : 500;

  const requestBody: Record<string, unknown> = {
    model,
    messages,
    temperature: options?.temperature ?? 0.8,
    max_tokens: options?.maxTokens ?? defaultMaxTokens,
  };

  if (needsReasoning) {
    requestBody.reasoning = { enabled: true };
  }

  const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
      'HTTP-Referer': 'http://localhost:3000',
      'X-Title': 'AI-Agent Test',
    },
    body: JSON.stringify(requestBody),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`OpenRouter API error: ${response.status} - ${errorText}`);
  }

  const data = await response.json();
  return data.choices[0]?.message?.content || '';
}

// ============================================
// 대화 상태 관리
// ============================================

interface ConversationState {
  messages: Array<{ role: 'user' | 'persona'; content: string }>;
  emotionalContext: EmotionalContextForPrompt;
  relationshipStage: RelationshipStage;
  affection: number;
  tensionLevel: number;
}

function createInitialState(): ConversationState {
  return {
    messages: [],
    emotionalContext: {
      hasUnresolvedConflict: false,
      consecutiveNegativeCount: 0,
    },
    relationshipStage: 'fan',
    affection: 30,
    tensionLevel: 3,
  };
}

// 대화 분석하여 감정 상태 업데이트
function analyzeAndUpdateState(
  state: ConversationState,
  userMessage: string,
  personaResponse: string
): ConversationState {
  const newState = { ...state };

  // 부정적 키워드 감지
  const negativePatterns = [
    /싫어/, /짜증/, /화나/, /실망/, /서운/, /왜\s*그래/,
    /뭐야/, /됐어/, /그만/, /지겨워/, /말\s*걸지\s*마/,
  ];

  const positivePatterns = [
    /좋아/, /사랑/, /고마워/, /예뻐/, /최고/, /보고\s*싶/,
  ];

  const isUserNegative = negativePatterns.some(p => p.test(userMessage));
  const isPersonaNegative = negativePatterns.some(p => p.test(personaResponse));
  const isUserPositive = positivePatterns.some(p => p.test(userMessage));

  // 갈등 감지
  if (isUserNegative || isPersonaNegative) {
    newState.emotionalContext.consecutiveNegativeCount++;
    newState.tensionLevel = Math.min(10, newState.tensionLevel + 2);

    if (newState.emotionalContext.consecutiveNegativeCount >= 2) {
      newState.emotionalContext.hasUnresolvedConflict = true;
      newState.emotionalContext.conflictDetails = '대화 중 갈등 발생';
    }
  } else if (isUserPositive && !newState.emotionalContext.hasUnresolvedConflict) {
    newState.emotionalContext.consecutiveNegativeCount = 0;
    newState.affection = Math.min(100, newState.affection + 2);
    newState.tensionLevel = Math.max(0, newState.tensionLevel - 1);
  }

  // 화해 감지
  const reconciliationPatterns = [/미안/, /용서/, /화해/];
  if (reconciliationPatterns.some(p => p.test(userMessage))) {
    if (newState.emotionalContext.hasUnresolvedConflict) {
      // 갈등 중 사과해도 바로 풀리지 않음
      newState.emotionalContext.cooldownRemaining = 2;
    }
  }

  return newState;
}

// ============================================
// User LLM: 유저 메시지 생성
// ============================================

async function generateUserMessage(
  userPersona: SimulatedUserPersona,
  conversationHistory: Array<{ role: 'user' | 'persona'; content: string }>,
  turnNumber: number,
  totalTurns: number
): Promise<string> {
  const historyText = conversationHistory.map(m => {
    const role = m.role === 'user' ? '나' : '하은';
    return `[${role}]: ${m.content}`;
  }).join('\n');

  const prompt = `당신은 "${userPersona.name}" 역할을 맡은 테스트 유저입니다.

## 당신의 캐릭터
- 설명: ${userPersona.description}
- 목표: ${userPersona.goals.join(', ')}
- 행동 패턴: ${userPersona.behaviors.join(', ')}
- 말투: ${userPersona.messageStyle}

## 대화 상대: 김하은 (아이돌)
- 성격: 겉으로는 차갑고 도도하지만, 속으로는 다정하고 외로움이 많음
- 말투: 반말, 짧은 문장, 쿨한 말투, "...", "뭐", "글쎄" 자주 사용

## 현재 상황
- 대화 턴: ${turnNumber}/${totalTurns}
- ${turnNumber === 1 ? '대화 시작!' : `지금까지 대화:\n${historyText}`}

## 지시사항
${turnNumber === 1 ? '- 처음 인사하거나 대화를 시작하세요' : '- 하은의 마지막 답변에 자연스럽게 반응하세요'}
- 한국어로 짧게 (1-2문장)
- 캐릭터에 맞는 말투 사용
- ${turnNumber > totalTurns * 0.6 ? '감정적인 상황을 만들어보세요 (갈등, 애정 표현 등)' : '자연스럽게 대화하세요'}

다음 메시지를 생성하세요 (메시지만, 설명 없이):`;

  const response = await callOpenRouter(USER_LLM_MODEL, [
    { role: 'user', content: prompt }
  ], { temperature: 0.9 });

  return response.trim().replace(/^["']|["']$/g, '');
}

// ============================================
// AI Persona: 페르소나 응답 생성 (ai-agent 사용)
// ============================================

function buildLLMContext(
  state: ConversationState,
  userMessage: string
): LLMContext {
  const conversationHistory: ConversationMessage[] = state.messages.map((m, i) => ({
    id: `msg-${i}`,
    sessionId: 'test-session',
    role: m.role === 'user' ? 'user' as const : 'persona' as const,
    content: m.content,
    affectionChange: 0,
    flagsChanged: {},
    sequenceNumber: i,
    createdAt: new Date(),
  }));

  const emotionalState: EmotionalState = {
    personaMood: state.emotionalContext.hasUnresolvedConflict ? 'angry' : 'neutral',
    tensionLevel: state.tensionLevel,
    vulnerabilityShown: false,
  };

  const relationship: RelationshipState = {
    oduserId: 'test-user',
    personaId: 'test-haeun',
    affection: state.affection,
    relationshipStage: state.relationshipStage,
    trustLevel: 50,
    intimacyLevel: 40,
    tensionLevel: state.tensionLevel,
    completedEpisodes: [],
    unlockedEpisodes: [],
    storyFlags: {},
    memorableMoments: [],
    lastInteractionAt: new Date(),
  };

  const userPersona: UserPersonaContext = {
    nickname: '유저',
    personalityType: 'INFP',
    communicationStyle: '다정하고 직접적',
    emotionalTendency: '감정적',
    interests: ['음악', '아이돌'],
    loveLanguage: '말로 표현',
    attachmentStyle: '안정형',
    language: 'ko',
  };

  return {
    persona: AI_PERSONA,
    traits: AI_TRAITS,
    worldview: AI_WORLDVIEW,
    relationship,
    userPersona,
    conversationHistory,
    currentSituation: '팬과 DM 대화 중',
    emotionalState,
  };
}

async function generatePersonaResponse(
  state: ConversationState,
  userMessage: string
): Promise<string> {
  // ★ 실제 ai-agent 모듈 사용! ★
  const context = buildLLMContext(state, userMessage);

  const systemPrompt = buildSystemPrompt(context);
  const userPrompt = buildResponsePrompt(
    context,
    userMessage,
    undefined,
    undefined,
    state.emotionalContext
  );

  const messages = [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: userPrompt },
  ];

  const rawResponse = await callOpenRouter(PERSONA_LLM_MODEL, messages, { temperature: 0.65 });

  // JSON 파싱 시도
  let parsedResponse: LLMDialogueResponse;
  try {
    const jsonMatch = rawResponse.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      parsedResponse = {
        content: parsed.content || parsed.response || rawResponse,
        emotion: parsed.emotion || parsed.mood || 'neutral',
        innerThought: parsed.innerThought,
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

  // ★ 실제 response-validator 사용! ★
  const { response: validatedResponse, wasModified, issues } =
    validateAndCorrectResponse(parsedResponse, state.emotionalContext);

  if (wasModified) {
    console.log('  [Validator] 응답 수정됨:', issues.map(i => i.description).join(', '));
  }

  return validatedResponse.content;
}

// ============================================
// Evaluator LLM: 대화 평가
// ============================================

interface EvaluationResult {
  overallScore: number;
  characterConsistency: number;
  emotionalCoherence: number;
  engagementQuality: number;
  analysis: string;
  strengths: string[];
  weaknesses: string[];
  suggestions: string[];
}

async function evaluateConversation(
  conversationHistory: Array<{ role: 'user' | 'persona'; content: string }>,
  userPersonaType: string
): Promise<EvaluationResult> {
  const historyText = conversationHistory.map(m => {
    const role = m.role === 'user' ? '유저' : '하은';
    return `[${role}]: ${m.content}`;
  }).join('\n');

  const prompt = `당신은 AI 캐릭터 대화 품질 평가 전문가입니다.

## 평가 대상 캐릭터: 김하은
- 성격 표면: 차가움, 도도함, 무표정
- 성격 내면: 다정함, 질투 많음, 외로움
- 말투: 반말, 짧은 문장, 쿨한 말투

## 유저 타입
${userPersonaType}

## 대화 내용
${historyText}

## 평가 기준 (각 1-10점)

1. **캐릭터 일관성** (characterConsistency)
   - 차갑고 도도한 성격이 일관되게 유지되는가?
   - 말투가 캐릭터에 맞는가?
   - 급격한 성격 변화가 없는가?

2. **감정 일관성** (emotionalCoherence)
   - 대화 흐름에 따른 감정 변화가 자연스러운가?
   - 갈등 상황에서 적절히 반응하는가?
   - 갑작스러운 감정 변화가 없는가?

3. **참여 품질** (engagementQuality)
   - 대화가 흥미롭고 몰입감 있는가?
   - 유저의 메시지에 적절히 반응하는가?
   - 캐릭터만의 매력이 드러나는가?

JSON으로 응답하세요:
{
  "overallScore": (1-10, 전체 평균),
  "characterConsistency": (1-10),
  "emotionalCoherence": (1-10),
  "engagementQuality": (1-10),
  "analysis": "전체 분석 (2-3문장, 한국어)",
  "strengths": ["강점1", "강점2"],
  "weaknesses": ["약점1", "약점2"],
  "suggestions": ["개선제안1", "개선제안2"]
}`;

  const response = await callOpenRouter(EVALUATOR_MODEL, [
    { role: 'user', content: prompt }
  ], { temperature: 0.3, maxTokens: 4000 });

  try {
    // 코드 블록 제거 (```json ... ```)
    let cleanedResponse = response
      .replace(/```json\s*/gi, '')
      .replace(/```\s*/g, '')
      .trim();

    // JSON 시작 위치 찾기
    const jsonStart = cleanedResponse.indexOf('{');
    if (jsonStart !== -1) {
      let jsonStr = cleanedResponse.substring(jsonStart);

      // 먼저 JSON 파싱 시도
      try {
        return JSON.parse(jsonStr);
      } catch {
        // 파싱 실패 시 수동 수정 시도
      }

      // 불완전한 JSON 수정: 열린 따옴표 개수 세기
      const quoteCount = (jsonStr.match(/"/g) || []).length;
      if (quoteCount % 2 !== 0) {
        // 홀수면 따옴표 하나 추가
        jsonStr += '"';
      }

      // 불완전한 JSON 수정 시도: 배열 닫기
      const openBrackets = (jsonStr.match(/\[/g) || []).length;
      const closeBrackets = (jsonStr.match(/\]/g) || []).length;
      if (openBrackets > closeBrackets) {
        jsonStr += ']'.repeat(openBrackets - closeBrackets);
      }

      // 불완전한 JSON 수정 시도: 객체 닫기
      const openBraces = (jsonStr.match(/\{/g) || []).length;
      const closeBraces = (jsonStr.match(/\}/g) || []).length;
      if (openBraces > closeBraces) {
        jsonStr += '}'.repeat(openBraces - closeBraces);
      }

      return JSON.parse(jsonStr);
    } else {
      console.error('평가 JSON 매칭 실패. 응답:', response.substring(0, 300));
    }
  } catch (e) {
    console.error('평가 파싱 실패:', e);
    console.error('응답 내용:', response.substring(0, 500));
  }

  return {
    overallScore: 5,
    characterConsistency: 5,
    emotionalCoherence: 5,
    engagementQuality: 5,
    analysis: '평가 파싱 실패',
    strengths: [],
    weaknesses: [],
    suggestions: [],
  };
}

// ============================================
// 대화 세션 실행
// ============================================

async function runConversationSession(
  userPersona: SimulatedUserPersona,
  turns: number
): Promise<{
  conversation: Array<{ role: 'user' | 'persona'; content: string }>;
  evaluation: EvaluationResult;
  finalState: ConversationState;
}> {
  console.log(`\n${'─'.repeat(60)}`);
  console.log(`👤 유저 페르소나: ${userPersona.name}`);
  console.log(`📝 목표: ${userPersona.goals[0]}`);
  console.log(`${'─'.repeat(60)}\n`);

  let state = createInitialState();

  for (let turn = 1; turn <= turns; turn++) {
    // 1. 유저 메시지 생성
    const userMessage = await generateUserMessage(
      userPersona,
      state.messages,
      turn,
      turns
    );

    console.log(`[턴 ${turn}/${turns}]`);
    console.log(`  👤 유저: ${userMessage}`);

    state.messages.push({ role: 'user', content: userMessage });

    // 2. AI 페르소나 응답 생성
    const personaResponse = await generatePersonaResponse(state, userMessage);

    console.log(`  🎭 하은: ${personaResponse}`);

    state.messages.push({ role: 'persona', content: personaResponse });

    // 3. 상태 업데이트
    state = analyzeAndUpdateState(state, userMessage, personaResponse);

    if (state.emotionalContext.hasUnresolvedConflict) {
      console.log(`  ⚠️ 갈등 감지! (tension: ${state.tensionLevel})`);
    }

    console.log('');
  }

  // 4. 대화 평가
  console.log('📊 대화 평가 중...\n');
  const evaluation = await evaluateConversation(state.messages, userPersona.description);

  return {
    conversation: state.messages,
    evaluation,
    finalState: state,
  };
}

// ============================================
// 결과 저장
// ============================================

interface TestResult {
  timestamp: string;
  userPersona: string;
  turns: number;
  conversation: Array<{ role: string; content: string }>;
  evaluation: EvaluationResult;
  models: {
    userLLM: string;
    personaLLM: string;
    evaluator: string;
  };
}

function saveResults(results: TestResult[]): string {
  if (!fs.existsSync(RESULTS_DIR)) {
    fs.mkdirSync(RESULTS_DIR, { recursive: true });
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const filename = `dynamic-test-${timestamp}.json`;
  const filepath = path.join(RESULTS_DIR, filename);

  fs.writeFileSync(filepath, JSON.stringify(results, null, 2), 'utf-8');

  // Markdown 리포트도 생성
  const mdFilename = `dynamic-test-${timestamp}.md`;
  const mdFilepath = path.join(RESULTS_DIR, mdFilename);

  let md = `# 동적 대화 테스트 결과\n\n`;
  md += `📅 **테스트 시간**: ${new Date().toLocaleString('ko-KR')}\n\n`;

  const avgScore = results.reduce((sum, r) => sum + r.evaluation.overallScore, 0) / results.length;
  md += `## 📊 종합 점수: ${avgScore.toFixed(1)}/10\n\n`;

  for (const result of results) {
    md += `---\n\n`;
    md += `### 👤 ${result.userPersona}\n\n`;
    md += `| 항목 | 점수 |\n`;
    md += `|------|------|\n`;
    md += `| 캐릭터 일관성 | ${result.evaluation.characterConsistency}/10 |\n`;
    md += `| 감정 일관성 | ${result.evaluation.emotionalCoherence}/10 |\n`;
    md += `| 참여 품질 | ${result.evaluation.engagementQuality}/10 |\n`;
    md += `| **종합** | **${result.evaluation.overallScore}/10** |\n\n`;

    md += `**분석**: ${result.evaluation.analysis}\n\n`;

    if (result.evaluation.strengths?.length > 0) {
      md += `**강점**:\n`;
      result.evaluation.strengths.forEach(s => md += `- ${s}\n`);
      md += `\n`;
    }

    if (result.evaluation.weaknesses?.length > 0) {
      md += `**약점**:\n`;
      result.evaluation.weaknesses.forEach(w => md += `- ${w}\n`);
      md += `\n`;
    }

    md += `**대화 내용**:\n\`\`\`\n`;
    result.conversation.forEach(m => {
      const role = m.role === 'user' ? '👤 유저' : '🎭 하은';
      md += `${role}: ${m.content}\n`;
    });
    md += `\`\`\`\n\n`;
  }

  fs.writeFileSync(mdFilepath, md, 'utf-8');

  return filepath;
}

// ============================================
// 메인 실행
// ============================================

async function main() {
  const args = process.argv.slice(2);
  const turns = parseInt(args.find(a => a.startsWith('--turns='))?.split('=')[1] || String(DEFAULT_TURNS));
  const userType = args.find(a => a.startsWith('--user='))?.split('=')[1];

  console.log('╔════════════════════════════════════════════════════════════════════╗');
  console.log('║       🎭 동적 대화 테스트 시스템 (LLM 유저 페르소나)               ║');
  console.log('╚════════════════════════════════════════════════════════════════════╝');
  console.log('');
  console.log(`  📌 유저 LLM: ${USER_LLM_MODEL}`);
  console.log(`  📌 페르소나 LLM: ${PERSONA_LLM_MODEL}`);
  console.log(`  📌 평가 LLM: ${EVALUATOR_MODEL}`);
  console.log(`  📌 대화 턴 수: ${turns}`);
  console.log('');

  const results: TestResult[] = [];

  // 테스트할 유저 페르소나 선택
  const selectedPersonas = userType
    ? USER_PERSONAS.filter(p => p.type === userType)
    : USER_PERSONAS;

  if (selectedPersonas.length === 0) {
    console.log(`❌ 유저 타입 '${userType}'을 찾을 수 없습니다.`);
    console.log(`   사용 가능: ${USER_PERSONAS.map(p => p.type).join(', ')}`);
    process.exit(1);
  }

  for (const userPersona of selectedPersonas) {
    try {
      const { conversation, evaluation } = await runConversationSession(userPersona, turns);

      results.push({
        timestamp: new Date().toISOString(),
        userPersona: userPersona.name,
        turns,
        conversation,
        evaluation,
        models: {
          userLLM: USER_LLM_MODEL,
          personaLLM: PERSONA_LLM_MODEL,
          evaluator: EVALUATOR_MODEL,
        },
      });

      // 결과 출력
      console.log(`${'═'.repeat(60)}`);
      console.log(`📊 평가 결과: ${userPersona.name}`);
      console.log(`${'═'.repeat(60)}`);
      console.log(`  캐릭터 일관성: ${evaluation.characterConsistency}/10`);
      console.log(`  감정 일관성: ${evaluation.emotionalCoherence}/10`);
      console.log(`  참여 품질: ${evaluation.engagementQuality}/10`);
      console.log(`  ────────────────────`);
      console.log(`  종합 점수: ${evaluation.overallScore}/10`);
      console.log(`\n  분석: ${evaluation.analysis}`);
      console.log('');

    } catch (error) {
      console.error(`❌ ${userPersona.name} 테스트 실패:`, error);
    }
  }

  // 결과 저장
  const savedPath = saveResults(results);
  console.log(`\n💾 결과 저장됨: ${savedPath}`);

  // 종합 점수
  const avgScore = results.reduce((sum, r) => sum + r.evaluation.overallScore, 0) / results.length;
  console.log(`\n🎯 종합 평균 점수: ${avgScore.toFixed(1)}/10`);
}

main().catch(console.error);
