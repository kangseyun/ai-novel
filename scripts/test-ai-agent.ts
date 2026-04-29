/**
 * AI Agent 통합 테스트
 * 페르소나가 실제로 사람처럼 동작하는지 검증
 *
 * 실행: npx ts-node scripts/test-ai-agent.ts
 */

import { config } from 'dotenv';
config({ path: '.env.local' });

import { createClient } from '@supabase/supabase-js';
import { AIAgent } from '../lib/ai-agent/ai-agent';
import { PersonaLoader } from '../lib/ai-agent/persona-loader';
import { LLMClient } from '../lib/ai-agent/llm-client';
import { buildSystemPrompt, buildResponsePrompt } from '../lib/ai-agent/prompt-builder';
import type { LLMContext, RelationshipState, PersonaTraits, PersonaWorldview, Persona } from '../lib/ai-agent/types';

// ============================================
// 테스트 설정
// ============================================

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('❌ 환경 변수가 설정되지 않았습니다.');
  console.error('   NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY 확인 필요');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// ============================================
// 테스트 유틸리티
// ============================================

function log(emoji: string, message: string, data?: unknown) {
  console.log(`\n${emoji} ${message}`);
  if (data) {
    console.log(JSON.stringify(data, null, 2));
  }
}

function logSection(title: string) {
  console.log('\n' + '='.repeat(60));
  console.log(`  ${title}`);
  console.log('='.repeat(60));
}

// ============================================
// 테스트 1: 페르소나 로딩 테스트
// ============================================

async function testPersonaLoading() {
  logSection('테스트 1: 페르소나 로딩');

  const loader = new PersonaLoader(supabase);

  // DB에서 페르소나 목록 조회
  const { data: personas, error } = await supabase
    .from('personas')
    .select('id, name')
    .limit(5);

  if (error || !personas?.length) {
    log('⚠️', 'DB에 페르소나가 없습니다. 기본 페르소나로 테스트합니다.');
    return null;
  }

  log('📋', `발견된 페르소나: ${personas.length}개`);

  // 첫 번째 페르소나 로드
  const testPersonaId = personas[0].id;
  log('🔍', `페르소나 로딩 테스트: ${personas[0].name} (${testPersonaId})`);

  try {
    const personaData = await loader.loadPersona(testPersonaId);

    log('✅', '페르소나 로딩 성공', {
      name: personaData.persona.name,
      role: personaData.persona.role,
      age: personaData.persona.age,
      coreTrope: personaData.traits.coreTrope,
      surfacePersonality: personaData.traits.surfacePersonality,
      formality: personaData.traits.speechPatterns.formality,
    });

    // 캐시 테스트
    const start = Date.now();
    await loader.loadPersona(testPersonaId);
    const cacheTime = Date.now() - start;
    log('⚡', `캐시 히트 시간: ${cacheTime}ms`);

    return { personaId: testPersonaId, personaData };
  } catch (error) {
    log('❌', '페르소나 로딩 실패', error);
    return null;
  }
}

// ============================================
// 테스트 2: 프롬프트 생성 테스트
// ============================================

async function testPromptGeneration(personaData: {
  persona: Persona;
  traits: PersonaTraits;
  worldview: PersonaWorldview;
}) {
  logSection('테스트 2: 프롬프트 생성');

  // Mock 관계 상태
  const mockRelationship: RelationshipState = {
    oduserId: 'test-user',
    personaId: personaData.persona.id,
    affection: 30,
    relationshipStage: 'fan',
    trustLevel: 20,
    intimacyLevel: 10,
    tensionLevel: 0,
    completedEpisodes: [],
    unlockedEpisodes: [],
    storyFlags: {},
    memorableMoments: [],
    lastInteractionAt: null,
  };

  // Mock LLM 컨텍스트
  const mockContext: LLMContext = {
    persona: personaData.persona,
    traits: personaData.traits,
    worldview: personaData.worldview,
    relationship: mockRelationship,
    userPersona: {
      nickname: '당신',
      personalityType: 'warm',
      communicationStyle: 'casual',
      emotionalTendency: 'stable',
      interests: ['music', 'movies'],
      loveLanguage: 'words_of_affirmation',
      attachmentStyle: 'secure',
      language: 'ko',
    },
    conversationHistory: [],
    currentSituation: '첫 대화 시작',
    emotionalState: {
      personaMood: 'neutral',
      tensionLevel: 0,
      vulnerabilityShown: false,
    },
  };

  // 시스템 프롬프트 생성
  const systemPrompt = buildSystemPrompt(mockContext);
  log('📝', `시스템 프롬프트 길이: ${systemPrompt.length}자`);

  // 프롬프트 내용 검증
  const checks = {
    '페르소나 이름 포함': systemPrompt.includes(personaData.persona.name),
    '관계 단계 포함': systemPrompt.includes('fan') || systemPrompt.includes('팬'),
    '호감도 포함': systemPrompt.includes('30') || systemPrompt.includes('호감'),
    '말투 가이드 포함': systemPrompt.includes('formality') || systemPrompt.includes('말투'),
  };

  Object.entries(checks).forEach(([check, passed]) => {
    log(passed ? '✅' : '❌', check);
  });

  // 응답 프롬프트 생성
  const responsePrompt = buildResponsePrompt(mockContext, '안녕! 오늘 뭐해?');
  log('📝', `응답 프롬프트 길이: ${responsePrompt.length}자`);

  return { systemPrompt, mockContext };
}

// ============================================
// 테스트 3: LLM 응답 생성 테스트
// ============================================

async function testLLMResponse(
  systemPrompt: string,
  mockContext: LLMContext
) {
  logSection('테스트 3: LLM 응답 생성');

  if (!process.env.OPENROUTER_API_KEY) {
    log('⚠️', 'OPENROUTER_API_KEY가 없습니다. LLM 테스트 스킵.');
    return null;
  }

  try {
    const llmClient = new LLMClient();

    // 테스트 메시지들
    const testMessages = [
      '안녕! 처음 인사하는데 긴장되네',
      '요즘 뭐하고 지내?',
      '나 오늘 힘든 일이 있었어...',
    ];

    for (const userMessage of testMessages) {
      log('💬', `유저 메시지: "${userMessage}"`);

      const start = Date.now();
      const response = await llmClient.generateResponse(mockContext, userMessage);
      const elapsed = Date.now() - start;

      log('🤖', `페르소나 응답 (${elapsed}ms):`, {
        content: response.content.substring(0, 200) + (response.content.length > 200 ? '...' : ''),
        emotion: response.emotion,
        affectionModifier: response.affectionModifier,
        hasInnerThought: !!response.innerThought,
        hasScenarioTrigger: !!response.scenarioTrigger,
      });

      // 응답 품질 체크
      const qualityChecks = {
        '응답 길이 적절 (10자 이상)': response.content.length >= 10,
        '감정 상태 유효': ['neutral', 'happy', 'sad', 'angry', 'flirty', 'vulnerable', 'playful', 'jealous', 'worried', 'excited'].includes(response.emotion),
        '호감도 변화 범위 유효 (-20~20)': response.affectionModifier >= -20 && response.affectionModifier <= 20,
      };

      Object.entries(qualityChecks).forEach(([check, passed]) => {
        log(passed ? '  ✅' : '  ❌', check);
      });
    }

    return true;
  } catch (error) {
    log('❌', 'LLM 응답 생성 실패', error);
    return false;
  }
}

// ============================================
// 테스트 4: 관계 단계별 응답 차이 테스트
// ============================================

async function testRelationshipStages(personaData: {
  persona: Persona;
  traits: PersonaTraits;
  worldview: PersonaWorldview;
}) {
  logSection('테스트 4: 관계 단계별 응답 차이');

  if (!process.env.OPENROUTER_API_KEY) {
    log('⚠️', 'OPENROUTER_API_KEY가 없습니다. 테스트 스킵.');
    return;
  }

  const stages = [
    { stage: 'stranger', affection: 5 },
    { stage: 'fan', affection: 25 },
    { stage: 'friend', affection: 50 },
    { stage: 'close', affection: 70 },
    { stage: 'heart', affection: 95 },
  ] as const;

  const testMessage = '보고 싶었어';
  const llmClient = new LLMClient();

  for (const { stage, affection } of stages) {
    const context: LLMContext = {
      persona: personaData.persona,
      traits: personaData.traits,
      worldview: personaData.worldview,
      relationship: {
        oduserId: 'test-user',
        personaId: personaData.persona.id,
        affection,
        relationshipStage: stage,
        trustLevel: affection * 0.8,
        intimacyLevel: affection * 0.6,
        tensionLevel: 0,
        completedEpisodes: [],
        unlockedEpisodes: [],
        storyFlags: {},
        memorableMoments: [],
        lastInteractionAt: null,
      },
      userPersona: {
        nickname: '당신',
        personalityType: 'warm',
        communicationStyle: 'casual',
        emotionalTendency: 'stable',
        interests: [],
        loveLanguage: 'words_of_affirmation',
        attachmentStyle: 'secure',
        language: 'ko',
      },
      conversationHistory: [],
      currentSituation: `관계 단계: ${stage}`,
      emotionalState: {
        personaMood: 'neutral',
        tensionLevel: 0,
        vulnerabilityShown: false,
      },
    };

    try {
      const response = await llmClient.generateResponse(context, testMessage);
      log('💕', `[${stage}] (호감도 ${affection}): ${response.content.substring(0, 100)}...`);
      log('   ', `감정: ${response.emotion}, 호감도 변화: ${response.affectionModifier > 0 ? '+' : ''}${response.affectionModifier}`);
    } catch (error) {
      log('❌', `[${stage}] 응답 실패`, error);
    }
  }
}

// ============================================
// 테스트 5: 선택지 생성 테스트
// ============================================

async function testChoiceGeneration(mockContext: LLMContext) {
  logSection('테스트 5: 선택지 생성');

  if (!process.env.OPENROUTER_API_KEY) {
    log('⚠️', 'OPENROUTER_API_KEY가 없습니다. 테스트 스킵.');
    return;
  }

  const llmClient = new LLMClient();

  try {
    const choices = await llmClient.generateChoices(
      mockContext,
      '페르소나가 "오늘 뭐 할거야?"라고 물었습니다.',
      3
    );

    log('🎯', `생성된 선택지: ${choices.length}개`);

    choices.forEach((choice, i) => {
      log(`  ${i + 1}.`, `[${choice.tone}] ${choice.text}`);
      log('     ', `호감도 예상: ${choice.estimatedAffectionChange > 0 ? '+' : ''}${choice.estimatedAffectionChange}, 프리미엄: ${choice.isPremium}`);
    });

    // 선택지 품질 체크
    const qualityChecks = {
      '선택지 개수 적절 (1개 이상)': choices.length >= 1,
      '모든 선택지에 텍스트 있음': choices.every(c => c.text && c.text.length > 0),
      '다양한 톤 제공': new Set(choices.map(c => c.tone)).size >= 2,
    };

    Object.entries(qualityChecks).forEach(([check, passed]) => {
      log(passed ? '✅' : '❌', check);
    });
  } catch (error) {
    log('❌', '선택지 생성 실패', error);
  }
}

// ============================================
// 테스트 6: 메모리 추출 패턴 테스트
// ============================================

async function testMemoryPatterns() {
  logSection('테스트 6: 메모리 추출 패턴');

  // 메모리 추출 대상 테스트 메시지
  const testMessages = [
    { text: '나 사실 아무한테도 말 안했는데...', expectedType: 'secret_shared' },
    { text: '다음에 꼭 같이 가자! 약속!', expectedType: 'promise' },
    { text: '처음 만나서 반가워', expectedType: 'first_meeting' },
    { text: '나 생일이 12월 25일이야', expectedType: 'important_date' },
    { text: '난 매운 음식 정말 좋아해', expectedType: 'user_preference' },
    { text: '그때 정말 감동받았어...', expectedType: 'emotional_event' },
    { text: '우리 둘만의 비밀이야', expectedType: 'secret_shared' },
  ];

  // 패턴 매칭 테스트 (memory-service.ts의 패턴과 동일)
  const patterns: Record<string, { keywords: string[]; patterns: RegExp[] }> = {
    secret_shared: {
      keywords: ['비밀', '아무한테도', '너만', '우리만'],
      patterns: [/비밀인데/, /아무한테도\s*말/, /너한테만/, /우리만\s*아는/],
    },
    promise: {
      keywords: ['약속', '맹세', '꼭', '반드시'],
      patterns: [/약속\s*할[게래]/, /꼭\s*.+[할께]/, /반드시\s*.+할/],
    },
    first_meeting: {
      keywords: ['처음', '첫', '만나서'],
      patterns: [/처음\s*(만|봐|봤)/, /첫\s*만남/],
    },
    important_date: {
      keywords: ['생일', '기념일', '특별한 날'],
      patterns: [/생일이\s*언제/, /기념일/],
    },
    user_preference: {
      keywords: ['좋아하', '싫어하', '취향'],
      patterns: [/좋아하는\s*\w+/, /싫어하는\s*\w+/],
    },
    emotional_event: {
      keywords: ['울었', '감동', '행복', '슬퍼'],
      patterns: [/울\s*뻔/, /감동\s*받/, /너무\s*행복/],
    },
  };

  for (const { text, expectedType } of testMessages) {
    const normalizedText = text.toLowerCase();
    let matchedType: string | null = null;

    for (const [type, { keywords, patterns: regexPatterns }] of Object.entries(patterns)) {
      const keywordMatch = keywords.some(k => normalizedText.includes(k));
      const patternMatch = regexPatterns.some(p => p.test(text));

      if (keywordMatch || patternMatch) {
        matchedType = type;
        break;
      }
    }

    const passed = matchedType === expectedType;
    log(passed ? '✅' : '❌', `"${text}"`);
    log('   ', `예상: ${expectedType}, 실제: ${matchedType || '매칭 없음'}`);
  }
}

// ============================================
// 테스트 7: 실제 세션 플로우 테스트 (선택적)
// ============================================

async function testFullSessionFlow() {
  logSection('테스트 7: 실제 세션 플로우 (E2E)');

  // 테스트 유저 확인
  const { data: testUser } = await supabase
    .from('users')
    .select('id')
    .limit(1)
    .single();

  const { data: testPersona } = await supabase
    .from('personas')
    .select('id, name')
    .limit(1)
    .single();

  if (!testUser || !testPersona) {
    log('⚠️', 'DB에 테스트용 유저/페르소나가 없습니다. E2E 테스트 스킵.');
    return;
  }

  log('🧪', `E2E 테스트 시작: ${testPersona.name}과 대화`);

  try {
    const agent = new AIAgent(SUPABASE_URL, SUPABASE_KEY);

    // 세션 생성
    const session = await agent.getOrCreateSession(testUser.id, testPersona.id);
    log('📍', `세션 생성됨: ${session.id}`);

    // 첫 메시지 전송
    const result = await agent.processUserMessage(session.id, '안녕! 오늘 어때?');

    log('✅', 'E2E 테스트 성공', {
      responsePreview: result.response.content.substring(0, 100) + '...',
      emotion: result.response.emotion,
      affectionChange: result.affectionChange,
      choicesCount: result.choices.length,
    });

    // 세션 종료 (테스트 데이터 정리)
    await supabase
      .from('conversation_sessions')
      .update({ status: 'completed' })
      .eq('id', session.id);

    log('🧹', '테스트 세션 정리 완료');
  } catch (error) {
    log('❌', 'E2E 테스트 실패', error);
  }
}

// ============================================
// 메인 실행
// ============================================

async function main() {
  console.log('\n🚀 AI Agent 통합 테스트 시작\n');
  console.log(`📅 ${new Date().toLocaleString('ko-KR')}`);
  console.log(`🔗 Supabase URL: ${SUPABASE_URL.substring(0, 30)}...`);
  console.log(`🔑 OpenRouter API: ${process.env.OPENROUTER_API_KEY ? '설정됨' : '미설정'}`);

  // 테스트 1: 페르소나 로딩
  const personaResult = await testPersonaLoading();
  if (!personaResult) {
    console.log('\n❌ 페르소나 로딩 실패로 추가 테스트 불가');
    return;
  }

  // 테스트 2: 프롬프트 생성
  const promptResult = await testPromptGeneration(personaResult.personaData);

  // 테스트 3: LLM 응답 생성
  await testLLMResponse(promptResult.systemPrompt, promptResult.mockContext);

  // 테스트 4: 관계 단계별 응답
  await testRelationshipStages(personaResult.personaData);

  // 테스트 5: 선택지 생성
  await testChoiceGeneration(promptResult.mockContext);

  // 테스트 6: 메모리 패턴
  await testMemoryPatterns();

  // 테스트 7: E2E (선택적)
  const runE2E = process.argv.includes('--e2e');
  if (runE2E) {
    await testFullSessionFlow();
  } else {
    log('💡', 'E2E 테스트를 실행하려면 --e2e 플래그를 추가하세요');
  }

  // 결과 요약
  logSection('테스트 완료');
  console.log('\n📊 모든 테스트가 완료되었습니다.');
  console.log('   상세 결과는 위 로그를 확인하세요.\n');
}

main().catch(console.error);
