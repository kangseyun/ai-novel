import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser, unauthorized, serverError } from '@/lib/auth';
import { createClient } from '@/lib/supabase-server';

/**
 * GET /api/ai/events/pending
 * 전달 대기 중인 이벤트 목록 조회
 */
export async function GET(request: NextRequest) {
  try {
    const user = await getAuthUser(request);
    if (!user) return unauthorized();

    const supabase = await createClient();

    // 현재 시간 이전에 예약된, 아직 전달되지 않은 이벤트들
    const { data: events, error } = await supabase
      .from('scheduled_events')
      .select(`
        id,
        persona_id,
        event_type,
        scheduled_for,
        event_data,
        trigger_rule_id
      `)
      .eq('user_id', user.id)
      .eq('status', 'pending')
      .lte('scheduled_for', new Date().toISOString())
      .order('scheduled_for', { ascending: true });

    if (error) {
      console.error('[Pending Events] DB error:', error);
      throw error;
    }

    return NextResponse.json({
      events: events?.map((event: { id: string; persona_id: string; event_type: string; scheduled_for: string; event_data: Record<string, unknown> | null; trigger_rule_id: string | null }) => ({
        id: event.id,
        personaId: event.persona_id,
        type: event.event_type,
        scheduledFor: event.scheduled_for,
        triggerRuleId: event.trigger_rule_id,
        preview: event.event_data?.preview || null,
      })) || [],
    });
  } catch (error) {
    console.error('[Pending Events] Error:', error);
    return serverError(error);
  }
}
