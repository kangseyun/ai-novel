import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase-server';

/**
 * GET /api/personas - 페르소나 목록 조회
 *
 * Query params:
 * - active: boolean (기본 true) - 활성화된 페르소나만
 * - category: string - 카테고리 필터
 * - premium: boolean - 프리미엄 페르소나 필터
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createServerClient();
    const { searchParams } = new URL(request.url);

    const activeOnly = searchParams.get('active') !== 'false';
    const category = searchParams.get('category');
    const premiumOnly = searchParams.get('premium') === 'true';

    let query = supabase
      .from('personas')
      .select(`
        id,
        name,
        display_name,
        username,
        bio,
        avatar_url,
        cover_image_url,
        is_verified,
        is_active,
        is_premium,
        category,
        sort_order,
        followers_count,
        following_count,
        posts_count,
        tags
      `)
      .order('sort_order', { ascending: true });

    if (activeOnly) {
      query = query.eq('is_active', true);
    }

    if (category) {
      query = query.eq('category', category);
    }

    if (premiumOnly) {
      query = query.eq('is_premium', true);
    }

    const { data: personas, error } = await query;

    if (error) {
      console.error('[Personas] Error:', error);
      return NextResponse.json(
        { error: 'Failed to fetch personas', details: error },
        { status: 500 }
      );
    }

    // 응답 데이터 매핑 (snake_case -> camelCase)
    const mappedPersonas = (personas || []).map(p => ({
      id: p.id,
      name: p.name,
      displayName: p.display_name || p.name,
      username: p.username || p.name,
      bio: p.bio || '',
      avatarUrl: p.avatar_url || '/default-avatar.png',
      coverImageUrl: p.cover_image_url,
      isVerified: p.is_verified ?? true,
      isActive: p.is_active ?? true,
      isPremium: p.is_premium ?? false,
      category: p.category || 'other',
      sortOrder: p.sort_order || 0,
      followersCount: p.followers_count || '0',
      followingCount: p.following_count || 0,
      postsCount: p.posts_count || 0,
      tags: p.tags || [],
    }));

    return NextResponse.json({ personas: mappedPersonas });
  } catch (error) {
    console.error('[Personas] Unexpected error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
