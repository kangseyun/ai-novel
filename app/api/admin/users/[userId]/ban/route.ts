import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { requireAdmin } from '@/lib/auth';
import { recordAdminAction } from '@/lib/admin-audit';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;

  const { userId } = await params;
  const body = await request.json().catch(() => ({}));
  const ban = body.ban === true;
  const reason = typeof body.reason === 'string' ? body.reason.trim() : '';

  if (ban && (!reason || reason.length < 3)) {
    return NextResponse.json({ error: 'reason is required when banning (min 3 chars)' }, { status: 400 });
  }
  if (userId === guard.userId) {
    return NextResponse.json({ error: 'You cannot ban yourself' }, { status: 400 });
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    return NextResponse.json({ error: 'Service role not configured' }, { status: 500 });
  }
  const admin = createClient(url, key);

  const { data: before, error: beforeErr } = await admin
    .from('users')
    .select('id, email, role, is_banned, banned_at, banned_reason')
    .eq('id', userId)
    .single();

  if (beforeErr || !before) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 });
  }

  if ((before as { role: string }).role === 'admin') {
    return NextResponse.json({ error: 'Cannot ban an admin user; demote first' }, { status: 400 });
  }

  const update = ban
    ? { is_banned: true, banned_at: new Date().toISOString(), banned_reason: reason }
    : { is_banned: false, banned_at: null, banned_reason: null };

  const { error: updateErr } = await admin
    .from('users')
    .update(update)
    .eq('id', userId);

  if (updateErr) {
    return NextResponse.json({ error: updateErr.message }, { status: 500 });
  }

  await recordAdminAction({
    adminUserId: guard.userId,
    adminEmail: guard.email,
    action: ban ? 'ban' : 'unban',
    targetType: 'user',
    targetId: userId,
    reason: reason || null,
    before: {
      is_banned: (before as { is_banned?: boolean }).is_banned ?? false,
      banned_reason: (before as { banned_reason?: string | null }).banned_reason ?? null,
    },
    after: { is_banned: ban, banned_reason: ban ? reason : null },
  });

  return NextResponse.json({ userId, banned: ban });
}
