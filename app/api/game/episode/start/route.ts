import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase-server';
import { getAuthUser, unauthorized, badRequest, serverError } from '@/lib/auth';

// POST /api/game/episode/start - 에피소드 시작
export async function POST(request: NextRequest) {
  try {
    const user = await getAuthUser(request);
    if (!user) return unauthorized();

    const { persona_id, episode_id } = await request.json();

    if (!persona_id || !episode_id) {
      return badRequest('persona_id and episode_id are required');
    }

    const supabase = await createServerClient();

    // 1. 게임 상태 확인
    const { data: gameState } = await supabase
      .from('game_state')
      .select('*')
      .eq('user_id', user.id)
      .eq('persona_id', persona_id)
      .single();

    // 에피소드 잠금 확인 (unlocked_episodes에 있는지)
    if (gameState && !gameState.unlocked_episodes?.includes(episode_id)) {
      return NextResponse.json(
        { error: 'Episode is locked' },
        { status: 403 }
      );
    }

    // 2. 새 게임 세션 생성
    const { data: session, error: sessionError } = await supabase
      .from('game_sessions')
      .insert({
        user_id: user.id,
        persona_id,
        episode_id,
        scene_id: 'scene1',
        beat_index: 0,
        status: 'active',
      })
      .select()
      .single();

    if (sessionError) {
      return serverError(sessionError);
    }

    // 3. 게임 상태 업데이트
    await supabase
      .from('game_state')
      .upsert({
        user_id: user.id,
        persona_id,
        current_episode: episode_id,
        current_scene: 'scene1',
        current_beat: 0,
        last_interaction: new Date().toISOString(),
      }, {
        onConflict: 'user_id,persona_id',
      });

    // 4. 초기 씬 데이터 반환 (실제로는 시나리오 데이터에서 가져옴)
    return NextResponse.json({
      session_id: session.id,
      episode: {
        id: episode_id,
        title: getEpisodeTitle(episode_id),
      },
      initial_scene: {
        id: 'scene1',
        setting: {
          location: getEpisodeLocation(episode_id),
          time: getEpisodeTime(episode_id),
          mood: 'neutral',
        },
      },
    });
  } catch (error) {
    return serverError(error);
  }
}

// 헬퍼 함수들 (실제로는 시나리오 데이터베이스에서 가져옴)
function getEpisodeTitle(episodeId: string): string {
  const titles: Record<string, string> = {
    ep1: '새벽 3시, 편의점',
    ep2: '비밀 연락처',
    ep3: '처음 보는 모습',
  };
  return titles[episodeId] || '에피소드';
}

function getEpisodeLocation(episodeId: string): string {
  const locations: Record<string, string> = {
    ep1: '편의점',
    ep2: '연습실',
    ep3: '한강공원',
  };
  return locations[episodeId] || '???';
}

function getEpisodeTime(episodeId: string): string {
  const times: Record<string, string> = {
    ep1: '새벽 3시',
    ep2: '밤 11시',
    ep3: '저녁 7시',
  };
  return times[episodeId] || '???';
}
