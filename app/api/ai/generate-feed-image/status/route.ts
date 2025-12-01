import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser, unauthorized, badRequest, serverError } from '@/lib/auth';
import { getKlingAIClient } from '@/lib/kling-ai';

/**
 * GET /api/ai/generate-feed-image/status?taskId=xxx
 * 이미지 생성 태스크 상태 조회
 */
export async function GET(request: NextRequest) {
  try {
    const user = await getAuthUser(request);
    if (!user) return unauthorized();

    const { searchParams } = new URL(request.url);
    const taskId = searchParams.get('taskId');

    if (!taskId) {
      return badRequest('taskId is required');
    }

    const kling = getKlingAIClient();
    const status = await kling.getTaskStatus(taskId);

    return NextResponse.json({
      taskId: status.data.task_id,
      status: status.data.task_status,
      statusMessage: status.data.task_status_msg,
      images: status.data.task_result?.images || [],
      createdAt: status.data.created_at,
      updatedAt: status.data.updated_at,
    });
  } catch (error) {
    console.error('[Image Status] Error:', error);
    return serverError(error);
  }
}
