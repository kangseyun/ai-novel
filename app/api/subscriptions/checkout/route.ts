import { NextRequest, NextResponse } from 'next/server';
import { stripe } from '@/lib/stripe';
import { createServerClient } from '@/lib/supabase-server';
import { SUBSCRIPTION_PRICING, type PlanPricing } from '@/lib/pricing';

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
    const plan = SUBSCRIPTION_PRICING[plan_id as keyof typeof SUBSCRIPTION_PRICING];

    if (!plan) {
      return NextResponse.json({ error: 'Invalid plan' }, { status: 400 });
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

    const priceId = await getOrCreatePrice(plan);

    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      payment_method_types: ['card'],
      line_items: [{ price: priceId, quantity: 1 }],
      mode: 'subscription',
      success_url: `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/shop?subscription=success`,
      cancel_url: `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/shop?subscription=canceled`,
      metadata: {
        user_id: user.id,
        plan_id: plan.id,
        tier: plan.tier,
      },
      subscription_data: {
        metadata: {
          user_id: user.id,
          plan_id: plan.id,
          tier: plan.tier,
        },
      },
    });

    return NextResponse.json({ url: session.url });
  } catch (error) {
    console.error('Subscription checkout error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function GET() {
  const plans = Object.values(SUBSCRIPTION_PRICING);
  return NextResponse.json({ plans });
}

async function getOrCreatePrice(plan: PlanPricing): Promise<string> {
  if (!stripe) throw new Error('Stripe not configured');

  const prices = await stripe.prices.list({ lookup_keys: [plan.lookup_key], limit: 1 });
  if (prices.data.length > 0) return prices.data[0].id;

  const productId = await getOrCreateProduct(plan);

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

async function getOrCreateProduct(plan: PlanPricing): Promise<string> {
  if (!stripe) throw new Error('Stripe not configured');

  const productName = plan.tier === 'lumin_pass' ? 'LUMIN PASS' : 'Standard';
  const products = await stripe.products.search({
    query: `name:"${productName}" AND active:"true"`,
    limit: 1,
  });

  if (products.data.length > 0) return products.data[0].id;

  const product = await stripe.products.create({
    name: productName,
    description: plan.tagline,
    metadata: { tier: plan.tier },
  });
  return product.id;
}
