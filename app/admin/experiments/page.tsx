'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { adminFetch } from '@/lib/admin-fetch';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Loader2, Plus, FlaskConical } from 'lucide-react';
import { format } from 'date-fns';

interface Variant { name: string; weight: number }

interface Experiment {
  id: string;
  key: string;
  name: string;
  description: string | null;
  status: string;
  variants: Variant[];
  conversion_events: string[];
  started_at: string | null;
  ended_at: string | null;
  created_at: string;
  assignments: Record<string, number>;
}

const STATUS_COLOR: Record<string, string> = {
  draft: 'bg-slate-100 text-slate-700',
  running: 'bg-emerald-100 text-emerald-700',
  paused: 'bg-amber-100 text-amber-700',
  complete: 'bg-blue-100 text-blue-700',
};

export default function AdminExperimentsPage() {
  const [experiments, setExperiments] = useState<Experiment[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await adminFetch('/api/admin/experiments');
      if (res.ok) {
        const data = await res.json();
        setExperiments(data.experiments ?? []);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function setStatus(id: string, status: string) {
    await adminFetch(`/api/admin/experiments/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    });
    load();
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
            <FlaskConical className="w-7 h-7" /> A/B 실험
          </h1>
          <p className="text-muted-foreground">
            결정론적 SHA-256 해시 기반 sticky 할당. 코드에서{' '}
            <code className="bg-slate-100 px-1 rounded text-xs">{`assignVariant(userId, key)`}</code> 호출.
          </p>
        </div>
        <Button onClick={() => setShowForm((v) => !v)}>
          <Plus className="w-4 h-4 mr-1" /> 새 실험
        </Button>
      </div>

      {showForm && <CreateForm onCreated={() => { setShowForm(false); load(); }} />}

      {loading ? (
        <div className="p-12 flex justify-center"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
      ) : experiments.length === 0 ? (
        <Card><CardContent className="p-12 text-center text-muted-foreground">아직 실험이 없습니다.</CardContent></Card>
      ) : (
        <div className="space-y-4">
          {experiments.map((e) => {
            const totalAssigned = Object.values(e.assignments).reduce((a, b) => a + b, 0);
            return (
              <Card key={e.id}>
                <CardHeader>
                  <div className="flex items-start gap-3 flex-wrap">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <Badge className={STATUS_COLOR[e.status] ?? ''} variant="secondary">{e.status}</Badge>
                        <code className="text-xs bg-slate-100 px-2 py-0.5 rounded">{e.key}</code>
                      </div>
                      <CardTitle className="text-lg">{e.name}</CardTitle>
                      {e.description && <CardDescription>{e.description}</CardDescription>}
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {e.status === 'draft' && (
                        <Button size="sm" onClick={() => setStatus(e.id, 'running')}>시작</Button>
                      )}
                      {e.status === 'running' && (
                        <>
                          <Button size="sm" variant="outline" onClick={() => setStatus(e.id, 'paused')}>일시정지</Button>
                          <Button size="sm" variant="outline" onClick={() => setStatus(e.id, 'complete')}>완료</Button>
                        </>
                      )}
                      {e.status === 'paused' && (
                        <Button size="sm" onClick={() => setStatus(e.id, 'running')}>재개</Button>
                      )}
                      <Link href={`/admin/experiments/${e.id}`}>
                        <Button size="sm" variant="outline">결과 →</Button>
                      </Link>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                    <div>
                      <div className="text-xs text-muted-foreground mb-1">Variants</div>
                      <div className="space-y-1">
                        {e.variants.map((v) => (
                          <div key={v.name} className="flex justify-between gap-2">
                            <code className="text-xs">{v.name} (w={v.weight})</code>
                            <span className="text-muted-foreground">{e.assignments[v.name] ?? 0}명</span>
                          </div>
                        ))}
                      </div>
                    </div>
                    <div>
                      <div className="text-xs text-muted-foreground mb-1">Conversion events</div>
                      <div className="text-xs">
                        {e.conversion_events.length > 0
                          ? e.conversion_events.map((ev) => <code key={ev} className="bg-slate-100 px-1 mr-1 rounded">{ev}</code>)
                          : <span className="text-muted-foreground">미설정</span>}
                      </div>
                    </div>
                    <div className="text-xs text-muted-foreground">
                      <div>총 할당: {totalAssigned.toLocaleString()}명</div>
                      <div>생성: {format(new Date(e.created_at), 'yyyy-MM-dd')}</div>
                      {e.started_at && <div>시작: {format(new Date(e.started_at), 'yyyy-MM-dd')}</div>}
                      {e.ended_at && <div>종료: {format(new Date(e.ended_at), 'yyyy-MM-dd')}</div>}
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

function CreateForm({ onCreated }: { onCreated: () => void }) {
  const [key, setKey] = useState('');
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [variantsText, setVariantsText] = useState('control:1, treatment:1');
  const [eventsText, setEventsText] = useState('pass_purchased, standard_purchased');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function submit() {
    setBusy(true);
    setErr(null);
    try {
      const variants = variantsText.split(',').map((s) => {
        const [n, w] = s.split(':').map((p) => p.trim());
        return { name: n, weight: w ? Number(w) : 1 };
      }).filter((v) => v.name);
      const conversion_events = eventsText.split(',').map((s) => s.trim()).filter(Boolean);

      const res = await adminFetch('/api/admin/experiments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key, name, description: description || null, variants, conversion_events }),
      });
      if (!res.ok) {
        const d = await res.json();
        setErr(d.error ?? '실패');
      } else {
        onCreated();
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card className="border-emerald-200 bg-emerald-50/40">
      <CardHeader><CardTitle className="text-base">새 실험</CardTitle></CardHeader>
      <CardContent className="space-y-3 text-sm">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
          <Input placeholder="key (예: pass_landing_v2) *" value={key} onChange={(e) => setKey(e.target.value)} className="font-mono" />
          <Input placeholder="이름 *" value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <Input placeholder="설명" value={description} onChange={(e) => setDescription(e.target.value)} />
        <Input placeholder="variants (예: control:1, treatment:1)" value={variantsText} onChange={(e) => setVariantsText(e.target.value)} />
        <Input placeholder="conversion events (콤마 구분, 예: pass_purchased, standard_purchased)" value={eventsText} onChange={(e) => setEventsText(e.target.value)} />
        {err && <div className="text-sm text-rose-600">{err}</div>}
        <Button onClick={submit} disabled={busy || !key || !name}>
          {busy ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : null} 생성
        </Button>
      </CardContent>
    </Card>
  );
}
