'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { adminFetch } from '@/lib/admin-fetch';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { format } from 'date-fns';
import { Loader2, AlertTriangle, Activity } from 'lucide-react';

interface ErrorRow {
  id: string;
  error_type: string;
  error_message: string;
  error_stack: string | null;
  context: Record<string, unknown> | null;
  resolved: boolean;
  resolved_at: string | null;
  created_at: string;
}

interface ErrorResponse {
  errors: ErrorRow[];
  summary: {
    total7d: number;
    unresolved7d: number;
    topTypes: { type: string; count: number }[];
  };
}

interface ActivityRow {
  id: string;
  user_id: string;
  persona_id: string | null;
  action_type: string;
  action_data: Record<string, unknown> | null;
  created_at: string;
  user: { id: string; email: string | null; nickname: string | null } | null;
}

interface ActivityResponse {
  activity: ActivityRow[];
  summary: {
    total24h: number;
    byAction: { action: string; count: number }[];
  };
}

export default function AdminLogsPage() {
  const [tab, setTab] = useState<'errors' | 'activity'>('errors');

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">로그</h1>
        <p className="text-muted-foreground">에러 로그 / 사용자 활동 로그를 검색·필터합니다.</p>
      </div>

      <Tabs value={tab} onValueChange={(v) => setTab(v as 'errors' | 'activity')}>
        <TabsList>
          <TabsTrigger value="errors" className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4" /> 에러 로그
          </TabsTrigger>
          <TabsTrigger value="activity" className="flex items-center gap-2">
            <Activity className="w-4 h-4" /> 활동 로그
          </TabsTrigger>
        </TabsList>

        <TabsContent value="errors" className="mt-4">
          <ErrorLogPanel />
        </TabsContent>
        <TabsContent value="activity" className="mt-4">
          <ActivityLogPanel />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function ErrorLogPanel() {
  const [data, setData] = useState<ErrorResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorType, setErrorType] = useState('');
  const [resolved, setResolved] = useState('false');
  const [search, setSearch] = useState('');
  const [busyIds, setBusyIds] = useState<Set<string>>(new Set());

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (errorType) params.set('error_type', errorType);
      if (resolved) params.set('resolved', resolved);
      if (search) params.set('q', search);
      const res = await adminFetch(`/api/admin/logs/errors?${params}`);
      if (res.ok) setData(await res.json());
    } finally {
      setLoading(false);
    }
  }, [errorType, resolved, search]);

  useEffect(() => { load(); }, [load]);

  async function toggleResolve(id: string, current: boolean) {
    setBusyIds((prev) => new Set(prev).add(id));
    try {
      await adminFetch('/api/admin/logs/errors', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, resolved: !current }),
      });
      await load();
    } finally {
      setBusyIds((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">7일간 총 에러</CardTitle></CardHeader>
          <CardContent><div className="text-2xl font-bold">{data?.summary.total7d ?? 0}</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">미해결</CardTitle></CardHeader>
          <CardContent><div className="text-2xl font-bold text-rose-600">{data?.summary.unresolved7d ?? 0}</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">상위 에러 타입</CardTitle></CardHeader>
          <CardContent>
            <div className="text-xs space-y-1">
              {data?.summary.topTypes.slice(0, 5).map((t) => (
                <div key={t.type} className="flex justify-between">
                  <code>{t.type}</code><span className="text-muted-foreground">{t.count}</span>
                </div>
              )) ?? <span className="text-muted-foreground">데이터 없음</span>}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardContent className="p-3 flex flex-wrap gap-2">
          <Input placeholder="에러 메시지 검색" value={search} onChange={(e) => setSearch(e.target.value)} className="w-64" />
          <select className="border rounded px-3 py-1.5 text-sm bg-white" value={resolved} onChange={(e) => setResolved(e.target.value)}>
            <option value="false">미해결</option>
            <option value="true">해결됨</option>
            <option value="">전체</option>
          </select>
          <Input placeholder="error_type" value={errorType} onChange={(e) => setErrorType(e.target.value)} className="w-48" />
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-12 flex justify-center"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
          ) : !data || data.errors.length === 0 ? (
            <div className="p-12 text-center text-muted-foreground">결과 없음</div>
          ) : (
            <div className="divide-y">
              {data.errors.map((e) => {
                const busy = busyIds.has(e.id);
                return (
                  <div key={e.id} className="p-4 space-y-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge variant={e.resolved ? 'secondary' : 'destructive'}>{e.resolved ? '해결됨' : '미해결'}</Badge>
                      <code className="text-xs">{e.error_type}</code>
                      <span className="text-xs text-muted-foreground ml-auto">{format(new Date(e.created_at), 'yyyy-MM-dd HH:mm:ss')}</span>
                    </div>
                    <div className="text-sm font-medium">{e.error_message}</div>
                    {e.error_stack && (
                      <details className="text-xs text-muted-foreground">
                        <summary className="cursor-pointer">stack trace</summary>
                        <pre className="mt-2 bg-slate-50 p-2 rounded overflow-auto max-h-64">{e.error_stack}</pre>
                      </details>
                    )}
                    {e.context && Object.keys(e.context).length > 0 && (
                      <details className="text-xs text-muted-foreground">
                        <summary className="cursor-pointer">context</summary>
                        <pre className="mt-2 bg-slate-50 p-2 rounded overflow-auto max-h-64">{JSON.stringify(e.context, null, 2)}</pre>
                      </details>
                    )}
                    <Button size="sm" variant="outline" disabled={busy} onClick={() => toggleResolve(e.id, e.resolved)}>
                      {busy ? <Loader2 className="w-3 h-3 animate-spin" /> : (e.resolved ? '미해결로 되돌리기' : '해결됨으로 표시')}
                    </Button>
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

function ActivityLogPanel() {
  const [data, setData] = useState<ActivityResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState('');
  const [actionType, setActionType] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (userId) params.set('user_id', userId);
      if (actionType) params.set('action_type', actionType);
      const res = await adminFetch(`/api/admin/logs/activity?${params}`);
      if (res.ok) setData(await res.json());
    } finally {
      setLoading(false);
    }
  }, [userId, actionType]);

  useEffect(() => { load(); }, [load]);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">24h 활동 수</CardTitle></CardHeader>
          <CardContent><div className="text-2xl font-bold">{data?.summary.total24h ?? 0}</div></CardContent>
        </Card>
        <Card className="md:col-span-2">
          <CardHeader className="pb-2"><CardTitle className="text-sm">24h 액션 분포</CardTitle></CardHeader>
          <CardContent>
            <div className="text-xs flex flex-wrap gap-3">
              {data?.summary.byAction.slice(0, 12).map((a) => (
                <div key={a.action} className="flex items-center gap-1">
                  <code>{a.action}</code><span className="text-muted-foreground">{a.count}</span>
                </div>
              )) ?? <span className="text-muted-foreground">데이터 없음</span>}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardContent className="p-3 flex flex-wrap gap-2">
          <Input placeholder="user_id" value={userId} onChange={(e) => setUserId(e.target.value)} className="w-80 font-mono text-xs" />
          <Input placeholder="action_type" value={actionType} onChange={(e) => setActionType(e.target.value)} className="w-48" />
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-12 flex justify-center"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
          ) : !data || data.activity.length === 0 ? (
            <div className="p-12 text-center text-muted-foreground">결과 없음</div>
          ) : (
            <table className="w-full text-sm">
              <thead className="border-b">
                <tr className="text-left text-muted-foreground">
                  <th className="px-4 py-2 font-medium">시간</th>
                  <th className="px-4 py-2 font-medium">유저</th>
                  <th className="px-4 py-2 font-medium">액션</th>
                  <th className="px-4 py-2 font-medium">페르소나</th>
                  <th className="px-4 py-2 font-medium">데이터</th>
                </tr>
              </thead>
              <tbody>
                {data.activity.map((a) => (
                  <tr key={a.id} className="border-b last:border-b-0 hover:bg-slate-50">
                    <td className="px-4 py-2 text-xs text-muted-foreground whitespace-nowrap">
                      {format(new Date(a.created_at), 'MM-dd HH:mm:ss')}
                    </td>
                    <td className="px-4 py-2">
                      {a.user ? (
                        <Link href={`/admin/users/${a.user.id}`} className="hover:underline">
                          {a.user.nickname || a.user.email || a.user.id.slice(0, 8)}
                        </Link>
                      ) : (
                        <code className="text-xs">{a.user_id.slice(0, 8)}</code>
                      )}
                    </td>
                    <td className="px-4 py-2"><code className="text-xs">{a.action_type}</code></td>
                    <td className="px-4 py-2 text-xs text-muted-foreground">{a.persona_id ?? '—'}</td>
                    <td className="px-4 py-2">
                      {a.action_data && Object.keys(a.action_data).length > 0 && (
                        <details className="text-xs">
                          <summary className="cursor-pointer text-muted-foreground">view</summary>
                          <pre className="mt-1 bg-slate-50 p-2 rounded text-xs">{JSON.stringify(a.action_data, null, 2)}</pre>
                        </details>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
