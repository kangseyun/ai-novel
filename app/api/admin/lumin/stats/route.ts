import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { requireAdmin } from '@/lib/auth';

interface RelRow {
  persona_id: string;
  affection: number | null;
  total_messages: number | null;
  is_unlocked: boolean | null;
  last_interaction_at: string | null;
}

interface ScenarioRow {
  persona_id: string;
  scenario_id: string;
  completed: boolean;
}

interface ScenarioTemplateRow {
  id: string;
  persona_id: string | null;
  title: string;
}

const STAGE_BUCKETS = ['stranger', 'fan', 'friend', 'close', 'heart'] as const;

export async function GET() {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    return NextResponse.json({ error: 'Service role not configured' }, { status: 500 });
  }
  const admin = createClient(url, key);

  const since24h = new Date(Date.now() - 24 * 3600_000).toISOString();
  const since7d = new Date(Date.now() - 7 * 86_400_000).toISOString();

  const { data: personas } = await admin
    .from('persona_core')
    .select('id, name, full_name, profile_image_url, role, status, sort_order, age')
    .order('sort_order', { ascending: true });

  const personaList = (personas ?? []) as Array<{
    id: string; name: string; full_name: string | null; profile_image_url: string | null;
    role: string | null; status: string | null; sort_order: number | null; age: number | null;
  }>;

  const personaIds = personaList.map((p) => p.id);
  if (personaIds.length === 0) {
    return NextResponse.json({ members: [] });
  }

  const [
    { data: relsAll },
    { data: stages },
    { data: msg24h },
    { data: msg7d },
    { data: progress },
    { data: templates },
  ] = await Promise.all([
    admin
      .from('user_persona_relationships')
      .select('persona_id, affection, total_messages, is_unlocked, last_interaction_at')
      .in('persona_id', personaIds),
    admin
      .from('user_persona_relationships')
      .select('persona_id, relationship_stage')
      .in('persona_id', personaIds),
    admin
      .from('conversation_messages')
      .select('id, session_id, created_at')
      .gte('created_at', since24h)
      .limit(20000),
    admin
      .from('conversation_messages')
      .select('id, session_id, created_at')
      .gte('created_at', since7d)
      .limit(50000),
    admin
      .from('user_scenario_progress')
      .select('persona_id, scenario_id, completed')
      .in('persona_id', personaIds),
    admin
      .from('scenario_templates')
      .select('id, persona_id, title')
      .in('persona_id', personaIds),
  ]);

  const { data: sessionMap } = await admin
    .from('conversation_sessions')
    .select('id, persona_id');
  const sessionToPersona = new Map<string, string>();
  for (const s of (sessionMap ?? []) as { id: string; persona_id: string }[]) {
    sessionToPersona.set(s.id, s.persona_id);
  }

  const msgCount24h = new Map<string, number>();
  for (const m of (msg24h ?? []) as { session_id: string }[]) {
    const pid = sessionToPersona.get(m.session_id);
    if (pid) msgCount24h.set(pid, (msgCount24h.get(pid) ?? 0) + 1);
  }
  const msgCount7d = new Map<string, number>();
  for (const m of (msg7d ?? []) as { session_id: string }[]) {
    const pid = sessionToPersona.get(m.session_id);
    if (pid) msgCount7d.set(pid, (msgCount7d.get(pid) ?? 0) + 1);
  }

  const titleByScenario = new Map<string, string>();
  const scenariosByPersona = new Map<string, Set<string>>();
  for (const t of (templates ?? []) as ScenarioTemplateRow[]) {
    titleByScenario.set(t.id, t.title);
    if (t.persona_id) {
      if (!scenariosByPersona.has(t.persona_id)) scenariosByPersona.set(t.persona_id, new Set());
      scenariosByPersona.get(t.persona_id)!.add(t.id);
    }
  }

  const completedCounts = new Map<string, Map<string, number>>();
  for (const p of (progress ?? []) as ScenarioRow[]) {
    if (!p.completed) continue;
    if (!completedCounts.has(p.persona_id)) completedCounts.set(p.persona_id, new Map());
    const bucket = completedCounts.get(p.persona_id)!;
    bucket.set(p.scenario_id, (bucket.get(p.scenario_id) ?? 0) + 1);
  }

  const members = personaList.map((p) => {
    const rels = ((relsAll ?? []) as RelRow[]).filter((r) => r.persona_id === p.id);
    const activeRels = rels.filter((r) => r.is_unlocked);
    const totalUsers = rels.length;
    const activeUsers = activeRels.length;
    const avgAffection = activeRels.length > 0
      ? activeRels.reduce((acc, r) => acc + (r.affection ?? 0), 0) / activeRels.length
      : 0;
    const totalMessages = rels.reduce((acc, r) => acc + (r.total_messages ?? 0), 0);
    const lastActive = rels
      .map((r) => r.last_interaction_at)
      .filter(Boolean)
      .sort()
      .pop() as string | null | undefined;

    const stageCount: Record<string, number> = {};
    for (const s of STAGE_BUCKETS) stageCount[s] = 0;
    for (const r of (stages ?? []) as { persona_id: string; relationship_stage: string }[]) {
      if (r.persona_id !== p.id) continue;
      if (stageCount[r.relationship_stage] !== undefined) stageCount[r.relationship_stage] += 1;
    }

    const completed = completedCounts.get(p.id) ?? new Map<string, number>();
    const topScenarios = Array.from(completed.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([scenarioId, count]) => ({
        scenarioId,
        title: titleByScenario.get(scenarioId) ?? scenarioId,
        completedCount: count,
      }));

    return {
      persona: {
        id: p.id,
        name: p.name,
        fullName: p.full_name,
        profileImageUrl: p.profile_image_url,
        role: p.role,
        status: p.status,
        age: p.age,
      },
      kpi: {
        activeUsers,
        totalUsers,
        avgAffection: Math.round(avgAffection * 10) / 10,
        totalMessages,
        messagesIn24h: msgCount24h.get(p.id) ?? 0,
        messagesIn7d: msgCount7d.get(p.id) ?? 0,
        avgMessagesPerActiveUser: activeUsers > 0
          ? Math.round((totalMessages / activeUsers) * 10) / 10
          : 0,
        lastActive,
      },
      stages: stageCount,
      topScenarios,
      scenariosTotal: scenariosByPersona.get(p.id)?.size ?? 0,
    };
  });

  return NextResponse.json({ members });
}
