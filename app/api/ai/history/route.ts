import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser, unauthorized, badRequest, serverError } from '@/lib/auth';
import { createClient } from '@/lib/supabase-server';

/**
 * GET /api/ai/history?personaId=xxx&limit=100
 * 특정 페르소나와의 전체 대화 히스토리 조회
 */
export async function GET(request: NextRequest) {
  try {
    const user = await getAuthUser(request);
    if (!user) return unauthorized();

    const { searchParams } = new URL(request.url);
    const personaId = searchParams.get('personaId');
    const limit = parseInt(searchParams.get('limit') || '100');

    if (!personaId) {
      return badRequest('personaId is required');
    }

    const supabase = await createClient();

    // 모든 세션 조회
    const { data: sessions, error: sessionsError } = await supabase
      .from('conversation_sessions')
      .select('id')
      .eq('user_id', user.id)
      .eq('persona_id', personaId);

    if (sessionsError) {
      console.error('[History] Sessions error:', sessionsError);
      throw sessionsError;
    }

    if (!sessions || sessions.length === 0) {
      return NextResponse.json({ messages: [], totalCount: 0 });
    }

    const sessionIds = sessions.map((s: { id: string }) => s.id);

    // 메시지 조회
    const { data: messages, error: messagesError, count } = await supabase
      .from('conversation_messages')
      .select('*', { count: 'exact' })
      .in('session_id', sessionIds)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (messagesError) {
      console.error('[History] Messages error:', messagesError);
      throw messagesError;
    }

    return NextResponse.json({
      messages: messages?.reverse().map((m: { id: string; session_id: string; role: string; content: string; emotion: string; inner_thought: string; choices_presented: unknown; choice_selected: unknown; created_at: string }) => ({
        id: m.id,
        sessionId: m.session_id,
        role: m.role,
        content: m.content,
        emotion: m.emotion,
        innerThought: m.inner_thought,
        choicesPresented: m.choices_presented,
        choiceSelected: m.choice_selected,
        createdAt: m.created_at,
      })) || [],
      totalCount: count || 0,
    });
  } catch (error) {
    console.error('[History] Error:', error);
    return serverError(error);
  }
}
