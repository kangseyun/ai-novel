#!/usr/bin/env -S npx tsx
/**
 * Scenario lint — 정규식 + (선택) LLM 캐논 검사.
 *
 * 기본 사용 (CI 호환):
 *   npm run lint:scenarios
 *
 * 확장 사용:
 *   npx tsx scripts/lint-scenarios.ts --llm
 *   npx tsx scripts/lint-scenarios.ts --llm --persona haeon
 *   npx tsx scripts/lint-scenarios.ts --llm-only --concurrency 4
 *   npx tsx scripts/lint-scenarios.ts --llm --dry-run
 *
 * 환경변수:
 *   SUPABASE_URL / NEXT_PUBLIC_SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 *   OPENROUTER_API_KEY (LLM 옵션 사용 시)
 */
import 'dotenv/config';
import { config as loadDotenv } from 'dotenv';
import { createClient } from '@supabase/supabase-js';

loadDotenv({ path: '.env.local' });
import { detectFlags } from '../lib/moderation';
import {
  llmLintScenario,
  type LintFinding,
  type LLMLintResult,
} from '../lib/lint-scenarios/llm-lint';

interface Scenario {
  id: string;
  persona_id: string | null;
  title: string;
  description: string | null;
  content: unknown;
  is_active: boolean;
  scenario_type: string;
  generation_mode: 'static' | 'guided' | 'dynamic';
}

interface CliFlags {
  llm: boolean;
  llmOnly: boolean;
  dryRun: boolean;
  persona: string | null;
  concurrency: number;
  model: string | undefined;
}

function parseFlags(argv: string[]): CliFlags {
  const flags: CliFlags = {
    llm: false,
    llmOnly: false,
    dryRun: false,
    persona: null,
    concurrency: 3,
    model: undefined,
  };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    switch (arg) {
      case '--llm':
        flags.llm = true;
        break;
      case '--llm-only':
        flags.llm = true;
        flags.llmOnly = true;
        break;
      case '--dry-run':
        flags.dryRun = true;
        break;
      case '--persona':
        flags.persona = argv[++i] ?? null;
        break;
      case '--concurrency':
        flags.concurrency = Math.max(1, Math.min(8, parseInt(argv[++i] ?? '3', 10) || 3));
        break;
      case '--model':
        flags.model = argv[++i];
        break;
      default:
        if (arg?.startsWith('--')) {
          console.error(`unknown flag: ${arg}`);
          process.exit(2);
        }
    }
  }
  return flags;
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

function ruleLint(s: Scenario): LintFinding[] {
  const fragments: { path: string; text: string }[] = [];
  if (s.title) fragments.push({ path: 'title', text: s.title });
  if (s.description) fragments.push({ path: 'description', text: s.description });
  extractTextFragments(s.content, 'content', fragments);

  const findings: LintFinding[] = [];
  for (const f of fragments) {
    for (const m of detectFlags(f.text)) {
      findings.push({
        path: f.path,
        category: m.category,
        severity: m.severity,
        matched: m.matched,
        preview: f.text.slice(0, 120) + (f.text.length > 120 ? '…' : ''),
        source: 'rule',
      });
    }
  }
  return findings;
}

async function runLLMBatch(
  scenarios: Scenario[],
  concurrency: number,
  model: string | undefined
): Promise<Map<string, LLMLintResult>> {
  const results = new Map<string, LLMLintResult>();
  let cursor = 0;

  const worker = async () => {
    while (cursor < scenarios.length) {
      const idx = cursor++;
      const s = scenarios[idx];
      const result = await llmLintScenario(
        {
          scenarioId: s.id,
          personaId: s.persona_id,
          title: s.title,
          description: s.description,
          content: s.content,
          scenarioType: s.scenario_type,
          generationMode: s.generation_mode,
        },
        { model }
      );
      results.set(s.id, result);
    }
  };

  const workers = Array.from({ length: Math.min(concurrency, scenarios.length) }, () => worker());
  await Promise.all(workers);
  return results;
}

async function main() {
  const flags = parseFlags(process.argv.slice(2));

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.error('Missing SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY');
    process.exit(2);
  }
  const admin = createClient(url, key);

  const query = admin
    .from('scenario_templates')
    .select('id, persona_id, title, description, content, is_active, scenario_type, generation_mode');

  const { data, error } = flags.persona ? await query.eq('persona_id', flags.persona) : await query;

  if (error) {
    console.error('Failed to load scenario_templates:', error.message);
    process.exit(2);
  }

  const scenarios = (data ?? []) as Scenario[];
  console.log(
    `loaded ${scenarios.length} scenarios` +
      (flags.persona ? ` (persona=${flags.persona})` : '') +
      (flags.llm ? ` · LLM=${flags.llmOnly ? 'only' : 'on'}` : '')
  );

  // ---- 정규식 lint ----
  const ruleViolations: Array<{ scenario: Scenario; findings: LintFinding[] }> = [];
  if (!flags.llmOnly) {
    for (const s of scenarios) {
      const findings = ruleLint(s);
      if (findings.length > 0) ruleViolations.push({ scenario: s, findings });
    }
  }

  // ---- LLM lint ----
  let llmResults: Map<string, LLMLintResult> = new Map();
  let totalCost = 0;
  if (flags.llm) {
    if (flags.dryRun) {
      const estPerScenario = 0.0008;
      console.log(
        `[dry-run] would call LLM for ${scenarios.length} scenarios ≈ $${(scenarios.length * estPerScenario).toFixed(4)}`
      );
    } else {
      console.log(`running LLM lint (concurrency=${flags.concurrency})...`);
      llmResults = await runLLMBatch(scenarios, flags.concurrency, flags.model);
      for (const r of llmResults.values()) totalCost += r.cost;
    }
  }

  // ---- 출력 ----
  console.log('');
  if (!flags.llmOnly) {
    if (ruleViolations.length === 0) {
      console.log('✓ rule lint: no Hard Rules violations');
    } else {
      console.error(`✗ rule lint: ${ruleViolations.length} scenario(s)`);
      for (const v of ruleViolations) {
        console.error(
          `  · ${v.scenario.id} [${v.scenario.persona_id ?? 'global'}]${v.scenario.is_active ? '' : ' (inactive)'}: ${v.scenario.title}`
        );
        for (const f of v.findings) {
          console.error(`      ${f.severity}/${f.category} @ ${f.path}: ${f.matched.join(', ')}`);
          console.error(`        > ${f.preview}`);
        }
      }
    }
  }

  let llmFindingCount = 0;
  let llmErrorCount = 0;
  if (flags.llm && !flags.dryRun) {
    console.log('');
    for (const s of scenarios) {
      const r = llmResults.get(s.id);
      if (!r) continue;
      if (r.error) {
        llmErrorCount++;
        console.error(`  ! ${s.id} [LLM error]: ${r.error}`);
        continue;
      }
      if (r.findings.length === 0) continue;
      llmFindingCount += r.findings.length;
      console.log(
        `  · ${s.id} [${s.persona_id ?? 'global'}] ${s.title} — ${r.findings.length} finding(s) (${r.durationMs}ms, $${r.cost.toFixed(5)})`
      );
      for (const f of r.findings) {
        console.log(
          `      ${f.severity}/${f.category} @ ${f.path} (conf=${(f.confidence ?? 0).toFixed(2)})`
        );
        console.log(`        evidence: ${f.evidence}`);
        console.log(`        reason:   ${f.reason}`);
        if (f.suggestion) console.log(`        suggest:  ${f.suggestion}`);
      }
    }
    console.log('');
    console.log(
      `LLM summary: ${llmFindingCount} finding(s) across ${llmResults.size} scenarios · errors=${llmErrorCount} · total cost=$${totalCost.toFixed(4)}`
    );
  }

  // ---- 종료 코드 ----
  // Phase 1: LLM finding 은 차단하지 않음 (advisory). 정규식 위반만 비정상 종료.
  if (!flags.llmOnly && ruleViolations.length > 0) process.exit(1);
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(2);
});
