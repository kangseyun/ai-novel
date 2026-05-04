import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { requireAdmin } from '@/lib/auth';
import { recordAdminAction } from '@/lib/admin-audit';
import { detectFlags } from '@/lib/moderation';

interface ScenarioRow {
  id: string;
  title: string;
  description: string | null;
  content: unknown;
  review_status: string;
  is_active: boolean;
}

const ALLOWED_ACTIONS = ['submit', 'approve', 'reject'] as const;
type Action = (typeof ALLOWED_ACTIONS)[number];

function service() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key);
}

function extractText(value: unknown, path: string, out: { path: string; text: string }[]) {
  if (value == null) return;
  if (typeof value === 'string') {
    if (value.length >= 4) out.push({ path, text: value });
    return;
  }
  if (Array.isArray(value)) {
    value.forEach((v, i) => extractText(v, `${path}[${i}]`, out));
    return;
  }
  if (typeof value === 'object') {
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      extractText(v, path ? `${path}.${k}` : k, out);
    }
  }
}

function lintScenario(s: ScenarioRow) {
  const fragments: { path: string; text: string }[] = [];
  if (s.title) fragments.push({ path: 'title', text: s.title });
  if (s.description) fragments.push({ path: 'description', text: s.description });
  extractText(s.content, 'content', fragments);
  const findings: Array<{ path: string; category: string; severity: string; matched: string[]; preview: string }> = [];
  for (const f of fragments) {
    for (const m of detectFlags(f.text)) {
      findings.push({
        path: f.path,
        category: m.category,
        severity: m.severity,
        matched: m.matched,
        preview: f.text.slice(0, 120) + (f.text.length > 120 ? '…' : ''),
      });
    }
  }
  return findings;
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;

  const { id } = await params;
  const body = await request.json().catch(() => ({}));
  const action = body.action as Action;
  const note = typeof body.note === 'string' ? body.note.slice(0, 500) : null;
  const force = body.force === true;

  if (!ALLOWED_ACTIONS.includes(action)) {
    return NextResponse.json({ error: `action must be one of ${ALLOWED_ACTIONS.join(', ')}` }, { status: 400 });
  }

  const admin = service();
  if (!admin) return NextResponse.json({ error: 'Service role not configured' }, { status: 500 });

  const { data: before, error: beforeErr } = await admin
    .from('scenario_templates')
    .select('id, title, description, content, review_status, is_active')
    .eq('id', id)
    .single();

  if (beforeErr || !before) {
    return NextResponse.json({ error: 'Scenario not found' }, { status: 404 });
  }

  const scenario = before as ScenarioRow;
  const update: Record<string, unknown> = {};

  if (action === 'submit') {
    const findings = lintScenario(scenario);
    const blocking = findings.filter((f) => f.severity === 'critical' || f.severity === 'high');
    if (blocking.length > 0 && !force) {
      return NextResponse.json(
        {
          error: 'lint_blocked',
          message: `${blocking.length}건의 high/critical 위반이 감지됨. force:true로 무시 가능.`,
          findings,
        },
        { status: 422 }
      );
    }
    update.review_status = 'in_review';
    update.submitted_at = new Date().toISOString();
    update.lint_findings = findings;
    update.is_active = false;
  } else if (action === 'approve') {
    if (scenario.review_status !== 'in_review' && !force) {
      return NextResponse.json({ error: 'scenario must be in_review (use force to override)' }, { status: 400 });
    }
    update.review_status = 'approved';
    update.reviewed_at = new Date().toISOString();
    update.reviewer_id = guard.userId;
    update.review_notes = note;
    update.is_active = true;
  } else if (action === 'reject') {
    update.review_status = 'rejected';
    update.reviewed_at = new Date().toISOString();
    update.reviewer_id = guard.userId;
    update.review_notes = note;
    update.is_active = false;
  }

  const { data, error } = await admin
    .from('scenario_templates')
    .update(update)
    .eq('id', id)
    .select('*')
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await recordAdminAction({
    adminUserId: guard.userId,
    adminEmail: guard.email,
    action: `scenario_${action}`,
    targetType: 'scenario_template',
    targetId: id,
    reason: note,
    before: { review_status: scenario.review_status, is_active: scenario.is_active },
    after: { review_status: update.review_status, is_active: update.is_active },
    metadata: { findings_count: action === 'submit' ? (update.lint_findings as unknown[]).length : undefined },
  });

  return NextResponse.json(data);
}
