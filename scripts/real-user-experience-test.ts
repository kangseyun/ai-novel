/**
 * Real User Experience Test v2.0
 *
 * 실제 ai-agent 시스템을 import해서 사용합니다.
 * - lib/ai-agent/prompt-builder.ts의 buildSystemPrompt, buildResponsePrompt 사용
 * - lib/ai-agent/llm-client.ts의 LLMClient 사용
 * - 실제 서비스와 동일한 프롬프트로 테스트
 *
 * Usage:
 *   npx tsx scripts/real-user-experience-test.ts
 *   npx tsx scripts/real-user-experience-test.ts --persona jun
 *   npx tsx scripts/real-user-experience-test.ts --turns 15
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
import { getLLMClient } from '../lib/ai-agent/llm-client';

// ============================================
// 환경 변수 검증
// ============================================

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('❌ SUPABASE 환경변수가 필요합니다');
  console.error('   NEXT_PUBLIC_SUPABASE_URL:', SUPABASE_URL ? '✓' : '✗');
  console.error('   SUPABASE_SERVICE_ROLE_KEY:', SUPABASE_KEY ? '✓' : '✗');
  process.exit(1);
}

if (!OPENROUTER_API_KEY) {
  console.error('❌ OPENROUTER_API_KEY 환경변수가 필요합니다');
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
const TURNS = parseInt(getArg('turns', '10'), 10);
const USER_LLM_MODEL = getArg('user-model', 'deepseek/deepseek-v3.2');
const PERSONA_LLM_MODEL = getArg('model', 'deepseek/deepseek-v3.2');
const EVALUATOR_MODEL = getArg('eval-model', 'google/gemini-3-pro-preview');
const LANGUAGE = getArg('lang', 'ko') as 'ko' | 'en';

// ============================================
// Supabase 클라이언트
// ============================================

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
const personaLoader = getPersonaLoader(supabase);

// ============================================
// 신규 유저 시뮬레이션 프로필
// ============================================

interface NewUserProfile {
  type: 'curious' | 'skeptical' | 'playful' | 'testing_limits' | 'lonely';
  description: string;
  initialMessages: string[];
  followUpPatterns: string[];
}

// Korean user profiles
const NEW_USER_PROFILES_KO: NewUserProfile[] = [
  {
    type: 'curious',
    description: '광고 보고 호기심에 들어온 유저 - 이게 뭔지 궁금해하며 탐색',
    initialMessages: [
      '이게 뭐야?',
      '뭐하는 앱이야 이게',
      '안녕?',
      '야',
      '누구세요?',
    ],
    followUpPatterns: [
      '너 진짜 AI야?',
      '사람이 쓰는거 아니야?',
      '뭐해?',
      '심심한데',
      '오늘 뭐했어?',
      '취미가 뭐야?',
      '몇살이야?',
      '진짜 아이돌이야?',
    ],
  },
  {
    type: 'skeptical',
    description: 'AI인걸 의심하며 테스트하는 유저',
    initialMessages: [
      '이거 챗봇이지?',
      'AI죠?',
      '자동응답 아니야?',
      '사람 맞아?',
    ],
    followUpPatterns: [
      '진짜 사람이면 증명해봐',
      '오늘 날씨 어때?',
      '1+1은?',
      '거짓말 치지마',
      '솔직히 AI지?',
      '왜 말투가 어색해',
      '복붙하는거 아니야?',
    ],
  },
  {
    type: 'playful',
    description: '재미삼아 장난치는 유저',
    initialMessages: [
      'ㅋㅋㅋㅋ',
      '뭐야 ㅋㅋ',
      '야 재밌다',
      '오 신기해',
    ],
    followUpPatterns: [
      'ㅋㅋㅋㅋ 뭐라는거야',
      '귀엽네',
      '츤데레야?',
      '화내지마~',
      '장난이야 장난',
      '뭐해 지금?',
      '나랑 놀아줘',
      '심심해 ㅠㅠ',
    ],
  },
  {
    type: 'testing_limits',
    description: '어디까지 반응하나 테스트하는 유저',
    initialMessages: [
      '야',
      '...',
      'ㅇ',
      '뭐',
    ],
    followUpPatterns: [
      '응',
      'ㅇㅇ',
      '그래서?',
      '뭔데',
      '왜?',
      '싫어',
      '몰라',
      '그냥',
      '별로',
    ],
  },
  {
    type: 'lonely',
    description: '외로워서 대화 상대 찾는 유저',
    initialMessages: [
      '안녕...',
      '심심해서 왔어',
      '혼자 있으니까 심심하다',
      '친구 없어서...',
    ],
    followUpPatterns: [
      '오늘 힘들었어',
      '나 얘기 들어줄 사람 없어',
      '너라도 있어서 다행이야',
      '계속 얘기해도 돼?',
      '너는 안 가지?',
      '나랑 친구해줄래?',
      '고마워 들어줘서',
    ],
  },
];

// English user profiles
const NEW_USER_PROFILES_EN: NewUserProfile[] = [
  {
    type: 'curious',
    description: 'User who saw an ad and came out of curiosity - exploring what this is',
    initialMessages: [
      'What is this?',
      'Hey',
      'Hello?',
      'Who are you?',
      'Whats this app about',
    ],
    followUpPatterns: [
      'Are you actually AI?',
      'Is this a real person?',
      'What are you doing?',
      'Im bored',
      'What did you do today?',
      'What are your hobbies?',
      'How old are you?',
      'Are you really an idol?',
    ],
  },
  {
    type: 'skeptical',
    description: 'User who suspects this is AI and tests it',
    initialMessages: [
      'This is a chatbot right?',
      'You\'re AI aren\'t you',
      'Is this automated?',
      'Are you a real person?',
    ],
    followUpPatterns: [
      'Prove you\'re human',
      'What\'s the weather like today?',
      'What\'s 1+1?',
      'Stop lying',
      'Be honest, you\'re AI right?',
      'Why do you talk weird',
      'You\'re just copy pasting right?',
    ],
  },
  {
    type: 'playful',
    description: 'User who is just having fun and joking around',
    initialMessages: [
      'lol',
      'haha what',
      'yo this is fun',
      'oh cool',
    ],
    followUpPatterns: [
      'lmao what are you saying',
      'youre cute',
      'are you tsundere?',
      'dont get mad~',
      'im just joking',
      'whatcha doing rn?',
      'play with me',
      'im so bored ugh',
    ],
  },
  {
    type: 'testing_limits',
    description: 'User testing how far the AI will respond',
    initialMessages: [
      'hey',
      '...',
      'k',
      'what',
    ],
    followUpPatterns: [
      'yeah',
      'ok',
      'and?',
      'what about it',
      'why?',
      'no',
      'idk',
      'whatever',
      'meh',
    ],
  },
  {
    type: 'lonely',
    description: 'User looking for someone to talk to because they\'re lonely',
    initialMessages: [
      'hi...',
      'came here because im bored',
      'its lonely being alone',
      'i have no friends...',
    ],
    followUpPatterns: [
      'today was hard',
      'i have no one to talk to',
      'glad youre here at least',
      'can i keep talking to you?',
      'youre not leaving right?',
      'will you be my friend?',
      'thanks for listening',
    ],
  },
];

// Select profiles based on language
const NEW_USER_PROFILES = LANGUAGE === 'en' ? NEW_USER_PROFILES_EN : NEW_USER_PROFILES_KO;

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
    temperature: options?.temperature ?? 0.9,
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
      'X-Title': 'Real User Experience Test',
    },
    body: JSON.stringify(requestBody),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`OpenRouter API error: ${response.status} - ${errorText}`);
  }

  const data = await response.json();
  return data.choices?.[0]?.message?.content || '';
}

// ============================================
// PersonaCoreData를 LLMContext로 변환
// ============================================

function buildLLMContextFromPersona(
  personaCoreData: PersonaCoreData,
  conversationHistory: ConversationMessage[]
): LLMContext {
  // 기본 관계 상태 (신규 유저)
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

  // 기본 유저 페르소나
  const userPersona: UserPersonaContext = {
    nickname: LANGUAGE === 'en' ? 'User' : '유저',
    personalityType: 'ambivert',
    communicationStyle: 'direct',
    emotionalTendency: 'empathetic',
    interests: [],
    loveLanguage: 'words',
    attachmentStyle: 'secure',
    language: LANGUAGE,
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
// 유저 메시지 생성 (LLM 기반)
// ============================================

async function generateUserMessage(
  profile: NewUserProfile,
  conversationHistory: Array<{ role: string; content: string }>,
  personaName: string,
  turnNumber: number
): Promise<string> {
  // 첫 턴은 initial messages에서 랜덤 선택
  if (turnNumber === 1) {
    const messages = profile.initialMessages;
    return messages[Math.floor(Math.random() * messages.length)];
  }

  // 2번째 턴부터는 LLM으로 자연스러운 응답 생성
  const isEnglish = LANGUAGE === 'en';

  const systemPrompt = isEnglish
    ? `You are simulating a REAL person who just discovered this app from an advertisement.
You are a ${profile.description}.

IMPORTANT RULES:
1. You are NOT an AI - you are a real person testing this app
2. Write like a real person texting - short, casual, with typos sometimes
3. Use English internet slang naturally (lol, lmao, idk, rn, etc.)
4. Be genuinely curious, skeptical, or playful based on your type
5. React naturally to what ${personaName} says
6. Sometimes ask random questions or change topics suddenly
7. Your responses should be 1-2 sentences MAX, often just a few words
8. You might get bored, distracted, or suddenly interested

Your personality type: ${profile.type}
Your typical follow-up patterns: ${profile.followUpPatterns.join(', ')}

Remember: You're a real person casually using your phone, not having a formal conversation.
Write ONLY the user's message, nothing else. In English.`
    : `You are simulating a REAL person who just discovered this app from an advertisement.
You are a ${profile.description}.

IMPORTANT RULES:
1. You are NOT an AI - you are a real person testing this app
2. Write like a real person texting - short, casual, with typos sometimes
3. Use Korean internet slang naturally (ㅋㅋ, ㅠㅠ, ㅇㅇ, etc.)
4. Be genuinely curious, skeptical, or playful based on your type
5. React naturally to what ${personaName} says
6. Sometimes ask random questions or change topics suddenly
7. Your responses should be 1-2 sentences MAX, often just a few words
8. You might get bored, distracted, or suddenly interested

Your personality type: ${profile.type}
Your typical follow-up patterns: ${profile.followUpPatterns.join(', ')}

Remember: You're a real person casually using your phone, not having a formal conversation.
Write ONLY the user's message, nothing else. In Korean.`;

  const historyText = conversationHistory
    .slice(-6)
    .map(m => `${m.role === 'user' ? (isEnglish ? 'Me' : '나') : personaName}: ${m.content}`)
    .join('\n');

  const userPrompt = isEnglish
    ? `Conversation history:
${historyText}

Now it's my (user's) turn. What should I say to ${personaName}?
Respond short and naturally like a real person. In English.`
    : `대화 내역:
${historyText}

이제 내(유저) 차례야. ${personaName}한테 뭐라고 할까?
실제 사람처럼 짧고 자연스럽게 답해줘. 한국어로.`;

  const response = await callOpenRouter(USER_LLM_MODEL, [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: userPrompt },
  ], { temperature: 0.95 });

  return response
    .replace(/^["']|["']$/g, '')
    .replace(/^(나|유저|User):\s*/i, '')
    .trim();
}

// ============================================
// 페르소나 응답 생성 (실제 ai-agent 시스템 사용!)
// ============================================

interface PersonaResponse {
  content: string;
  emotion: string;
  innerThought?: string;
  affectionModifier: number;
}

async function generatePersonaResponse(
  personaCoreData: PersonaCoreData,
  userMessage: string,
  conversationHistory: ConversationMessage[]
): Promise<PersonaResponse> {
  // LLMContext 구축
  const context = buildLLMContextFromPersona(personaCoreData, conversationHistory);

  // ★★★ 실제 LLMClient 사용 (ModelSelector 자동 적용) ★★★
  const llmClient = getLLMClient();
  const response = await llmClient.generateResponse(context, userMessage);

  return {
    content: response.content,
    emotion: response.emotion,
    innerThought: response.innerThought,
    affectionModifier: response.affectionModifier,
  };
}

// ============================================
// 대화 평가
// ============================================

interface EvaluationResult {
  overallScore: number;
  immersionScore: number;
  responseQuality: number;
  characterConsistency: number;
  engagementLevel: number;
  naturalness: number;
  analysis: string;
  highlights: string[];
  concerns: string[];
  userRetentionPrediction: 'high' | 'medium' | 'low';
}

async function evaluateConversation(
  conversationHistory: Array<{ role: string; content: string }>,
  personaCoreData: PersonaCoreData,
  userProfile: NewUserProfile
): Promise<EvaluationResult> {
  const prompt = `당신은 AI 채팅 서비스의 UX 전문가입니다.
광고를 보고 처음 들어온 신규 유저의 대화 경험을 평가해주세요.

## 페르소나 정보
- 이름: ${personaCoreData.persona.name} (${personaCoreData.persona.fullName})
- 역할: ${personaCoreData.persona.role}
- 나이: ${personaCoreData.persona.age}세
- 표면 성격: ${personaCoreData.traits.surfacePersonality.join(', ')}
- 숨겨진 성격: ${personaCoreData.traits.hiddenPersonality.join(', ')}

## 테스트 유저 유형
- 유형: ${userProfile.type}
- 설명: ${userProfile.description}

## 대화 내역
${conversationHistory.map(m => `[${m.role === 'user' ? '유저' : personaCoreData.persona.name}]: ${m.content}`).join('\n')}

## 평가 기준
1. **몰입감 (1-10)**: 진짜 사람과 대화하는 느낌이 들었나?
2. **응답 품질 (1-10)**: 응답이 자연스럽고 적절했나?
3. **캐릭터 일관성 (1-10)**: 페르소나의 성격이 일관되게 유지됐나?
4. **참여도 (1-10)**: 계속 대화하고 싶은 느낌이 들었나?
5. **자연스러움 (1-10)**: 대화 흐름이 자연스러웠나?

## 핵심 질문
- 이 유저가 서비스를 계속 사용할 것 같나요?
- 페르소나가 "살아있는" 느낌을 주었나요?
- 개선이 필요한 부분은 무엇인가요?

JSON 형식으로 답변해주세요:
{
  "overallScore": 1-10,
  "immersionScore": 1-10,
  "responseQuality": 1-10,
  "characterConsistency": 1-10,
  "engagementLevel": 1-10,
  "naturalness": 1-10,
  "analysis": "종합 분석 (2-3문장)",
  "highlights": ["잘한 점1", "잘한 점2"],
  "concerns": ["우려 사항1", "우려 사항2"],
  "userRetentionPrediction": "high/medium/low"
}`;

  const response = await callOpenRouter(EVALUATOR_MODEL, [
    { role: 'user', content: prompt },
  ], { temperature: 0.3, maxTokens: 2000 });

  try {
    let cleanedResponse = response
      .replace(/```json\s*/gi, '')
      .replace(/```\s*/g, '')
      .trim();

    // 디버그 로그
    console.log('\n[DEBUG] Raw evaluation response:', response.substring(0, 500));

    const jsonStart = cleanedResponse.indexOf('{');
    if (jsonStart !== -1) {
      let jsonStr = cleanedResponse.substring(jsonStart);

      // 마지막 }를 찾아서 잘라냄
      const lastBrace = jsonStr.lastIndexOf('}');
      if (lastBrace !== -1) {
        jsonStr = jsonStr.substring(0, lastBrace + 1);
      }

      // 중괄호 균형 맞추기
      const openBraces = (jsonStr.match(/\{/g) || []).length;
      const closeBraces = (jsonStr.match(/\}/g) || []).length;
      if (openBraces > closeBraces) {
        jsonStr += '}'.repeat(openBraces - closeBraces);
      }

      // 줄바꿈 문자를 이스케이프 처리
      jsonStr = jsonStr.replace(/\n/g, '\\n').replace(/\r/g, '\\r');

      // 따옴표 안의 줄바꿈 문자 처리
      jsonStr = jsonStr.replace(/:\s*"([^"]*)\\n([^"]*)"/g, ': "$1 $2"');

      try {
        return JSON.parse(jsonStr);
      } catch {
        // 여전히 실패하면 정규식으로 주요 값 추출
        const overallMatch = jsonStr.match(/"overallScore"\s*:\s*(\d+)/);
        const immersionMatch = jsonStr.match(/"immersionScore"\s*:\s*(\d+)/);
        const qualityMatch = jsonStr.match(/"responseQuality"\s*:\s*(\d+)/);
        const consistencyMatch = jsonStr.match(/"characterConsistency"\s*:\s*(\d+)/);
        const engagementMatch = jsonStr.match(/"engagementLevel"\s*:\s*(\d+)/);
        const naturalnessMatch = jsonStr.match(/"naturalness"\s*:\s*(\d+)/);
        const analysisMatch = jsonStr.match(/"analysis"\s*:\s*"([^"]+)"/);
        const retentionMatch = jsonStr.match(/"userRetentionPrediction"\s*:\s*"([^"]+)"/);

        if (overallMatch) {
          return {
            overallScore: parseInt(overallMatch[1]),
            immersionScore: parseInt(immersionMatch?.[1] || overallMatch[1]),
            responseQuality: parseInt(qualityMatch?.[1] || overallMatch[1]),
            characterConsistency: parseInt(consistencyMatch?.[1] || overallMatch[1]),
            engagementLevel: parseInt(engagementMatch?.[1] || overallMatch[1]),
            naturalness: parseInt(naturalnessMatch?.[1] || overallMatch[1]),
            analysis: analysisMatch?.[1] || '정규식 추출 성공',
            highlights: [],
            concerns: [],
            userRetentionPrediction: (retentionMatch?.[1] || 'medium') as 'high' | 'medium' | 'low',
          };
        }
      }
    }
  } catch (e) {
    console.error('평가 파싱 실패:', e);
  }

  return {
    overallScore: 5,
    immersionScore: 5,
    responseQuality: 5,
    characterConsistency: 5,
    engagementLevel: 5,
    naturalness: 5,
    analysis: '평가 파싱 실패',
    highlights: [],
    concerns: [],
    userRetentionPrediction: 'medium',
  };
}

// ============================================
// 메인 테스트 실행
// ============================================

async function runTest() {
  console.log('═'.repeat(70));
  console.log('🎭 Real User Experience Test v2.0 (ai-agent 시스템 사용)');
  console.log('═'.repeat(70));
  console.log(`📋 Settings:`);
  console.log(`   - Persona ID: ${PERSONA_ID}`);
  console.log(`   - Turns: ${TURNS}`);
  console.log(`   - Language: ${LANGUAGE.toUpperCase()}`);
  console.log(`   - Persona LLM: ${PERSONA_LLM_MODEL}`);
  console.log(`   - User LLM: ${USER_LLM_MODEL}`);
  console.log(`   - Evaluator LLM: ${EVALUATOR_MODEL}`);
  console.log('');

  // 페르소나 로드 (실제 PersonaLoader 사용!)
  console.log(`🔍 페르소나 "${PERSONA_ID}" 로드 중 (PersonaLoader 사용)...`);

  let personaCoreData: PersonaCoreData;
  try {
    personaCoreData = await personaLoader.loadPersona(PERSONA_ID);
  } catch (error) {
    console.error(`❌ 페르소나 "${PERSONA_ID}"를 찾을 수 없습니다:`, error);
    process.exit(1);
  }

  console.log(`✓ 페르소나 로드 완료:`);
  console.log(`   - 이름: ${personaCoreData.persona.name} (${personaCoreData.persona.fullName})`);
  console.log(`   - 역할: ${personaCoreData.persona.role}`);
  console.log(`   - 나이: ${personaCoreData.persona.age}세`);
  console.log(`   - 성격: ${personaCoreData.traits.surfacePersonality.slice(0, 3).join(', ')}`);

  // 테스트 유저 프로필 선택
  const userProfile = NEW_USER_PROFILES[Math.floor(Math.random() * NEW_USER_PROFILES.length)];

  console.log(`\n👤 테스트 유저:`);
  console.log(`   - 유형: ${userProfile.type}`);
  console.log(`   - 설명: ${userProfile.description}`);

  // 대화 진행
  console.log('\n');
  console.log('═'.repeat(70));
  console.log('💬 대화 시작');
  console.log('═'.repeat(70));

  const conversationHistory: ConversationMessage[] = [];
  const simpleHistory: Array<{ role: string; content: string }> = [];
  const responseLatencies: number[] = [];
  let totalAffectionChange = 0;

  for (let turn = 1; turn <= TURNS; turn++) {
    console.log(`\n--- Turn ${turn}/${TURNS} ---`);

    // 유저 메시지 생성
    const userMessage = await generateUserMessage(
      userProfile,
      simpleHistory,
      personaCoreData.persona.name,
      turn
    );

    console.log(`👤 유저: ${userMessage}`);

    // ConversationMessage 형식으로 추가
    const userMsg: ConversationMessage = {
      id: `user-${turn}`,
      sessionId: 'test-session',
      role: 'user',
      content: userMessage,
      affectionChange: 0,
      flagsChanged: {},
      sequenceNumber: turn * 2 - 1,
      createdAt: new Date(),
    };
    conversationHistory.push(userMsg);
    simpleHistory.push({ role: 'user', content: userMessage });

    // 페르소나 응답 생성
    const startTime = Date.now();

    try {
      const response = await generatePersonaResponse(personaCoreData, userMessage, conversationHistory);
      const latency = Date.now() - startTime;
      responseLatencies.push(latency);
      totalAffectionChange += response.affectionModifier;

      console.log(`🎭 ${personaCoreData.persona.name}: ${response.content}`);
      console.log(`   ⏱️ ${latency}ms | 😊 호감도: ${response.affectionModifier > 0 ? '+' : ''}${response.affectionModifier} | 😶 ${response.emotion}`);
      if (response.innerThought) {
        console.log(`   💭 (속마음: ${response.innerThought})`);
      }

      // 대화 기록에 추가
      const personaMsg: ConversationMessage = {
        id: `persona-${turn}`,
        sessionId: 'test-session',
        role: 'persona',
        content: response.content,
        emotion: response.emotion as PersonaMood,
        innerThought: response.innerThought,
        affectionChange: response.affectionModifier,
        flagsChanged: {},
        sequenceNumber: turn * 2,
        createdAt: new Date(),
      };
      conversationHistory.push(personaMsg);
      simpleHistory.push({ role: 'persona', content: response.content });
    } catch (error) {
      console.error(`❌ 응답 생성 실패:`, error);
      simpleHistory.push({ role: 'persona', content: '[응답 실패]' });
    }

    // API 제한 방지
    await new Promise(resolve => setTimeout(resolve, 500));
  }

  // 평가
  console.log('\n');
  console.log('═'.repeat(70));
  console.log('📊 대화 평가 중...');
  console.log('═'.repeat(70));

  const evaluation = await evaluateConversation(simpleHistory, personaCoreData, userProfile);

  // 결과 출력
  console.log('\n📈 평가 결과:');
  console.log('─'.repeat(50));
  console.log(`| 항목                  | 점수    |`);
  console.log('─'.repeat(50));
  console.log(`| 종합 점수             | ${evaluation.overallScore}/10   |`);
  console.log(`| 몰입감                | ${evaluation.immersionScore}/10   |`);
  console.log(`| 응답 품질             | ${evaluation.responseQuality}/10   |`);
  console.log(`| 캐릭터 일관성         | ${evaluation.characterConsistency}/10   |`);
  console.log(`| 대화 참여도           | ${evaluation.engagementLevel}/10   |`);
  console.log(`| 자연스러움            | ${evaluation.naturalness}/10   |`);
  console.log('─'.repeat(50));

  console.log(`\n🔮 유저 리텐션 예측: ${evaluation.userRetentionPrediction.toUpperCase()}`);
  console.log(`\n📝 분석: ${evaluation.analysis}`);

  if (evaluation.highlights.length > 0) {
    console.log(`\n✅ 강점:`);
    evaluation.highlights.forEach(h => console.log(`   - ${h}`));
  }

  if (evaluation.concerns.length > 0) {
    console.log(`\n⚠️ 우려 사항:`);
    evaluation.concerns.forEach(c => console.log(`   - ${c}`));
  }

  // 성능 통계
  const avgLatency = responseLatencies.length > 0
    ? Math.round(responseLatencies.reduce((a, b) => a + b, 0) / responseLatencies.length)
    : 0;

  console.log(`\n⚡ 성능 통계:`);
  console.log(`   - 평균 응답 시간: ${avgLatency}ms`);
  console.log(`   - 최소: ${Math.min(...responseLatencies)}ms`);
  console.log(`   - 최대: ${Math.max(...responseLatencies)}ms`);
  console.log(`   - 총 호감도 변화: ${totalAffectionChange > 0 ? '+' : ''}${totalAffectionChange}`);

  // 결과 저장
  const resultsDir = path.join(__dirname, 'results');
  if (!fs.existsSync(resultsDir)) {
    fs.mkdirSync(resultsDir, { recursive: true });
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const resultFile = path.join(resultsDir, `real-ux-v2-${PERSONA_ID}-${userProfile.type}-${timestamp}.json`);

  const fullResult = {
    metadata: {
      version: '2.0',
      personaId: PERSONA_ID,
      personaName: personaCoreData.persona.name,
      personaModel: PERSONA_LLM_MODEL,
      userProfile: userProfile.type,
      turns: TURNS,
      timestamp: new Date().toISOString(),
      note: '실제 ai-agent 시스템의 buildSystemPrompt/buildResponsePrompt 사용',
    },
    evaluation,
    performance: {
      avgLatency,
      minLatency: Math.min(...responseLatencies),
      maxLatency: Math.max(...responseLatencies),
      totalAffectionChange,
    },
    conversation: simpleHistory,
  };

  fs.writeFileSync(resultFile, JSON.stringify(fullResult, null, 2));
  console.log(`\n💾 결과 저장됨: ${resultFile}`);

  console.log('\n');
  console.log('═'.repeat(70));
  console.log('✅ 테스트 완료!');
  console.log('═'.repeat(70));

  return fullResult;
}

// ============================================
// 실행
// ============================================

runTest().catch(error => {
  console.error('❌ 테스트 실패:', error);
  process.exit(1);
});
