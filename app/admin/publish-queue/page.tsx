'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { adminFetch } from '@/lib/admin-fetch';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Loader2, Check, X, AlertTriangle } from 'lucide-react';
import { format } from 'date-fns';

interface ScenarioReview {
  id: string;
  title: string;
  description: string | null;
  persona_id: string | null;
  scenario_type: string;
  generation_mode: string;
  review_status: string;
  submitted_at: string | null;
  reviewed_at: string | null;
  review_notes: string | null;
  lint_findings: Array<{
    path: string;
    category: string;
    severity: string;
    matched: string[];
    preview: string;
    source?: 'rule' | 'llm';
    reason?: string;
    evidence?: string;
    suggestion?: string;
    confidence?: number;
    model?: string;
  }>;
  lint_llm_version?: string | null;
  lint_llm_model?: string | null;
  lint_llm_at?: string | null;
  lint_llm_cost?: number | null;
  is_active: boolean;
  created_at: string;
}

interface ResponseShape {
  scenarios: ScenarioReview[];
  summary: { draft: number; in_review: number; approved: number; rejected: number; total: number };
}

const STATUS_BADGE: Record<string, string> = {
  draft: 'bg-slate-100 text-slate-700',
  in_review: 'bg-amber-100 text-amber-700',
  approved: 'bg-emerald-100 text-emerald-700',
  rejected: 'bg-rose-100 text-rose-700',
};

const SEVERITY_COLOR: Record<string, string> = {
  critical: 'bg-rose-600 text-white',
  high: 'bg-rose-100 text-rose-700',
  medium: 'bg-amber-100 text-amber-700',
  low: 'bg-slate-100 text-slate-700',
};

const SOURCE_BADGE: Record<string, string> = {
  rule: 'bg-slate-200 text-slate-700',
  llm: 'bg-violet-100 text-violet-700',
};

export default function AdminPublishQueuePage() {
  const [data, setData] = useState<ResponseShape | null>(null);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('in_review');
  const [busyIds, setBusyIds] = useState<Set<string>>(new Set());
  const [noteById, setNoteById] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set('status', statusFilter);
      const res = await adminFetch(`/api/admin/scenarios/review-queue?${params}`);
      if (res.ok) setData(await res.json());
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => { load(); }, [load]);

  async function review(id: string, action: 'approve' | 'reject', force = false) {
    setBusyIds((prev) => new Set(prev).add(id));
    try {
      await adminFetch(`/api/admin/scenarios/${id}/review`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, note: noteById[id] ?? null, force }),
      });
      await load();
    } finally {
      setBusyIds((prev) => { const next = new Set(prev); next.delete(id); return next; });
    }
  }

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">발행 큐</h1>
        <p className="text-muted-foreground">
          시나리오 발행 전 Hard Rules lint + 검토자 승인 단계. 거부된 시나리오는 자동으로 비활성화됩니다.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        <Mini label="전체" value={data?.summary.total ?? 0} />
        <Mini label="draft" value={data?.summary.draft ?? 0} />
        <Mini label="검토 중" value={data?.summary.in_review ?? 0} highlight={data?.summary.in_review !== 0} />
        <Mini label="승인됨" value={data?.summary.approved ?? 0} />
        <Mini label="거부됨" value={data?.summary.rejected ?? 0} />
      </div>

      <Card>
        <CardHeader className="pb-3"><CardTitle className="text-base">상태 필터</CardTitle></CardHeader>
        <CardContent>
          <select className="border rounded px-3 py-1.5 text-sm bg-white" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
            <option value="in_review">검토 중</option>
            <option value="draft">draft</option>
            <option value="approved">승인됨</option>
            <option value="rejected">거부됨</option>
            <option value="all">전체</option>
          </select>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-12 flex justify-center"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
          ) : !data || data.scenarios.length === 0 ? (
            <div className="p-12 text-center text-muted-foreground">조건에 맞는 시나리오가 없습니다.</div>
          ) : (
            <div className="divide-y">
              {data.scenarios.map((s) => {
                const busy = busyIds.has(s.id);
                const findings = s.lint_findings ?? [];
                const blocking = findings.filter((f) => f.severity === 'critical' || f.severity === 'high');
                return (
                  <div key={s.id} className="p-4 space-y-3">
                    <div className="flex items-start gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap mb-1">
                          <Badge className={STATUS_BADGE[s.review_status] ?? ''} variant="secondary">{s.review_status}</Badge>
                          <Badge variant="outline">{s.scenario_type}</Badge>
                          <Badge variant="outline">{s.generation_mode}</Badge>
                          {s.persona_id && <Badge variant="outline">{s.persona_id}</Badge>}
                          {blocking.length > 0 && (
                            <Badge className="bg-rose-600 text-white">
                              <AlertTriangle className="w-3 h-3 mr-1" /> lint 차단 {blocking.length}건
                            </Badge>
                          )}
                        </div>
                        <Link href={`/admin/scenarios/${s.id}`} className="font-semibold hover:underline">
                          {s.title}
                        </Link>
                        {s.description && <div className="text-sm text-muted-foreground mt-1">{s.description}</div>}
                        <div className="text-xs text-muted-foreground mt-1">
                          {s.submitted_at ? `제출: ${format(new Date(s.submitted_at), 'yyyy-MM-dd HH:mm')}` : '미제출'}
                          {s.reviewed_at && ` · 검토: ${format(new Date(s.reviewed_at), 'yyyy-MM-dd HH:mm')}`}
                        </div>
                      </div>
                    </div>

                    {findings.length > 0 && (
                      <details className="text-xs">
                        <summary className="cursor-pointer text-muted-foreground">
                          Lint 결과 {findings.length}건
                          {s.lint_llm_version && (
                            <span className="ml-2 text-violet-600">
                              · LLM {s.lint_llm_version}{s.lint_llm_cost != null ? ` ($${s.lint_llm_cost.toFixed(5)})` : ''}
                            </span>
                          )}
                        </summary>
                        <ul className="mt-2 space-y-2 pl-4">
                          {findings.map((f, i) => {
                            const source = f.source ?? 'rule';
                            return (
                              <li
                                key={i}
                                className={`border-l-2 pl-2 ${source === 'llm' ? 'border-violet-300' : 'border-rose-300'}`}
                              >
                                <div className="flex flex-wrap items-center gap-1">
                                  <Badge className={SEVERITY_COLOR[f.severity] ?? ''} variant="secondary">{f.severity}</Badge>
                                  <Badge className={SOURCE_BADGE[source] ?? ''} variant="secondary">{source}</Badge>
                                  <code>{f.category}</code>
                                  <span className="text-muted-foreground">@</span>
                                  <code>{f.path}</code>
                                  {source === 'llm' && f.confidence != null && (
                                    <span className="text-muted-foreground">conf {Math.round(f.confidence * 100)}%</span>
                                  )}
                                </div>
                                {source === 'llm' ? (
                                  <div className="mt-1 space-y-0.5">
                                    {f.evidence && (
                                      <div className="text-muted-foreground italic">증거: {f.evidence}</div>
                                    )}
                                    {f.reason && <div>사유: {f.reason}</div>}
                                    {f.suggestion && (
                                      <div className="text-emerald-700">제안: {f.suggestion}</div>
                                    )}
                                  </div>
                                ) : (
                                  <>
                                    {f.matched.length > 0 && (
                                      <div className="text-muted-foreground">매치: {f.matched.join(', ')}</div>
                                    )}
                                    <div className="text-muted-foreground italic">{f.preview}</div>
                                  </>
                                )}
                              </li>
                            );
                          })}
                        </ul>
                      </details>
                    )}

                    {(s.review_status === 'in_review' || s.review_status === 'draft') && (
                      <div className="flex flex-wrap gap-2 items-center">
                        <Input
                          placeholder="검토 메모 (선택)"
                          className="flex-1 min-w-[200px]"
                          value={noteById[s.id] ?? ''}
                          onChange={(e) => setNoteById((prev) => ({ ...prev, [s.id]: e.target.value }))}
                        />
                        <Button size="sm" disabled={busy} onClick={() => review(s.id, 'approve')}>
                          {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                          승인 + 활성화
                        </Button>
                        <Button size="sm" variant="destructive" disabled={busy} onClick={() => review(s.id, 'reject')}>
                          <X className="w-4 h-4" /> 거부
                        </Button>
                      </div>
                    )}

                    {s.review_notes && (
                      <div className="text-xs bg-slate-50 border rounded p-2">
                        검토 메모: {s.review_notes}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function Mini({ label, value, highlight }: { label: string; value: number; highlight?: boolean }) {
  return (
    <Card>
      <CardHeader className="pb-2"><CardDescription>{label}</CardDescription></CardHeader>
      <CardContent>
        <div className={`text-2xl font-bold ${highlight ? 'text-amber-600' : ''}`}>{value}</div>
      </CardContent>
    </Card>
  );
}
