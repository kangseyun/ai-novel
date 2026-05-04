'use client';

import { useEffect, useState, useCallback } from 'react';
import { adminFetch } from '@/lib/admin-fetch';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { format } from 'date-fns';
import { Loader2, Calendar, Plus, Trash2 } from 'lucide-react';

interface CalendarEvent {
  id: string;
  type: string;
  title: string;
  description: string | null;
  persona_id: string | null;
  recur_month: number | null;
  recur_day: number | null;
  event_date: string | null;
  is_active: boolean;
  nextOccurrence?: string | null;
}

interface Scheduled {
  id: string;
  user_id: string;
  persona_id: string | null;
  event_type: string;
  scheduled_for: string;
  status: string;
  delivered_at: string | null;
}

interface ResponseShape {
  events: CalendarEvent[];
  upcoming: CalendarEvent[];
  scheduled: Scheduled[];
  horizonDays: number;
}

const TYPE_LABEL: Record<string, string> = {
  member_birthday: '멤버 생일',
  debut_anniversary: '데뷔 기념일',
  comeback: '컴백',
  release: '발매',
  fan_day: '팬 데이',
  custom: '기타',
};

const TYPE_COLOR: Record<string, string> = {
  member_birthday: 'bg-pink-100 text-pink-700',
  debut_anniversary: 'bg-amber-100 text-amber-700',
  comeback: 'bg-purple-100 text-purple-700',
  release: 'bg-sky-100 text-sky-700',
  fan_day: 'bg-emerald-100 text-emerald-700',
  custom: 'bg-slate-100 text-slate-700',
};

export default function AdminEventsPage() {
  const [data, setData] = useState<ResponseShape | null>(null);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await adminFetch('/api/admin/events?days=180');
      if (res.ok) setData(await res.json());
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function deleteEvent(id: string) {
    if (!confirm('이벤트를 삭제할까요?')) return;
    await adminFetch(`/api/admin/events/${id}`, { method: 'DELETE' });
    load();
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
            <Calendar className="w-7 h-7" /> 이벤트 캘린더
          </h1>
          <p className="text-muted-foreground">멤버 생일 · 데뷔 기념일 · 컴백 D-day를 한 곳에서 관리합니다.</p>
        </div>
        <Button onClick={() => setShowForm((v) => !v)}>
          <Plus className="w-4 h-4 mr-1" /> 이벤트 추가
        </Button>
      </div>

      {showForm && (
        <CreateEventForm onCreated={() => { setShowForm(false); load(); }} />
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">앞으로 {data?.horizonDays ?? 90}일 이내</CardTitle>
          <CardDescription>다음 발생 시점 기준 정렬</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-12 flex justify-center"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
          ) : !data || data.upcoming.length === 0 ? (
            <div className="p-12 text-center text-muted-foreground">예정된 이벤트가 없습니다.</div>
          ) : (
            <div className="divide-y">
              {data.upcoming.map((e) => {
                const next = e.nextOccurrence ? new Date(e.nextOccurrence) : null;
                const dDay = next ? Math.ceil((next.getTime() - Date.now()) / (24 * 3600_000)) : null;
                return (
                  <div key={e.id} className="p-4 flex items-start gap-4 hover:bg-slate-50">
                    <div className="w-24 text-center flex-shrink-0">
                      <div className="text-2xl font-bold">D-{dDay}</div>
                      <div className="text-xs text-muted-foreground">
                        {next ? format(next, 'MM월 dd일') : '—'}
                      </div>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <Badge className={TYPE_COLOR[e.type] ?? ''} variant="secondary">{TYPE_LABEL[e.type] ?? e.type}</Badge>
                        {e.persona_id && <Badge variant="outline">{e.persona_id}</Badge>}
                        {e.recur_month && <Badge variant="outline" className="text-xs">매년</Badge>}
                      </div>
                      <div className="font-semibold">{e.title}</div>
                      {e.description && <div className="text-sm text-muted-foreground">{e.description}</div>}
                    </div>
                    <Button variant="ghost" size="icon" onClick={() => deleteEvent(e.id)}>
                      <Trash2 className="w-4 h-4 text-rose-500" />
                    </Button>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {data && data.scheduled.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">예정된 발사 (scheduled_events)</CardTitle>
            <CardDescription>유저별로 큐된 트리거 발사. 상태가 pending이면 대기 중.</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <table className="w-full text-sm">
              <thead className="border-b">
                <tr className="text-left text-muted-foreground">
                  <th className="px-4 py-2 font-medium">발사 시각</th>
                  <th className="px-4 py-2 font-medium">유저</th>
                  <th className="px-4 py-2 font-medium">페르소나</th>
                  <th className="px-4 py-2 font-medium">타입</th>
                  <th className="px-4 py-2 font-medium">상태</th>
                </tr>
              </thead>
              <tbody>
                {data.scheduled.slice(0, 50).map((s) => (
                  <tr key={s.id} className="border-b last:border-b-0">
                    <td className="px-4 py-2 text-xs">{format(new Date(s.scheduled_for), 'yyyy-MM-dd HH:mm')}</td>
                    <td className="px-4 py-2 text-xs"><code>{s.user_id.slice(0, 8)}</code></td>
                    <td className="px-4 py-2 text-xs">{s.persona_id ?? '—'}</td>
                    <td className="px-4 py-2 text-xs">{s.event_type}</td>
                    <td className="px-4 py-2"><Badge variant="secondary">{s.status}</Badge></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function CreateEventForm({ onCreated }: { onCreated: () => void }) {
  const [type, setType] = useState('member_birthday');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [personaId, setPersonaId] = useState('');
  const [mode, setMode] = useState<'recur' | 'date'>('recur');
  const [recurMonth, setRecurMonth] = useState('');
  const [recurDay, setRecurDay] = useState('');
  const [eventDate, setEventDate] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    setBusy(true);
    setError(null);
    try {
      const body: Record<string, unknown> = { type, title, description: description || null };
      if (personaId) body.persona_id = personaId;
      if (mode === 'recur') {
        body.recur_month = parseInt(recurMonth, 10);
        body.recur_day = parseInt(recurDay, 10);
      } else {
        body.event_date = eventDate;
      }
      const res = await adminFetch('/api/admin/events', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const data = await res.json();
        setError(data.error ?? '실패');
      } else {
        onCreated();
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card className="border-emerald-200 bg-emerald-50/40">
      <CardHeader><CardTitle className="text-base">새 이벤트</CardTitle></CardHeader>
      <CardContent className="space-y-3 text-sm">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
          <select className="border rounded px-3 py-1.5 text-sm bg-white" value={type} onChange={(e) => setType(e.target.value)}>
            <option value="member_birthday">멤버 생일</option>
            <option value="debut_anniversary">데뷔 기념일</option>
            <option value="comeback">컴백</option>
            <option value="release">발매</option>
            <option value="fan_day">팬 데이</option>
            <option value="custom">기타</option>
          </select>
          <Input placeholder="제목" value={title} onChange={(e) => setTitle(e.target.value)} />
          <Input
            placeholder="페르소나 ID (예: haeon, 멤버 이벤트만)"
            value={personaId}
            onChange={(e) => setPersonaId(e.target.value)}
          />
        </div>
        <Input placeholder="설명 (선택)" value={description} onChange={(e) => setDescription(e.target.value)} />
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-1 text-sm">
            <input type="radio" checked={mode === 'recur'} onChange={() => setMode('recur')} /> 매년 (월/일)
          </label>
          <label className="flex items-center gap-1 text-sm">
            <input type="radio" checked={mode === 'date'} onChange={() => setMode('date')} /> 일회성 날짜
          </label>
        </div>
        {mode === 'recur' ? (
          <div className="flex gap-2">
            <Input placeholder="월 (1-12)" value={recurMonth} onChange={(e) => setRecurMonth(e.target.value)} className="w-32" />
            <Input placeholder="일 (1-31)" value={recurDay} onChange={(e) => setRecurDay(e.target.value)} className="w-32" />
          </div>
        ) : (
          <Input type="date" value={eventDate} onChange={(e) => setEventDate(e.target.value)} className="w-48" />
        )}
        {error && <div className="text-sm text-rose-600">{error}</div>}
        <Button onClick={submit} disabled={busy || !title}>
          {busy ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : null} 생성
        </Button>
      </CardContent>
    </Card>
  );
}
