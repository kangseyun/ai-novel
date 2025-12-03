import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { stripe } from '@/lib/stripe';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { trackPurchaseServer, trackSubscribeServer } from '@/lib/analytics-server';

// Supabase admin client (bypasses RLS) - lazy initialization
let supabaseAdmin: SupabaseClient | null = null;

function getSupabaseAdmin(): SupabaseClient {
  if (!supabaseAdmin) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) {
      throw new Error('Supabase environment variables not configured');
    }
    supabaseAdmin = createClient(url, key);
  }
  return supabaseAdmin;
}

export async function POST(request: NextRequest) {
  if (!stripe) {
    return NextResponse.json({ error: 'Stripe not configured' }, { status: 500 });
  }

  const body = await request.text();
  const signature = request.headers.get('stripe-signature');

  if (!signature) {
    return NextResponse.json({ error: 'No signature' }, { status: 400 });
  }

  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(
      body,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET!
    );
  } catch (err) {
    console.error('Webhook signature verification failed:', err);
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;
        await handleCheckoutCompleted(session);
        break;
      }

      case 'customer.subscription.created':
      case 'customer.subscription.updated': {
        const subscription = event.data.object as Stripe.Subscription;
        await handleSubscriptionUpdate(subscription);
        break;
      }

      case 'customer.subscription.deleted': {
        const subscription = event.data.object as Stripe.Subscription;
        await handleSubscriptionDeleted(subscription);
        break;
      }

      case 'invoice.payment_succeeded': {
        const invoice = event.data.object as Stripe.Invoice;
        await handlePaymentSucceeded(invoice);
        break;
      }

      case 'invoice.payment_failed': {
        const invoice = event.data.object as Stripe.Invoice;
        await handlePaymentFailed(invoice);
        break;
      }

      default:
        console.log(`Unhandled event type: ${event.type}`);
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error('Webhook handler error:', error);
    return NextResponse.json({ error: 'Webhook handler failed' }, { status: 500 });
  }
}

async function handleCheckoutCompleted(session: Stripe.Checkout.Session) {
  const userId = session.metadata?.user_id;
  const tokenAmount = session.metadata?.token_amount;

  if (!userId) {
    console.error('No user_id in session metadata');
    return;
  }

  // 토큰 구매인 경우
  if (tokenAmount) {
    const { error } = await getSupabaseAdmin().rpc('add_tokens', {
      p_user_id: userId,
      p_amount: parseInt(tokenAmount),
    });

    if (error) {
      console.error('Failed to add tokens:', error);
      throw error;
    }

    // 구매 기록 저장
    await getSupabaseAdmin().from('purchases').insert({
      user_id: userId,
      type: 'token',
      amount: parseInt(tokenAmount),
      price: session.amount_total ? session.amount_total / 100 : 0,
      currency: session.currency || 'usd',
      stripe_session_id: session.id,
    });

    // 서버사이드 애널리틱스 (Meta CAPI, Mixpanel)
    const price = session.amount_total ? session.amount_total / 100 : 0;
    await trackPurchaseServer({
      userId,
      email: session.customer_email || undefined,
      value: price,
      currency: (session.currency || 'krw').toUpperCase(),
      transactionId: session.id,
      items: [{
        id: session.metadata?.package_id || 'credits',
        name: `${tokenAmount} Credits`,
        price,
      }],
    });
  }

  // 구독인 경우 subscription 이벤트에서 처리
}

async function handleSubscriptionUpdate(subscription: Stripe.Subscription) {
  if (!stripe) throw new Error('Stripe not configured');
  const customerId = subscription.customer as string;

  // Stripe customer에서 user_id 가져오기
  const customer = await stripe.customers.retrieve(customerId);
  const userId = (customer as Stripe.Customer).metadata?.user_id;

  if (!userId) {
    console.error('No user_id in customer metadata');
    return;
  }

  const subscriptionItem = subscription.items.data[0];
  const plan = subscriptionItem?.price?.lookup_key || 'premium';
  const status = subscription.status;

  // Stripe v20+에서는 period 정보가 subscription item에 있음
  const periodStart = subscriptionItem?.current_period_start || Math.floor(Date.now() / 1000);
  const periodEnd = subscriptionItem?.current_period_end || Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60;

  const periodEndDate = new Date(periodEnd * 1000);
  const isActive = status === 'active' || status === 'trialing';

  // 구독 상태 업데이트
  const { error: subError } = await getSupabaseAdmin()
    .from('subscriptions')
    .upsert({
      user_id: userId,
      stripe_subscription_id: subscription.id,
      stripe_customer_id: customerId,
      plan_id: plan,
      status: status,
      current_period_start: new Date(periodStart * 1000).toISOString(),
      current_period_end: periodEndDate.toISOString(),
    }, {
      onConflict: 'user_id',
    });

  if (subError) {
    console.error('Failed to update subscription:', subError);
    throw subError;
  }

  // users 테이블의 프리미엄 상태 업데이트
  const { error: userError } = await getSupabaseAdmin()
    .from('users')
    .update({
      is_premium: isActive,
      premium_expires_at: isActive ? periodEndDate.toISOString() : null,
    })
    .eq('id', userId);

  if (userError) {
    console.error('Failed to update user premium status:', userError);
    throw userError;
  }

  // 신규 구독인 경우 서버사이드 애널리틱스 전송
  if (isActive && status === 'active') {
    const price = subscriptionItem?.price;
    const amount = price?.unit_amount ? price.unit_amount / 100 : 9900;

    await trackSubscribeServer({
      userId,
      email: (customer as Stripe.Customer).email || undefined,
      planId: plan,
      planName: `Pro ${plan.includes('yearly') ? 'Yearly' : 'Monthly'}`,
      value: amount,
      currency: (price?.currency || 'krw').toUpperCase(),
      transactionId: subscription.id,
    });
  }
}

async function handleSubscriptionDeleted(subscription: Stripe.Subscription) {
  if (!stripe) throw new Error('Stripe not configured');
  const customerId = subscription.customer as string;

  const customer = await stripe.customers.retrieve(customerId);
  const userId = (customer as Stripe.Customer).metadata?.user_id;

  if (!userId) {
    console.error('No user_id in customer metadata');
    return;
  }

  // 구독 취소 처리
  const { error: subError } = await getSupabaseAdmin()
    .from('subscriptions')
    .update({
      status: 'canceled',
    })
    .eq('user_id', userId);

  if (subError) {
    console.error('Failed to cancel subscription:', subError);
    throw subError;
  }

  // users 테이블의 프리미엄 상태 해제
  const { error: userError } = await getSupabaseAdmin()
    .from('users')
    .update({
      is_premium: false,
      premium_expires_at: null,
    })
    .eq('id', userId);

  if (userError) {
    console.error('Failed to update user premium status:', userError);
    throw userError;
  }
}

// 구독 플랜별 크레딧 지급량
const SUBSCRIPTION_CREDITS = {
  pro_monthly: 660,
  pro_yearly: 666, // 연간은 매월 분할 지급 (8000/12)
  vip_monthly: 660,
  vip_yearly: 666,
} as const;

async function handlePaymentSucceeded(invoice: Stripe.Invoice) {
  if (!stripe) throw new Error('Stripe not configured');
  console.log('Payment succeeded for invoice:', invoice.id);

  // 구독 결제인 경우 크레딧 지급
  const subscriptionId = (invoice as unknown as { subscription?: string }).subscription;
  if (subscriptionId) {
    const customerId = invoice.customer as string;
    const customer = await stripe.customers.retrieve(customerId);
    const userId = (customer as Stripe.Customer).metadata?.user_id;

    if (!userId) {
      console.error('No user_id in customer metadata');
      return;
    }

    // 구독 정보에서 플랜 확인
    const subscription = await stripe.subscriptions.retrieve(subscriptionId);
    const lookupKey = subscription.items.data[0]?.price?.lookup_key;

    // 플랜에 따른 크레딧 결정
    let creditsToAdd = 660; // 기본값
    if (lookupKey) {
      creditsToAdd = SUBSCRIPTION_CREDITS[lookupKey as keyof typeof SUBSCRIPTION_CREDITS] || 660;
    }

    // 크레딧 지급
    const { error } = await getSupabaseAdmin().rpc('add_tokens', {
      p_user_id: userId,
      p_amount: creditsToAdd,
    });

    if (error) {
      console.error('Failed to add subscription credits:', error);
      // 크레딧 지급 실패해도 구독은 유지되어야 하므로 throw하지 않음
    } else {
      console.log(`Added ${creditsToAdd} credits to user ${userId}`);
    }

    // 크레딧 지급 기록 저장
    await getSupabaseAdmin().from('purchases').insert({
      user_id: userId,
      type: 'subscription_credit',
      amount: creditsToAdd,
      price: 0, // 구독 크레딧은 무료
      currency: invoice.currency || 'krw',
      stripe_session_id: invoice.id,
    });
  }
}

async function handlePaymentFailed(invoice: Stripe.Invoice) {
  if (!stripe) throw new Error('Stripe not configured');
  console.log('Payment failed for invoice:', invoice.id);

  const customerId = invoice.customer as string;
  const customer = await stripe.customers.retrieve(customerId);
  const userId = (customer as Stripe.Customer).metadata?.user_id;

  if (userId) {
    // 결제 실패 알림 등 처리
    await getSupabaseAdmin().from('notifications').insert({
      user_id: userId,
      type: 'payment_failed',
      title: '결제 실패',
      message: '구독 결제에 실패했습니다. 결제 수단을 확인해주세요.',
    });
  }
}
