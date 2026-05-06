import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase-server';
import { WELCOME_OFFER_DEPRECATED } from '@/lib/pricing';

/**
 * Welcome Offer ($49.50 = 50% off PASS) is deprecated as of 2026-05-06 (3rd Pivot — All-Digital Hybrid).
 * The new PASS price is $49/mo, which makes the 50% discount meaningless.
 *
 * - GET returns eligible:false with deprecated:true
 * - POST returns 410 Gone
 *
 * Existing welcome_offer_claimed=true rows are intentionally preserved for billing
 * and audit history. See docs/STRATEGY.md (3rd Pivot) §7.
 */

export async function GET() {
  try {
    const supabase = await createServerClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    return NextResponse.json({
      eligible: false,
      deprecated: WELCOME_OFFER_DEPRECATED,
      message: 'Welcome Offer는 종료되었습니다. 신규 LUMIN PASS는 $49/월입니다.',
      alternativePlanId: 'lumin_pass_monthly_v2',
      expiresAt: null,
      remainingSeconds: 0,
    });
  } catch (error) {
    console.error('Welcome offer eligibility check error:', error);
    return NextResponse.json({ error: 'Failed to check eligibility' }, { status: 500 });
  }
}

export async function POST() {
  return NextResponse.json({
    error: 'Welcome Offer has been discontinued. Please use the standard $49/mo PASS plan.',
    deprecated: true,
    alternativePlanId: 'lumin_pass_monthly_v2',
  }, { status: 410 });
}
