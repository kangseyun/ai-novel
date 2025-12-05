import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser, unauthorized, badRequest, serverError } from '@/lib/auth';
import { createServerClient } from '@/lib/supabase-server';

/**
 * POST /api/dm/read
 * 특정 페르소나와의 메시지를 읽음으로 표시
 */
export async function POST(request: NextRequest) {
  try {
    const user = await getAuthUser(request);
    if (!user) return unauthorized();

    const body = await request.json();
    const { personaId } = body;

    if (!personaId) {
      return badRequest('personaId is required');
    }

    const supabase = await createServerClient();

    // RPC 함수 호출하여 읽음 처리
    const { data, error } = await supabase.rpc('mark_messages_as_read', {
      p_user_id: user.id,
      p_persona_id: personaId,
    });

    if (error) {
      console.error('[DM Read] Error:', error);
      // RPC가 없으면 직접 업데이트
      const { data: sessions } = await supabase
        .from('conversation_sessions')
        .select('id')
        .eq('user_id', user.id)
        .eq('persona_id', personaId);

      if (sessions && sessions.length > 0) {
        const sessionIds = sessions.map(s => s.id);
        await supabase
          .from('conversation_messages')
          .update({ is_read: true })
          .in('session_id', sessionIds)
          .eq('role', 'persona')
          .eq('is_read', false);
      }
    }

    return NextResponse.json({
      success: true,
      markedCount: data || 0,
    });
  } catch (error) {
    console.error('[DM Read] Error:', error);
    return serverError(error);
  }
}

/**
 * GET /api/dm/read
 * 읽지 않은 메시지 총 수 조회
 */
export async function GET(request: NextRequest) {
  try {
    const user = await getAuthUser(request);
    if (!user) return unauthorized();

    const supabase = await createServerClient();

    // RPC 함수 호출
    const { data, error } = await supabase.rpc('get_total_unread_count', {
      p_user_id: user.id,
    });

    if (error) {
      console.error('[DM Read] Get unread count error:', error);
      // RPC가 없으면 직접 카운트
      const { count } = await supabase
        .from('conversation_messages')
        .select('*, conversation_sessions!inner(user_id)', { count: 'exact', head: true })
        .eq('conversation_sessions.user_id', user.id)
        .eq('role', 'persona')
        .eq('is_read', false);

      return NextResponse.json({ unreadCount: count || 0 });
    }

    return NextResponse.json({ unreadCount: data || 0 });
  } catch (error) {
    console.error('[DM Read] Error:', error);
    return serverError(error);
  }
}
