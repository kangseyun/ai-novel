import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

function getSupabaseAdmin() {
  return createClient(supabaseUrl, supabaseServiceKey);
}

// 이미지 상태 업데이트
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = getSupabaseAdmin();
    const body = await request.json();

    const { status, notes } = body;

    const updateData: Record<string, unknown> = {};
    if (status !== undefined) {
      updateData.status = status;
      if (status === 'used') {
        updateData.used_at = new Date().toISOString();
      }
    }
    if (notes !== undefined) updateData.notes = notes;

    const { data, error } = await supabase
      .from('marketing_images')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ image: data });
  } catch (error) {
    console.error('[Marketing Image] PATCH error:', error);
    return NextResponse.json({
      error: error instanceof Error ? error.message : 'Failed to update image'
    }, { status: 500 });
  }
}

// 이미지 삭제
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = getSupabaseAdmin();

    const { error } = await supabase
      .from('marketing_images')
      .delete()
      .eq('id', id);

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[Marketing Image] DELETE error:', error);
    return NextResponse.json({
      error: error instanceof Error ? error.message : 'Failed to delete image'
    }, { status: 500 });
  }
}
