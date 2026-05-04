import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { requireAdmin } from '@/lib/auth';
import { recordAdminAction } from '@/lib/admin-audit';

const STATUSES = ['draft','running','paused','complete'];

function service() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key);
}

export async function GET() {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;

  const admin = service();
  if (!admin) return NextResponse.json({ error: 'Service role not configured' }, { status: 500 });

  const { data: experiments, error } = await admin
    .from('experiments')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const ids = ((experiments ?? []) as { id: string }[]).map((e) => e.id);
  const { data: assignmentRows } = ids.length
    ? await admin.from('experiment_assignments').select('experiment_id, variant_name').in('experiment_id', ids)
    : { data: [] as { experiment_id: string; variant_name: string }[] };

  const assignmentByExp = new Map<string, Record<string, number>>();
  for (const row of (assignmentRows ?? []) as { experiment_id: string; variant_name: string }[]) {
    if (!assignmentByExp.has(row.experiment_id)) assignmentByExp.set(row.experiment_id, {});
    const bucket = assignmentByExp.get(row.experiment_id)!;
    bucket[row.variant_name] = (bucket[row.variant_name] ?? 0) + 1;
  }

  const enriched = (experiments ?? []).map((e) => {
    const exp = e as { id: string };
    return { ...e, assignments: assignmentByExp.get(exp.id) ?? {} };
  });

  return NextResponse.json({ experiments: enriched });
}

export async function POST(request: NextRequest) {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;

  const body = await request.json().catch(() => ({}));
  if (!body.key || !body.name) {
    return NextResponse.json({ error: 'key and name are required' }, { status: 400 });
  }
  if (!/^[a-z0-9_-]+$/i.test(body.key)) {
    return NextResponse.json({ error: 'key must match [a-zA-Z0-9_-]' }, { status: 400 });
  }
  if (body.status && !STATUSES.includes(body.status)) {
    return NextResponse.json({ error: `status must be one of ${STATUSES.join(', ')}` }, { status: 400 });
  }
  if (body.variants && !Array.isArray(body.variants)) {
    return NextResponse.json({ error: 'variants must be an array' }, { status: 400 });
  }
  if (body.conversion_events && !Array.isArray(body.conversion_events)) {
    return NextResponse.json({ error: 'conversion_events must be an array' }, { status: 400 });
  }

  const admin = service();
  if (!admin) return NextResponse.json({ error: 'Service role not configured' }, { status: 500 });

  const insert: Record<string, unknown> = {
    key: body.key,
    name: body.name,
    description: body.description ?? null,
    status: body.status ?? 'draft',
    variants: body.variants ?? [{ name: 'control', weight: 1 }, { name: 'treatment', weight: 1 }],
    conversion_events: body.conversion_events ?? [],
    metadata: body.metadata ?? {},
  };

  const { data, error } = await admin.from('experiments').insert(insert).select('*').single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await recordAdminAction({
    adminUserId: guard.userId,
    adminEmail: guard.email,
    action: 'experiment_create',
    targetType: 'experiment',
    targetId: (data as { id: string }).id,
    after: data as Record<string, unknown>,
  });

  return NextResponse.json(data);
}
