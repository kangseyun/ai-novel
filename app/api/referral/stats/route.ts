import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase-server';

export async function GET(request: NextRequest) {
  try {
    const supabase = await createServerClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: profile, error } = await supabase
      .from('users')
      .select('referral_code, referral_count, referred_by')
      .eq('id', user.id)
      .single();

    if (error) {
      console.error('Failed to fetch referral stats:', error);
      return NextResponse.json({ error: 'Failed to fetch stats' }, { status: 500 });
    }

    // 만약 referral_code가 없으면(기존 유저) 새로 생성
    if (!profile.referral_code) {
      const newCode = Math.random().toString(36).substring(2, 10).toUpperCase();
      const { data: newProfile, error: updateError } = await supabase
        .from('users')
        .update({ referral_code: newCode })
        .eq('id', user.id)
        .select('referral_code, referral_count, referred_by')
        .single();
        
      if (!updateError && newProfile) {
        return NextResponse.json(newProfile);
      }
    }

    return NextResponse.json(profile);
  } catch (error) {
    console.error('Referral stats error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
