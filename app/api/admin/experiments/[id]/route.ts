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

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;
  const { id } = await params;
  const body = await request.json().catch(() => ({}));

  const update: Record<string, unknown> = {};
  for (const key of ['name','description','status','variants','conversion_events','metadata','started_at','ended_at']) {
    if (key in body) update[key] = body[key];
  }
  if (update.status === 'running' && !update.started_at) {
    update.started_at = new Date().toISOString();
  }
  if (update.status === 'complete' && !update.ended_at) {
    update.ended_at = new Date().toISOString();
  }

  const admin = service();
  if (!admin) return NextResponse.json({ error: 'Service role not configured' }, { status: 500 });

  const { data: before } = await admin.from('experiments').select('*').eq('id', id).single();
  const { data, error } = await admin.from('experiments').update(update).eq('id', id).select('*').single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await recordAdminAction({
    adminUserId: guard.userId,
    adminEmail: guard.email,
    action: 'experiment_update',
    targetType: 'experiment',
    targetId: id,
    before: (before ?? {}) as Record<string, unknown>,
    after: (data ?? {}) as Record<string, unknown>,
  });

  return NextResponse.json(data);
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;
  const { id } = await params;

  const admin = service();
  if (!admin) return NextResponse.json({ error: 'Service role not configured' }, { status: 500 });

  const { data: before } = await admin.from('experiments').select('*').eq('id', id).single();
  const { error } = await admin.from('experiments').delete().eq('id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await recordAdminAction({
    adminUserId: guard.userId,
    adminEmail: guard.email,
    action: 'experiment_delete',
    targetType: 'experiment',
    targetId: id,
    before: (before ?? {}) as Record<string, unknown>,
  });

  return NextResponse.json({ ok: true });
}
