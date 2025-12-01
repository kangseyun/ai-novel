import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');
  const next = searchParams.get('next') ?? '/';

  if (code) {
    const supabase = createServerClient();
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error && data.user) {
      // users 테이블에 사용자 정보 저장/업데이트
      await supabase
        .from('users')
        .upsert({
          id: data.user.id,
          email: data.user.email,
          nickname: data.user.user_metadata?.name || null,
          profile_image: data.user.user_metadata?.avatar_url || null,
          gems: 100,
        }, {
          onConflict: 'id',
        });

      // 사용자의 온보딩 상태 확인
      const { data: profile } = await supabase
        .from('users')
        .select('onboarding_completed')
        .eq('id', data.user.id)
        .single();

      // 온보딩 미완료 시 온보딩 페이지로 리다이렉트
      const redirectPath = profile?.onboarding_completed ? next : '/onboarding';

      // 클라이언트에서 토큰을 저장할 수 있도록 쿼리 파라미터로 전달
      const response = NextResponse.redirect(
        `${origin}${redirectPath}?access_token=${data.session.access_token}&refresh_token=${data.session.refresh_token}`
      );

      return response;
    }
  }

  // 에러 발생 시 로그인 페이지로 리다이렉트
  return NextResponse.redirect(`${origin}/login?error=auth_failed`);
}
