import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';
import { getAuthUser, unauthorized, badRequest, serverError } from '@/lib/auth';

// POST /api/game/choice - 선택지 선택
export async function POST(request: NextRequest) {
  try {
    const user = await getAuthUser(request);
    if (!user) return unauthorized();

    const { session_id, scene_id, beat_id, choice_id, is_premium } = await request.json();

    if (!session_id || !choice_id) {
      return badRequest('session_id and choice_id are required');
    }

    const supabase = createServerClient();

    // 1. 세션 확인
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

    if (session.status !== 'active') {
      return NextResponse.json(
        { error: 'Session is not active' },
        { status: 400 }
      );
    }

    // 2. 프리미엄 선택지면 젬 차감
    if (is_premium) {
      const { data: userData } = await supabase
        .from('users')
        .select('gems')
        .eq('id', user.id)
        .single();

      if (!userData || userData.gems < 50) {
        return NextResponse.json(
          { error: 'Not enough gems' },
          { status: 402 }
        );
      }

      await supabase
        .from('users')
        .update({ gems: userData.gems - 50 })
        .eq('id', user.id);
    }

    // 3. 선택에 따른 호감도 변화 계산 (실제로는 시나리오 데이터 기반)
    const affectionChange = calculateAffectionChange(choice_id, is_premium);

    // 4. 게임 상태 업데이트
    const { data: gameState } = await supabase
      .from('game_state')
      .select('affection, story_flags')
      .eq('user_id', user.id)
      .eq('persona_id', session.persona_id)
      .single();

    const newAffection = Math.max(0, Math.min(100, (gameState?.affection || 0) + affectionChange));
    const newFlags = {
      ...(gameState?.story_flags || {}),
      [`choice_${choice_id}`]: true,
    };

    // 관계 단계 계산
    const newStage = calculateRelationshipStage(newAffection);

    const { error: updateError } = await supabase
      .from('game_state')
      .update({
        affection: newAffection,
        story_flags: newFlags,
        relationship_stage: newStage,
        current_beat: session.beat_index + 1,
        last_interaction: new Date().toISOString(),
      })
      .eq('user_id', user.id)
      .eq('persona_id', session.persona_id);

    if (updateError) {
      return serverError(updateError);
    }

    // 5. 대화 기록 저장
    await supabase.from('conversation_history').insert({
      user_id: user.id,
      persona_id: session.persona_id,
      episode_id: session.episode_id,
      scene_id,
      beat_id,
      speaker: 'user',
      choice_made: choice_id,
      affection_change: affectionChange,
    });

    // 6. 세션 업데이트
    await supabase
      .from('game_sessions')
      .update({ beat_index: session.beat_index + 1 })
      .eq('id', session_id);

    // 7. 응답 생성 (실제로는 LLM이나 시나리오 데이터 기반)
    const nextBeat = generateNextBeat(choice_id, is_premium);

    return NextResponse.json({
      success: true,
      affection_change: affectionChange,
      new_affection: newAffection,
      flags_updated: { [`choice_${choice_id}`]: true },
      next_beat: nextBeat,
      stage_changed: gameState?.affection && calculateRelationshipStage(gameState.affection) !== newStage
        ? { from: calculateRelationshipStage(gameState.affection), to: newStage }
        : null,
    });
  } catch (error) {
    return serverError(error);
  }
}

function calculateAffectionChange(choiceId: string, isPremium: boolean): number {
  // 프리미엄 선택지는 더 높은 호감도
  if (isPremium) return 10;

  // 일반 선택지는 선택에 따라 다름
  const affectionMap: Record<string, number> = {
    'caring': 5,
    'playful': 3,
    'neutral': 1,
    'cold': -2,
  };

  // choice_id에서 톤 추출 (예: choice_caring_1 -> caring)
  const tone = choiceId.split('_')[1] || 'neutral';
  return affectionMap[tone] || 2;
}

function calculateRelationshipStage(affection: number): string {
  if (affection >= 90) return 'lover';
  if (affection >= 70) return 'close';
  if (affection >= 50) return 'friend';
  if (affection >= 30) return 'acquaintance';
  return 'stranger';
}

function generateNextBeat(choiceId: string, isPremium: boolean) {
  // 실제로는 LLM이나 시나리오 데이터에서 생성
  return {
    id: `beat_${Date.now()}`,
    type: 'dialogue',
    speaker: 'jun',
    emotion: isPremium ? 'touched' : 'happy',
    text: isPremium
      ? '...고마워. 진심으로.'
      : '그렇구나... ㅎㅎ',
    tts_url: null,
  };
}
