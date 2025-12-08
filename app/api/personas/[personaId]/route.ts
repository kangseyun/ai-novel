import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase-server';

// GET /api/personas/:personaId - 페르소나 상세 조회
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ personaId: string }> }
) {
  const { personaId } = await params;

  try {
    const supabase = await createClient();

    // personas view에서 조회 (published 상태만 포함됨)
    const { data: persona, error } = await supabase
      .from('personas')
      .select('*')
      .eq('id', personaId)
      .single();

    if (error || !persona) {
      console.error('[Persona API] Not found:', personaId, error);
      return NextResponse.json(
        { error: 'Persona not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({ persona });
  } catch (error) {
    console.error('[Persona API] Error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
