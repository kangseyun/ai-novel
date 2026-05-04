import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { requireAdmin } from '@/lib/auth';

export async function GET(request: NextRequest) {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;

  const url = new URL(request.url);
  const status = url.searchParams.get('status') ?? 'in_review';
  const limit = Math.min(200, parseInt(url.searchParams.get('limit') ?? '100', 10));

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !key) {
    return NextResponse.json({ error: 'Service role not configured' }, { status: 500 });
  }
  const admin = createClient(supabaseUrl, key);

  let query = admin
    .from('scenario_templates')
    .select(
      'id, title, description, persona_id, scenario_type, generation_mode, ' +
      'review_status, submitted_at, reviewed_at, reviewer_id, review_notes, lint_findings, ' +
      'is_active, created_at, updated_at'
    )
    .order('submitted_at', { ascending: false, nullsFirst: false })
    .limit(limit);

  if (status !== 'all') query = query.eq('review_status', status);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const counts = await admin
    .from('scenario_templates')
    .select('review_status')
    .limit(5000);

  const summary = { draft: 0, in_review: 0, approved: 0, rejected: 0, total: 0 };
  for (const r of (counts.data ?? []) as { review_status: string }[]) {
    summary.total += 1;
    if (r.review_status in summary) (summary as Record<string, number>)[r.review_status] += 1;
  }

  return NextResponse.json({ scenarios: data ?? [], summary });
}
