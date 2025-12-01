'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { apiClient } from '@/lib/api-client';
import { useAuthStore } from '@/lib/stores/auth-store';

export default function AuthCallbackPage() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const loadUser = useAuthStore(state => state.loadUser);

  useEffect(() => {
    const handleCallback = async () => {
      try {
        // URL hash에서 토큰 추출 (implicit flow)
        const hashParams = new URLSearchParams(window.location.hash.substring(1));
        const accessToken = hashParams.get('access_token');
        const refreshToken = hashParams.get('refresh_token');

        if (accessToken) {
          // Supabase 세션 설정
          const { data: { user }, error: sessionError } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken || '',
          });

          if (sessionError) throw sessionError;
          if (!user) throw new Error('No user found');

          // API 클라이언트에 토큰 설정
          apiClient.setAccessToken(accessToken);
          if (refreshToken) {
            localStorage.setItem('refresh_token', refreshToken);
          }

          // 사용자 정보 확인 및 저장
          const { data: existingUser } = await supabase
            .from('users')
            .select('id, onboarding_completed')
            .eq('id', user.id)
            .single();

          if (!existingUser) {
            // 신규 가입자 - 온보딩은 회원가입 전에 이미 완료됨
            await supabase.from('users').insert({
              id: user.id,
              email: user.email,
              nickname: user.user_metadata?.name || user.user_metadata?.full_name || null,
              profile_image: user.user_metadata?.avatar_url || null,
              tokens: 100,
              onboarding_completed: true,
            });
          } else {
            // 기존 가입자 - 프로필 업데이트
            await supabase
              .from('users')
              .update({
                email: user.email,
                profile_image: user.user_metadata?.avatar_url || null,
              })
              .eq('id', user.id);
          }

          // Auth 스토어 업데이트 (isAuthenticated = true)
          await loadUser();

          // 항상 홈으로 이동
          router.replace('/');
        } else {
          // code flow 시도 (PKCE)
          const urlParams = new URLSearchParams(window.location.search);
          const code = urlParams.get('code');

          if (code) {
            const { data, error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);

            if (exchangeError) throw exchangeError;
            if (!data.user) throw new Error('No user found');

            apiClient.setAccessToken(data.session.access_token);
            localStorage.setItem('refresh_token', data.session.refresh_token);

            // 사용자 정보 확인
            const { data: existingUser } = await supabase
              .from('users')
              .select('id, onboarding_completed')
              .eq('id', data.user.id)
              .single();

            if (!existingUser) {
              // 신규 가입자 - 온보딩은 회원가입 전에 이미 완료됨
              await supabase.from('users').insert({
                id: data.user.id,
                email: data.user.email,
                nickname: data.user.user_metadata?.name || data.user.user_metadata?.full_name || null,
                profile_image: data.user.user_metadata?.avatar_url || null,
                tokens: 100,
                onboarding_completed: true,
              });
            } else {
              // 기존 가입자 - 프로필 업데이트
              await supabase
                .from('users')
                .update({
                  email: data.user.email,
                  profile_image: data.user.user_metadata?.avatar_url || null,
                })
                .eq('id', data.user.id);
            }

            // Auth 스토어 업데이트 (isAuthenticated = true)
            await loadUser();

            // 항상 홈으로 이동
            router.replace('/');
          } else {
            throw new Error('No authentication data found');
          }
        }
      } catch (err) {
        console.error('Auth callback error:', err);
        setError(err instanceof Error ? err.message : 'Authentication failed');
        setTimeout(() => router.replace('/login?error=auth_failed'), 2000);
      }
    };

    handleCallback();
  }, [router, loadUser]);

  if (error) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-400 mb-2">로그인 실패</p>
          <p className="text-white/40 text-sm">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black flex items-center justify-center">
      <div className="text-center">
        <div className="w-8 h-8 border-2 border-white/30 border-t-white rounded-full animate-spin mx-auto mb-4" />
        <p className="text-white/60">로그인 중...</p>
      </div>
    </div>
  );
}
