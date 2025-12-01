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

    if (!personaId || !message) {
      return badRequest('personaId and message are required');
    }

    const supabase = await createServerClient();

    // 토큰 잔액 확인
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('tokens')
      .eq('id', user.id)
      .single();

    if (userError) {
      console.error('[AI Chat] User fetch error:', userError);
      return serverError(userError);
    }

    const currentTokens = userData?.tokens ?? 0;
    if (currentTokens < TOKEN_COST_PER_MESSAGE) {
      return NextResponse.json(
        { error: 'insufficient_tokens', message: '토큰이 부족합니다.' },
        { status: 402 }
      );
    }

    const agent = getAIAgent();

    // 세션 가져오기 또는 생성
    // sessionId가 전달되면 해당 세션을 사용하고, 없으면 새로 생성/조회
    const session = sessionId
      ? await agent.getSession(sessionId) ?? await agent.getOrCreateSession(user.id, personaId)
      : await agent.getOrCreateSession(user.id, personaId);

    // 메시지 처리 및 응답 생성
    const result = await agent.processUserMessage(
      session.id,
      message,
      choiceData
    );

    // 토큰 차감
    const newTokenBalance = currentTokens - TOKEN_COST_PER_MESSAGE;
    const { error: updateError } = await supabase
      .from('users')
      .update({ tokens: newTokenBalance })
      .eq('id', user.id);

    if (updateError) {
      console.error('[AI Chat] Token update error:', updateError);
      // 토큰 차감 실패해도 응답은 반환 (다음에 차감)
    }

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
      // 시나리오 전환 트리거
      scenarioTrigger: result.scenarioTrigger,
    });
  } catch (error) {
    console.error('[AI Chat] Error:', error);
    return serverError(error);
  }
}
