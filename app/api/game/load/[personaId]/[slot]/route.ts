import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';
import { getAuthUser, unauthorized, serverError } from '@/lib/auth';

// GET /api/game/load/:personaId/:slot - 게임 불러오기
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ personaId: string; slot: string }> }
) {
  try {
    const user = await getAuthUser(request);
    if (!user) return unauthorized();

    const { personaId } = await params;
    const supabase = createServerClient();

    // 게임 상태 조회 (slot은 현재 미사용, 추후 다중 슬롯 지원시 사용)
    const { data: gameState, error } = await supabase
      .from('game_state')
      .select('*')
      .eq('user_id', user.id)
      .eq('persona_id', personaId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return NextResponse.json(
          { error: 'No save data found' },
          { status: 404 }
        );
      }
      return serverError(error);
    }

    return NextResponse.json({
      persona_id: gameState.persona_id,
      affection: gameState.affection,
      relationship_stage: gameState.relationship_stage,
      current_episode: gameState.current_episode,
      current_scene: gameState.current_scene,
      current_beat: gameState.current_beat,
      completed_episodes: gameState.completed_episodes || [],
      unlocked_episodes: gameState.unlocked_episodes || [],
      story_flags: gameState.story_flags || {},
      last_saved: gameState.last_interaction,
    });
  } catch (error) {
    return serverError(error);
  }
}
