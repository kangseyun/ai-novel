import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth';
import { createClient } from '@supabase/supabase-js';

interface UsageRow {
  user_id: string;
  model_id: string;
  total_tokens: number;
  estimated_cost: number;
  task_type: string;
  created_at: string;
}

export async function GET() {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    return NextResponse.json({ error: 'Service role not configured' }, { status: 500 });
  }
  const admin = createClient(url, key);

  const since30d = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

  const { data: rows, error } = await admin
    .from('llm_usage_records')
    .select('user_id, model_id, total_tokens, estimated_cost, task_type, created_at')
    .gte('created_at', since30d);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const records = (rows ?? []) as UsageRow[];

  const today = new Date();
  const todayKey = today.toISOString().slice(0, 10);
  const monthKey = todayKey.slice(0, 7);

  const dailyMap = new Map<string, { date: string; cost: number; calls: number; tokens: number }>();
  const userMap = new Map<string, { user_id: string; cost: number; calls: number; tokens: number }>();
  const modelMap = new Map<string, { model_id: string; cost: number; calls: number; tokens: number }>();
  const taskMap = new Map<string, { task_type: string; cost: number; calls: number }>();

  let todayCost = 0;
  let monthCost = 0;
  let totalCost = 0;
  let totalCalls = 0;

  for (let i = 0; i < 30; i++) {
    const d = new Date(Date.now() - (29 - i) * 24 * 60 * 60 * 1000);
    const key = d.toISOString().slice(0, 10);
    dailyMap.set(key, { date: key, cost: 0, calls: 0, tokens: 0 });
  }

  for (const r of records) {
    const cost = Number(r.estimated_cost) || 0;
    const tokens = r.total_tokens || 0;
    totalCost += cost;
    totalCalls += 1;

    const dateKey = r.created_at.slice(0, 10);
    if (dateKey === todayKey) todayCost += cost;
    if (dateKey.slice(0, 7) === monthKey) monthCost += cost;

    const day = dailyMap.get(dateKey);
    if (day) {
      day.cost += cost;
      day.calls += 1;
      day.tokens += tokens;
    }

    const u = userMap.get(r.user_id) ?? { user_id: r.user_id, cost: 0, calls: 0, tokens: 0 };
    u.cost += cost; u.calls += 1; u.tokens += tokens;
    userMap.set(r.user_id, u);

    const m = modelMap.get(r.model_id) ?? { model_id: r.model_id, cost: 0, calls: 0, tokens: 0 };
    m.cost += cost; m.calls += 1; m.tokens += tokens;
    modelMap.set(r.model_id, m);

    const t = taskMap.get(r.task_type) ?? { task_type: r.task_type, cost: 0, calls: 0 };
    t.cost += cost; t.calls += 1;
    taskMap.set(r.task_type, t);
  }

  const topUsers = Array.from(userMap.values())
    .sort((a, b) => b.cost - a.cost)
    .slice(0, 20);

  const userIds = topUsers.map((u) => u.user_id);
  const { data: userRows } = userIds.length
    ? await admin.from('users').select('id, email, nickname, subscription_tier').in('id', userIds)
    : { data: [] as { id: string; email: string; nickname: string; subscription_tier: string }[] };

  const userById = new Map((userRows ?? []).map((u) => [u.id as string, u]));
  const topUsersDecorated = topUsers.map((u) => {
    const meta = userById.get(u.user_id) as
      | { id: string; email?: string; nickname?: string; subscription_tier?: string }
      | undefined;
    return {
      ...u,
      email: meta?.email ?? null,
      nickname: meta?.nickname ?? null,
      subscriptionTier: meta?.subscription_tier ?? 'free',
    };
  });

  return NextResponse.json({
    summary: {
      todayCostUsd: round(todayCost),
      monthCostUsd: round(monthCost),
      thirtyDayCostUsd: round(totalCost),
      thirtyDayCalls: totalCalls,
      avgCostPerCall: totalCalls > 0 ? round(totalCost / totalCalls, 6) : 0,
    },
    daily: Array.from(dailyMap.values()).map((d) => ({
      ...d,
      cost: round(d.cost),
    })),
    topUsers: topUsersDecorated.map((u) => ({
      ...u,
      cost: round(u.cost),
    })),
    models: Array.from(modelMap.values())
      .sort((a, b) => b.cost - a.cost)
      .map((m) => ({ ...m, cost: round(m.cost) })),
    tasks: Array.from(taskMap.values())
      .sort((a, b) => b.cost - a.cost)
      .map((t) => ({ ...t, cost: round(t.cost) })),
  });
}

function round(n: number, decimals = 4): number {
  const k = Math.pow(10, decimals);
  return Math.round(n * k) / k;
}
