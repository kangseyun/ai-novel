import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser, unauthorized, badRequest, serverError } from '@/lib/auth';
import { getAIAgent } from '@/lib/ai-agent';

/**
 * POST /api/ai/events/process
 * 예약된 이벤트 처리 및 전달
 */
export async function POST(request: NextRequest) {
  try {
    const user = await getAuthUser(request);
    if (!user) return unauthorized();

    const { eventId } = await request.json();

    if (!eventId) {
      return badRequest('eventId is required');
    }

    const agent = getAIAgent();

    // 예약된 이벤트 처리
    const result = await agent.processScheduledEvent(eventId);

    return NextResponse.json({
      success: result.delivered,
      content: result.content,
    });
  } catch (error) {
    console.error('[Event Process] Error:', error);
    return serverError(error);
  }
}
