'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { adminFetch } from '@/lib/admin-fetch';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { format } from 'date-fns';
import { Loader2, MessageSquare, Users as UsersIcon, Heart, BookOpen } from 'lucide-react';

interface Member {
  persona: {
    id: string;
    name: string;
    fullName: string | null;
    profileImageUrl: string | null;
    role: string | null;
    status: string | null;
    age: number | null;
  };
  kpi: {
    activeUsers: number;
    totalUsers: number;
    avgAffection: number;
    totalMessages: number;
    messagesIn24h: number;
    messagesIn7d: number;
    avgMessagesPerActiveUser: number;
    lastActive: string | null;
  };
  stages: Record<string, number>;
  topScenarios: { scenarioId: string; title: string; completedCount: number }[];
  scenariosTotal: number;
}

const STAGE_ORDER = ['stranger', 'fan', 'friend', 'close', 'heart'];
const STAGE_COLORS: Record<string, string> = {
  stranger: '#cbd5e1',
  fan: '#7dd3fc',
  friend: '#86efac',
  close: '#c4b5fd',
  heart: '#f9a8d4',
};

export default function AdminLuminPage() {
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const res = await adminFetch('/api/admin/lumin/stats');
        if (res.ok) {
          const data = await res.json();
          setMembers(data.members ?? []);
        }
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  if (loading) {
    return <div className="p-12 flex justify-center"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>;
  }

  const totals = members.reduce(
    (acc, m) => ({
      activeUsers: acc.activeUsers + m.kpi.activeUsers,
      messages24h: acc.messages24h + m.kpi.messagesIn24h,
      messages7d: acc.messages7d + m.kpi.messagesIn7d,
    }),
    { activeUsers: 0, messages24h: 0, messages7d: 0 }
  );

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">LUMIN 멤버</h1>
        <p className="text-muted-foreground">7명 운영 KPI를 한눈에 봅니다.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2"><div className="text-sm text-muted-foreground">활성 유저 합계</div></CardHeader>
          <CardContent><div className="text-2xl font-bold">{totals.activeUsers.toLocaleString()}</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><div className="text-sm text-muted-foreground">24h 메시지 합계</div></CardHeader>
          <CardContent><div className="text-2xl font-bold">{totals.messages24h.toLocaleString()}</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><div className="text-sm text-muted-foreground">7일 메시지 합계</div></CardHeader>
          <CardContent><div className="text-2xl font-bold">{totals.messages7d.toLocaleString()}</div></CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {members.map((m) => {
          const stagesTotal = STAGE_ORDER.reduce((acc, s) => acc + (m.stages[s] ?? 0), 0);
          return (
            <Card key={m.persona.id}>
              <CardHeader className="pb-3">
                <div className="flex items-center gap-3">
                  {m.persona.profileImageUrl ? (
                    <img
                      src={m.persona.profileImageUrl}
                      alt={m.persona.name}
                      className="w-14 h-14 rounded-full object-cover"
                    />
                  ) : (
                    <div className="w-14 h-14 rounded-full bg-slate-200 flex items-center justify-center text-lg font-bold">
                      {m.persona.name.slice(0, 1)}
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold truncate">{m.persona.name}</div>
                    <div className="text-xs text-muted-foreground truncate">
                      {m.persona.role || m.persona.fullName || m.persona.id}
                      {m.persona.age ? ` · ${m.persona.age}세` : ''}
                    </div>
                  </div>
                  {m.persona.status === 'lab' && <Badge variant="outline">lab</Badge>}
                </div>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <div className="grid grid-cols-2 gap-2">
                  <KPI
                    icon={<UsersIcon className="w-3 h-3" />}
                    label="활성"
                    value={m.kpi.activeUsers}
                    sub={`/ ${m.kpi.totalUsers}명`}
                  />
                  <KPI
                    icon={<Heart className="w-3 h-3" />}
                    label="평균 호감도"
                    value={m.kpi.avgAffection}
                  />
                  <KPI
                    icon={<MessageSquare className="w-3 h-3" />}
                    label="24h 메시지"
                    value={m.kpi.messagesIn24h}
                  />
                  <KPI
                    icon={<MessageSquare className="w-3 h-3" />}
                    label="유저당 평균"
                    value={m.kpi.avgMessagesPerActiveUser}
                  />
                </div>

                {stagesTotal > 0 && (
                  <div>
                    <div className="text-xs text-muted-foreground mb-1">관계 단계 분포</div>
                    <div className="flex h-2 rounded overflow-hidden">
                      {STAGE_ORDER.map((s) => {
                        const count = m.stages[s] ?? 0;
                        const pct = stagesTotal > 0 ? (count / stagesTotal) * 100 : 0;
                        if (pct === 0) return null;
                        return (
                          <div
                            key={s}
                            title={`${s}: ${count}`}
                            style={{ width: `${pct}%`, backgroundColor: STAGE_COLORS[s] }}
                          />
                        );
                      })}
                    </div>
                    <div className="flex flex-wrap gap-2 text-xs text-muted-foreground mt-1">
                      {STAGE_ORDER.map((s) => (
                        <span key={s} className="flex items-center gap-1">
                          <span
                            className="w-2 h-2 rounded inline-block"
                            style={{ backgroundColor: STAGE_COLORS[s] }}
                          />
                          {s}: {m.stages[s] ?? 0}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                <div className="text-xs text-muted-foreground">
                  <BookOpen className="w-3 h-3 inline mr-1" />
                  시나리오 {m.scenariosTotal}개 발행
                  {m.kpi.lastActive && (
                    <span className="ml-2">· 마지막 대화 {format(new Date(m.kpi.lastActive), 'MM-dd HH:mm')}</span>
                  )}
                </div>

                {m.topScenarios.length > 0 && (
                  <div>
                    <div className="text-xs text-muted-foreground mb-1">인기 시나리오 Top 3</div>
                    <ul className="text-xs space-y-1">
                      {m.topScenarios.map((s) => (
                        <li key={s.scenarioId} className="flex justify-between">
                          <span className="truncate flex-1">{s.title}</span>
                          <span className="text-muted-foreground ml-2">{s.completedCount}회</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                <Link href={`/admin/personas/${m.persona.id}`}>
                  <span className="text-xs text-primary hover:underline">페르소나 편집 →</span>
                </Link>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}

function KPI({ icon, label, value, sub }: { icon: React.ReactNode; label: string; value: number; sub?: string }) {
  return (
    <div className="bg-slate-50 rounded p-2">
      <div className="text-[11px] text-muted-foreground flex items-center gap-1">{icon} {label}</div>
      <div className="font-semibold">
        {value.toLocaleString()}
        {sub && <span className="text-xs text-muted-foreground font-normal ml-1">{sub}</span>}
      </div>
    </div>
  );
}
