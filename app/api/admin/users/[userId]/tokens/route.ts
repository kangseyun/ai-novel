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
  const delta = Number(body.delta);
  const reason = typeof body.reason === 'string' ? body.reason.trim() : '';

  if (!Number.isFinite(delta) || delta === 0) {
    return NextResponse.json({ error: 'delta must be a non-zero number' }, { status: 400 });
  }
  if (Math.abs(delta) > 1_000_000) {
    return NextResponse.json({ error: 'delta out of safe range (|delta| <= 1,000,000)' }, { status: 400 });
  }
  if (!reason || reason.length < 3) {
    return NextResponse.json({ error: 'reason is required (min 3 chars)' }, { status: 400 });
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    return NextResponse.json({ error: 'Service role not configured' }, { status: 500 });
  }
  const admin = createClient(url, key);

  const { data: before, error: beforeErr } = await admin
    .from('users')
    .select('id, email, tokens')
    .eq('id', userId)
    .single();

  if (beforeErr || !before) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 });
  }

  const beforeTokens = (before as { tokens: number }).tokens ?? 0;
  const newTokens = Math.max(0, beforeTokens + delta);

  const { error: updateErr } = await admin
    .from('users')
    .update({ tokens: newTokens })
    .eq('id', userId);

  if (updateErr) {
    return NextResponse.json({ error: updateErr.message }, { status: 500 });
  }

  await recordAdminAction({
    adminUserId: guard.userId,
    adminEmail: guard.email,
    action: 'token_adjust',
    targetType: 'user',
    targetId: userId,
    reason,
    before: { tokens: beforeTokens },
    after: { tokens: newTokens },
    metadata: { delta, requested_delta: delta, applied_delta: newTokens - beforeTokens },
  });

  return NextResponse.json({
    userId,
    before: beforeTokens,
    after: newTokens,
    appliedDelta: newTokens - beforeTokens,
  });
}
