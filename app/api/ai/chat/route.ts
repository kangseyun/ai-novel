import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser, unauthorized, badRequest, serverError } from '@/lib/auth';
import { getAIAgent } from '@/lib/ai-agent';
import { createServerClient } from '@/lib/supabase-server';

const TOKEN_COST_PER_MESSAGE = 1; // 메시지당 토큰 비용

/**
 * POST /api/ai/chat
 * AI 페르소나와 대화
 */
export async function POST(request: NextRequest) {
  try {
    const user = await getAuthUser(request);
    if (!user) return unauthorized();

    const { personaId, message, sessionId, choiceData } = await request.json();

    // 입력 검증
    if (!personaId || typeof personaId !== 'string') {
      return badRequest('Invalid personaId');
    }

    if (!message || typeof message !== 'string' || message.trim().length === 0) {
      return badRequest('Message cannot be empty');
    }

    const supabase = await createServerClient();
    const agent = getAIAgent();

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

    // 세션 처리 (개선된 버전)
    let session = null;

    if (sessionId) {
      session = await agent.getSession(sessionId);

      if (session) {
        // 세션이 현재 유저 소유인지 확인
        if (session.userId !== user.id) {
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
      }
    }

    // 세션이 없으면 새로 생성
    if (!session) {
      session = await agent.getOrCreateSession(user.id, personaId);
    }

    // 세션 생성 실패 체크
    if (!session) {
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

    // 메시지 처리 및 응답 생성
    try {
      const result = await agent.processUserMessage(
        session.id,
        message,
        choiceData
      );

      // 이벤트 트리거 체크 (비동기로 실행)
      agent.checkEventTriggers(user.id, personaId, {
        userId: user.id,
        personaId,
        actionType: choiceData?.wasPremium ? 'premium_purchased' : 'message_sent',
        actionData: { message, sessionId: session.id },
        timestamp: new Date(),
      }).catch(console.error);

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
      console.error('[AI Chat] Processing error, refunding tokens:', processError);
      await supabase.rpc('add_tokens', {
        p_user_id: user.id,
        p_amount: TOKEN_COST_PER_MESSAGE
      });
      throw processError;
    }
  } catch (error) {
    console.error('[AI Chat] Error:', error);
    return serverError(error);
  }
}
