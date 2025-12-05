import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

function getSupabaseAdmin() {
  return createClient(supabaseUrl, supabaseServiceKey);
}

// 마케팅 문구 목록 조회
export async function GET(request: NextRequest) {
  try {
    const supabase = getSupabaseAdmin();
    const { searchParams } = new URL(request.url);
    const projectId = searchParams.get('project_id');

    let query = supabase
      .from('marketing_copies')
      .select('*')
      .order('created_at', { ascending: false });

    if (projectId) {
      query = query.eq('project_id', projectId);
    }

    const { data, error } = await query;

    if (error) throw error;

    return NextResponse.json({ copies: data || [] });
  } catch (error) {
    console.error('[Marketing Copies] GET error:', error);
    return NextResponse.json({
      error: error instanceof Error ? error.message : 'Failed to fetch copies'
    }, { status: 500 });
  }
}

// 마케팅 문구 생성 (여러 버전)
export async function POST(request: NextRequest) {
  try {
    const supabase = getSupabaseAdmin();
    const body = await request.json();
    const { project_id, copies } = body;

    if (!project_id || !copies || !Array.isArray(copies)) {
      return NextResponse.json({ error: 'Project ID and copies array are required' }, { status: 400 });
    }

    const insertData = copies.map((copy: { headline: string; body: string; cta: string }, idx: number) => ({
      project_id,
      headline: copy.headline,
      body: copy.body,
      cta: copy.cta,
      version: idx + 1,
      status: 'generated',
    }));

    const { data, error } = await supabase
      .from('marketing_copies')
      .insert(insertData)
      .select();

    if (error) throw error;

    return NextResponse.json({ copies: data || [] });
  } catch (error) {
    console.error('[Marketing Copies] POST error:', error);
    return NextResponse.json({
      error: error instanceof Error ? error.message : 'Failed to create copies'
    }, { status: 500 });
  }
}
