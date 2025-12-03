import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser, unauthorized, badRequest, serverError } from '@/lib/auth';
import { getAIAgent } from '@/lib/ai-agent';
import { createServerClient } from '@/lib/supabase-server';

const TOKEN_COST_PER_MESSAGE = 1; // 메시지당 토큰 비용

// 타임스탬프 헬퍼 (밀리초 단위)
const getTs = () => new Date().toISOString().replace('T', ' ').replace('Z', '');

/**
 * POST /api/ai/chat
 * AI 페르소나와 대화
 */
export async function POST(request: NextRequest) {
  const startTime = Date.now();
  const requestId = `chat-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

  console.log(`\n${'='.repeat(60)}`);
  console.log(`[${getTs()}][${requestId}] 🚀 AI Chat Request Started`);
  console.log(`${'='.repeat(60)}`);

  try {
    const user = await getAuthUser(request);
    if (!user) {
      console.log(`[${getTs()}][${requestId}] ❌ Unauthorized - No user found`);
      return unauthorized();
    }
    console.log(`[${getTs()}][${requestId}] 👤 User: ${user.id}`);

    const body = await request.json();
    const { personaId, message, sessionId, choiceData } = body;

    console.log(`[${getTs()}][${requestId}] 📨 Request Body:`);
    console.log(`  - personaId: ${personaId}`);
    console.log(`  - message: "${message?.substring(0, 50)}${message?.length > 50 ? '...' : ''}"`);
    console.log(`  - sessionId: ${sessionId || '(new session)'}`);
    console.log(`  - choiceData: ${choiceData ? JSON.stringify(choiceData) : '(none)'}`);

    // 입력 검증
    if (!personaId || typeof personaId !== 'string') {
      console.log(`[${getTs()}][${requestId}] ❌ Invalid personaId`);
      return badRequest('Invalid personaId');
    }

    if (!message || typeof message !== 'string' || message.trim().length === 0) {
      console.log(`[${getTs()}][${requestId}] ❌ Empty message`);
      return badRequest('Message cannot be empty');
    }

    const supabase = await createServerClient();
    const agent = getAIAgent();
    console.log(`[${getTs()}][${requestId}] ✅ Supabase & AIAgent initialized`);

    // 원자적 토큰 차감 (Race Condition 방지)
    const { data: tokenResult, error: tokenError } = await supabase.rpc('deduct_tokens', {
      p_user_id: user.id,
      p_amount: TOKEN_COST_PER_MESSAGE,
      p_min_balance: 0
    });

    if (tokenError) {
      console.error('[AI Chat] Token deduction error:', tokenError);
      return serverError(tokenError);
    }

    if (!tokenResult?.[0]?.success) {
      return NextResponse.json(
        {
          error: 'insufficient_tokens',
          message: '토큰이 부족합니다.',
          currentBalance: tokenResult?.[0]?.previous_balance || 0,
          required: TOKEN_COST_PER_MESSAGE
        },
        { status: 402 }
      );
    }

    const newTokenBalance = tokenResult[0].new_balance;
    console.log(`[${getTs()}][${requestId}] 💰 Token deducted: ${TOKEN_COST_PER_MESSAGE}, new balance: ${newTokenBalance}`);

    // 세션 처리 (개선된 버전)
    let session = null;
    const sessionStartTime = Date.now();

    if (sessionId) {
      console.log(`[${getTs()}][${requestId}] 🔍 Looking up existing session: ${sessionId}`);
      session = await agent.getSession(sessionId);

      if (session) {
        console.log(`[${getTs()}][${requestId}] ✅ Session found - userId: ${session.userId}, personaId: ${session.personaId}`);

        // 세션이 현재 유저 소유인지 확인
        if (session.userId !== user.id) {
          console.log(`[${getTs()}][${requestId}] ❌ Session ownership mismatch`);
          // 토큰 환불
          await supabase.rpc('add_tokens', {
            p_user_id: user.id,
            p_amount: TOKEN_COST_PER_MESSAGE
          });
          return NextResponse.json(
            { error: 'Session does not belong to current user' },
            { status: 403 }
          );
        }

        // 세션이 요청된 페르소나와 일치하는지 확인
        if (session.personaId !== personaId) {
          console.log(`[${getTs()}][${requestId}] ❌ Session persona mismatch`);
          // 토큰 환불
          await supabase.rpc('add_tokens', {
            p_user_id: user.id,
            p_amount: TOKEN_COST_PER_MESSAGE
          });
          return NextResponse.json(
            { error: 'Session belongs to different persona' },
            { status: 400 }
          );
        }
      } else {
        console.log(`[${getTs()}][${requestId}] ⚠️ Session not found, will create new`);
      }
    }

    // 세션이 없으면 새로 생성
    if (!session) {
      console.log(`[${getTs()}][${requestId}] 🆕 Creating new session for user: ${user.id}, persona: ${personaId}`);
      session = await agent.getOrCreateSession(user.id, personaId);
    }

    // 세션 생성 실패 체크
    if (!session) {
      console.log(`[${getTs()}][${requestId}] ❌ Failed to create session`);
      // 토큰 환불
      await supabase.rpc('add_tokens', {
        p_user_id: user.id,
        p_amount: TOKEN_COST_PER_MESSAGE
      });
      return NextResponse.json(
        { error: 'Failed to create conversation session' },
        { status: 500 }
      );
    }

    console.log(`[${getTs()}][${requestId}] ✅ Session ready: ${session.id} (${Date.now() - sessionStartTime}ms)`)

    // 메시지 처리 및 응답 생성
    try {
      console.log(`[${getTs()}][${requestId}] 🤖 Processing message with AIAgent...`);
      const llmStartTime = Date.now();

      const result = await agent.processUserMessage(
        session.id,
        message,
        choiceData
      );

      const llmDuration = Date.now() - llmStartTime;
      console.log(`[${getTs()}][${requestId}] ✅ LLM Response received (${llmDuration}ms)`);
      console.log(`[${getTs()}][${requestId}] 📝 Response Details:`);
      console.log(`  - content: "${result.response.content.substring(0, 80)}${result.response.content.length > 80 ? '...' : ''}"`);
      console.log(`  - emotion: ${result.response.emotion}`);
      console.log(`  - innerThought: ${result.response.innerThought ? `"${result.response.innerThought.substring(0, 50)}..."` : '(none)'}`);
      console.log(`  - affectionChange: ${result.affectionChange}`);
      console.log(`  - choices: ${result.choices?.length || 0} options`);
      if (result.choices?.length) {
        result.choices.forEach((c, i) => {
          console.log(`    [${i + 1}] ${c.isPremium ? '💎' : '  '} "${c.text.substring(0, 40)}..."`);
        });
      }
      console.log(`[${getTs()}][${requestId}]   - scenarioTrigger: ${result.scenarioTrigger?.shouldStart ? `YES (${result.scenarioTrigger.scenarioType})` : 'no'}`);

      // 이벤트 트리거 체크 (비동기로 실행)
      agent.checkEventTriggers(user.id, personaId, {
        userId: user.id,
        personaId,
        actionType: choiceData?.wasPremium ? 'premium_purchased' : 'message_sent',
        actionData: { message, sessionId: session.id },
        timestamp: new Date(),
      }).catch(console.error);

      const totalDuration = Date.now() - startTime;
      console.log(`[${getTs()}][${requestId}] 🏁 Request completed in ${totalDuration}ms`);
      console.log(`${'='.repeat(60)}\n`);

      return NextResponse.json({
        sessionId: session.id,
        response: {
          content: result.response.content,
          emotion: result.response.emotion,
          innerThought: result.response.innerThought,
        },
        choices: result.choices,
        affectionChange: result.affectionChange,
        tokenBalance: newTokenBalance,
        scenarioTrigger: result.scenarioTrigger,
      });
    } catch (processError) {
      // 메시지 처리 실패 시 토큰 환불
      console.error(`[${getTs()}][${requestId}] ❌ Processing error, refunding tokens:`, processError);
      await supabase.rpc('add_tokens', {
        p_user_id: user.id,
        p_amount: TOKEN_COST_PER_MESSAGE
      });
      throw processError;
    }
  } catch (error) {
    const totalDuration = Date.now() - startTime;
    console.error(`[${getTs()}][${requestId}] ❌ Fatal error after ${totalDuration}ms:`, error);
    console.log(`${'='.repeat(60)}\n`);
    return serverError(error);
  }
}
