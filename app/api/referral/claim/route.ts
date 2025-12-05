import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase-server';

export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { code } = await request.json();

    if (!code || typeof code !== 'string') {
      return NextResponse.json({ error: 'Invalid code' }, { status: 400 });
    }

    // RPC 함수 호출 (트랜잭션 처리)
    const { data: result, error } = await supabase.rpc('claim_referral_reward', {
      p_user_id: user.id,
      p_code: code.trim()
    });

    if (error) {
      console.error('Failed to claim referral:', error);
      return NextResponse.json({ error: 'Failed to claim reward' }, { status: 500 });
    }

    if (!result.success) {
      return NextResponse.json(
        { error: result.message },
        { status: 400 }
      );
    }

    return NextResponse.json({ 
      success: true, 
      reward: result.reward_amount 
    });
  } catch (error) {
    console.error('Referral claim error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
