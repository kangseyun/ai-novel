import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { requireAdmin } from '@/lib/auth';

interface UserRow {
  id: string;
  created_at: string;
  onboarding_completed: boolean | null;
  initial_follows_completed: boolean | null;
}

export async function GET() {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return NextResponse.json({ error: 'Service role not configured' }, { status: 500 });
  const admin = createClient(url, key);

  const since30d = new Date(Date.now() - 30 * 86_400_000).toISOString();

  const [{ data: allUsers }, { data: recent }, { count: dmStartedCount }] = await Promise.all([
    admin.from('users').select('id, created_at, onboarding_completed, initial_follows_completed'),
    admin.from('users')
      .select('id, created_at, onboarding_completed, initial_follows_completed')
      .gte('created_at', since30d)
      .order('created_at', { ascending: true }),
    admin.from('user_persona_relationships')
      .select('user_id', { count: 'exact', head: true }),
  ]);

  const users = (allUsers ?? []) as UserRow[];
  const total = users.length;
  const onboarded = users.filter((u) => u.onboarding_completed).length;
  const followsDone = users.filter((u) => u.initial_follows_completed).length;
  const dmStarted = dmStartedCount ?? 0;

  const dailyMap = new Map<string, { date: string; signups: number; onboarded: number; followsDone: number }>();
  for (let i = 0; i < 30; i++) {
    const d = new Date(Date.now() - (29 - i) * 86_400_000);
    const key = d.toISOString().slice(0, 10);
    dailyMap.set(key, { date: key, signups: 0, onboarded: 0, followsDone: 0 });
  }

  for (const u of (recent ?? []) as UserRow[]) {
    const key = u.created_at.slice(0, 10);
    const day = dailyMap.get(key);
    if (!day) continue;
    day.signups += 1;
    if (u.onboarding_completed) day.onboarded += 1;
    if (u.initial_follows_completed) day.followsDone += 1;
  }

  const recentUsers = (recent ?? []) as UserRow[];
  const recentTotal = recentUsers.length;
  const recentOnboarded = recentUsers.filter((u) => u.onboarding_completed).length;
  const recentFollows = recentUsers.filter((u) => u.initial_follows_completed).length;

  const stuck = users
    .filter((u) => !u.onboarding_completed)
    .filter((u) => Date.now() - new Date(u.created_at).getTime() > 24 * 3600_000)
    .slice(0, 50);

  return NextResponse.json({
    funnel: {
      total,
      onboarded,
      followsDone,
      dmStarted,
      onboardedRate: total > 0 ? Math.round((onboarded / total) * 1000) / 10 : 0,
      followsRate: total > 0 ? Math.round((followsDone / total) * 1000) / 10 : 0,
      dmStartedRate: total > 0 ? Math.round((dmStarted / total) * 1000) / 10 : 0,
    },
    last30d: {
      total: recentTotal,
      onboarded: recentOnboarded,
      followsDone: recentFollows,
      onboardedRate: recentTotal > 0 ? Math.round((recentOnboarded / recentTotal) * 1000) / 10 : 0,
      followsRate: recentTotal > 0 ? Math.round((recentFollows / recentTotal) * 1000) / 10 : 0,
    },
    daily: Array.from(dailyMap.values()),
    stuckCount: stuck.length,
  });
}
