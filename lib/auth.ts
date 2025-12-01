import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from './supabase';

export interface AuthUser {
  id: string;
  email: string;
}

export async function getAuthUser(request: NextRequest): Promise<AuthUser | null> {
  const authHeader = request.headers.get('Authorization');

  if (!authHeader?.startsWith('Bearer ')) {
    return null;
  }

  const token = authHeader.split(' ')[1];
  const supabase = createServerClient();

  const { data, error } = await supabase.auth.getUser(token);

  if (error || !data.user) {
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
  return NextResponse.json(
    { error: 'Internal server error' },
    { status: 500 }
  );
}
