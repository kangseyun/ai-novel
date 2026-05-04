import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth';
import { createClient } from '@/lib/supabase-server';
import { lookupPlan } from '@/lib/pricing';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;

  const { id } = await params;
  const supabase = await createClient();

  const { data: sub, error } = await supabase
    .from('subscriptions')
    .select(`
      id, user_id, stripe_subscription_id, stripe_customer_id,
      plan_id, status, current_period_start, current_period_end,
      cancel_at_period_end, created_at, updated_at,
      users:users!inner(id, email, nickname, role, subscription_tier, tokens, created_at)
    `)
    .eq('id', id)
    .single();

  if (error || !sub) {
    return NextResponse.json({ error: 'Subscription not found' }, { status: 404 });
  }

  const plan = lookupPlan(sub.plan_id);

  const { data: purchases } = await supabase
    .from('purchases')
    .select('id, type, amount, price, currency, stripe_session_id, stripe_payment_intent_id, metadata, created_at')
    .eq('user_id', sub.user_id)
    .order('created_at', { ascending: false })
    .limit(20);

  const { data: welcomeOffer } = await supabase
    .from('welcome_offer_purchases')
    .select('id, plan_type, original_price, paid_price, discount_percent, bonus_credits, purchased_at')
    .eq('user_id', sub.user_id)
    .maybeSingle();

  return NextResponse.json({
    subscription: {
      ...sub,
      planName: plan?.name ?? sub.plan_id,
      tier: plan?.tier ?? null,
      monthlyUsd: plan?.monthly_usd ?? 0,
    },
    purchases: purchases ?? [],
    welcomeOffer,
  });
}
