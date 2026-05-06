/**
 * LLM Scenario Lint (Phase 1 — advisory)
 *
 * OpenRouter (DeepSeek V3.2) 직접 호출. ai-agent/core/llm-client 는 dialogue/choice
 * 같은 런타임 호출 전용이라, 시스템 lint 호출은 가벼운 별도 모듈로 둔다.
 *
 * 실패는 절대 throw 하지 않는다 (Phase 1 advisory). 호출자는 result.error 만 확인.
 */

import { z } from 'zod';
import {
  buildSystemPrompt,
  buildUserPrompt,
  flattenContentForReview,
  LLM_LINT_VERSION,
  type LLMLintInput,
} from './prompts';

const OPENROUTER_API_URL = 'https://openrouter.ai/api/v1/chat/completions';
const DEFAULT_MODEL = 'deepseek/deepseek-v3.2';

// $0.14 / 1M input, $0.28 / 1M output (lib/ai-agent/core/model-selector.ts 와 일치)
const MODEL_PRICING: Record<string, { inputPer1k: number; outputPer1k: number }> = {
  'deepseek/deepseek-v3.2': { inputPer1k: 0.00014, outputPer1k: 0.00028 },
  'google/gemini-3-pro-preview': { inputPer1k: 0.00125, outputPer1k: 0.01 },
};

// ============================================
// 결과 / 입력 타입
// ============================================

export type LintFindingSource = 'rule' | 'llm';
export type LintFindingSeverity = 'critical' | 'high' | 'medium' | 'low';

export interface LintFinding {
  path: string;
  category: string;
  severity: LintFindingSeverity;
  matched: string[];
  preview: string;
  source?: LintFindingSource;
  reason?: string;
  evidence?: string;
  suggestion?: string;
  confidence?: number;
  model?: string;
  reviewed_at?: string;
}

export interface LLMLintOptions {
  model?: string;
  apiKey?: string;
  timeoutMs?: number;
  signal?: AbortSignal;
}

export interface LLMLintResult {
  findings: LintFinding[]; // source: 'llm' 만
  cost: number;
  model: string;
  version: string;
  durationMs: number;
  inputTokens?: number;
  outputTokens?: number;
  summary?: string;
  error?: string;
}

// ============================================
// 응답 스키마 (zod)
// ============================================

const llmFindingSchema = z.object({
  category: z.enum(['ooc', 'canon_consistency']),
  severity: z.enum(['low', 'medium', 'high']),
  path: z.string().min(1).max(200),
  evidence: z.string().min(1).max(400),
  reason: z.string().min(1).max(400),
  suggestion: z.string().max(400).optional(),
  confidence: z.number().min(0).max(1),
});

const llmResponseSchema = z.object({
  findings: z.array(llmFindingSchema).max(10),
  summary: z.string().max(300).optional(),
});

type LLMResponse = z.infer<typeof llmResponseSchema>;

// ============================================
// 진입 함수
// ============================================

export async function llmLintScenario(
  input: LLMLintInput,
  options: LLMLintOptions = {}
): Promise<LLMLintResult> {
  const startedAt = Date.now();
  const model = options.model ?? DEFAULT_MODEL;
  const reviewedAt = new Date().toISOString();

  const apiKey = options.apiKey ?? process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    return {
      findings: [],
      cost: 0,
      model,
      version: LLM_LINT_VERSION,
      durationMs: Date.now() - startedAt,
      error: 'missing_openrouter_api_key',
    };
  }

  const systemPrompt = buildSystemPrompt(input.personaId);
  const userPrompt = buildUserPrompt(input);

  // 1차 호출 + JSON 파싱 실패 시 1회 재시도
  let llmResponse: LLMResponse | null = null;
  let lastError: string | undefined;
  let usage: { prompt_tokens?: number; completion_tokens?: number } | undefined;

  for (let attempt = 0; attempt < 2; attempt++) {
    const call = await callOpenRouter({
      apiKey,
      model,
      systemPrompt,
      userPrompt,
      timeoutMs: options.timeoutMs ?? 20_000,
      signal: options.signal,
    });

    if (!call.ok) {
      lastError = call.error;
      break; // 네트워크/4xx 는 재시도 의미 없음
    }

    usage = call.usage;
    const parsed = parseLLMJson(call.content);
    if (parsed.ok) {
      llmResponse = parsed.value;
      lastError = undefined;
      break;
    }
    lastError = `parse_failed_attempt_${attempt + 1}: ${parsed.error}`;
  }

  const cost = estimateCost(model, usage);

  if (!llmResponse) {
    return {
      findings: [],
      cost,
      model,
      version: LLM_LINT_VERSION,
      durationMs: Date.now() - startedAt,
      inputTokens: usage?.prompt_tokens,
      outputTokens: usage?.completion_tokens,
      error: lastError ?? 'unknown_failure',
    };
  }

  // 명세 위반 항목 필터링 (confidence < 0.6 / 빈 path 등은 zod 가 거름)
  const findings: LintFinding[] = llmResponse.findings
    .filter((f) => f.confidence >= 0.6)
    .map((f) => ({
      path: f.path,
      category: f.category,
      severity: f.severity as LintFindingSeverity,
      matched: [],
      preview: f.evidence.slice(0, 120) + (f.evidence.length > 120 ? '…' : ''),
      source: 'llm' as const,
      reason: f.reason,
      evidence: f.evidence,
      suggestion: f.suggestion,
      confidence: f.confidence,
      model,
      reviewed_at: reviewedAt,
    }));

  return {
    findings,
    cost,
    model,
    version: LLM_LINT_VERSION,
    durationMs: Date.now() - startedAt,
    inputTokens: usage?.prompt_tokens,
    outputTokens: usage?.completion_tokens,
    summary: llmResponse.summary,
  };
}

// ============================================
// 내부 — OpenRouter 호출
// ============================================

interface OpenRouterCallArgs {
  apiKey: string;
  model: string;
  systemPrompt: string;
  userPrompt: string;
  timeoutMs: number;
  signal?: AbortSignal;
}

interface OpenRouterCallResult {
  ok: boolean;
  content: string;
  error?: string;
  usage?: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number };
}

async function callOpenRouter(args: OpenRouterCallArgs): Promise<OpenRouterCallResult> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), args.timeoutMs);
  if (args.signal) {
    args.signal.addEventListener('abort', () => controller.abort(), { once: true });
  }

  try {
    const res = await fetch(OPENROUTER_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${args.apiKey}`,
        'HTTP-Referer': process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000',
        'X-Title': 'Luminovel.ai (lint)',
      },
      body: JSON.stringify({
        model: args.model,
        messages: [
          { role: 'system', content: args.systemPrompt },
          { role: 'user', content: args.userPrompt },
        ],
        temperature: 0.2, // 일관된 lint 판정 — 낮게
        max_tokens: 1500,
        response_format: { type: 'json_object' },
      }),
      signal: controller.signal,
    });

    if (!res.ok) {
      const text = await res.text().catch(() => '');
      return { ok: false, content: '', error: `http_${res.status}: ${text.slice(0, 200)}` };
    }

    const data = (await res.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
      usage?: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number };
    };

    const content = data.choices?.[0]?.message?.content ?? '';
    if (!content) return { ok: false, content: '', error: 'empty_response', usage: data.usage };

    return { ok: true, content, usage: data.usage };
  } catch (err) {
    const reason = err instanceof Error ? err.message : 'network_error';
    return { ok: false, content: '', error: reason };
  } finally {
    clearTimeout(timer);
  }
}

// ============================================
// 내부 — JSON 파싱 (코드펜스 제거 대비)
// ============================================

function parseLLMJson(raw: string): { ok: true; value: LLMResponse } | { ok: false; error: string } {
  const stripped = raw
    .trim()
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/i, '');

  let json: unknown;
  try {
    json = JSON.parse(stripped);
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'json_parse_error' };
  }

  const result = llmResponseSchema.safeParse(json);
  if (!result.success) {
    return { ok: false, error: result.error.issues.map((i) => i.message).join('; ').slice(0, 200) };
  }
  return { ok: true, value: result.data };
}

// ============================================
// 내부 — 비용 추정
// ============================================

function estimateCost(
  model: string,
  usage?: { prompt_tokens?: number; completion_tokens?: number }
): number {
  if (!usage) return 0;
  const pricing = MODEL_PRICING[model];
  if (!pricing) return 0;
  const inputCost = ((usage.prompt_tokens ?? 0) / 1000) * pricing.inputPer1k;
  const outputCost = ((usage.completion_tokens ?? 0) / 1000) * pricing.outputPer1k;
  return Number((inputCost + outputCost).toFixed(6));
}

// 외부 노출
export { flattenContentForReview, LLM_LINT_VERSION };
export type { LLMLintInput };
