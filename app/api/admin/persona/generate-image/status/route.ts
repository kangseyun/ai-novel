import { NextRequest, NextResponse } from 'next/server';
import { getKlingAIClient } from '@/lib/kling-ai';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const taskId = searchParams.get('taskId');

    if (!taskId) {
      return NextResponse.json({ error: 'taskId is required' }, { status: 400 });
    }

    const klingClient = getKlingAIClient();
    const status = await klingClient.getTaskStatus(taskId);

    return NextResponse.json({
      success: true,
      taskId,
      status: status.data.task_status,
      statusMessage: status.data.task_status_msg,
      images: status.data.task_result?.images || [],
    });
  } catch (error) {
    console.error('Status check error:', error);
    return NextResponse.json({
      error: error instanceof Error ? error.message : 'Status check failed'
    }, { status: 500 });
  }
}
