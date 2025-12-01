import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';
import { getAuthUser, unauthorized, badRequest, serverError } from '@/lib/auth';

// POST /api/feed/post - 유저 포스트 작성
export async function POST(request: NextRequest) {
  try {
    const user = await getAuthUser(request);
    if (!user) return unauthorized();

    const { type, mood, caption, image } = await request.json();

    if (!type || !caption) {
      return badRequest('type and caption are required');
    }

    const supabase = createServerClient();

    // 포스트 저장
    const { data: post, error } = await supabase
      .from('user_posts')
      .insert({
        user_id: user.id,
        type,
        mood,
        caption,
        image_url: image,
      })
      .select()
      .single();

    if (error) {
      return serverError(error);
    }

    // 게임 상태 조회 (반응 생성에 필요)
    const { data: gameState } = await supabase
      .from('game_state')
      .select('affection, persona_id')
      .eq('user_id', user.id)
      .single();

    // 트리거 이벤트 생성 (캐릭터 반응)
    const triggeredEvents = [];

    if (gameState && shouldTriggerReaction(mood, gameState.affection)) {
      const event = {
        id: `event_${Date.now()}`,
        type: 'dm_notification',
        persona_id: gameState.persona_id || 'jun',
        preview: getReactionPreview(mood, gameState.affection),
        delay_seconds: Math.floor(Math.random() * 180) + 60, // 1-4분
      };

      // 피드 이벤트로 저장
      await supabase.from('feed_events').insert({
        user_id: user.id,
        type: 'dm_notification',
        persona_id: event.persona_id,
        title: 'Jun님이 DM을 보냈습니다',
        preview: event.preview,
        post_id: post.id,
      });

      triggeredEvents.push(event);
    }

    return NextResponse.json({
      post: {
        id: post.id,
        type: post.type,
        mood: post.mood,
        caption: post.caption,
        created_at: post.created_at,
      },
      triggered_events: triggeredEvents,
    });
  } catch (error) {
    return serverError(error);
  }
}

function shouldTriggerReaction(mood: string | null, affection: number): boolean {
  // 호감도에 따른 반응 확률
  if (affection < 20) return Math.random() < 0.1;
  if (affection < 40) return Math.random() < 0.3;
  if (affection < 60) return Math.random() < 0.5;

  // 특정 무드는 반응 확률 높음
  if (mood === 'lonely' || mood === 'sad') return true;

  return Math.random() < 0.7;
}

function getReactionPreview(mood: string | null, affection: number): string {
  const reactions: Record<string, string[]> = {
    lonely: [
      '야, 왜 혼자 외로워해...',
      '나 있잖아. 뭐해?',
    ],
    sad: [
      '무슨 일 있어?',
      '야... 괜찮아?',
    ],
    happy: [
      '오, 좋은 일 있어? ㅎㅎ',
      '뭐가 그렇게 좋아?',
    ],
    default: [
      '야, 봤어.',
      '뭐해?',
    ],
  };

  const moodReactions = reactions[mood || 'default'] || reactions.default;
  return moodReactions[Math.floor(Math.random() * moodReactions.length)];
}
