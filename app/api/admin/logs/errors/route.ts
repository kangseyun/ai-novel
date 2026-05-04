import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { requireAdmin } from '@/lib/auth';
import { recordAdminAction } from '@/lib/admin-audit';

function service() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key);
}

export async function GET(request: NextRequest) {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;

  const url = new URL(request.url);
  const errorType = url.searchParams.get('error_type');
  const resolved = url.searchParams.get('resolved');
  const search = url.searchParams.get('q');
  const limit = Math.min(500, parseInt(url.searchParams.get('limit') ?? '100', 10));

  const admin = service();
  if (!admin) return NextResponse.json({ error: 'Service role not configured' }, { status: 500 });

  let query = admin
    .from('error_logs')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit);

  if (errorType) query = query.eq('error_type', errorType);
  if (resolved === 'true') query = query.eq('resolved', true);
  if (resolved === 'false') query = query.eq('resolved', false);
  if (search) query = query.ilike('error_message', `%${search}%`);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const summary = await admin
    .from('error_logs')
    .select('error_type, resolved')
    .gte('created_at', new Date(Date.now() - 7 * 86_400_000).toISOString())
    .limit(2000);

  const types = new Map<string, number>();
  let unresolved7d = 0;
  let total7d = 0;
  for (const row of (summary.data ?? []) as { error_type: string; resolved: boolean }[]) {
    total7d += 1;
    if (!row.resolved) unresolved7d += 1;
    types.set(row.error_type, (types.get(row.error_type) ?? 0) + 1);
  }

  return NextResponse.json({
    errors: data ?? [],
    summary: {
      total7d,
      unresolved7d,
      topTypes: Array.from(types.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10)
        .map(([type, count]) => ({ type, count })),
    },
  });
}

export async function PATCH(request: NextRequest) {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;

  const body = await request.json().catch(() => ({}));
  const id = body.id as string | undefined;
  const resolved = body.resolved === true;

  if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 });

  const admin = service();
  if (!admin) return NextResponse.json({ error: 'Service role not configured' }, { status: 500 });

  const { data: before } = await admin
    .from('error_logs')
    .select('id, resolved, error_type')
    .eq('id', id)
    .single();

  const { error } = await admin
    .from('error_logs')
    .update({
      resolved,
      resolved_at: resolved ? new Date().toISOString() : null,
      resolved_by: resolved ? guard.userId : null,
    })
    .eq('id', id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await recordAdminAction({
    adminUserId: guard.userId,
    adminEmail: guard.email,
    action: resolved ? 'error_resolve' : 'error_unresolve',
    targetType: 'error_log',
    targetId: id,
    before: { resolved: (before as { resolved?: boolean } | null)?.resolved ?? false },
    after: { resolved },
    metadata: { error_type: (before as { error_type?: string } | null)?.error_type ?? null },
  });

  return NextResponse.json({ id, resolved });
}
