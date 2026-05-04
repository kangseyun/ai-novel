import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { requireAdmin } from '@/lib/auth';

interface RelRow {
  user_id: string;
  persona_id: string;
  affection: number | null;
  relationship_stage: string | null;
  trust_level: number | null;
  intimacy_level: number | null;
  total_messages: number | null;
  total_scenarios_completed: number | null;
  first_interaction_at: string | null;
  last_interaction_at: string | null;
  is_unlocked: boolean | null;
  unlocked_at: string | null;
}

interface MilestoneRow {
  id: string;
  user_id: string;
  persona_id: string;
  type: string;
  description: string;
  achieved_at: string;
}

interface ProgressRow {
  user_id: string;
  persona_id: string;
  scenario_id: string;
  completed: boolean;
  completed_at: string | null;
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;

  const { userId } = await params;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    return NextResponse.json({ error: 'Service role not configured' }, { status: 500 });
  }
  const admin = createClient(url, key);

  const { data: personas } = await admin
    .from('persona_core')
    .select('id, name, full_name, profile_image_url, role, status, sort_order')
    .order('sort_order', { ascending: true });

  const personaList = (personas ?? []) as Array<{
    id: string; name: string; full_name: string | null;
    profile_image_url: string | null; role: string | null;
    status: string | null; sort_order: number | null;
  }>;
  const personaIds = personaList.map((p) => p.id);

  const [{ data: rels }, { data: milestones }, { data: progress }, { data: memories }] = await Promise.all([
    admin
      .from('user_persona_relationships')
      .select('*')
      .eq('user_id', userId)
      .in('persona_id', personaIds.length ? personaIds : ['__none__']),
    admin
      .from('relationship_milestones')
      .select('id, persona_id, type, description, achieved_at')
      .eq('user_id', userId)
      .order('achieved_at', { ascending: false })
      .limit(200),
    admin
      .from('user_scenario_progress')
      .select('persona_id, scenario_id, completed, completed_at')
      .eq('user_id', userId),
    admin
      .from('persona_memories')
      .select('persona_id, is_active')
      .eq('user_id', userId),
  ]);

  const relByPersona = new Map<string, RelRow>();
  for (const r of (rels ?? []) as RelRow[]) relByPersona.set(r.persona_id, r);

  const milestonesByPersona = new Map<string, MilestoneRow[]>();
  for (const m of (milestones ?? []) as MilestoneRow[]) {
    if (!milestonesByPersona.has(m.persona_id)) milestonesByPersona.set(m.persona_id, []);
    milestonesByPersona.get(m.persona_id)!.push(m);
  }

  const scenariosByPersona = new Map<string, { completed: number; inProgress: number }>();
  for (const p of (progress ?? []) as ProgressRow[]) {
    const entry = scenariosByPersona.get(p.persona_id) ?? { completed: 0, inProgress: 0 };
    if (p.completed) entry.completed += 1; else entry.inProgress += 1;
    scenariosByPersona.set(p.persona_id, entry);
  }

  const memoryCounts = new Map<string, number>();
  for (const m of (memories ?? []) as { persona_id: string; is_active: boolean | null }[]) {
    if (m.is_active === false) continue;
    memoryCounts.set(m.persona_id, (memoryCounts.get(m.persona_id) ?? 0) + 1);
  }

  const cards = personaList.map((p) => {
    const rel = relByPersona.get(p.id);
    const ms = milestonesByPersona.get(p.id) ?? [];
    const scen = scenariosByPersona.get(p.id) ?? { completed: 0, inProgress: 0 };
    return {
      persona: {
        id: p.id,
        name: p.name,
        fullName: p.full_name,
        profileImageUrl: p.profile_image_url,
        role: p.role,
        status: p.status,
      },
      relationship: rel
        ? {
            affection: rel.affection ?? 0,
            stage: rel.relationship_stage ?? 'stranger',
            trust: rel.trust_level ?? 0,
            intimacy: rel.intimacy_level ?? 0,
            totalMessages: rel.total_messages ?? 0,
            firstInteractionAt: rel.first_interaction_at,
            lastInteractionAt: rel.last_interaction_at,
            isUnlocked: rel.is_unlocked ?? false,
          }
        : null,
      milestones: {
        total: ms.length,
        recent: ms.slice(0, 5),
      },
      scenarios: scen,
      memoriesActive: memoryCounts.get(p.id) ?? 0,
    };
  });

  return NextResponse.json({ cards });
}
