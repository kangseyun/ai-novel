import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

export interface AuthUser {
  id: string;
  email: string;
}

export async function getAuthUser(request: NextRequest): Promise<AuthUser | null> {
  const authHeader = request.headers.get('Authorization');

  console.log('[Auth] Authorization header:', authHeader ? 'present' : 'missing');

  if (!authHeader?.startsWith('Bearer ')) {
    console.log('[Auth] No Bearer token found');
    return null;
  }

  const token = authHeader.split(' ')[1];
  console.log('[Auth] Token length:', token?.length);

  // 토큰으로 사용자 정보 조회
  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    global: {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    },
  });

  const { data, error } = await supabase.auth.getUser(token);

  if (error || !data.user) {
    console.error('[Auth] getUser error:', error?.message || 'No user data');
    return null;
  }

  console.log('[Auth] User authenticated:', data.user.id);

  return {
    id: data.user.id,
    email: data.user.email!,
  };
}

export function unauthorized() {
  return NextResponse.json(
    { error: 'Unauthorized' },
    { status: 401 }
  );
}

export function badRequest(message: string) {
  return NextResponse.json(
    { error: message },
    { status: 400 }
  );
}

export function serverError(error: unknown) {
  console.error('Server error:', error);

  // 개발 환경에서는 상세 에러 반환
  const isDev = process.env.NODE_ENV === 'development';
  const message = error instanceof Error ? error.message : 'Internal server error';
  const details = isDev && error && typeof error === 'object' && 'code' in error
    ? { code: (error as { code: string }).code, message }
    : undefined;

  return NextResponse.json(
    { error: isDev ? message : 'Internal server error', details },
    { status: 500 }
  );
}
