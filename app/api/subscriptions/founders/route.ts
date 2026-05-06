import { NextResponse } from 'next/server';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { stripe } from '@/lib/stripe';
import { createServerClient } from '@/lib/supabase-server';
import { ONE_TIME_PRODUCTS, type OneTimeProductPricing } from '@/lib/pricing';

let supabaseAdminClient: SupabaseClient | null = null;
function getSupabaseAdmin(): SupabaseClient | null {
  if (supabaseAdminClient) return supabaseAdminClient;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  supabaseAdminClient = createClient(url, key);
  return supabaseAdminClient;
}

async function countClaimedFoundersNumbers(): Promise<number> {
  const admin = getSupabaseAdmin();
  if (!admin) return 0;
  const { count } = await admin
    .from('users')
    .select('id', { count: 'exact', head: true })
    .not('founders_number', 'is', null);
  return count ?? 0;
}

export async function GET() {
  const product = ONE_TIME_PRODUCTS.founders_edition;
  const claimed = await countClaimedFoundersNumbers();
  const total = product.total_supply ?? 0;
  return NextResponse.json({
    product,
    claimed,
    total_supply: total,
    remaining: Math.max(0, total - claimed),
    available: claimed < total,
  });
}

export async function POST() {
  try {
    if (!stripe) {
      return NextResponse.json({ error: 'Stripe not configured' }, { status: 500 });
    }

    const supabase = await createServerClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: userData } = await supabase
      .from('users')
      .select('founders_number, subscription_tier')
      .eq('id', user.id)
      .single();

    if (userData?.founders_number != null) {
      return NextResponse.json({
        error: 'You already own Founders Edition',
        founders_number: userData.founders_number,
      }, { status: 400 });
    }

    const product = ONE_TIME_PRODUCTS.founders_edition;
    const total = product.total_supply ?? 100;
    const claimed = await countClaimedFoundersNumbers();
    if (claimed >= total) {
      return NextResponse.json({ error: 'All Founders Edition slots claimed' }, { status: 410 });
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

    const priceId = await getOrCreateOneTimePrice(product);

    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      payment_method_types: ['card'],
      line_items: [{ price: priceId, quantity: 1 }],
      mode: 'payment',
      success_url: `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/shop?founders=success`,
      cancel_url: `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/shop?founders=canceled`,
      metadata: {
        user_id: user.id,
        product_id: product.id,
        product_type: 'founders_edition',
        tier: product.grants_tier ?? '',
      },
      payment_intent_data: {
        metadata: {
          user_id: user.id,
          product_id: product.id,
          product_type: 'founders_edition',
        },
      },
      custom_text: {
        submit: {
          message: 'Founders Edition은 100석 한정 일회성 결제입니다. 1년 PASS Annual + 영구 Founders 번호가 부여됩니다.',
        },
      },
    });

    return NextResponse.json({ url: session.url });
  } catch (error) {
    console.error('Founders Edition checkout error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

async function getOrCreateOneTimePrice(product: OneTimeProductPricing): Promise<string> {
  if (!stripe) throw new Error('Stripe not configured');

  const prices = await stripe.prices.list({ lookup_keys: [product.lookup_key], limit: 1 });
  if (prices.data.length > 0) return prices.data[0].id;

  const stripeProductId = await getOrCreateOneTimeStripeProduct(product);

  const price = await stripe.prices.create({
    product: stripeProductId,
    unit_amount: product.unit_amount_cents,
    currency: 'usd',
    lookup_key: product.lookup_key,
    nickname: product.name,
  });
  return price.id;
}

async function getOrCreateOneTimeStripeProduct(product: OneTimeProductPricing): Promise<string> {
  if (!stripe) throw new Error('Stripe not configured');

  const products = await stripe.products.search({
    query: `name:"${product.name}" AND active:"true"`,
    limit: 1,
  });
  if (products.data.length > 0) return products.data[0].id;

  const stripeProduct = await stripe.products.create({
    name: product.name,
    description: product.tagline,
    metadata: { product_id: product.id, type: 'one_time' },
  });
  return stripeProduct.id;
}
