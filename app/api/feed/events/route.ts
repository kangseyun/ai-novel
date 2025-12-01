import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';
import { getAuthUser, unauthorized, serverError } from '@/lib/auth';

// GET /api/feed/events - 이벤트/알림 조회
export async function GET(request: NextRequest) {
  try {
    const user = await getAuthUser(request);
    if (!user) return unauthorized();

    const supabase = createServerClient();

    const { data: events, error } = await supabase
      .from('feed_events')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(50);

    if (error) {
      return serverError(error);
    }

    const unreadCount = events?.filter(e => !e.read).length || 0;

    return NextResponse.json({
      events: events || [],
      unread_count: unreadCount,
    });
  } catch (error) {
    return serverError(error);
  }
}
