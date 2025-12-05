import { NextRequest, NextResponse } from 'next/server';
import { stripe } from '@/lib/stripe';
import { createServerClient } from '@/lib/supabase-server';

// 구독 플랜 정의 (USD 기준)
const SUBSCRIPTION_PLANS = {
  monthly: {
    name: 'Pro Membership (Monthly)',
    price: 999,          // $9.99/month
    interval: 'month' as const,
    credits: 300,        // 매월 지급 크레딧 (약 $10 가치)
    features: [
      '300 Monthly Credits',
      'Free Premium Episodes',
      'Ad-free Experience',
      'Exclusive Story Access',
      'Priority Support',
    ],
  },
  yearly: {
    name: 'Pro Membership (Yearly)',
    price: 9999,         // $99.99/year (~17% OFF)
    interval: 'year' as const,
    credits: 4000,       // 연간 총 크레딧
    features: [
      '4,000 Yearly Credits',
      'Free Premium Episodes',
      'Ad-free Experience',
      'Exclusive Story Access',
      'Priority Support',
      'New Character Early Access',
    ],
  },
};

export async function POST(request: NextRequest) {
  try {
    if (!stripe) {
      return NextResponse.json({ error: 'Stripe not configured' }, { status: 500 });
    }

    const supabase = await createServerClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { plan_id } = await request.json();

    if (!plan_id || !SUBSCRIPTION_PLANS[plan_id as keyof typeof SUBSCRIPTION_PLANS]) {
      return NextResponse.json({ error: 'Invalid plan' }, { status: 400 });
    }

    const plan = SUBSCRIPTION_PLANS[plan_id as keyof typeof SUBSCRIPTION_PLANS];

    // Stripe 고객 찾기 또는 생성
    let customerId: string;
    const customers = await stripe.customers.list({
      email: user.email,
      limit: 1,
    });

    if (customers.data.length > 0) {
      customerId = customers.data[0].id;
      await stripe.customers.update(customerId, {
        metadata: { user_id: user.id },
      });
    } else {
      const customer = await stripe.customers.create({
        email: user.email,
        metadata: { user_id: user.id },
      });
      customerId = customer.id;
    }

    // Stripe에서 Price 찾기 또는 생성
    const priceId = await getOrCreatePrice(plan_id, plan);

    // Checkout 세션 생성 (구독 모드)
    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      payment_method_types: ['card'],
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      mode: 'subscription',
      success_url: `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/shop?subscription=success`,
      cancel_url: `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/shop?subscription=canceled`,
      metadata: {
        user_id: user.id,
        plan_id: plan_id,
      },
      subscription_data: {
        metadata: {
          user_id: user.id,
          plan_id: plan_id,
        },
      },
    });

    return NextResponse.json({ url: session.url });
  } catch (error) {
    console.error('Subscription checkout error:', error);
    return NextResponse.json({ error: 'Failed to create subscription checkout' }, { status: 500 });
  }
}

// 구독 플랜 목록 조회
export async function GET() {
  const plans = Object.entries(SUBSCRIPTION_PLANS).map(([id, plan]) => ({
    id,
    ...plan,
  }));

  return NextResponse.json({ plans });
}

// Stripe Price 찾기 또는 생성
async function getOrCreatePrice(planId: string, plan: { name: string; price: number; interval: 'month' | 'year'; credits: number; features: string[] }) {
  if (!stripe) throw new Error('Stripe not configured');
  const lookupKey = `pro_${planId}`;

  // 기존 Price 찾기
  const prices = await stripe.prices.list({
    lookup_keys: [lookupKey],
    limit: 1,
  });

  if (prices.data.length > 0) {
    return prices.data[0].id;
  }

  // 기존 상품 사용 (이미 Stripe에 생성된 VIP 멤버십)
  const productId = 'prod_TWQg6iFER1FGgP';

  // Price 생성
  const price = await stripe.prices.create({
    product: productId,
    unit_amount: plan.price,
    currency: 'usd',
    recurring: {
      interval: plan.interval,
    },
    lookup_key: lookupKey,
  });

  return price.id;
}
