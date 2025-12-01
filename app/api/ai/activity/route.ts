import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser, unauthorized, badRequest, serverError } from '@/lib/auth';
import { createClient } from '@/lib/supabase-server';

/**
 * POST /api/ai/activity
 * 사용자 활동 로깅 (AI 판단에 활용)
 */
export async function POST(request: NextRequest) {
  try {
    const user = await getAuthUser(request);
    if (!user) return unauthorized();

    const { actionType, personaId, actionData } = await request.json();

    if (!actionType) {
      return badRequest('actionType is required');
    }

    const supabase = await createClient();

    // 활동 로그 저장
    const { error } = await supabase.from('user_activity_log').insert({
      user_id: user.id,
      persona_id: personaId || null,
      action_type: actionType,
      action_data: actionData || {},
      created_at: new Date().toISOString(),
    });

    if (error) {
      console.error('[Activity Log] DB error:', error);
      throw error;
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[Activity Log] Error:', error);
    return serverError(error);
  }
}

/**
 * GET /api/ai/activity?personaId=xxx&limit=50
 * 최근 활동 로그 조회
 */
export async function GET(request: NextRequest) {
  try {
    const user = await getAuthUser(request);
    if (!user) return unauthorized();

    const { searchParams } = new URL(request.url);
    const personaId = searchParams.get('personaId');
    const limit = parseInt(searchParams.get('limit') || '50');

    const supabase = await createClient();

    let query = supabase
      .from('user_activity_log')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (personaId) {
      query = query.eq('persona_id', personaId);
    }

    const { data: activities, error } = await query;

    if (error) {
      console.error('[Activity Log] DB error:', error);
      throw error;
    }

    return NextResponse.json({
      activities: activities?.map((a: { id: string; action_type: string; persona_id: string; action_data: Record<string, unknown>; created_at: string }) => ({
        id: a.id,
        actionType: a.action_type,
        personaId: a.persona_id,
        actionData: a.action_data,
        createdAt: a.created_at,
      })) || [],
    });
  } catch (error) {
    console.error('[Activity Log] Error:', error);
    return serverError(error);
  }
}
