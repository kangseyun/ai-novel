import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser, unauthorized, badRequest, serverError } from '@/lib/auth';
import { createServerClient } from '@/lib/supabase-server';

/**
 * GET /api/ai/session?personaId=xxx
 * 특정 페르소나와의 대화 세션 조회
 */
export async function GET(request: NextRequest) {
  try {
    const user = await getAuthUser(request);
    if (!user) return unauthorized();

    const { searchParams } = new URL(request.url);
    const personaId = searchParams.get('personaId');

    if (!personaId) {
      return badRequest('personaId is required');
    }

    const supabase = await createServerClient();

    // 활성 세션 조회 (status가 'active'이거나 null인 경우 - 하위호환성)
    const { data: session, error } = await supabase
      .from('conversation_sessions')
      .select(`
        id,
        persona_id,
        status,
        current_scenario,
        relationship_stage,
        emotional_state,
        conversation_summary,
        created_at,
        last_message_at
      `)
      .eq('user_id', user.id)
      .eq('persona_id', personaId)
      .or('status.eq.active,status.is.null')
      .order('last_message_at', { ascending: false, nullsFirst: false })
      .limit(1)
      .single();

    if (error && error.code !== 'PGRST116') {
      console.error('[Session] DB error:', error);
      throw error;
    }

    if (!session) {
      return NextResponse.json({ session: null });
    }

    // 최근 메시지 조회
    const { data: messages } = await supabase
      .from('conversation_messages')
      .select('*')
      .eq('session_id', session.id)
      .order('sequence_number', { ascending: false })
      .limit(20);

    return NextResponse.json({
      session: {
        id: session.id,
        personaId: session.persona_id,
        currentScenario: session.current_scenario,
        relationshipStage: session.relationship_stage,
        emotionalState: session.emotional_state,
        contextSummary: session.conversation_summary,
        startedAt: session.created_at,
        lastMessageAt: session.last_message_at,
      },
      messages: messages?.reverse().map(m => ({
        id: m.id,
        role: m.role,
        content: m.content,
        emotion: m.emotion,
        innerThought: m.inner_thought,
        choicesPresented: m.choices_presented,
        choiceSelected: m.choice_selected,
        createdAt: m.created_at,
      })) || [],
    });
  } catch (error) {
    console.error('[Session] Error:', error);
    return serverError(error);
  }
}

/**
 * POST /api/ai/session
 * 새 대화 세션 시작
 */
export async function POST(request: NextRequest) {
  try {
    const user = await getAuthUser(request);
    if (!user) return unauthorized();

    const { personaId, episodeId } = await request.json();

    if (!personaId) {
      return badRequest('personaId is required');
    }

    const supabase = await createServerClient();

    // 기존 활성 세션이 있으면 비활성화
    await supabase
      .from('conversation_sessions')
      .update({ status: 'ended' })
      .eq('user_id', user.id)
      .eq('persona_id', personaId)
      .eq('status', 'active');

    // 새 세션 생성
    const { data: session, error } = await supabase
      .from('conversation_sessions')
      .insert({
        user_id: user.id,
        persona_id: personaId,
        status: 'active',
        current_scenario: episodeId ? { episodeId } : null,
        relationship_stage: 'stranger',
        emotional_state: { mood: 'neutral', intensity: 0.5 },
        last_message_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (error) {
      console.error('[Session Create] DB error:', error);
      throw error;
    }

    return NextResponse.json({
      session: {
        id: session.id,
        personaId: session.persona_id,
        currentScenario: session.current_scenario,
        relationshipStage: session.relationship_stage,
        emotionalState: session.emotional_state,
        startedAt: session.created_at,
      },
    });
  } catch (error) {
    console.error('[Session Create] Error:', error);
    return serverError(error);
  }
}

/**
 * DELETE /api/ai/session?sessionId=xxx
 * 대화 세션 종료
 */
export async function DELETE(request: NextRequest) {
  try {
    const user = await getAuthUser(request);
    if (!user) return unauthorized();

    const { searchParams } = new URL(request.url);
    const sessionId = searchParams.get('sessionId');

    if (!sessionId) {
      return badRequest('sessionId is required');
    }

    const supabase = await createServerClient();

    const { error } = await supabase
      .from('conversation_sessions')
      .update({ status: 'ended' })
      .eq('id', sessionId)
      .eq('user_id', user.id);

    if (error) {
      console.error('[Session Delete] DB error:', error);
      throw error;
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[Session Delete] Error:', error);
    return serverError(error);
  }
}
