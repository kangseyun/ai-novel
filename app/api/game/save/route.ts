import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';
import { getAuthUser, unauthorized, badRequest, serverError } from '@/lib/auth';

// POST /api/game/save - 게임 저장
export async function POST(request: NextRequest) {
  try {
    const user = await getAuthUser(request);
    if (!user) return unauthorized();

    const { persona_id, slot = 1 } = await request.json();

    if (!persona_id) {
      return badRequest('persona_id is required');
    }

    const supabase = createServerClient();

    // 현재 게임 상태 가져오기
    const { data: gameState, error } = await supabase
      .from('game_state')
      .select('*')
      .eq('user_id', user.id)
      .eq('persona_id', persona_id)
      .single();

    if (error) {
      return serverError(error);
    }

    // 저장 데이터 생성 (실제로는 별도 save_slots 테이블 사용)
    // 여기서는 단순히 현재 상태를 저장된 것으로 표시
    const saveData = {
      slot,
      persona_id,
      affection: gameState.affection,
      relationship_stage: gameState.relationship_stage,
      current_episode: gameState.current_episode,
      current_scene: gameState.current_scene,
      current_beat: gameState.current_beat,
      story_flags: gameState.story_flags,
      saved_at: new Date().toISOString(),
    };

    return NextResponse.json({
      success: true,
      save: saveData,
    });
  } catch (error) {
    return serverError(error);
  }
}
