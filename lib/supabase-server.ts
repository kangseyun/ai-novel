import { createServerClient as createSupabaseServerClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';
import { cookies, headers } from 'next/headers';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

// 서버 사이드용 Supabase 클라이언트 (Bearer 토큰 + 쿠키 기반 인증)
export async function createServerClient() {
  const cookieStore = await cookies();
  const headerStore = await headers();

  // 1. Authorization 헤더 확인 (Bearer 토큰) - 대소문자 모두 체크
  const authHeader = headerStore.get('authorization') || headerStore.get('Authorization');
  if (authHeader?.startsWith('Bearer ')) {
    const token = authHeader.split(' ')[1];
    // Bearer 토큰이 있으면 일반 클라이언트로 세션 설정
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      },
    });
    return supabase;
  }

  // 2. 쿠키 기반 인증 (fallback)
  return createSupabaseServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          );
        } catch {
          // Called from Server Component, ignore
        }
      },
    },
  });
}

// Alias for backward compatibility
export { createServerClient as createClient };
