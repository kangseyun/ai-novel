import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { requireAdmin } from '@/lib/auth';

interface ActivityRow {
  id: string;
  user_id: string;
  persona_id: string | null;
  action_type: string;
  action_data: Record<string, unknown>;
  created_at: string;
}

export async function GET(request: NextRequest) {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;

  const url = new URL(request.url);
  const userId = url.searchParams.get('user_id');
  const actionType = url.searchParams.get('action_type');
  const personaId = url.searchParams.get('persona_id');
  const limit = Math.min(500, parseInt(url.searchParams.get('limit') ?? '100', 10));

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !key) {
    return NextResponse.json({ error: 'Service role not configured' }, { status: 500 });
  }
  const admin = createClient(supabaseUrl, key);

  let query = admin
    .from('user_activity_log')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit);

  if (userId) query = query.eq('user_id', userId);
  if (actionType) query = query.eq('action_type', actionType);
  if (personaId) query = query.eq('persona_id', personaId);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const rows = (data ?? []) as ActivityRow[];

  const userIds = Array.from(new Set(rows.map((r) => r.user_id))).filter(Boolean) as string[];
  const { data: users } = userIds.length
    ? await admin.from('users').select('id, email, nickname').in('id', userIds)
    : { data: [] as { id: string; email: string; nickname: string }[] };
  const userById = new Map((users ?? []).map((u) => [u.id as string, u]));

  const summary = await admin
    .from('user_activity_log')
    .select('action_type')
    .gte('created_at', new Date(Date.now() - 24 * 3600_000).toISOString())
    .limit(5000);

  const actions = new Map<string, number>();
  for (const r of (summary.data ?? []) as { action_type: string }[]) {
    actions.set(r.action_type, (actions.get(r.action_type) ?? 0) + 1);
  }

  return NextResponse.json({
    activity: rows.map((r) => ({
      ...r,
      user: userById.get(r.user_id) ?? null,
    })),
    summary: {
      total24h: Array.from(actions.values()).reduce((a, b) => a + b, 0),
      byAction: Array.from(actions.entries())
        .sort((a, b) => b[1] - a[1])
        .map(([action, count]) => ({ action, count })),
    },
  });
}
