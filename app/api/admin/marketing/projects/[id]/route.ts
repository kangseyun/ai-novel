import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

function getSupabaseAdmin() {
  return createClient(supabaseUrl, supabaseServiceKey);
}

// 프로젝트 상세 조회
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = getSupabaseAdmin();

    const { data: project, error: projectError } = await supabase
      .from('marketing_projects')
      .select('*')
      .eq('id', id)
      .single();

    if (projectError) throw projectError;

    // 이미지 목록 조회
    const { data: images, error: imagesError } = await supabase
      .from('marketing_images')
      .select('*')
      .eq('project_id', id)
      .order('created_at', { ascending: false });

    if (imagesError) throw imagesError;

    // 마케팅 문구 목록 조회
    const { data: copies, error: copiesError } = await supabase
      .from('marketing_copies')
      .select('*')
      .eq('project_id', id)
      .order('created_at', { ascending: false });

    if (copiesError) {
      console.warn('[Marketing Project] Copies query error:', copiesError);
      // 문구 테이블이 없을 수 있으므로 에러 무시
    }

    // 사이즈별 통계
    const sizeStats = images?.reduce((acc, img) => {
      acc[img.ad_size] = (acc[img.ad_size] || 0) + 1;
      return acc;
    }, {} as Record<string, number>) || {};

    return NextResponse.json({
      project,
      images: images || [],
      copies: copies || [],
      stats: {
        total: images?.length || 0,
        bySize: sizeStats,
        approved: images?.filter(i => i.status === 'approved').length || 0,
        used: images?.filter(i => i.status === 'used').length || 0,
      },
    });
  } catch (error) {
    console.error('[Marketing Project] GET error:', error);
    return NextResponse.json({
      error: error instanceof Error ? error.message : 'Failed to fetch project'
    }, { status: 500 });
  }
}

// 프로젝트 수정
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = getSupabaseAdmin();
    const body = await request.json();

    const {
      name,
      description,
      status,
      target_platform,
      // 베이스 이미지 정보
      base_image_url,
      base_template,
      base_custom_prompt,
      // 마케팅 컨셉 정보
      marketing_concept,
      cta_goal,
    } = body;

    const updateData: Record<string, unknown> = {};
    if (name !== undefined) updateData.name = name;
    if (description !== undefined) updateData.description = description;
    if (status !== undefined) updateData.status = status;
    if (target_platform !== undefined) updateData.target_platform = target_platform;
    // 베이스 이미지 정보 업데이트
    if (base_image_url !== undefined) updateData.base_image_url = base_image_url;
    if (base_template !== undefined) updateData.base_template = base_template;
    if (base_custom_prompt !== undefined) updateData.base_custom_prompt = base_custom_prompt;
    // 마케팅 컨셉 정보 업데이트
    if (marketing_concept !== undefined) updateData.marketing_concept = marketing_concept;
    if (cta_goal !== undefined) updateData.cta_goal = cta_goal;

    const { data, error } = await supabase
      .from('marketing_projects')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ project: data });
  } catch (error) {
    console.error('[Marketing Project] PATCH error:', error);
    return NextResponse.json({
      error: error instanceof Error ? error.message : 'Failed to update project'
    }, { status: 500 });
  }
}

// 프로젝트 삭제
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = getSupabaseAdmin();

    const { error } = await supabase
      .from('marketing_projects')
      .delete()
      .eq('id', id);

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[Marketing Project] DELETE error:', error);
    return NextResponse.json({
      error: error instanceof Error ? error.message : 'Failed to delete project'
    }, { status: 500 });
  }
}
