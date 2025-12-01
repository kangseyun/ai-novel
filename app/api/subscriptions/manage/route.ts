import { NextRequest, NextResponse } from 'next/server';
import { stripe } from '@/lib/stripe';
import { createServerClient } from '@/lib/supabase-server';

// 구독 상태 조회
export async function GET() {
  try {
    const supabase = await createServerClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // DB에서 구독 정보 조회
    const { data: subscription } = await supabase
      .from('subscriptions')
      .select('*')
      .eq('user_id', user.id)
      .single();

    if (!subscription) {
      return NextResponse.json({
        subscription: null,
        isActive: false,
      });
    }

    return NextResponse.json({
      subscription: {
        plan: subscription.plan_id,
        status: subscription.status,
        currentPeriodEnd: subscription.current_period_end,
        cancelAtPeriodEnd: subscription.cancel_at_period_end,
      },
      isActive: subscription.status === 'active',
    });
  } catch (error) {
    console.error('Get subscription error:', error);
    return NextResponse.json({ error: 'Failed to get subscription' }, { status: 500 });
  }
}

// 구독 취소
export async function DELETE() {
  try {
    if (!stripe) {
      return NextResponse.json({ error: 'Stripe not configured' }, { status: 500 });
    }

    const supabase = await createServerClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // DB에서 구독 정보 조회
    const { data: subscription } = await supabase
      .from('subscriptions')
      .select('stripe_subscription_id')
      .eq('user_id', user.id)
      .single();

    if (!subscription?.stripe_subscription_id) {
      return NextResponse.json({ error: 'No active subscription' }, { status: 400 });
    }

    // Stripe에서 구독 취소 (기간 끝까지 유지)
    await stripe.subscriptions.update(subscription.stripe_subscription_id, {
      cancel_at_period_end: true,
    });

    // DB 업데이트
    await supabase
      .from('subscriptions')
      .update({ cancel_at_period_end: true })
      .eq('user_id', user.id);

    return NextResponse.json({ success: true, message: '구독이 기간 종료 시 취소됩니다.' });
  } catch (error) {
    console.error('Cancel subscription error:', error);
    return NextResponse.json({ error: 'Failed to cancel subscription' }, { status: 500 });
  }
}

// 구독 재활성화
export async function PUT() {
  try {
    if (!stripe) {
      return NextResponse.json({ error: 'Stripe not configured' }, { status: 500 });
    }

    const supabase = await createServerClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // DB에서 구독 정보 조회
    const { data: subscription } = await supabase
      .from('subscriptions')
      .select('stripe_subscription_id')
      .eq('user_id', user.id)
      .single();

    if (!subscription?.stripe_subscription_id) {
      return NextResponse.json({ error: 'No subscription found' }, { status: 400 });
    }

    // Stripe에서 구독 재활성화
    await stripe.subscriptions.update(subscription.stripe_subscription_id, {
      cancel_at_period_end: false,
    });

    // DB 업데이트
    await supabase
      .from('subscriptions')
      .update({ cancel_at_period_end: false })
      .eq('user_id', user.id);

    return NextResponse.json({ success: true, message: '구독이 재활성화되었습니다.' });
  } catch (error) {
    console.error('Reactivate subscription error:', error);
    return NextResponse.json({ error: 'Failed to reactivate subscription' }, { status: 500 });
  }
}
