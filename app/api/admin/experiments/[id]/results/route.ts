import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { requireAdmin } from '@/lib/auth';

interface AssignmentRow { user_id: string; variant_name: string }
interface EventRow { user_id: string | null; event_name: string; value: number | null }

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;
  const { id } = await params;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return NextResponse.json({ error: 'Service role not configured' }, { status: 500 });
  const admin = createClient(url, key);

  const { data: experiment, error: expErr } = await admin
    .from('experiments')
    .select('id, key, name, status, variants, conversion_events, started_at, ended_at')
    .eq('id', id)
    .single();

  if (expErr || !experiment) {
    return NextResponse.json({ error: 'Experiment not found' }, { status: 404 });
  }

  const exp = experiment as { id: string; key: string; variants: Array<{ name: string; weight: number }>; conversion_events: string[] };

  const [{ data: assignmentRows }, { data: eventRows }] = await Promise.all([
    admin.from('experiment_assignments').select('user_id, variant_name').eq('experiment_id', id),
    admin.from('experiment_events').select('user_id, event_name, value').eq('experiment_id', id),
  ]);

  const variantUsers = new Map<string, Set<string>>();
  for (const a of (assignmentRows ?? []) as AssignmentRow[]) {
    if (!variantUsers.has(a.variant_name)) variantUsers.set(a.variant_name, new Set());
    variantUsers.get(a.variant_name)!.add(a.user_id);
  }
  const userToVariant = new Map<string, string>();
  for (const a of (assignmentRows ?? []) as AssignmentRow[]) {
    userToVariant.set(a.user_id, a.variant_name);
  }

  const eventList = exp.conversion_events ?? [];

  const results = exp.variants.map((v) => {
    const users = variantUsers.get(v.name) ?? new Set<string>();
    const conversions: Record<string, { converters: number; total: number; sumValue: number }> = {};
    for (const ev of eventList) {
      conversions[ev] = { converters: 0, total: 0, sumValue: 0 };
    }
    const seenByEvent: Record<string, Set<string>> = {};
    for (const ev of eventList) seenByEvent[ev] = new Set();

    for (const e of (eventRows ?? []) as EventRow[]) {
      if (!e.user_id || userToVariant.get(e.user_id) !== v.name) continue;
      if (!eventList.includes(e.event_name)) continue;
      conversions[e.event_name].total += 1;
      conversions[e.event_name].sumValue += Number(e.value ?? 0);
      seenByEvent[e.event_name].add(e.user_id);
    }
    for (const ev of eventList) {
      conversions[ev].converters = seenByEvent[ev].size;
    }

    return {
      variant: v.name,
      assigned: users.size,
      conversions: Object.entries(conversions).map(([ev, c]) => ({
        event: ev,
        converters: c.converters,
        rate: users.size > 0 ? Math.round((c.converters / users.size) * 1000) / 10 : 0,
        totalEvents: c.total,
        sumValue: c.sumValue,
      })),
    };
  });

  return NextResponse.json({ experiment: exp, results });
}
