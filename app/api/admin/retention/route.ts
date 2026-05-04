import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { requireAdmin } from '@/lib/auth';

const COHORT_WINDOW_DAYS = 90;
const RETENTION_TARGETS = [1, 7, 30] as const;

interface UserRow {
  id: string;
  created_at: string;
}

interface ActivityRow {
  user_id: string;
  created_at: string;
}

function isoWeekStart(d: Date): string {
  const day = d.getUTCDay() || 7;
  const monday = new Date(d);
  monday.setUTCDate(d.getUTCDate() - (day - 1));
  return monday.toISOString().slice(0, 10);
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

  const since = new Date(Date.now() - COHORT_WINDOW_DAYS * 86_400_000);

  const [{ data: users }, { data: activity }] = await Promise.all([
    admin
      .from('users')
      .select('id, created_at')
      .gte('created_at', since.toISOString()),
    admin
      .from('user_activity_log')
      .select('user_id, created_at')
      .gte('created_at', since.toISOString())
      .limit(100_000),
  ]);

  const userList = (users ?? []) as UserRow[];

  const activeDaysByUser = new Map<string, Set<number>>();
  for (const a of (activity ?? []) as ActivityRow[]) {
    const userCreated = userList.find((u) => u.id === a.user_id)?.created_at;
    if (!userCreated) continue;
    const dayOffset = Math.floor(
      (new Date(a.created_at).getTime() - new Date(userCreated).getTime()) / 86_400_000
    );
    if (dayOffset < 0) continue;
    if (!activeDaysByUser.has(a.user_id)) activeDaysByUser.set(a.user_id, new Set());
    activeDaysByUser.get(a.user_id)!.add(dayOffset);
  }

  const cohorts = new Map<string, {
    week: string;
    size: number;
    retained: Map<number, number>;
  }>();

  const now = Date.now();

  for (const u of userList) {
    const week = isoWeekStart(new Date(u.created_at));
    if (!cohorts.has(week)) {
      cohorts.set(week, { week, size: 0, retained: new Map() });
    }
    const c = cohorts.get(week)!;
    c.size += 1;

    const userAge = Math.floor((now - new Date(u.created_at).getTime()) / 86_400_000);
    const days = activeDaysByUser.get(u.id);
    for (const target of RETENTION_TARGETS) {
      if (userAge < target) continue;
      if (days?.has(target)) {
        c.retained.set(target, (c.retained.get(target) ?? 0) + 1);
      }
    }
  }

  const cohortRows = Array.from(cohorts.values())
    .sort((a, b) => a.week.localeCompare(b.week))
    .map((c) => {
      const result: Record<string, unknown> = { week: c.week, size: c.size };
      for (const target of RETENTION_TARGETS) {
        const retained = c.retained.get(target) ?? 0;
        result[`d${target}`] = retained;
        result[`d${target}Pct`] = c.size > 0 ? Math.round((retained / c.size) * 1000) / 10 : 0;
      }
      return result;
    });

  const totalSize = cohortRows.reduce((acc, r) => acc + (r.size as number), 0);
  const overall: Record<string, number> = {};
  for (const target of RETENTION_TARGETS) {
    const retained = cohortRows.reduce((acc, r) => acc + (r[`d${target}`] as number), 0);
    overall[`d${target}`] = retained;
    overall[`d${target}Pct`] = totalSize > 0 ? Math.round((retained / totalSize) * 1000) / 10 : 0;
  }

  return NextResponse.json({
    windowDays: COHORT_WINDOW_DAYS,
    cohorts: cohortRows,
    overall: { size: totalSize, ...overall },
    targets: RETENTION_TARGETS,
    note: '활동 정의: user_activity_log에 D-N 일자에 한 건 이상 row가 있는 경우.',
  });
}
