import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { requireAdmin } from '@/lib/auth';
import { recordAdminAction } from '@/lib/admin-audit';

const ALLOWED_STATUSES = ['acknowledged', 'dismissed', 'escalated'] as const;
type AllowedStatus = (typeof ALLOWED_STATUSES)[number];

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;

  const { id } = await params;
  const body = await request.json().catch(() => ({}));
  const status = body.status as string;
  const note = typeof body.note === 'string' ? body.note.slice(0, 500) : null;

  if (!ALLOWED_STATUSES.includes(status as AllowedStatus)) {
    return NextResponse.json({ error: `status must be one of ${ALLOWED_STATUSES.join(', ')}` }, { status: 400 });
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    return NextResponse.json({ error: 'Service role not configured' }, { status: 500 });
  }
  const admin = createClient(url, key);

  const { data: before, error: beforeErr } = await admin
    .from('moderation_flags')
    .select('id, status, category, severity, user_id')
    .eq('id', id)
    .single();

  if (beforeErr || !before) {
    return NextResponse.json({ error: 'Flag not found' }, { status: 404 });
  }

  const { error: updateErr } = await admin
    .from('moderation_flags')
    .update({
      status,
      reviewer_id: guard.userId,
      reviewer_note: note,
      reviewed_at: new Date().toISOString(),
    })
    .eq('id', id);

  if (updateErr) {
    return NextResponse.json({ error: updateErr.message }, { status: 500 });
  }

  await recordAdminAction({
    adminUserId: guard.userId,
    adminEmail: guard.email,
    action: `moderation_${status}`,
    targetType: 'moderation_flag',
    targetId: id,
    reason: note,
    before: { status: (before as { status: string }).status },
    after: { status },
    metadata: {
      category: (before as { category: string }).category,
      severity: (before as { severity: string }).severity,
      flagged_user_id: (before as { user_id: string | null }).user_id,
    },
  });

  return NextResponse.json({ id, status });
}
