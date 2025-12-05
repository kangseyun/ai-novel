import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

function getSupabaseAdmin() {
  return createClient(supabaseUrl, supabaseServiceKey);
}

// 마케팅 문구 수정
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = getSupabaseAdmin();
    const body = await request.json();

    const { status, headline, body: copyBody, cta } = body;

    const updateData: Record<string, unknown> = {};
    if (status !== undefined) updateData.status = status;
    if (headline !== undefined) updateData.headline = headline;
    if (copyBody !== undefined) updateData.body = copyBody;
    if (cta !== undefined) updateData.cta = cta;

    const { data, error } = await supabase
      .from('marketing_copies')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ copy: data });
  } catch (error) {
    console.error('[Marketing Copy] PATCH error:', error);
    return NextResponse.json({
      error: error instanceof Error ? error.message : 'Failed to update copy'
    }, { status: 500 });
  }
}

// 마케팅 문구 삭제
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = getSupabaseAdmin();

    const { error } = await supabase
      .from('marketing_copies')
      .delete()
      .eq('id', id);

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[Marketing Copy] DELETE error:', error);
    return NextResponse.json({
      error: error instanceof Error ? error.message : 'Failed to delete copy'
    }, { status: 500 });
  }
}
