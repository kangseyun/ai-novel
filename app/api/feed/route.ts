import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase-server';
import { getAuthUser, unauthorized, serverError } from '@/lib/auth';

// 관계 단계별 우선순위
const STAGE_PRIORITY: Record<string, number> = {
  stranger: 0,
  acquaintance: 1,
  close: 2,
  intimate: 3,
  lover: 4,
};

// GET /api/feed - 피드 조회
export async function GET(request: NextRequest) {
  try {
    const user = await getAuthUser(request);
    if (!user) return unauthorized();

    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');
    const offset = (page - 1) * limit;

    const supabase = await createServerClient();

    // 1. 사용자 포스트 조회
    const { data: userPosts, error: userPostsError } = await supabase
      .from('user_posts')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (userPostsError) {
      console.error('[Feed] User posts error:', userPostsError);
    }

    // 2. 사용자의 페르소나 관계 상태 조회
    const { data: relationships } = await supabase
      .from('user_persona_relationships')
      .select('persona_id, current_stage, affection_level')
      .eq('user_id', user.id);

    // 관계 맵 생성 (없으면 stranger로 기본값)
    const relationshipMap: Record<string, { stage: string; affection: number }> = {};
    relationships?.forEach(r => {
      relationshipMap[r.persona_id] = {
        stage: r.current_stage || 'stranger',
        affection: r.affection_level || 0,
      };
    });

    // 3. 페르소나 포스트 조회 (DB에서)
    const { data: personaPosts, error: personaPostsError } = await supabase
      .from('persona_posts')
      .select(`
        id,
        persona_id,
        post_type,
        caption,
        images,
        location,
        likes_count,
        comments_count,
        hours_ago,
        mood,
        hashtags,
        required_relationship_stage,
        required_affection,
        is_premium,
        personas (
          id,
          name,
          full_name,
          profile_image
        )
      `)
      .order('hours_ago', { ascending: true });

    if (personaPostsError) {
      console.error('[Feed] Persona posts error:', personaPostsError);
    }

    // 4. 사용자가 볼 수 있는 페르소나 포스트 필터링
    const visiblePersonaPosts = (personaPosts || []).filter(post => {
      const relationship = relationshipMap[post.persona_id] || { stage: 'stranger', affection: 0 };
      const userStageLevel = STAGE_PRIORITY[relationship.stage] || 0;
      const requiredStageLevel = STAGE_PRIORITY[post.required_relationship_stage] || 0;

      // 관계 단계 체크
      if (userStageLevel < requiredStageLevel) return false;

      // 호감도 체크
      if (relationship.affection < (post.required_affection || 0)) return false;

      return true;
    });

    // 5. 페르소나 포스트를 동적 시간으로 변환
    const now = Date.now();
    const formattedPersonaPosts = visiblePersonaPosts.map(post => {
      const personaData = post.personas as unknown;
      const persona = Array.isArray(personaData) ? personaData[0] as { id: string; name: string; full_name: string; profile_image: string } : personaData as { id: string; name: string; full_name: string; profile_image: string } | null;
      return {
        id: post.id,
        type: 'persona_post',
        persona_id: post.persona_id,
        persona: persona ? {
          id: persona.id,
          name: persona.name,
          display_name: persona.full_name || persona.name,
          avatar_url: persona.profile_image,
        } : null,
        content: {
          images: post.images || [],
          caption: post.caption,
          location: post.location,
          mood: post.mood,
          hashtags: post.hashtags,
        },
        likes: post.likes_count,
        comments: post.comments_count,
        user_liked: false, // TODO: 실제 좋아요 상태
        is_premium: post.is_premium,
        created_at: new Date(now - (post.hours_ago || 1) * 3600000).toISOString(),
      };
    });

    // 6. 사용자 포스트 포맷팅
    const formattedUserPosts = (userPosts || []).map(p => ({
      id: p.id,
      type: 'user_post',
      content: {
        mood: p.mood,
        caption: p.caption,
        image: p.image_url,
      },
      created_at: p.created_at,
    }));

    // 7. 모든 포스트 합쳐서 시간순 정렬
    const allPosts = [...formattedPersonaPosts, ...formattedUserPosts]
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

    // 페이지네이션 적용
    const paginatedPosts = allPosts.slice(offset, offset + limit);

    return NextResponse.json({
      posts: paginatedPosts,
      total: allPosts.length,
      next_page: offset + limit < allPosts.length ? page + 1 : null,
    });
  } catch (error) {
    console.error('[Feed] Error:', error);
    return serverError(error);
  }
}
