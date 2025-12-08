import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser, unauthorized, badRequest, serverError } from '@/lib/auth';
import { createClient } from '@/lib/supabase-server';

/**
 * GET /api/onboarding/follow
 * 타겟 오디언스별 페르소나 목록 조회
 */
export async function GET(request: NextRequest) {
  try {
    const user = await getAuthUser(request);
    if (!user) return unauthorized();

    const { searchParams } = new URL(request.url);
    const targetAudience = searchParams.get('target_audience') || 'female';

    const supabase = await createClient();

    // 1. 해당 타겟 오디언스의 활성 페르소나 조회
    const { data: personas, error: personasError } = await supabase
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
        is_premium,
        category,
        target_audience,
        tags,
        followers_count
      `)
      .eq('target_audience', targetAudience)
      .eq('is_active', true)
      .order('sort_order', { ascending: true });

    if (personasError) {
      console.error('[Onboarding Follow] Personas fetch error:', personasError);
      return serverError(personasError);
    }

    // 2. 이미 팔로우한 페르소나 확인
    const { data: followedPersonas } = await supabase
      .from('user_persona_relationships')
      .select('persona_id')
      .eq('user_id', user.id)
      .eq('is_unlocked', true);

    const followedIds = new Set(followedPersonas?.map(r => r.persona_id) || []);
    // jun은 항상 팔로우된 것으로 간주
    followedIds.add('jun');

    // 3. 팔로우 상태 포함하여 반환
    const mappedPersonas = (personas || []).map(p => ({
      id: p.id,
      name: p.name,
      displayName: p.display_name || p.name,
      username: p.username || p.id,
      bio: p.bio || '',
      avatarUrl: p.avatar_url || '/default-avatar.png',
      coverImageUrl: p.cover_image_url,
      isVerified: p.is_verified ?? true,
      isPremium: p.is_premium ?? false,
      category: p.category || 'other',
      targetAudience: p.target_audience || 'female',
      tags: p.tags || [],
      followersCount: p.followers_count || '0',
      isFollowed: followedIds.has(p.id),
    }));

    // 4. 초기 팔로우 완료 여부 확인
    const { data: userData } = await supabase
      .from('users')
      .select('initial_follows_completed')
      .eq('id', user.id)
      .single();

    return NextResponse.json({
      personas: mappedPersonas,
      initialFollowsCompleted: userData?.initial_follows_completed ?? false,
    });
  } catch (error) {
    console.error('[Onboarding Follow] Error:', error);
    return serverError(error);
  }
}

/**
 * POST /api/onboarding/follow
 * 초기 팔로우 일괄 처리 (온보딩 시 무료)
 */
export async function POST(request: NextRequest) {
  try {
    const user = await getAuthUser(request);
    if (!user) return unauthorized();

    const { personaIds, targetAudience } = await request.json();

    if (!personaIds || !Array.isArray(personaIds)) {
      return badRequest('personaIds array is required');
    }

    if (personaIds.length < 5) {
      return badRequest('At least 5 personas must be selected');
    }

    const supabase = await createClient();

    // 1. 이미 초기 팔로우를 완료했는지 확인
    const { data: userData } = await supabase
      .from('users')
      .select('initial_follows_completed')
      .eq('id', user.id)
      .single();

    if (userData?.initial_follows_completed) {
      return NextResponse.json(
        { success: false, message: '이미 초기 팔로우를 완료했습니다' },
        { status: 400 }
      );
    }

    // 2. 선택한 페르소나들 무료로 팔로우
    const now = new Date().toISOString();
    const relationships = personaIds.map((personaId: string) => ({
      user_id: user.id,
      persona_id: personaId,
      is_unlocked: true,
      unlocked_at: now,
      affection: 0,
      relationship_stage: 'stranger',
    }));

    // upsert로 중복 방지
    const { error: relationshipError } = await supabase
      .from('user_persona_relationships')
      .upsert(relationships, {
        onConflict: 'user_id,persona_id',
        ignoreDuplicates: false,
      });

    if (relationshipError) {
      console.error('[Onboarding Follow] Relationship error:', relationshipError);
      return serverError(relationshipError);
    }

    // 3. 초기 팔로우 완료 표시 + 선호 타겟 저장
    const { error: updateError } = await supabase
      .from('users')
      .update({
        initial_follows_completed: true,
        preferred_target_audience: targetAudience,
        updated_at: now,
      })
      .eq('id', user.id);

    if (updateError) {
      console.error('[Onboarding Follow] User update error:', updateError);
      return serverError(updateError);
    }

    return NextResponse.json({
      success: true,
      followedCount: personaIds.length,
      message: '팔로우가 완료되었습니다',
    });
  } catch (error) {
    console.error('[Onboarding Follow] Error:', error);
    return serverError(error);
  }
}
