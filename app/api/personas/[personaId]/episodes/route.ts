import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase-server';
import { getAuthUser } from '@/lib/auth';

// GET /api/personas/:personaId/episodes - 에피소드 목록 조회
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ personaId: string }> }
) {
  const { personaId } = await params;
  const user = await getAuthUser(request);

  // 에피소드 정적 데이터
  const allEpisodes: Record<string, Array<{
    id: string;
    title: string;
    premise: string;
    duration_minutes: number;
    is_premium: boolean;
    thumbnail: string;
    unlock_requirements?: {
      min_affection?: number;
      token_cost?: number;
    };
  }>> = {
    jun: [
      {
        id: 'ep1',
        title: '새벽 3시, 편의점',
        premise: '우연한 첫 만남',
        duration_minutes: 15,
        is_premium: false,
        thumbnail: '/episodes/jun-ep1.jpg',
      },
      {
        id: 'ep2',
        title: '비밀 연락처',
        premise: '그의 개인 번호',
        duration_minutes: 20,
        is_premium: true,
        thumbnail: '/episodes/jun-ep2.jpg',
        unlock_requirements: {
          min_affection: 30,
          token_cost: 100,
        },
      },
      {
        id: 'ep3',
        title: '처음 보는 모습',
        premise: '무대 뒤의 그',
        duration_minutes: 25,
        is_premium: true,
        thumbnail: '/episodes/jun-ep3.jpg',
        unlock_requirements: {
          min_affection: 50,
          token_cost: 150,
        },
      },
      {
        id: 'ep4',
        title: '비밀 데이트',
        premise: '둘만의 시간',
        duration_minutes: 30,
        is_premium: true,
        thumbnail: '/episodes/jun-ep4.jpg',
        unlock_requirements: {
          min_affection: 70,
          token_cost: 200,
        },
      },
      {
        id: 'ep5',
        title: '고백',
        premise: '진심을 전하다',
        duration_minutes: 35,
        is_premium: true,
        thumbnail: '/episodes/jun-ep5.jpg',
        unlock_requirements: {
          min_affection: 90,
          token_cost: 300,
        },
      },
    ],
  };

  const episodes = allEpisodes[personaId] || [];

  // 로그인한 사용자의 경우 잠금 상태 확인
  let unlockedEpisodes: string[] = ['ep1'];
  let userAffection = 0;

  if (user) {
    const supabase = await createServerClient();
    const { data: gameState } = await supabase
      .from('game_state')
      .select('unlocked_episodes, affection')
      .eq('user_id', user.id)
      .eq('persona_id', personaId)
      .single();

    if (gameState) {
      unlockedEpisodes = gameState.unlocked_episodes || ['ep1'];
      userAffection = gameState.affection || 0;
    }
  }

  const episodesWithLockStatus = episodes.map(ep => ({
    ...ep,
    is_locked: !unlockedEpisodes.includes(ep.id),
    can_unlock: ep.unlock_requirements
      ? userAffection >= (ep.unlock_requirements.min_affection || 0)
      : true,
  }));

  return NextResponse.json({ episodes: episodesWithLockStatus });
}
