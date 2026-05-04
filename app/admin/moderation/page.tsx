'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { adminFetch } from '@/lib/admin-fetch';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { format } from 'date-fns';
import { Loader2, AlertTriangle, Shield } from 'lucide-react';

interface Flag {
  id: string;
  user_id: string | null;
  persona_id: string | null;
  session_id: string | null;
  source: string;
  category: string;
  severity: string;
  matched_terms: string[];
  excerpt: string;
  status: string;
  reviewer_note: string | null;
  created_at: string;
  reviewed_at: string | null;
  user: { id: string; email: string | null; nickname: string | null } | null;
}

interface ResponseShape {
  flags: Flag[];
  summary: { open: number; acknowledged: number; dismissed: number; escalated: number; total: number };
}

const SEVERITY_BADGE: Record<string, string> = {
  critical: 'bg-rose-600 text-white',
  high: 'bg-rose-100 text-rose-700',
  medium: 'bg-amber-100 text-amber-700',
  low: 'bg-slate-100 text-slate-700',
};

const CATEGORY_LABEL: Record<string, string> = {
  sexual: '성적',
  real_idol: '실명 아이돌',
  drugs: '약물/음주',
  violence: '폭력/자해',
  politics: '정치/종교',
  other: '기타',
};

export default function AdminModerationPage() {
  const [data, setData] = useState<ResponseShape | null>(null);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('open');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [severityFilter, setSeverityFilter] = useState('');
  const [busyIds, setBusyIds] = useState<Set<string>>(new Set());

  async function load() {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (statusFilter) params.set('status', statusFilter);
      if (categoryFilter) params.set('category', categoryFilter);
      if (severityFilter) params.set('severity', severityFilter);

      const res = await adminFetch(`/api/admin/moderation?${params}`);
      if (res.ok) setData(await res.json());
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, [statusFilter, categoryFilter, severityFilter]);

  async function act(id: string, status: 'acknowledged' | 'dismissed' | 'escalated') {
    setBusyIds((prev) => new Set(prev).add(id));
    try {
      const res = await adminFetch(`/api/admin/moderation/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });
      if (res.ok) await load();
    } finally {
      setBusyIds((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
            <Shield className="w-7 h-7 text-rose-600" /> 모더레이션
          </h1>
          <p className="text-muted-foreground">Hard Rules 위반 의심 메시지를 검토합니다.</p>
        </div>
        {data && (
          <div className="text-sm text-muted-foreground">
            <span className="text-rose-600 font-bold">{data.summary.open}</span> 미처리 / 누적 {data.summary.total}
          </div>
        )}
      </div>

      <Card>
        <CardHeader className="pb-3"><CardTitle className="text-base">필터</CardTitle></CardHeader>
        <CardContent className="flex flex-wrap gap-3">
          <select className="border rounded px-3 py-1.5 text-sm bg-white" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
            <option value="open">상태: open</option>
            <option value="acknowledged">acknowledged</option>
            <option value="dismissed">dismissed</option>
            <option value="escalated">escalated</option>
            <option value="all">전체</option>
          </select>
          <select className="border rounded px-3 py-1.5 text-sm bg-white" value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)}>
            <option value="">카테고리: 전체</option>
            <option value="sexual">성적</option>
            <option value="real_idol">실명 아이돌</option>
            <option value="drugs">약물/음주</option>
            <option value="violence">폭력/자해</option>
            <option value="politics">정치/종교</option>
            <option value="other">기타</option>
          </select>
          <select className="border rounded px-3 py-1.5 text-sm bg-white" value={severityFilter} onChange={(e) => setSeverityFilter(e.target.value)}>
            <option value="">심각도: 전체</option>
            <option value="critical">critical</option>
            <option value="high">high</option>
            <option value="medium">medium</option>
            <option value="low">low</option>
          </select>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-12 flex justify-center"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
          ) : !data || data.flags.length === 0 ? (
            <div className="p-12 text-center text-muted-foreground">
              <AlertTriangle className="w-8 h-8 mx-auto text-emerald-500 mb-2" />
              조건에 맞는 플래그가 없습니다. 좋은 신호예요.
            </div>
          ) : (
            <div className="divide-y">
              {data.flags.map((f) => {
                const busy = busyIds.has(f.id);
                return (
                  <div key={f.id} className="p-4 space-y-2 hover:bg-slate-50">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge className={SEVERITY_BADGE[f.severity] ?? ''} variant="secondary">{f.severity}</Badge>
                      <Badge variant="outline">{CATEGORY_LABEL[f.category] ?? f.category}</Badge>
                      <Badge variant="secondary">{f.source}</Badge>
                      <span className="text-xs text-muted-foreground ml-auto">
                        {format(new Date(f.created_at), 'yyyy-MM-dd HH:mm')}
                      </span>
                    </div>
                    <div className="text-sm bg-slate-50 border rounded p-2 font-mono whitespace-pre-wrap break-words">
                      {f.excerpt}
                    </div>
                    <div className="text-xs text-muted-foreground space-x-3">
                      <span>유저: {f.user ? (
                        <Link href={`/admin/users/${f.user.id}`} className="hover:underline text-foreground">
                          {f.user.nickname || f.user.email || f.user.id.slice(0, 8)}
                        </Link>
                      ) : '—'}</span>
                      <span>페르소나: <code>{f.persona_id ?? '—'}</code></span>
                      <span>매치: {f.matched_terms.join(', ')}</span>
                    </div>
                    {f.status === 'open' ? (
                      <div className="flex gap-2 pt-1">
                        <Button size="sm" variant="outline" disabled={busy} onClick={() => act(f.id, 'acknowledged')}>
                          확인 완료
                        </Button>
                        <Button size="sm" variant="ghost" disabled={busy} onClick={() => act(f.id, 'dismissed')}>
                          오탐 (무시)
                        </Button>
                        <Button size="sm" variant="destructive" disabled={busy} onClick={() => act(f.id, 'escalated')}>
                          에스컬레이션
                        </Button>
                      </div>
                    ) : (
                      <div className="text-xs text-muted-foreground">
                        처리됨: <Badge variant="outline">{f.status}</Badge>
                        {f.reviewed_at && <span className="ml-2">{format(new Date(f.reviewed_at), 'yyyy-MM-dd HH:mm')}</span>}
                        {f.reviewer_note && <span className="ml-2">메모: {f.reviewer_note}</span>}
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
