import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

function getSupabaseAdmin() {
  return createClient(supabaseUrl, supabaseServiceKey);
}

// 프로젝트 목록 조회
export async function GET(request: NextRequest) {
  try {
    const supabase = getSupabaseAdmin();
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');

    let query = supabase
      .from('marketing_projects')
      .select(`
        *,
        marketing_images(count)
      `)
      .order('created_at', { ascending: false });

    if (status) {
      query = query.eq('status', status);
    }

    const { data, error } = await query;

    if (error) throw error;

    // 이미지 카운트 정리
    const projects = data?.map(project => ({
      ...project,
      image_count: project.marketing_images?.[0]?.count || 0,
      marketing_images: undefined,
    }));

    return NextResponse.json({ projects });
  } catch (error) {
    console.error('[Marketing Projects] GET error:', error);
    return NextResponse.json({
      error: error instanceof Error ? error.message : 'Failed to fetch projects'
    }, { status: 500 });
  }
}

// 새 프로젝트 생성
export async function POST(request: NextRequest) {
  try {
    const supabase = getSupabaseAdmin();
    const body = await request.json();
    const {
      name,
      description,
      target_platform,
      // 캐릭터 정보 (필수)
      persona_id,
      persona_name,
      persona_avatar_url,
    } = body;

    if (!name) {
      return NextResponse.json({ error: 'Project name is required' }, { status: 400 });
    }

    if (!persona_id || !persona_name) {
      return NextResponse.json({ error: 'Persona is required' }, { status: 400 });
    }

    const { data, error } = await supabase
      .from('marketing_projects')
      .insert({
        name,
        description: description || null,
        target_platform: target_platform || 'meta',
        status: 'active',
        // 캐릭터 정보 저장
        persona_id,
        persona_name,
        persona_avatar_url: persona_avatar_url || null,
      })
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ project: data });
  } catch (error) {
    console.error('[Marketing Projects] POST error:', error);
    return NextResponse.json({
      error: error instanceof Error ? error.message : 'Failed to create project'
    }, { status: 500 });
  }
}
