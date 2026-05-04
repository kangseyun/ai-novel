import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth';
import { createClient } from '@/lib/supabase-server';
import { lookupPlan } from '@/lib/pricing';

export async function GET(request: NextRequest) {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;

  const url = new URL(request.url);
  const status = url.searchParams.get('status');
  const tier = url.searchParams.get('tier');
  const expiringWithinDays = url.searchParams.get('expiring_within_days');

  const supabase = await createClient();

  let query = supabase
    .from('subscriptions')
    .select(`
      id, user_id, stripe_subscription_id, stripe_customer_id,
      plan_id, status, current_period_start, current_period_end,
      cancel_at_period_end, created_at, updated_at,
      users:users!inner(id, email, nickname, role, subscription_tier)
    `)
    .order('current_period_end', { ascending: true, nullsFirst: false });

  if (status) query = query.eq('status', status);

  const { data, error } = await query;
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  let rows = (data ?? []).map((row) => {
    const plan = lookupPlan(row.plan_id);
    return {
      id: row.id,
      userId: row.user_id,
      email: (row.users as { email?: string } | null)?.email ?? null,
      nickname: (row.users as { nickname?: string } | null)?.nickname ?? null,
      stripeSubscriptionId: row.stripe_subscription_id,
      stripeCustomerId: row.stripe_customer_id,
      planId: row.plan_id,
      planName: plan?.name ?? row.plan_id,
      tier: plan?.tier ?? null,
      monthlyUsd: plan?.monthly_usd ?? 0,
      status: row.status,
      currentPeriodStart: row.current_period_start,
      currentPeriodEnd: row.current_period_end,
      cancelAtPeriodEnd: row.cancel_at_period_end,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  });

  if (tier) rows = rows.filter((r) => r.tier === tier);

  if (expiringWithinDays) {
    const days = parseInt(expiringWithinDays, 10);
    if (Number.isFinite(days)) {
      const cutoff = new Date(Date.now() + days * 24 * 60 * 60 * 1000);
      rows = rows.filter((r) =>
        r.currentPeriodEnd ? new Date(r.currentPeriodEnd) <= cutoff : false
      );
    }
  }

  return NextResponse.json({ subscriptions: rows });
}
