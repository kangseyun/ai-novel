import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';
import { getAuthUser, unauthorized, serverError } from '@/lib/auth';

// GET /api/feed - 피드 조회
export async function GET(request: NextRequest) {
  try {
    const user = await getAuthUser(request);
    if (!user) return unauthorized();

    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');
    const offset = (page - 1) * limit;

    const supabase = createServerClient();

    // 사용자 포스트 조회
    const { data: userPosts, error } = await supabase
      .from('user_posts')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) {
      return serverError(error);
    }

    // 페르소나 포스트 (정적 + 동적 혼합)
    const personaPosts = getPersonaPosts(page);

    // 사용자 포스트와 페르소나 포스트 합치기
    const allPosts = [
      ...personaPosts.map(p => ({ ...p, type: 'persona_post' })),
      ...(userPosts || []).map(p => ({
        id: p.id,
        type: 'user_post',
        content: {
          mood: p.mood,
          caption: p.caption,
          image: p.image_url,
        },
        created_at: p.created_at,
      })),
    ].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

    return NextResponse.json({
      posts: allPosts.slice(0, limit),
      next_page: allPosts.length > limit ? page + 1 : null,
    });
  } catch (error) {
    return serverError(error);
  }
}

function getPersonaPosts(page: number) {
  // 정적 페르소나 포스트 (실제로는 DB에서 가져옴)
  const posts = [
    {
      id: 'jun_post_1',
      persona_id: 'jun',
      content: {
        images: ['/feed/jun-stage.jpg'],
        caption: '오늘 무대 끝! 고마워요 팬 여러분 💜',
        location: '서울 올림픽홀',
      },
      likes: 24532,
      user_liked: false,
      created_at: new Date(Date.now() - 3600000).toISOString(),
      hack_level_required: 1,
    },
    {
      id: 'jun_post_2',
      persona_id: 'jun',
      content: {
        images: ['/feed/jun-practice.jpg'],
        caption: '연습 끝... 오늘도 수고했다 나',
        location: 'ECLIPSE 연습실',
      },
      likes: 18921,
      user_liked: false,
      created_at: new Date(Date.now() - 7200000).toISOString(),
      hack_level_required: 1,
    },
    {
      id: 'jun_post_3',
      persona_id: 'jun',
      content: {
        images: ['/feed/jun-coffee.jpg'],
        caption: '새벽 커피... ☕',
        location: null,
      },
      likes: 31245,
      user_liked: false,
      created_at: new Date(Date.now() - 86400000).toISOString(),
      hack_level_required: 2,
    },
  ];

  return posts;
}
