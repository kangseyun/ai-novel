import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';
import { getAuthUser, unauthorized, serverError } from '@/lib/auth';

// PUT /api/feed/events/:eventId/read - 이벤트 읽음 처리
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ eventId: string }> }
) {
  try {
    const user = await getAuthUser(request);
    if (!user) return unauthorized();

    const { eventId } = await params;
    const supabase = createServerClient();

    const { error } = await supabase
      .from('feed_events')
      .update({ read: true })
      .eq('id', eventId)
      .eq('user_id', user.id);

    if (error) {
      return serverError(error);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    return serverError(error);
  }
}
