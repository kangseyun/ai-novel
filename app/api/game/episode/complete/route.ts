import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase-server';
import { getAuthUser, unauthorized, badRequest, serverError } from '@/lib/auth';

// POST /api/game/episode/complete - 에피소드 완료
export async function POST(request: NextRequest) {
  try {
    const user = await getAuthUser(request);
    if (!user) return unauthorized();

    const { session_id, episode_id } = await request.json();

    if (!session_id || !episode_id) {
      return badRequest('session_id and episode_id are required');
    }

    const supabase = await createServerClient();

    // 1. 세션 확인 및 완료 처리
    const { data: session, error: sessionError } = await supabase
      .from('game_sessions')
      .select('*')
      .eq('id', session_id)
      .eq('user_id', user.id)
      .single();

    if (sessionError || !session) {
      return NextResponse.json(
        { error: 'Session not found' },
        { status: 404 }
      );
    }

    // 세션 완료 처리
    await supabase
      .from('game_sessions')
      .update({
        status: 'completed',
        completed_at: new Date().toISOString(),
      })
      .eq('id', session_id);

    // 2. 게임 상태 업데이트
    const { data: gameState } = await supabase
      .from('game_state')
      .select('*')
      .eq('user_id', user.id)
      .eq('persona_id', session.persona_id)
      .single();

    const completedEpisodes = [...new Set([...(gameState?.completed_episodes || []), episode_id])];
    const nextEpisode = getNextEpisode(episode_id);
    const unlockedEpisodes = [...new Set([...(gameState?.unlocked_episodes || []), nextEpisode])].filter(Boolean);

    const oldStage = gameState?.relationship_stage || 'stranger';
    const newAffection = Math.min(100, (gameState?.affection || 0) + 15); // 에피소드 완료 보너스
    const newStage = calculateRelationshipStage(newAffection);

    await supabase
      .from('game_state')
      .update({
        completed_episodes: completedEpisodes,
        unlocked_episodes: unlockedEpisodes,
        current_episode: null,
        current_scene: null,
        current_beat: 0,
        affection: newAffection,
        relationship_stage: newStage,
        last_interaction: new Date().toISOString(),
      })
      .eq('user_id', user.id)
      .eq('persona_id', session.persona_id);

    // 3. 언락 아이템 확인 및 추가
    const unlockedItems = getUnlockedItems(episode_id, newAffection);

    if (unlockedItems.length > 0) {
      const itemsToInsert = unlockedItems.map(item => ({
        user_id: user.id,
        persona_id: session.persona_id,
        item_id: item.id,
        item_type: item.type,
      }));

      await supabase
        .from('unlocked_items')
        .upsert(itemsToInsert, {
          onConflict: 'user_id,persona_id,item_id',
        });
    }

    // 4. 해킹 레벨 XP 추가
    const { data: hackProgress } = await supabase
      .from('hack_progress')
      .select('*')
      .eq('user_id', user.id)
      .eq('persona_id', session.persona_id)
      .single();

    const xpGained = 100;
    const newXp = (hackProgress?.xp || 0) + xpGained;
    const newLevel = calculateHackLevel(newXp);

    await supabase
      .from('hack_progress')
      .upsert({
        user_id: user.id,
        persona_id: session.persona_id,
        xp: newXp,
        level: newLevel,
      }, {
        onConflict: 'user_id,persona_id',
      });

    return NextResponse.json({
      completed: true,
      total_affection_gained: 15,
      new_affection: newAffection,
      unlocked_items: unlockedItems,
      unlocked_episodes: nextEpisode ? [nextEpisode] : [],
      stage_changed: oldStage !== newStage
        ? { from: oldStage, to: newStage }
        : null,
      hack_xp_gained: xpGained,
    });
  } catch (error) {
    return serverError(error);
  }
}

function getNextEpisode(currentEpisode: string): string | null {
  const episodeOrder = ['ep1', 'ep2', 'ep3', 'ep4', 'ep5'];
  const currentIndex = episodeOrder.indexOf(currentEpisode);
  if (currentIndex >= 0 && currentIndex < episodeOrder.length - 1) {
    return episodeOrder[currentIndex + 1];
  }
  return null;
}

function calculateRelationshipStage(affection: number): string {
  if (affection >= 90) return 'lover';
  if (affection >= 70) return 'close';
  if (affection >= 50) return 'friend';
  if (affection >= 30) return 'acquaintance';
  return 'stranger';
}

function getUnlockedItems(episodeId: string, affection: number): Array<{ id: string; type: string }> {
  const items: Array<{ id: string; type: string }> = [];

  // 에피소드별 CG 언락
  const episodeCGs: Record<string, string> = {
    ep1: 'cg_jun_convenience_store',
    ep2: 'cg_jun_practice_room',
    ep3: 'cg_jun_han_river',
  };

  if (episodeCGs[episodeId]) {
    items.push({ id: episodeCGs[episodeId], type: 'cg' });
  }

  // 호감도 기반 보너스 아이템
  if (affection >= 50) {
    items.push({ id: 'voice_jun_greeting', type: 'voice' });
  }
  if (affection >= 80) {
    items.push({ id: 'cg_jun_smile', type: 'cg' });
  }

  return items;
}

function calculateHackLevel(xp: number): number {
  if (xp >= 1000) return 5;
  if (xp >= 500) return 4;
  if (xp >= 250) return 3;
  if (xp >= 100) return 2;
  return 1;
}
