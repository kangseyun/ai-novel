import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase-server';
import { getAuthUser, unauthorized, serverError } from '@/lib/auth';

// GET /api/user/profile - 프로필 조회
export async function GET(request: NextRequest) {
  try {
    const user = await getAuthUser(request);
    if (!user) return unauthorized();

    const supabase = await createServerClient();

    // 사용자 프로필 조회
    const { data: profile, error } = await supabase
      .from('users')
      .select('*')
      .eq('id', user.id)
      .single();

    if (error) {
      // 프로필이 없으면 생성
      if (error.code === 'PGRST116') {
        const { data: newProfile, error: insertError } = await supabase
          .from('users')
          .insert({
            id: user.id,
            email: user.email,
            tokens: 100,
          })
          .select()
          .single();

        if (insertError) {
          return serverError(insertError);
        }

        return NextResponse.json(newProfile);
      }
      return serverError(error);
    }

    // 구독 정보 조회
    const { data: subscription } = await supabase
      .from('subscriptions')
      .select('*')
      .eq('user_id', user.id)
      .eq('status', 'active')
      .single();

    return NextResponse.json({
      ...profile,
      subscription: subscription ? {
        plan: subscription.plan_id,
        expires_at: subscription.current_period_end,
      } : {
        plan: 'free',
        expires_at: null,
      },
    });
  } catch (error) {
    return serverError(error);
  }
}

// PUT /api/user/profile - 프로필 및 페르소나 수정
export async function PUT(request: NextRequest) {
  try {
    const user = await getAuthUser(request);
    if (!user) {
      return unauthorized();
    }

    const body = await request.json();
    const {
      nickname,
      profile_image,
      bio,
      personality_type,
      communication_style,
      emotional_tendency,
      interests,
      love_language,
      attachment_style,
    } = body;

    const supabase = await createServerClient();

    // undefined가 아닌 필드만 업데이트
    const updateData: Record<string, unknown> = {};
    if (nickname !== undefined) updateData.nickname = nickname;
    if (profile_image !== undefined) updateData.profile_image = profile_image;
    if (bio !== undefined) updateData.bio = bio;
    if (personality_type !== undefined) updateData.personality_type = personality_type;
    if (communication_style !== undefined) updateData.communication_style = communication_style;
    if (emotional_tendency !== undefined) updateData.emotional_tendency = emotional_tendency;
    if (interests !== undefined) updateData.interests = interests;
    if (love_language !== undefined) updateData.love_language = love_language;
    if (attachment_style !== undefined) updateData.attachment_style = attachment_style;

    const { data, error } = await supabase
      .from('users')
      .update(updateData)
      .eq('id', user.id)
      .select()
      .single();

    if (error) {
      console.error('[Profile PUT] DB Error:', error);
      return serverError(error);
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error('[Profile PUT] Exception:', error);
    return serverError(error);
  }
}
