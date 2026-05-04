import { NextRequest, NextResponse } from 'next/server';
import { stripe } from '@/lib/stripe';
import { createServerClient } from '@/lib/supabase-server';
import { WELCOME_OFFER_PRICING } from '@/lib/pricing';

const OFFER_VALIDITY_MS = 24 * 60 * 60 * 1000;

export async function GET() {
  try {
    const supabase = await createServerClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('created_at, welcome_offer_claimed')
      .eq('id', user.id)
      .single();

    if (userError || !userData) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    if (userData.welcome_offer_claimed) {
      return NextResponse.json({
        eligible: false,
        expiresAt: null,
        remainingSeconds: 0,
        alreadyPurchased: true,
      });
    }

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
      offer: WELCOME_OFFER_PRICING.welcome_lumin_pass_monthly,
    });
  } catch (error) {
    console.error('Welcome offer eligibility check error:', error);
    return NextResponse.json({ error: 'Failed to check eligibility' }, { status: 500 });
  }
}

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

    const body = await request.json().catch(() => ({}));
    const planId = (body.plan_id as string) || 'welcome_lumin_pass_monthly';
    const plan = WELCOME_OFFER_PRICING[planId];
    if (!plan) {
      return NextResponse.json({ error: 'Invalid plan' }, { status: 400 });
    }

    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('created_at, welcome_offer_claimed')
      .eq('id', user.id)
      .single();

    if (userError || !userData) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }
    if (userData.welcome_offer_claimed) {
      return NextResponse.json({ error: 'Welcome offer already claimed' }, { status: 400 });
    }

    const createdAt = new Date(userData.created_at).getTime();
    const expiresAt = createdAt + OFFER_VALIDITY_MS;
    if (Date.now() > expiresAt) {
      return NextResponse.json({ error: 'Welcome offer has expired' }, { status: 400 });
    }

    let customerId: string;
    const customers = await stripe.customers.list({ email: user.email, limit: 1 });
    if (customers.data.length > 0) {
      customerId = customers.data[0].id;
      await stripe.customers.update(customerId, { metadata: { user_id: user.id } });
    } else {
      const customer = await stripe.customers.create({
        email: user.email,
        metadata: { user_id: user.id },
      });
      customerId = customer.id;
    }

    const priceId = await getOrCreateWelcomePrice(plan.id, plan);

    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      payment_method_types: ['card'],
      line_items: [{ price: priceId, quantity: 1 }],
      mode: 'subscription',
      success_url: `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/?welcome_offer=success`,
      cancel_url: `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/?welcome_offer=canceled`,
      metadata: {
        user_id: user.id,
        plan_id: plan.id,
        tier: plan.tier,
        is_welcome_offer: 'true',
        discount_percent: String(plan.discount_percent),
      },
      subscription_data: {
        metadata: {
          user_id: user.id,
          plan_id: plan.id,
          tier: plan.tier,
          is_welcome_offer: 'true',
        },
      },
      custom_text: {
        submit: {
          message: `LUMIN PASS ${plan.discount_percent}% 할인 — 가입 후 24시간 한정. 7일 무조건 환불 보장.`,
        },
      },
    });

    return NextResponse.json({ url: session.url });
  } catch (error) {
    console.error('Welcome offer checkout error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

async function getOrCreateWelcomePrice(
  planId: string,
  plan: { unit_amount_cents: number; interval: 'month' | 'year'; lookup_key: string; name: string }
): Promise<string> {
  if (!stripe) throw new Error('Stripe not configured');

  const prices = await stripe.prices.list({ lookup_keys: [plan.lookup_key], limit: 1 });
  if (prices.data.length > 0) return prices.data[0].id;

  const productId = await getOrCreateWelcomeProduct();

  const price = await stripe.prices.create({
    product: productId,
    unit_amount: plan.unit_amount_cents,
    currency: 'usd',
    recurring: { interval: plan.interval },
    lookup_key: plan.lookup_key,
    nickname: plan.name,
  });
  return price.id;
}

async function getOrCreateWelcomeProduct(): Promise<string> {
  if (!stripe) throw new Error('Stripe not configured');

  const products = await stripe.products.search({
    query: 'name:"LUMIN PASS Welcome Offer" AND active:"true"',
    limit: 1,
  });
  if (products.data.length > 0) return products.data[0].id;

  const product = await stripe.products.create({
    name: 'LUMIN PASS Welcome Offer',
    description: '가입 후 24시간 한정 — LUMIN PASS 50% 할인',
    metadata: { is_welcome_offer: 'true', tier: 'lumin_pass' },
  });
  return product.id;
}
