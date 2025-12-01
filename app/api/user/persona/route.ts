import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';
import { getAuthUser, unauthorized, serverError } from '@/lib/auth';

// GET /api/user/persona - 페르소나 설정 조회
export async function GET(request: NextRequest) {
  try {
    const user = await getAuthUser(request);
    if (!user) return unauthorized();

    const supabase = createServerClient();

    const { data, error } = await supabase
      .from('user_personas')
      .select('*')
      .eq('user_id', user.id)
      .single();

    if (error && error.code !== 'PGRST116') {
      return serverError(error);
    }

    return NextResponse.json(data || null);
  } catch (error) {
    return serverError(error);
  }
}

// POST /api/user/persona - 페르소나 설정 저장
export async function POST(request: NextRequest) {
  try {
    const user = await getAuthUser(request);
    if (!user) return unauthorized();

    const {
      personality_type,
      communication_style,
      emotional_tendency,
      interests,
      love_language,
      attachment_style,
    } = await request.json();

    const supabase = createServerClient();

    // upsert: 있으면 업데이트, 없으면 생성
    const { data, error } = await supabase
      .from('user_personas')
      .upsert({
        user_id: user.id,
        personality_type,
        communication_style,
        emotional_tendency,
        interests,
        love_language,
        attachment_style,
      }, {
        onConflict: 'user_id',
      })
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
