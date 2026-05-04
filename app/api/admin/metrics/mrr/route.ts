import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth';
import { createClient } from '@/lib/supabase-server';
import { lookupPlan, PASS_MILESTONE_TARGET } from '@/lib/pricing';

export async function GET() {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;

  const supabase = await createClient();

  const { data: subs, error } = await supabase
    .from('subscriptions')
    .select('plan_id, status, current_period_end, cancel_at_period_end');

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const tierCounts = { free: 0, standard: 0, lumin_pass: 0 } as Record<string, number>;
  const intervalCounts = { month: 0, year: 0 } as Record<string, number>;
  let mrrUsd = 0;
  let activePassCount = 0;
  let unknownPlans: string[] = [];

  for (const sub of subs ?? []) {
    if (sub.status !== 'active' && sub.status !== 'trialing') continue;

    const plan = lookupPlan(sub.plan_id);
    if (!plan) {
      if (sub.plan_id) unknownPlans.push(sub.plan_id);
      continue;
    }
    tierCounts[plan.tier] += 1;
    intervalCounts[plan.interval] += 1;
    mrrUsd += plan.monthly_usd;
    if (plan.tier === 'lumin_pass') activePassCount += 1;
  }

  const { count: totalUsers } = await supabase
    .from('users')
    .select('*', { count: 'exact', head: true });

  tierCounts.free = Math.max(0, (totalUsers ?? 0) - tierCounts.standard - tierCounts.lumin_pass);

  return NextResponse.json({
    mrrUsd: Math.round(mrrUsd * 100) / 100,
    annualizedUsd: Math.round(mrrUsd * 12 * 100) / 100,
    tierCounts,
    intervalCounts,
    passMilestone: {
      current: activePassCount,
      target: PASS_MILESTONE_TARGET,
      percent: Math.min(100, Math.round((activePassCount / PASS_MILESTONE_TARGET) * 100)),
    },
    unknownPlans: Array.from(new Set(unknownPlans)),
  });
}
