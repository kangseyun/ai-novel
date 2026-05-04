import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth';
import { createClient } from '@supabase/supabase-js';

interface FlagRow {
  id: string;
  user_id: string | null;
  persona_id: string | null;
  session_id: string | null;
  source: string;
  category: string;
  severity: string;
  matched_terms: string[];
  excerpt: string;
  status: string;
  reviewer_id: string | null;
  reviewer_note: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  reviewed_at: string | null;
}

export async function GET(request: NextRequest) {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;

  const url = new URL(request.url);
  const status = url.searchParams.get('status') ?? 'open';
  const category = url.searchParams.get('category');
  const severity = url.searchParams.get('severity');
  const limit = Math.min(200, parseInt(url.searchParams.get('limit') ?? '50', 10));

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !key) {
    return NextResponse.json({ error: 'Service role not configured' }, { status: 500 });
  }
  const admin = createClient(supabaseUrl, key);

  let query = admin
    .from('moderation_flags')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit);

  if (status && status !== 'all') query = query.eq('status', status);
  if (category) query = query.eq('category', category);
  if (severity) query = query.eq('severity', severity);

  const { data, error } = await query;
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  const rows = (data ?? []) as FlagRow[];

  const userIds = Array.from(new Set(rows.map((r) => r.user_id).filter(Boolean))) as string[];
  const { data: users } = userIds.length
    ? await admin.from('users').select('id, email, nickname').in('id', userIds)
    : { data: [] as { id: string; email: string; nickname: string }[] };

  const userById = new Map((users ?? []).map((u) => [u.id as string, u]));

  const counts = await admin
    .from('moderation_flags')
    .select('status, category, severity')
    .order('created_at', { ascending: false })
    .limit(1000);

  const summary = { open: 0, acknowledged: 0, dismissed: 0, escalated: 0, total: 0 };
  for (const r of (counts.data ?? []) as { status: string }[]) {
    summary.total += 1;
    if (r.status in summary) {
      (summary as Record<string, number>)[r.status] += 1;
    }
  }

  return NextResponse.json({
    flags: rows.map((r) => ({
      ...r,
      user: r.user_id ? userById.get(r.user_id) ?? null : null,
    })),
    summary,
  });
}
