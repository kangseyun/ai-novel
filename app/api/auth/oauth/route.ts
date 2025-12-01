import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';

export async function POST(request: NextRequest) {
  try {
    const { provider } = await request.json();

    if (!provider || !['google', 'apple'].includes(provider)) {
      return NextResponse.json(
        { error: 'Invalid provider. Must be google or apple' },
        { status: 400 }
      );
    }

    const supabase = createServerClient();

    // OAuth 리다이렉트 URL 생성
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: provider as 'google' | 'apple',
      options: {
        redirectTo: `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/auth/callback`,
      },
    });

    if (error) {
      return NextResponse.json(
        { error: error.message },
        { status: 400 }
      );
    }

    return NextResponse.json({
      url: data.url,
    });
  } catch (error) {
    console.error('OAuth error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
