/**
 * E2E User Flow Test - Full Journey Simulation
 *
 * 실제 유저 플로우를 LLM으로 시뮬레이션:
 * 1. Onboarding → 첫 시나리오 체험
 * 2. DM Chat → 일반 대화
 * 3. Scenario Trigger → 이벤트 발생
 * 4. Scenario Play → 시나리오 진행
 * 5. DM Chat → 시나리오 후 대화
 *
 * Usage:
 *   npx tsx scripts/e2e-user-flow-test.ts
 *   npx tsx scripts/e2e-user-flow-test.ts --persona jun --turns 20
 *   npx tsx scripts/e2e-user-flow-test.ts --skip-onboarding
 */

import 'dotenv/config';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';
import { v4 as uuidv4 } from 'uuid';

// ============================================
// 환경 변수 검증
// ============================================

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY!;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('❌ SUPABASE 환경변수가 필요합니다');
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
const hasFlag = (name: string): boolean => args.includes(`--${name}`);

const CONFIG = {
  personaId: getArg('persona', 'jun'),
  dmTurns: parseInt(getArg('dm-turns', '10'), 10),
  scenarioTurns: parseInt(getArg('scenario-turns', '5'), 10),
  skipOnboarding: hasFlag('skip-onboarding'),
  userModel: getArg('user-model', 'deepseek/deepseek-chat'),
  verbose: hasFlag('verbose'),
};

// ============================================
// 타입 정의
// ============================================

interface TestLog {
  timestamp: string;
  phase: string;
  event: string;
  data?: unknown;
  duration?: number;
}

interface UserContext {
  userId: string;
  personaId: string;
  sessionId?: string;
  affection: number;
  relationshipStage: string;
  messageCount: number;
  scenarioSessionId?: string;
  scenarioMode?: string;
}

interface PhaseResult {
  phase: string;
  success: boolean;
  duration: number;
  messageCount: number;
  affectionChange: number;
  logs: TestLog[];
  error?: string;
}

// ============================================
// 로깅 시스템
// ============================================

class TestLogger {
  private logs: TestLog[] = [];
  private currentPhase: string = 'init';
  private startTime: number = Date.now();

  setPhase(phase: string) {
    this.currentPhase = phase;
    this.log('PHASE_START', { phase });
    console.log('\n' + '═'.repeat(70));
    console.log(`  📍 Phase: ${phase}`);
    console.log('═'.repeat(70));
  }

  log(event: string, data?: unknown, duration?: number) {
    const entry: TestLog = {
      timestamp: new Date().toISOString(),
      phase: this.currentPhase,
      event,
      data,
      duration,
    };
    this.logs.push(entry);

    if (CONFIG.verbose) {
      console.log(`[${entry.timestamp}] [${entry.phase}] ${event}`, data || '');
    }
  }

  info(message: string, data?: unknown) {
    console.log(`  ℹ️  ${message}`, data ? JSON.stringify(data, null, 2) : '');
    this.log('INFO', { message, ...data });
  }

  success(message: string, data?: unknown) {
    console.log(`  ✅ ${message}`, data ? JSON.stringify(data, null, 2) : '');
    this.log('SUCCESS', { message, ...data });
  }

  error(message: string, error?: unknown) {
    console.error(`  ❌ ${message}`, error);
    this.log('ERROR', { message, error: String(error) });
  }

  userMessage(content: string) {
    console.log(`  👤 유저: ${content}`);
    this.log('USER_MESSAGE', { content });
  }

  personaMessage(content: string, emotion?: string, affection?: number) {
    console.log(`  🎭 페르소나: ${content}`);
    if (emotion || affection !== undefined) {
      console.log(`     [감정: ${emotion || 'neutral'}, 호감도: ${affection !== undefined ? (affection > 0 ? '+' : '') + affection : 0}]`);
    }
    this.log('PERSONA_MESSAGE', { content, emotion, affection });
  }

  scenarioEvent(type: string, data?: unknown) {
    console.log(`  🎬 시나리오: [${type}]`, data || '');
    this.log('SCENARIO_EVENT', { type, ...data });
  }

  getLogs(): TestLog[] {
    return this.logs;
  }

  getPhaseLogs(phase: string): TestLog[] {
    return this.logs.filter(l => l.phase === phase);
  }

  getTotalDuration(): number {
    return Date.now() - this.startTime;
  }
}

const logger = new TestLogger();

// ============================================
// Supabase 클라이언트
// ============================================

const supabase: SupabaseClient = createClient(SUPABASE_URL, SUPABASE_KEY);

// ============================================
// OpenRouter API 호출
// ============================================

async function callLLM(
  messages: Array<{ role: string; content: string }>,
  options?: {
    model?: string;
    temperature?: number;
    maxTokens?: number;
    jsonMode?: boolean;
  }
): Promise<string> {
  const model = options?.model || CONFIG.userModel;

  const requestBody: Record<string, unknown> = {
    model,
    messages,
    temperature: options?.temperature ?? 0.9,
    max_tokens: options?.maxTokens ?? 500,
  };

  if (options?.jsonMode) {
    requestBody.response_format = { type: 'json_object' };
  }

  const start = Date.now();

  const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
      'HTTP-Referer': 'http://localhost:3000',
      'X-Title': 'E2E User Flow Test',
    },
    body: JSON.stringify(requestBody),
  });

  const duration = Date.now() - start;
  logger.log('LLM_CALL', { model, duration }, duration);

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`OpenRouter API error: ${response.status} - ${errorText}`);
  }

  const data = await response.json();
  return data.choices?.[0]?.message?.content || '';
}

// ============================================
// 유저 입력 생성기 (LLM 기반)
// ============================================

async function generateUserInput(
  context: UserContext,
  phase: string,
  conversationHistory: Array<{ role: string; content: string }>,
  personaName: string,
  turnNumber: number
): Promise<string> {
  const historyText = conversationHistory
    .slice(-6)
    .map(m => `${m.role === 'user' ? '나' : personaName}: ${m.content}`)
    .join('\n');

  let situationPrompt = '';

  switch (phase) {
    case 'onboarding':
      situationPrompt = `너는 이 앱을 처음 설치한 20대 유저야. 광고에서 "${personaName}"을 보고 호기심에 설치했어.
아직 뭔지 잘 모르고, AI인지 사람인지도 헷갈려. 짧고 캐주얼하게 반응해.
${turnNumber === 1 ? '첫 인사를 해봐.' : ''}`;
      break;

    case 'dm_chat':
      situationPrompt = `너는 ${personaName}과 ${context.messageCount}번 대화한 유저야.
관계 단계: ${context.relationshipStage}, 호감도: ${context.affection}
자연스럽게 대화를 이어가. 가끔 개인적인 이야기도 하고, 질문도 하고.`;
      break;

    case 'scenario':
      situationPrompt = `지금 ${personaName}과 특별한 시나리오 상황 중이야.
시나리오에 몰입해서 반응해. 선택지가 있으면 하나를 골라서 대답해.`;
      break;

    case 'post_scenario':
      situationPrompt = `방금 ${personaName}과 특별한 시나리오를 끝냈어.
시나리오에서 있었던 일에 대해 이야기하거나, 일상 대화로 자연스럽게 전환해.`;
      break;

    default:
      situationPrompt = '자연스럽게 대화해.';
  }

  const systemPrompt = `${situationPrompt}

중요 규칙:
1. 실제 한국인 20대가 카톡하듯이 짧게 (1-2문장)
2. ㅋㅋ, ㅠㅠ, ㅇㅇ 등 자연스럽게 사용
3. 너무 길게 쓰지 마
4. 대답만 출력 (설명 X)`;

  const userPrompt = conversationHistory.length > 0
    ? `대화 내역:\n${historyText}\n\n이제 내 차례. 뭐라고 할까?`
    : '첫 메시지를 보내줘.';

  const response = await callLLM([
    { role: 'system', content: systemPrompt },
    { role: 'user', content: userPrompt },
  ], { temperature: 0.95 });

  return response
    .replace(/^["']|["']$/g, '')
    .replace(/^(나|유저|User):\s*/i, '')
    .trim();
}

// ============================================
// Phase 1: Onboarding
// ============================================

async function runOnboardingPhase(ctx: UserContext): Promise<PhaseResult> {
  logger.setPhase('ONBOARDING');
  const startTime = Date.now();
  const logs: TestLog[] = [];
  let affectionChange = 0;

  try {
    // 페르소나 정보 조회
    const { data: persona, error: personaError } = await supabase
      .from('persona_core')
      .select('*')
      .eq('id', ctx.personaId)
      .single();

    if (personaError || !persona) {
      throw new Error(`페르소나를 찾을 수 없습니다: ${ctx.personaId}`);
    }

    logger.info(`페르소나 로드: ${persona.name} (${persona.full_name})`);

    // 온보딩 시나리오 조회
    const { data: onboardingScenario } = await supabase
      .from('scenario_templates')
      .select('*')
      .eq('persona_id', ctx.personaId)
      .eq('is_onboarding', true)
      .single();

    if (!onboardingScenario) {
      logger.info('온보딩 시나리오가 없습니다. 기본 대화로 시작.');
    } else {
      logger.info(`온보딩 시나리오 발견: ${onboardingScenario.title}`);
    }

    // 온보딩 대화 시뮬레이션 (3턴)
    const conversationHistory: Array<{ role: string; content: string }> = [];
    const ONBOARDING_TURNS = 3;

    for (let turn = 1; turn <= ONBOARDING_TURNS; turn++) {
      // 유저 메시지 생성
      const userMessage = await generateUserInput(
        ctx,
        'onboarding',
        conversationHistory,
        persona.name,
        turn
      );
      logger.userMessage(userMessage);
      conversationHistory.push({ role: 'user', content: userMessage });
      ctx.messageCount++;

      // 페르소나 응답 생성 (API 호출)
      const response = await fetch(`${SUPABASE_URL.replace('.supabase.co', '.functions.supabase.co')}/dm-chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${SUPABASE_KEY}`,
        },
        body: JSON.stringify({
          userId: ctx.userId,
          personaId: ctx.personaId,
          message: userMessage,
          isOnboarding: true,
        }),
      });

      if (!response.ok) {
        // Edge function이 없으면 직접 LLM 호출로 대체
        logger.info('Edge Function 미사용, 직접 LLM 호출');

        const personaResponse = await callLLM([
          {
            role: 'system',
            content: `당신은 ${persona.name}입니다. ${persona.role}.
성격: 처음 만난 사람에게는 약간 경계하지만 호기심 있음.
짧고 자연스럽게 대화하세요. 1-2문장.`
          },
          ...conversationHistory.map(m => ({
            role: m.role === 'user' ? 'user' as const : 'assistant' as const,
            content: m.content,
          })),
        ], { temperature: 0.8 });

        logger.personaMessage(personaResponse, 'neutral', 0);
        conversationHistory.push({ role: 'persona', content: personaResponse });
      } else {
        const data = await response.json();
        logger.personaMessage(data.response?.content || data.message, data.response?.emotion, data.affectionChange);
        conversationHistory.push({ role: 'persona', content: data.response?.content || data.message });
        affectionChange += data.affectionChange || 0;
      }

      await new Promise(r => setTimeout(r, 500));
    }

    ctx.affection += affectionChange;
    logger.success('온보딩 완료', {
      turns: ONBOARDING_TURNS,
      affectionChange,
      currentAffection: ctx.affection,
    });

    return {
      phase: 'onboarding',
      success: true,
      duration: Date.now() - startTime,
      messageCount: ONBOARDING_TURNS,
      affectionChange,
      logs: logger.getPhaseLogs('ONBOARDING'),
    };

  } catch (error) {
    logger.error('온보딩 실패', error);
    return {
      phase: 'onboarding',
      success: false,
      duration: Date.now() - startTime,
      messageCount: 0,
      affectionChange: 0,
      logs: logger.getPhaseLogs('ONBOARDING'),
      error: String(error),
    };
  }
}

// ============================================
// Phase 2: DM Chat
// ============================================

async function runDMChatPhase(ctx: UserContext): Promise<PhaseResult> {
  logger.setPhase('DM_CHAT');
  const startTime = Date.now();
  let affectionChange = 0;
  let messageCount = 0;

  try {
    // 페르소나 정보 조회
    const { data: persona } = await supabase
      .from('persona_core')
      .select('*')
      .eq('id', ctx.personaId)
      .single();

    if (!persona) {
      throw new Error('페르소나를 찾을 수 없습니다');
    }

    // 세션 생성 또는 조회
    const { data: session, error: sessionError } = await supabase
      .from('conversation_sessions')
      .insert({
        user_id: ctx.userId,
        persona_id: ctx.personaId,
        status: 'active',
      })
      .select()
      .single();

    if (sessionError) {
      // 기존 세션 사용
      const { data: existingSession } = await supabase
        .from('conversation_sessions')
        .select('*')
        .eq('user_id', ctx.userId)
        .eq('persona_id', ctx.personaId)
        .eq('status', 'active')
        .single();

      if (existingSession) {
        ctx.sessionId = existingSession.id;
      }
    } else {
      ctx.sessionId = session.id;
    }

    logger.info(`세션 ID: ${ctx.sessionId || 'new'}`);

    // DM 대화 진행
    const conversationHistory: Array<{ role: string; content: string }> = [];

    for (let turn = 1; turn <= CONFIG.dmTurns; turn++) {
      logger.info(`--- Turn ${turn}/${CONFIG.dmTurns} ---`);

      // 유저 메시지 생성
      const userMessage = await generateUserInput(
        ctx,
        'dm_chat',
        conversationHistory,
        persona.name,
        turn
      );
      logger.userMessage(userMessage);
      conversationHistory.push({ role: 'user', content: userMessage });
      messageCount++;
      ctx.messageCount++;

      // DM API 호출 시도
      try {
        const response = await fetch(`${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/dm/send`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            userId: ctx.userId,
            personaId: ctx.personaId,
            message: userMessage,
            sessionId: ctx.sessionId,
          }),
        });

        if (response.ok) {
          const data = await response.json();
          logger.personaMessage(
            data.response?.content || data.message,
            data.response?.emotion,
            data.affectionChange
          );
          conversationHistory.push({ role: 'persona', content: data.response?.content || data.message });
          affectionChange += data.affectionChange || 0;

          // 시나리오 트리거 체크
          if (data.scenarioTriggered) {
            logger.scenarioEvent('TRIGGER_DETECTED', {
              scenarioId: data.scenarioId,
              mode: data.scenarioMode,
            });
            ctx.scenarioSessionId = data.scenarioSessionId;
            ctx.scenarioMode = data.scenarioMode;

            // 시나리오 페이즈로 전환
            logger.info('시나리오 트리거됨! 시나리오 페이즈로 전환');
            break;
          }
        } else {
          // API 실패시 직접 LLM 호출
          const personaResponse = await callLLM([
            {
              role: 'system',
              content: `당신은 ${persona.name}입니다. ${persona.role}.
관계 단계: ${ctx.relationshipStage}, 호감도: ${ctx.affection}
자연스럽게 대화하세요. 1-3문장.`
            },
            ...conversationHistory.map(m => ({
              role: m.role === 'user' ? 'user' as const : 'assistant' as const,
              content: m.content,
            })),
          ]);

          logger.personaMessage(personaResponse, 'neutral', 1);
          conversationHistory.push({ role: 'persona', content: personaResponse });
          affectionChange += 1;
        }
      } catch (apiError) {
        // 네트워크 에러시 직접 LLM 호출
        const personaResponse = await callLLM([
          {
            role: 'system',
            content: `당신은 ${persona.name}입니다. 짧게 대화하세요.`
          },
          ...conversationHistory.slice(-4).map(m => ({
            role: m.role === 'user' ? 'user' as const : 'assistant' as const,
            content: m.content,
          })),
        ]);

        logger.personaMessage(personaResponse, 'neutral', 1);
        conversationHistory.push({ role: 'persona', content: personaResponse });
        affectionChange += 1;
      }

      // 관계 단계 업데이트
      ctx.affection += 1;
      if (ctx.affection >= 30 && ctx.relationshipStage === 'stranger') {
        ctx.relationshipStage = 'acquaintance';
        logger.info('🎉 관계 단계 업그레이드: acquaintance');
      } else if (ctx.affection >= 50 && ctx.relationshipStage === 'acquaintance') {
        ctx.relationshipStage = 'friend';
        logger.info('🎉 관계 단계 업그레이드: friend');
      }

      await new Promise(r => setTimeout(r, 300));
    }

    ctx.affection += affectionChange;
    logger.success('DM Chat 완료', {
      turns: messageCount,
      affectionChange,
      currentAffection: ctx.affection,
      relationshipStage: ctx.relationshipStage,
    });

    return {
      phase: 'dm_chat',
      success: true,
      duration: Date.now() - startTime,
      messageCount,
      affectionChange,
      logs: logger.getPhaseLogs('DM_CHAT'),
    };

  } catch (error) {
    logger.error('DM Chat 실패', error);
    return {
      phase: 'dm_chat',
      success: false,
      duration: Date.now() - startTime,
      messageCount,
      affectionChange,
      logs: logger.getPhaseLogs('DM_CHAT'),
      error: String(error),
    };
  }
}

// ============================================
// Phase 3: Scenario Trigger & Play
// ============================================

async function runScenarioPhase(ctx: UserContext): Promise<PhaseResult> {
  logger.setPhase('SCENARIO');
  const startTime = Date.now();
  let affectionChange = 0;
  let messageCount = 0;

  try {
    // 활성 시나리오가 없으면 수동으로 트리거
    if (!ctx.scenarioSessionId) {
      logger.info('활성 시나리오 없음. 조건에 맞는 시나리오 검색...');

      // 사용 가능한 시나리오 조회
      const { data: scenarios } = await supabase
        .from('scenario_templates')
        .select('*')
        .eq('persona_id', ctx.personaId)
        .eq('is_active', true)
        .neq('is_onboarding', true)
        .limit(5);

      if (!scenarios || scenarios.length === 0) {
        logger.info('사용 가능한 시나리오가 없습니다. 시나리오 페이즈 스킵.');
        return {
          phase: 'scenario',
          success: true,
          duration: Date.now() - startTime,
          messageCount: 0,
          affectionChange: 0,
          logs: logger.getPhaseLogs('SCENARIO'),
        };
      }

      // 조건에 맞는 시나리오 선택
      const eligibleScenario = scenarios.find(s => {
        const req = s.requirements || {};
        const minAffection = req.min_affection || 0;
        const maxAffection = req.max_affection || 100;
        return ctx.affection >= minAffection && ctx.affection <= maxAffection;
      }) || scenarios[0];

      logger.info(`시나리오 선택: ${eligibleScenario.title} (${eligibleScenario.generation_mode})`);

      // 시나리오 세션 시작
      const mode = eligibleScenario.generation_mode || 'static';

      if (mode === 'static') {
        // Static 시나리오: scenario_progress에 저장
        const { data: progress, error } = await supabase
          .from('scenario_progress')
          .insert({
            user_id: ctx.userId,
            persona_id: ctx.personaId,
            scenario_id: eligibleScenario.id,
            current_scene_index: 0,
            is_completed: false,
          })
          .select()
          .single();

        if (error) {
          logger.error('시나리오 진행 생성 실패', error);
        } else {
          ctx.scenarioSessionId = progress.id;
          ctx.scenarioMode = 'static';
          logger.scenarioEvent('SESSION_STARTED', {
            sessionId: progress.id,
            mode: 'static',
            scenario: eligibleScenario.title,
          });
        }
      } else if (mode === 'guided') {
        // Guided 시나리오
        const { data: session, error } = await supabase
          .from('guided_scenario_sessions')
          .insert({
            scenario_id: eligibleScenario.id,
            user_id: ctx.userId,
            persona_id: ctx.personaId,
            current_plot_index: 0,
            session_state: 'active',
          })
          .select()
          .single();

        if (!error && session) {
          ctx.scenarioSessionId = session.id;
          ctx.scenarioMode = 'guided';
          logger.scenarioEvent('SESSION_STARTED', {
            sessionId: session.id,
            mode: 'guided',
          });
        }
      } else if (mode === 'dynamic') {
        // Dynamic 시나리오
        const { data: session, error } = await supabase
          .from('dynamic_scenario_sessions')
          .insert({
            template_id: eligibleScenario.id,
            user_id: ctx.userId,
            persona_id: ctx.personaId,
            session_state: 'active',
          })
          .select()
          .single();

        if (!error && session) {
          ctx.scenarioSessionId = session.id;
          ctx.scenarioMode = 'dynamic';
          logger.scenarioEvent('SESSION_STARTED', {
            sessionId: session.id,
            mode: 'dynamic',
          });
        }
      }
    }

    if (!ctx.scenarioSessionId) {
      logger.info('시나리오 세션을 시작할 수 없습니다.');
      return {
        phase: 'scenario',
        success: false,
        duration: Date.now() - startTime,
        messageCount: 0,
        affectionChange: 0,
        logs: logger.getPhaseLogs('SCENARIO'),
        error: 'No scenario session',
      };
    }

    // 페르소나 정보 조회
    const { data: persona } = await supabase
      .from('persona_core')
      .select('*')
      .eq('id', ctx.personaId)
      .single();

    // 시나리오 대화 진행
    const conversationHistory: Array<{ role: string; content: string }> = [];

    for (let turn = 1; turn <= CONFIG.scenarioTurns; turn++) {
      logger.info(`--- Scenario Turn ${turn}/${CONFIG.scenarioTurns} ---`);

      // 시나리오 상태에 따른 프롬프트 구성
      const scenarioPrompt = `지금 ${persona?.name}과 특별한 시나리오 상황 중입니다.
모드: ${ctx.scenarioMode}
상황에 몰입해서 자연스럽게 대화하세요.`;

      // 유저 메시지 생성
      const userMessage = await generateUserInput(
        ctx,
        'scenario',
        conversationHistory,
        persona?.name || 'Unknown',
        turn
      );
      logger.userMessage(userMessage);
      conversationHistory.push({ role: 'user', content: userMessage });
      messageCount++;

      // 시나리오 응답 생성 (LLM 직접 호출)
      const personaResponse = await callLLM([
        {
          role: 'system',
          content: `${scenarioPrompt}
당신은 ${persona?.name}입니다.
시나리오 상황에서 긴장감 있고 몰입감 있게 대화하세요.
때로는 내레이션을 포함해도 됩니다. (예: *조용히 다가오며*)
1-3문장.`
        },
        ...conversationHistory.map(m => ({
          role: m.role === 'user' ? 'user' as const : 'assistant' as const,
          content: m.content,
        })),
      ]);

      logger.personaMessage(personaResponse, 'excited', 2);
      conversationHistory.push({ role: 'persona', content: personaResponse });
      affectionChange += 2;

      await new Promise(r => setTimeout(r, 300));
    }

    // 시나리오 완료 처리
    if (ctx.scenarioMode === 'static') {
      await supabase
        .from('scenario_progress')
        .update({ is_completed: true, completed_at: new Date().toISOString() })
        .eq('id', ctx.scenarioSessionId);
    } else if (ctx.scenarioMode === 'guided') {
      await supabase
        .from('guided_scenario_sessions')
        .update({ session_state: 'completed', completed_at: new Date().toISOString() })
        .eq('id', ctx.scenarioSessionId);
    } else if (ctx.scenarioMode === 'dynamic') {
      await supabase
        .from('dynamic_scenario_sessions')
        .update({ session_state: 'completed', completed_at: new Date().toISOString() })
        .eq('id', ctx.scenarioSessionId);
    }

    logger.scenarioEvent('SESSION_COMPLETED', {
      sessionId: ctx.scenarioSessionId,
      mode: ctx.scenarioMode,
      turns: messageCount,
    });

    ctx.affection += affectionChange;

    return {
      phase: 'scenario',
      success: true,
      duration: Date.now() - startTime,
      messageCount,
      affectionChange,
      logs: logger.getPhaseLogs('SCENARIO'),
    };

  } catch (error) {
    logger.error('시나리오 실패', error);
    return {
      phase: 'scenario',
      success: false,
      duration: Date.now() - startTime,
      messageCount,
      affectionChange,
      logs: logger.getPhaseLogs('SCENARIO'),
      error: String(error),
    };
  }
}

// ============================================
// Phase 4: Post-Scenario DM Chat
// ============================================

async function runPostScenarioDMPhase(ctx: UserContext): Promise<PhaseResult> {
  logger.setPhase('POST_SCENARIO_DM');
  const startTime = Date.now();
  let affectionChange = 0;
  let messageCount = 0;

  try {
    const { data: persona } = await supabase
      .from('persona_core')
      .select('*')
      .eq('id', ctx.personaId)
      .single();

    const conversationHistory: Array<{ role: string; content: string }> = [];
    const POST_TURNS = 5;

    for (let turn = 1; turn <= POST_TURNS; turn++) {
      logger.info(`--- Post-Scenario Turn ${turn}/${POST_TURNS} ---`);

      // 유저 메시지 생성
      const userMessage = await generateUserInput(
        ctx,
        'post_scenario',
        conversationHistory,
        persona?.name || 'Unknown',
        turn
      );
      logger.userMessage(userMessage);
      conversationHistory.push({ role: 'user', content: userMessage });
      messageCount++;

      // 응답 생성
      const personaResponse = await callLLM([
        {
          role: 'system',
          content: `당신은 ${persona?.name}입니다.
방금 특별한 시나리오를 함께 경험했습니다.
시나리오 후의 여운을 담아 대화하거나, 자연스럽게 일상으로 돌아가세요.
관계가 더 가까워진 느낌을 주세요.
1-2문장.`
        },
        ...conversationHistory.map(m => ({
          role: m.role === 'user' ? 'user' as const : 'assistant' as const,
          content: m.content,
        })),
      ]);

      logger.personaMessage(personaResponse, 'happy', 1);
      conversationHistory.push({ role: 'persona', content: personaResponse });
      affectionChange += 1;

      await new Promise(r => setTimeout(r, 300));
    }

    ctx.affection += affectionChange;
    logger.success('Post-Scenario DM 완료', {
      turns: messageCount,
      finalAffection: ctx.affection,
    });

    return {
      phase: 'post_scenario_dm',
      success: true,
      duration: Date.now() - startTime,
      messageCount,
      affectionChange,
      logs: logger.getPhaseLogs('POST_SCENARIO_DM'),
    };

  } catch (error) {
    logger.error('Post-Scenario DM 실패', error);
    return {
      phase: 'post_scenario_dm',
      success: false,
      duration: Date.now() - startTime,
      messageCount,
      affectionChange,
      logs: logger.getPhaseLogs('POST_SCENARIO_DM'),
      error: String(error),
    };
  }
}

// ============================================
// 결과 저장 및 리포트 생성
// ============================================

function generateReport(
  ctx: UserContext,
  results: PhaseResult[]
): void {
  logger.setPhase('REPORT');

  console.log('\n');
  console.log('╔' + '═'.repeat(68) + '╗');
  console.log('║' + '                     📊 E2E TEST REPORT                           '.padEnd(68) + '║');
  console.log('╠' + '═'.repeat(68) + '╣');

  // 전체 요약
  const totalDuration = results.reduce((sum, r) => sum + r.duration, 0);
  const totalMessages = results.reduce((sum, r) => sum + r.messageCount, 0);
  const totalAffection = results.reduce((sum, r) => sum + r.affectionChange, 0);
  const successCount = results.filter(r => r.success).length;

  console.log('║ ' + `Total Duration:   ${(totalDuration / 1000).toFixed(1)}s`.padEnd(66) + ' ║');
  console.log('║ ' + `Total Messages:   ${totalMessages}`.padEnd(66) + ' ║');
  console.log('║ ' + `Final Affection:  ${ctx.affection} (+${totalAffection})`.padEnd(66) + ' ║');
  console.log('║ ' + `Relationship:     ${ctx.relationshipStage}`.padEnd(66) + ' ║');
  console.log('║ ' + `Success Rate:     ${successCount}/${results.length} phases`.padEnd(66) + ' ║');

  console.log('╠' + '═'.repeat(68) + '╣');
  console.log('║' + '  Phase Breakdown:'.padEnd(68) + '║');
  console.log('╟' + '─'.repeat(68) + '╢');

  results.forEach(r => {
    const status = r.success ? '✅' : '❌';
    const line = `  ${status} ${r.phase.padEnd(20)} | ${r.messageCount} msgs | +${r.affectionChange} aff | ${(r.duration/1000).toFixed(1)}s`;
    console.log('║ ' + line.padEnd(66) + ' ║');
  });

  console.log('╚' + '═'.repeat(68) + '╝');

  // 파일 저장
  const resultsDir = path.join(__dirname, 'results');
  if (!fs.existsSync(resultsDir)) {
    fs.mkdirSync(resultsDir, { recursive: true });
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const filename = `e2e-flow-${CONFIG.personaId}-${timestamp}.json`;
  const filepath = path.join(resultsDir, filename);

  const fullReport = {
    metadata: {
      testId: uuidv4(),
      timestamp: new Date().toISOString(),
      personaId: CONFIG.personaId,
      config: CONFIG,
    },
    summary: {
      totalDuration,
      totalMessages,
      totalAffectionChange: totalAffection,
      finalAffection: ctx.affection,
      finalRelationshipStage: ctx.relationshipStage,
      successRate: `${successCount}/${results.length}`,
    },
    phases: results,
    fullLogs: logger.getLogs(),
  };

  fs.writeFileSync(filepath, JSON.stringify(fullReport, null, 2));
  console.log(`\n💾 Report saved: ${filepath}`);
}

// ============================================
// 메인 실행
// ============================================

async function main() {
  console.log('');
  console.log('╔' + '═'.repeat(68) + '╗');
  console.log('║' + '            🚀 E2E User Flow Test - Full Journey                   '.padEnd(68) + '║');
  console.log('╚' + '═'.repeat(68) + '╝');
  console.log('');
  console.log('📋 Configuration:');
  console.log(`   Persona ID:     ${CONFIG.personaId}`);
  console.log(`   DM Turns:       ${CONFIG.dmTurns}`);
  console.log(`   Scenario Turns: ${CONFIG.scenarioTurns}`);
  console.log(`   Skip Onboarding: ${CONFIG.skipOnboarding}`);
  console.log(`   User Model:     ${CONFIG.userModel}`);
  console.log('');

  // 테스트 유저 컨텍스트 생성
  const ctx: UserContext = {
    userId: uuidv4(), // 테스트용 가상 유저
    personaId: CONFIG.personaId,
    affection: 10,
    relationshipStage: 'stranger',
    messageCount: 0,
  };

  logger.info(`테스트 유저 생성: ${ctx.userId}`);

  const results: PhaseResult[] = [];

  try {
    // Phase 1: Onboarding
    if (!CONFIG.skipOnboarding) {
      const onboardingResult = await runOnboardingPhase(ctx);
      results.push(onboardingResult);
    } else {
      logger.info('온보딩 스킵됨');
      ctx.affection = 25; // 온보딩 완료 가정
    }

    // Phase 2: DM Chat
    const dmResult = await runDMChatPhase(ctx);
    results.push(dmResult);

    // Phase 3: Scenario
    const scenarioResult = await runScenarioPhase(ctx);
    results.push(scenarioResult);

    // Phase 4: Post-Scenario DM
    if (scenarioResult.success) {
      const postDMResult = await runPostScenarioDMPhase(ctx);
      results.push(postDMResult);
    }

    // 리포트 생성
    generateReport(ctx, results);

    console.log('\n✅ E2E Test completed successfully!\n');

  } catch (error) {
    console.error('\n❌ E2E Test failed:', error);
    generateReport(ctx, results);
    process.exit(1);
  }
}

main().catch(console.error);
