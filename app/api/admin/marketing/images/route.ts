import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

function getSupabaseAdmin() {
  return createClient(supabaseUrl, supabaseServiceKey);
}

// 이미지 저장
export async function POST(request: NextRequest) {
  try {
    const supabase = getSupabaseAdmin();
    const body = await request.json();

    const {
      project_id,
      persona_id,
      persona_name,
      image_url,
      ad_size,
      ad_size_label,
      template,
      template_label,
      custom_prompt,
      generated_prompt,
      width,
      height,
    } = body;

    if (!project_id || !persona_name || !image_url || !ad_size || !template) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const { data, error } = await supabase
      .from('marketing_images')
      .insert({
        project_id,
        persona_id: persona_id || null,
        persona_name,
        image_url,
        ad_size,
        ad_size_label: ad_size_label || ad_size,
        template,
        template_label: template_label || template,
        custom_prompt: custom_prompt || null,
        generated_prompt: generated_prompt || null,
        width: width || null,
        height: height || null,
        status: 'generated',
      })
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ image: data });
  } catch (error) {
    console.error('[Marketing Images] POST error:', error);
    return NextResponse.json({
      error: error instanceof Error ? error.message : 'Failed to save image'
    }, { status: 500 });
  }
}

// 이미지 목록 조회
export async function GET(request: NextRequest) {
  try {
    const supabase = getSupabaseAdmin();
    const { searchParams } = new URL(request.url);
    const projectId = searchParams.get('project_id');
    const adSize = searchParams.get('ad_size');
    const status = searchParams.get('status');

    let query = supabase
      .from('marketing_images')
      .select('*')
      .order('created_at', { ascending: false });

    if (projectId) {
      query = query.eq('project_id', projectId);
    }
    if (adSize) {
      query = query.eq('ad_size', adSize);
    }
    if (status) {
      query = query.eq('status', status);
    }

    const { data, error } = await query;

    if (error) throw error;

    return NextResponse.json({ images: data });
  } catch (error) {
    console.error('[Marketing Images] GET error:', error);
    return NextResponse.json({
      error: error instanceof Error ? error.message : 'Failed to fetch images'
    }, { status: 500 });
  }
}
