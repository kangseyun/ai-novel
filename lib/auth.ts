import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { createClient as createServerSupabase } from '@/lib/supabase-server';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

export interface AuthUser {
  id: string;
  email: string;
}

export type AdminGuard =
  | { ok: true; userId: string; email: string }
  | { ok: false; response: NextResponse };

export async function requireAdmin(): Promise<AdminGuard> {
  const supabase = await createServerSupabase();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return {
      ok: false,
      response: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }),
    };
  }

  const { data: userData, error } = await supabase
    .from('users')
    .select('role')
    .eq('id', user.id)
    .single();

  if (error || userData?.role !== 'admin') {
    return {
      ok: false,
      response: NextResponse.json({ error: 'Forbidden' }, { status: 403 }),
    };
  }

  return { ok: true, userId: user.id, email: user.email! };
}

export async function getAuthUser(request: NextRequest): Promise<AuthUser | null> {
  const authHeader = request.headers.get('Authorization');

  if (!authHeader?.startsWith('Bearer ')) {
    return null;
  }

  const token = authHeader.split(' ')[1];

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
