import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase-server';
import { getAuthUser, unauthorized, badRequest, serverError } from '@/lib/auth';

// POST /api/user/onboarding/complete - 온보딩 완료 처리
export async function POST(request: NextRequest) {
  try {
    const user = await getAuthUser(request);
    if (!user) return unauthorized();

    const { variant, persona_id, affection_gained, choices_made } = await request.json();

    if (!variant || !persona_id) {
      return badRequest('variant and persona_id are required');
    }

    const supabase = await createServerClient();

    // 1. 사용자 온보딩 완료 표시
    const { error: userError } = await supabase
      .from('users')
      .update({
        onboarding_completed: true,
        onboarding_variant: variant,
      })
      .eq('id', user.id);

    if (userError) {
      return serverError(userError);
    }

    // 2. 게임 상태 초기화 (첫 페르소나와의 관계 시작)
    const { error: gameStateError } = await supabase
      .from('game_state')
      .upsert({
        user_id: user.id,
        persona_id,
        affection: affection_gained || 0,
        relationship_stage: 'acquaintance',
        unlocked_episodes: ['ep1'],
        story_flags: {},
      }, {
        onConflict: 'user_id,persona_id',
      });

    if (gameStateError) {
      return serverError(gameStateError);
    }

    // 3. 대화 기록 저장 (선택지 기록)
    if (choices_made && Array.isArray(choices_made)) {
      const historyRecords = choices_made.map((choice: { scene_id: string; choice_id: string }) => ({
        user_id: user.id,
        persona_id,
        scene_id: choice.scene_id,
        choice_made: choice.choice_id,
        speaker: 'user',
        content: '',
      }));

      if (historyRecords.length > 0) {
        await supabase.from('conversation_history').insert(historyRecords);
      }
    }

    // 4. 해킹 레벨 초기화
    await supabase
      .from('hack_progress')
      .upsert({
        user_id: user.id,
        persona_id,
        level: 1,
        xp: 0,
      }, {
        onConflict: 'user_id,persona_id',
      });

    return NextResponse.json({
      success: true,
      message: 'Onboarding completed',
      initial_state: {
        persona_id,
        affection: affection_gained || 0,
        relationship_stage: 'acquaintance',
      },
    });
  } catch (error) {
    return serverError(error);
  }
}
