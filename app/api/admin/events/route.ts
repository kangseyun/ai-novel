import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { requireAdmin } from '@/lib/auth';
import { recordAdminAction } from '@/lib/admin-audit';

interface CalendarEvent {
  id: string;
  type: string;
  title: string;
  description: string | null;
  persona_id: string | null;
  recur_month: number | null;
  recur_day: number | null;
  event_date: string | null;
  is_active: boolean;
  metadata: Record<string, unknown>;
}

const ALLOWED_TYPES = ['member_birthday','debut_anniversary','comeback','release','fan_day','custom'] as const;

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
  const days = Math.min(365, parseInt(url.searchParams.get('days') ?? '90', 10));

  const admin = service();
  if (!admin) return NextResponse.json({ error: 'Service role not configured' }, { status: 500 });

  const { data: events, error } = await admin
    .from('lumin_events')
    .select('*')
    .order('event_date', { ascending: true, nullsFirst: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const now = new Date();
  const horizon = new Date(now.getTime() + days * 24 * 3600_000);

  const upcoming = ((events ?? []) as CalendarEvent[])
    .map((e) => {
      let nextOccurrence: Date | null = null;
      if (e.event_date) {
        nextOccurrence = new Date(e.event_date);
      } else if (e.recur_month && e.recur_day) {
        const candidate = new Date(now.getFullYear(), e.recur_month - 1, e.recur_day);
        nextOccurrence = candidate < now
          ? new Date(now.getFullYear() + 1, e.recur_month - 1, e.recur_day)
          : candidate;
      }
      return { ...e, nextOccurrence: nextOccurrence?.toISOString() ?? null };
    })
    .filter((e) => e.is_active && e.nextOccurrence && new Date(e.nextOccurrence) <= horizon)
    .sort((a, b) => (a.nextOccurrence ?? '').localeCompare(b.nextOccurrence ?? ''));

  const sched = await admin
    .from('scheduled_events')
    .select('id, user_id, persona_id, event_type, scheduled_for, status, delivered_at')
    .gte('scheduled_for', now.toISOString())
    .lte('scheduled_for', horizon.toISOString())
    .order('scheduled_for', { ascending: true })
    .limit(200);

  const scheduledSummary = ((sched.data ?? []) as Array<{
    id: string; persona_id: string | null; event_type: string; status: string; scheduled_for: string;
  }>);

  return NextResponse.json({
    events: events ?? [],
    upcoming,
    scheduled: scheduledSummary,
    horizonDays: days,
  });
}

export async function POST(request: NextRequest) {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;

  const body = await request.json().catch(() => ({}));
  if (!body.type || !ALLOWED_TYPES.includes(body.type)) {
    return NextResponse.json({ error: `type must be one of ${ALLOWED_TYPES.join(', ')}` }, { status: 400 });
  }
  if (!body.title || typeof body.title !== 'string') {
    return NextResponse.json({ error: 'title is required' }, { status: 400 });
  }
  const hasDate = typeof body.event_date === 'string' && body.event_date.length > 0;
  const hasRecur = body.recur_month && body.recur_day;
  if (!hasDate && !hasRecur) {
    return NextResponse.json({ error: 'event_date or (recur_month + recur_day) required' }, { status: 400 });
  }

  const admin = service();
  if (!admin) return NextResponse.json({ error: 'Service role not configured' }, { status: 500 });

  const insert: Record<string, unknown> = {
    type: body.type,
    title: body.title,
    description: body.description ?? null,
    persona_id: body.persona_id ?? null,
    metadata: body.metadata ?? {},
    is_active: body.is_active ?? true,
  };
  if (hasDate) insert.event_date = body.event_date;
  if (hasRecur) {
    insert.recur_month = body.recur_month;
    insert.recur_day = body.recur_day;
  }

  const { data, error } = await admin
    .from('lumin_events')
    .insert(insert)
    .select('*')
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await recordAdminAction({
    adminUserId: guard.userId,
    adminEmail: guard.email,
    action: 'event_create',
    targetType: 'lumin_event',
    targetId: (data as { id: string }).id,
    after: data as Record<string, unknown>,
  });

  return NextResponse.json(data);
}
