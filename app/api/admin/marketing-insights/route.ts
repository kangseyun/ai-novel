import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { requireAdmin } from '@/lib/auth';
import { lookupPlan } from '@/lib/pricing';

interface UserRow {
  id: string;
  utm_source: string | null;
  utm_medium: string | null;
  utm_campaign: string | null;
  subscription_tier: string;
  is_premium: boolean;
  created_at: string;
}

interface CampaignRow {
  id: string;
  name: string;
  platform: string;
  status: string;
  budget_daily: number | null;
  start_date: string | null;
  end_date: string | null;
}

interface SubRow {
  user_id: string;
  plan_id: string;
  status: string;
}

const UNTRACKED = '(untracked)';

export async function GET() {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    return NextResponse.json({ error: 'Service role not configured' }, { status: 500 });
  }
  const admin = createClient(url, key);

  const [{ data: users }, { data: subs }, { data: campaigns }] = await Promise.all([
    admin.from('users').select('id, utm_source, utm_medium, utm_campaign, subscription_tier, is_premium, created_at'),
    admin.from('subscriptions').select('user_id, plan_id, status').in('status', ['active', 'trialing']),
    admin.from('marketing_campaigns')
      .select('id, name, platform, status, budget_daily, start_date, end_date'),
  ]);

  const usersList = (users ?? []) as UserRow[];
  const subsList = (subs ?? []) as SubRow[];
  const subByUser = new Map(subsList.map((s) => [s.user_id, s]));

  const bySource = new Map<string, {
    source: string;
    signups: number;
    standard: number;
    pass: number;
    mrrUsd: number;
  }>();

  for (const u of usersList) {
    const source = u.utm_source ?? UNTRACKED;
    const entry = bySource.get(source) ?? { source, signups: 0, standard: 0, pass: 0, mrrUsd: 0 };
    entry.signups += 1;

    const sub = subByUser.get(u.id);
    if (sub) {
      const plan = lookupPlan(sub.plan_id);
      if (plan?.tier === 'lumin_pass') entry.pass += 1;
      else if (plan?.tier === 'standard') entry.standard += 1;
      if (plan) entry.mrrUsd += plan.monthly_usd;
    }

    bySource.set(source, entry);
  }

  // Per-platform spend (rough): sum daily budgets active during the last 30 days
  const platformSpend = new Map<string, number>();
  const now = Date.now();
  const thirtyAgo = now - 30 * 86_400_000;
  for (const c of (campaigns ?? []) as CampaignRow[]) {
    if (!c.budget_daily) continue;
    if (c.status !== 'active') continue;
    const start = c.start_date ? new Date(c.start_date).getTime() : thirtyAgo;
    const end = c.end_date ? new Date(c.end_date).getTime() : now;
    const overlapStart = Math.max(start, thirtyAgo);
    const overlapEnd = Math.min(end, now);
    if (overlapEnd <= overlapStart) continue;
    const days = (overlapEnd - overlapStart) / 86_400_000;
    const spend = Number(c.budget_daily) * days;
    platformSpend.set(c.platform, (platformSpend.get(c.platform) ?? 0) + spend);
  }

  const channels = Array.from(bySource.values())
    .map((row) => {
      const spend = platformSpend.get(row.source) ?? 0;
      return {
        ...row,
        signupRate: usersList.length > 0 ? Math.round((row.signups / usersList.length) * 1000) / 10 : 0,
        standardRate: row.signups > 0 ? Math.round((row.standard / row.signups) * 1000) / 10 : 0,
        passRate: row.signups > 0 ? Math.round((row.pass / row.signups) * 1000) / 10 : 0,
        spendUsd30d: Math.round(spend * 100) / 100,
        cacUsd: row.signups > 0 && spend > 0 ? Math.round((spend / row.signups) * 100) / 100 : 0,
      };
    })
    .sort((a, b) => b.signups - a.signups);

  const totals = {
    users: usersList.length,
    untracked: bySource.get(UNTRACKED)?.signups ?? 0,
    activePass: subsList.filter((s) => lookupPlan(s.plan_id)?.tier === 'lumin_pass').length,
    activeStandard: subsList.filter((s) => lookupPlan(s.plan_id)?.tier === 'standard').length,
    spendUsd30d: Math.round(Array.from(platformSpend.values()).reduce((a, b) => a + b, 0) * 100) / 100,
  };

  return NextResponse.json({
    channels,
    totals,
    untrackedShare: usersList.length > 0
      ? Math.round((totals.untracked / usersList.length) * 1000) / 10
      : 0,
    notes: [
      'utm_source가 NULL인 유저는 (untracked) 버킷으로 분류됩니다.',
      '캠페인 지출은 marketing_campaigns.budget_daily × 30일 활성 기간 단순 합산입니다.',
      'Mixpanel/Airbridge 어트리뷰션은 통합 후 다시 검토하세요 (P2-1, P2-2).',
    ],
  });
}
