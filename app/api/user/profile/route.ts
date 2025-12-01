import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';
import { getAuthUser, unauthorized, serverError } from '@/lib/auth';

// GET /api/user/profile - 프로필 조회
export async function GET(request: NextRequest) {
  try {
    const user = await getAuthUser(request);
    if (!user) return unauthorized();

    const supabase = createServerClient();

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
            gems: 100,
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

// PUT /api/user/profile - 프로필 수정
export async function PUT(request: NextRequest) {
  try {
    const user = await getAuthUser(request);
    if (!user) return unauthorized();

    const { nickname, profile_image, bio } = await request.json();

    const supabase = createServerClient();

    const { data, error } = await supabase
      .from('users')
      .update({
        nickname,
        profile_image,
        bio,
      })
      .eq('id', user.id)
      .select()
      .single();

    if (error) {
      return serverError(error);
    }

    return NextResponse.json(data);
  } catch (error) {
    return serverError(error);
  }
}
