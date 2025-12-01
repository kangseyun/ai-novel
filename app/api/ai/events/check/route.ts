import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser, unauthorized, badRequest, serverError } from '@/lib/auth';
import { getAIAgent } from '@/lib/ai-agent';

/**
 * POST /api/ai/events/check
 * 사용자 액션에 따른 이벤트 트리거 체크
 * - 페르소나가 피드에 새 게시물 올리기
 * - 페르소나가 DM 보내기
 * - 특별 이벤트 발생
 */
export async function POST(request: NextRequest) {
  try {
    const user = await getAuthUser(request);
    if (!user) return unauthorized();

    const { personaId, actionType, actionData } = await request.json();

    if (!personaId) {
      return badRequest('personaId is required');
    }

    const agent = getAIAgent();

    // 이벤트 트리거 체크
    const event = await agent.checkEventTriggers(user.id, personaId, {
      userId: user.id,
      personaId,
      actionType: actionType || 'app_opened',
      actionData: actionData || {},
      timestamp: new Date(),
    });

    if (event) {
      return NextResponse.json({
        triggered: true,
        event: {
          id: event.id,
          type: event.eventType,
          scheduledFor: event.scheduledFor,
        },
      });
    }

    return NextResponse.json({
      triggered: false,
    });
  } catch (error) {
    console.error('[Event Check] Error:', error);
    return serverError(error);
  }
}
