#!/usr/bin/env -S npx tsx
/**
 * Hard Rules regression: scan every scenario_templates row's content JSON
 * for forbidden patterns from lib/moderation and exit non-zero on hits.
 *
 * Usage:
 *   SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... npx tsx scripts/lint-scenarios.ts
 *   npm run lint:scenarios
 */
import 'dotenv/config';
import { config as loadDotenv } from 'dotenv';
import { createClient } from '@supabase/supabase-js';

loadDotenv({ path: '.env.local' });
import { detectFlags } from '../lib/moderation';

interface Scenario {
  id: string;
  persona_id: string | null;
  title: string;
  description: string | null;
  content: unknown;
  is_active: boolean;
  generation_mode: string;
}

function extractTextFragments(value: unknown, path: string, out: { path: string; text: string }[]) {
  if (value == null) return;
  if (typeof value === 'string') {
    if (value.length >= 4) out.push({ path, text: value });
    return;
  }
  if (Array.isArray(value)) {
    value.forEach((item, idx) => extractTextFragments(item, `${path}[${idx}]`, out));
    return;
  }
  if (typeof value === 'object') {
    for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
      extractTextFragments(child, path ? `${path}.${key}` : key, out);
    }
  }
}

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.error('Missing SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY');
    process.exit(2);
  }
  const admin = createClient(url, key);

  const { data, error } = await admin
    .from('scenario_templates')
    .select('id, persona_id, title, description, content, is_active, generation_mode');

  if (error) {
    console.error('Failed to load scenario_templates:', error.message);
    process.exit(2);
  }

  const scenarios = (data ?? []) as Scenario[];
  let totalChecks = 0;
  const violations: Array<{
    scenarioId: string;
    title: string;
    personaId: string | null;
    isActive: boolean;
    fragments: Array<{ path: string; category: string; severity: string; matched: string[]; preview: string }>;
  }> = [];

  for (const s of scenarios) {
    const fragments: { path: string; text: string }[] = [];
    if (s.title) fragments.push({ path: 'title', text: s.title });
    if (s.description) fragments.push({ path: 'description', text: s.description });
    extractTextFragments(s.content, 'content', fragments);

    const hits: typeof violations[number]['fragments'] = [];
    for (const f of fragments) {
      totalChecks += 1;
      const matches = detectFlags(f.text);
      for (const m of matches) {
        hits.push({
          path: f.path,
          category: m.category,
          severity: m.severity,
          matched: m.matched,
          preview: f.text.slice(0, 120) + (f.text.length > 120 ? '…' : ''),
        });
      }
    }

    if (hits.length > 0) {
      violations.push({
        scenarioId: s.id,
        title: s.title,
        personaId: s.persona_id,
        isActive: s.is_active,
        fragments: hits,
      });
    }
  }

  console.log(`scanned ${scenarios.length} scenarios, ${totalChecks} text fragments`);
  if (violations.length === 0) {
    console.log('✓ no Hard Rules violations');
    process.exit(0);
  }

  console.error(`✗ ${violations.length} scenario(s) with violations:\n`);
  for (const v of violations) {
    console.error(
      `  · ${v.scenarioId} [${v.personaId ?? 'global'}]${v.isActive ? '' : ' (inactive)'}: ${v.title}`
    );
    for (const f of v.fragments) {
      console.error(`      ${f.severity}/${f.category} @ ${f.path}: ${f.matched.join(', ')}`);
      console.error(`        > ${f.preview}`);
    }
  }
  process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(2);
});
