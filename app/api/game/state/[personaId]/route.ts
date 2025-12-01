import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase-server';
import { getAuthUser, unauthorized, serverError } from '@/lib/auth';

// GET /api/game/state/:personaId - 게임 상태 조회
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ personaId: string }> }
) {
  try {
    const user = await getAuthUser(request);
    if (!user) return unauthorized();

    const { personaId } = await params;
    const supabase = await createServerClient();

    // 게임 상태 조회
    let { data: gameState, error } = await supabase
      .from('game_state')
      .select('*')
      .eq('user_id', user.id)
      .eq('persona_id', personaId)
      .single();

    // 없으면 초기 상태 생성
    if (error && error.code === 'PGRST116') {
      const { data: newState, error: insertError } = await supabase
        .from('game_state')
        .insert({
          user_id: user.id,
          persona_id: personaId,
          affection: 0,
          relationship_stage: 'stranger',
          unlocked_episodes: ['ep1'],
          story_flags: {},
        })
        .select()
        .single();

      if (insertError) {
        return serverError(insertError);
      }

      gameState = newState;
    } else if (error) {
      return serverError(error);
    }

    return NextResponse.json({
      persona_id: gameState.persona_id,
      affection: gameState.affection,
      relationship_stage: gameState.relationship_stage,
      completed_episodes: gameState.completed_episodes || [],
      unlocked_episodes: gameState.unlocked_episodes || ['ep1'],
      current_episode: gameState.current_episode ? {
        id: gameState.current_episode,
        scene_id: gameState.current_scene,
        beat_index: gameState.current_beat,
      } : null,
      story_flags: gameState.story_flags || {},
      last_interaction: gameState.last_interaction,
    });
  } catch (error) {
    return serverError(error);
  }
}
