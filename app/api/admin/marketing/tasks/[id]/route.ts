import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

function getSupabaseAdmin() {
  return createClient(supabaseUrl, supabaseServiceKey);
}

// 태스크 상세 조회
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = getSupabaseAdmin();

    const { data: task, error } = await supabase
      .from('marketing_generation_tasks')
      .select('*')
      .eq('id', id)
      .single();

    if (error) throw error;

    return NextResponse.json({ task });
  } catch (error) {
    console.error('[Marketing Task] GET error:', error);
    return NextResponse.json({
      error: error instanceof Error ? error.message : 'Failed to fetch task'
    }, { status: 500 });
  }
}

// 태스크 업데이트 (베이스 이미지 선택 등)
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = getSupabaseAdmin();
    const body = await request.json();

    const { selected_base_image, status } = body;

    const updateData: Record<string, unknown> = {};
    if (selected_base_image !== undefined) {
      updateData.selected_base_image = selected_base_image;
    }
    if (status !== undefined) {
      updateData.status = status;
    }

    const { data, error } = await supabase
      .from('marketing_generation_tasks')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ task: data });
  } catch (error) {
    console.error('[Marketing Task] PATCH error:', error);
    return NextResponse.json({
      error: error instanceof Error ? error.message : 'Failed to update task'
    }, { status: 500 });
  }
}

// 태스크 취소/삭제
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = getSupabaseAdmin();

    // 실행 중인 태스크는 취소 상태로 변경
    const { data: task } = await supabase
      .from('marketing_generation_tasks')
      .select('status')
      .eq('id', id)
      .single();

    if (task?.status === 'processing') {
      await supabase
        .from('marketing_generation_tasks')
        .update({ status: 'cancelled' })
        .eq('id', id);
    } else {
      await supabase
        .from('marketing_generation_tasks')
        .delete()
        .eq('id', id);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[Marketing Task] DELETE error:', error);
    return NextResponse.json({
      error: error instanceof Error ? error.message : 'Failed to delete task'
    }, { status: 500 });
  }
}
