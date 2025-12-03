import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser, unauthorized, serverError } from '@/lib/auth';
import { createServerClient } from '@/lib/supabase-server';

/**
 * GET /api/dm/list
 * DM 대화 목록 조회
 */
export async function GET(request: NextRequest) {
  try {
    const user = await getAuthUser(request);
    if (!user) return unauthorized();

    const supabase = await createServerClient();

    // 사용자의 모든 대화 세션 조회 (페르소나별로 그룹화)
    const { data: sessions, error: sessionsError } = await supabase
      .from('conversation_sessions')
      .select(`
        id,
        persona_id,
        status,
        last_message_at,
        created_at
      `)
      .eq('user_id', user.id)
      .order('last_message_at', { ascending: false, nullsFirst: false });

    if (sessionsError) {
      console.error('[DM List] Sessions error:', sessionsError);
      throw sessionsError;
    }

    // 페르소나별로 가장 최근 세션만 유지
    const latestSessionsByPersona = new Map<string, (typeof sessions)[0]>();
    for (const session of sessions || []) {
      if (!latestSessionsByPersona.has(session.persona_id)) {
        latestSessionsByPersona.set(session.persona_id, session);
      }
    }

    // 페르소나 정보 조회
    const personaIds = Array.from(latestSessionsByPersona.keys());

    if (personaIds.length === 0) {
      return NextResponse.json({ conversations: [] });
    }

    // 새로운 컬럼들 조회 (없으면 fallback)
    const { data: personas, error: personasError } = await supabase
      .from('personas')
      .select('id, name, display_name, avatar_url, is_verified')
      .in('id', personaIds);

    if (personasError) {
      console.error('[DM List] Personas error:', personasError);
      throw personasError;
    }

    // 각 세션의 마지막 메시지 조회
    const conversations = await Promise.all(
      Array.from(latestSessionsByPersona.entries()).map(async ([personaId, session]) => {
        const persona = personas?.find(p => p.id === personaId);

        // 마지막 메시지 조회
        const { data: lastMessage } = await supabase
          .from('conversation_messages')
          .select('content, created_at')
          .eq('session_id', session.id)
          .order('sequence_number', { ascending: false })
          .limit(1)
          .single();

        // 읽지 않은 메시지 수 - 현재 read 컬럼이 없으므로 0으로 설정
        // TODO: read 컬럼 추가 후 구현 필요
        const unreadCount = 0;

        return {
          personaId,
          personaName: persona?.name || 'Unknown',
          personaDisplayName: persona?.display_name || persona?.name || 'Unknown',
          personaImage: persona?.avatar_url || '/default-avatar.png',
          isVerified: persona?.is_verified ?? true,
          lastMessage: lastMessage?.content || '대화를 시작해보세요',
          lastMessageAt: lastMessage?.created_at || session.last_message_at || session.created_at,
          unreadCount: unreadCount || 0,
          isOnline: true, // 페르소나는 항상 온라인
        };
      })
    );

    // 마지막 메시지 시간순으로 정렬
    conversations.sort((a, b) =>
      new Date(b.lastMessageAt).getTime() - new Date(a.lastMessageAt).getTime()
    );

    return NextResponse.json({ conversations });
  } catch (error) {
    console.error('[DM List] Error:', error);
    return serverError(error);
  }
}
