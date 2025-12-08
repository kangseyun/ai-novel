import { NextRequest, NextResponse } from 'next/server';
import { stripe } from '@/lib/stripe';
import { createServerClient } from '@/lib/supabase-server';

// 24시간 한정 특가 가격 (70% 할인)
const WELCOME_OFFER_PLANS = {
  monthly: {
    name: 'Welcome Offer - Pro Monthly',
    originalPrice: 999,  // $9.99
    price: 299,          // $2.99 (70% OFF)
    interval: 'month' as const,
    credits: 500,        // 보너스 크레딧
    features: [
      '500 Welcome Bonus Credits',
      'Free Premium Episodes',
      'Ad-free Experience',
      'Exclusive Story Access',
      'Priority Support',
    ],
  },
  yearly: {
    name: 'Welcome Offer - Pro Yearly',
    originalPrice: 9999, // $99.99
    price: 2999,         // $29.99 (70% OFF)
    interval: 'year' as const,
    credits: 6000,       // 보너스 크레딧
    features: [
      '6,000 Welcome Bonus Credits',
      'Free Premium Episodes',
      'Ad-free Experience',
      'Exclusive Story Access',
      'Priority Support',
      'New Character Early Access',
    ],
  },
};

// 24시간 = 86400000ms
const OFFER_VALIDITY_MS = 24 * 60 * 60 * 1000;

// GET: 웰컴 오퍼 자격 확인
export async function GET() {
  try {
    const supabase = await createServerClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // 사용자 정보 조회
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('created_at, welcome_offer_claimed')
      .eq('id', user.id)
      .single();

    if (userError || !userData) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // 이미 웰컴 오퍼를 구매했는지 확인
    if (userData.welcome_offer_claimed) {
      return NextResponse.json({
        eligible: false,
        expiresAt: null,
        remainingSeconds: 0,
        alreadyPurchased: true,
      });
    }

    // 가입 시간 기준 24시간 확인
    const createdAt = new Date(userData.created_at).getTime();
    const expiresAt = createdAt + OFFER_VALIDITY_MS;
    const now = Date.now();
    const remainingMs = expiresAt - now;

    if (remainingMs <= 0) {
      return NextResponse.json({
        eligible: false,
        expiresAt: new Date(expiresAt).toISOString(),
        remainingSeconds: 0,
        alreadyPurchased: false,
      });
    }

    return NextResponse.json({
      eligible: true,
      expiresAt: new Date(expiresAt).toISOString(),
      remainingSeconds: Math.floor(remainingMs / 1000),
      alreadyPurchased: false,
    });
  } catch (error) {
    console.error('Welcome offer eligibility check error:', error);
    return NextResponse.json(
      { error: 'Failed to check eligibility' },
      { status: 500 }
    );
  }
}

// POST: 웰컴 오퍼 결제 세션 생성
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

    if (!plan_id || !WELCOME_OFFER_PLANS[plan_id as keyof typeof WELCOME_OFFER_PLANS]) {
      return NextResponse.json({ error: 'Invalid plan' }, { status: 400 });
    }

    // 사용자 자격 확인
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('created_at, welcome_offer_claimed')
      .eq('id', user.id)
      .single();

    if (userError || !userData) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // 이미 구매한 경우
    if (userData.welcome_offer_claimed) {
      return NextResponse.json(
        { error: 'Welcome offer already claimed' },
        { status: 400 }
      );
    }

    // 24시간 만료 확인
    const createdAt = new Date(userData.created_at).getTime();
    const expiresAt = createdAt + OFFER_VALIDITY_MS;
    const now = Date.now();

    if (now > expiresAt) {
      return NextResponse.json(
        { error: 'Welcome offer has expired' },
        { status: 400 }
      );
    }

    const plan = WELCOME_OFFER_PLANS[plan_id as keyof typeof WELCOME_OFFER_PLANS];

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

    // Stripe Price 찾기 또는 생성
    const priceId = await getOrCreateWelcomeOfferPrice(plan_id, plan);

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
      success_url: `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/?welcome_offer=success`,
      cancel_url: `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/?welcome_offer=canceled`,
      metadata: {
        user_id: user.id,
        plan_id: plan_id,
        is_welcome_offer: 'true',
        bonus_credits: plan.credits.toString(),
      },
      subscription_data: {
        metadata: {
          user_id: user.id,
          plan_id: plan_id,
          is_welcome_offer: 'true',
          bonus_credits: plan.credits.toString(),
        },
      },
      // 긴급성 강조: 만료 시간 표시
      custom_text: {
        submit: {
          message: `🎉 70% 할인 특가! 가입 후 24시간 한정 - ${plan.credits.toLocaleString()} 보너스 크레딧 즉시 지급`,
        },
      },
    });

    return NextResponse.json({ url: session.url });
  } catch (error) {
    console.error('Welcome offer checkout error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}

// Stripe Price 찾기 또는 생성
async function getOrCreateWelcomeOfferPrice(
  planId: string,
  plan: {
    name: string;
    price: number;
    interval: 'month' | 'year';
    credits: number;
    features: string[];
  }
) {
  if (!stripe) throw new Error('Stripe not configured');
  const lookupKey = `welcome_offer_${planId}`;

  // 기존 Price 찾기
  const prices = await stripe.prices.list({
    lookup_keys: [lookupKey],
    limit: 1,
  });

  if (prices.data.length > 0) {
    return prices.data[0].id;
  }

  // Product 찾기 또는 생성
  const productId = await getOrCreateWelcomeOfferProduct();

  // Price 생성
  const price = await stripe.prices.create({
    product: productId,
    unit_amount: plan.price,
    currency: 'usd',
    recurring: {
      interval: plan.interval,
    },
    lookup_key: lookupKey,
    nickname: `Welcome Offer - ${plan.interval === 'month' ? 'Monthly' : 'Yearly'} (70% OFF)`,
  });

  return price.id;
}

// Stripe Product 찾기 또는 생성
async function getOrCreateWelcomeOfferProduct(): Promise<string> {
  if (!stripe) throw new Error('Stripe not configured');

  // 기존 웰컴 오퍼 상품 찾기
  const products = await stripe.products.search({
    query: 'name~"Welcome Offer" AND active:"true"',
    limit: 1,
  });

  if (products.data.length > 0) {
    return products.data[0].id;
  }

  // 상품 생성
  const product = await stripe.products.create({
    name: 'Welcome Offer - VIP 멤버십',
    description: '신규 가입자 24시간 한정 70% 할인 특가',
    metadata: {
      is_welcome_offer: 'true',
    },
  });

  return product.id;
}
