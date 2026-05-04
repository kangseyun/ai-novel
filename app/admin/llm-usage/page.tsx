'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { adminFetch } from '@/lib/admin-fetch';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Loader2, DollarSign, Activity, Users as UsersIcon, Cpu } from 'lucide-react';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip } from 'recharts';

interface Summary {
  todayCostUsd: number;
  monthCostUsd: number;
  thirtyDayCostUsd: number;
  thirtyDayCalls: number;
  avgCostPerCall: number;
}

interface DailyPoint {
  date: string;
  cost: number;
  calls: number;
  tokens: number;
}

interface TopUser {
  user_id: string;
  cost: number;
  calls: number;
  tokens: number;
  email: string | null;
  nickname: string | null;
  subscriptionTier: string;
}

interface ModelRow {
  model_id: string;
  cost: number;
  calls: number;
  tokens: number;
}

interface TaskRow {
  task_type: string;
  cost: number;
  calls: number;
}

interface Response {
  summary: Summary;
  daily: DailyPoint[];
  topUsers: TopUser[];
  models: ModelRow[];
  tasks: TaskRow[];
}

export default function AdminLlmUsagePage() {
  const [data, setData] = useState<Response | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const res = await adminFetch('/api/admin/llm-usage');
        if (res.ok) setData(await res.json());
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  if (loading) {
    return <div className="p-12 flex justify-center"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>;
  }
  if (!data) {
    return <div className="p-6 text-muted-foreground">데이터를 불러올 수 없습니다.</div>;
  }

  const s = data.summary;

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">LLM 사용량 / 비용</h1>
        <p className="text-muted-foreground">최근 30일 OpenRouter 호출 비용과 헤비 유저를 모니터링합니다.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard icon={<DollarSign className="w-4 h-4" />} label="오늘 비용 (USD)" value={`$${s.todayCostUsd.toFixed(4)}`} />
        <KpiCard icon={<DollarSign className="w-4 h-4" />} label="이번 달 누적 (USD)" value={`$${s.monthCostUsd.toFixed(4)}`} />
        <KpiCard icon={<Activity className="w-4 h-4" />} label="30일 호출 수" value={s.thirtyDayCalls.toLocaleString()} />
        <KpiCard icon={<Cpu className="w-4 h-4" />} label="평균 호출당 (USD)" value={`$${s.avgCostPerCall.toFixed(6)}`} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>일별 비용 추이 (최근 30일)</CardTitle>
          <CardDescription>USD · 모든 모델 합산</CardDescription>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={data.daily}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="date" stroke="#888" fontSize={11} tickFormatter={(v: string) => v.slice(5)} />
              <YAxis stroke="#888" fontSize={11} tickFormatter={(v: number) => `$${v.toFixed(2)}`} />
              <Tooltip
                contentStyle={{ borderRadius: 8, border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                formatter={(value: number, name: string) => name === 'cost' ? [`$${value.toFixed(4)}`, '비용'] : [value, name]}
              />
              <Bar dataKey="cost" fill="#8b5cf6" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><UsersIcon className="w-4 h-4" /> 헤비 유저 Top 20 (30일)</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {data.topUsers.length === 0 ? (
              <div className="p-6 text-center text-muted-foreground text-sm">기록 없음</div>
            ) : (
              <table className="w-full text-sm">
                <thead className="border-b">
                  <tr className="text-left text-muted-foreground">
                    <th className="px-4 py-2 font-medium">유저</th>
                    <th className="px-4 py-2 font-medium">티어</th>
                    <th className="px-4 py-2 font-medium text-right">호출</th>
                    <th className="px-4 py-2 font-medium text-right">토큰</th>
                    <th className="px-4 py-2 font-medium text-right">USD</th>
                  </tr>
                </thead>
                <tbody>
                  {data.topUsers.map((u) => (
                    <tr key={u.user_id} className="border-b last:border-b-0 hover:bg-slate-50">
                      <td className="px-4 py-2">
                        <Link href={`/admin/users/${u.user_id}`} className="hover:underline">
                          <div className="font-medium">{u.nickname || u.email || u.user_id.slice(0, 8)}</div>
                          <div className="text-xs text-muted-foreground">{u.email}</div>
                        </Link>
                      </td>
                      <td className="px-4 py-2 text-xs">{u.subscriptionTier}</td>
                      <td className="px-4 py-2 text-right">{u.calls.toLocaleString()}</td>
                      <td className="px-4 py-2 text-right">{u.tokens.toLocaleString()}</td>
                      <td className="px-4 py-2 text-right font-medium">${u.cost.toFixed(4)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Cpu className="w-4 h-4" /> 모델별 비용 (30일)</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {data.models.length === 0 ? (
              <div className="p-6 text-center text-muted-foreground text-sm">기록 없음</div>
            ) : (
              <table className="w-full text-sm">
                <thead className="border-b">
                  <tr className="text-left text-muted-foreground">
                    <th className="px-4 py-2 font-medium">모델</th>
                    <th className="px-4 py-2 font-medium text-right">호출</th>
                    <th className="px-4 py-2 font-medium text-right">USD</th>
                    <th className="px-4 py-2 font-medium text-right">비중</th>
                  </tr>
                </thead>
                <tbody>
                  {data.models.map((m) => {
                    const pct = s.thirtyDayCostUsd > 0 ? (m.cost / s.thirtyDayCostUsd) * 100 : 0;
                    return (
                      <tr key={m.model_id} className="border-b last:border-b-0">
                        <td className="px-4 py-2 font-mono text-xs">{m.model_id}</td>
                        <td className="px-4 py-2 text-right">{m.calls.toLocaleString()}</td>
                        <td className="px-4 py-2 text-right font-medium">${m.cost.toFixed(4)}</td>
                        <td className="px-4 py-2 text-right text-muted-foreground">{pct.toFixed(1)}%</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Task별 비용 (30일)</CardTitle>
          <CardDescription>호출이 어디서 발생하는지 (chat / scenario / memory 등)</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {data.tasks.length === 0 ? (
            <div className="p-6 text-center text-muted-foreground text-sm">기록 없음</div>
          ) : (
            <table className="w-full text-sm">
              <thead className="border-b">
                <tr className="text-left text-muted-foreground">
                  <th className="px-4 py-2 font-medium">Task Type</th>
                  <th className="px-4 py-2 font-medium text-right">호출</th>
                  <th className="px-4 py-2 font-medium text-right">USD</th>
                </tr>
              </thead>
              <tbody>
                {data.tasks.map((t) => (
                  <tr key={t.task_type} className="border-b last:border-b-0">
                    <td className="px-4 py-2">{t.task_type}</td>
                    <td className="px-4 py-2 text-right">{t.calls.toLocaleString()}</td>
                    <td className="px-4 py-2 text-right font-medium">${t.cost.toFixed(4)}</td>
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

function KpiCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{label}</CardTitle>
        <div className="text-muted-foreground">{icon}</div>
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
      </CardContent>
    </Card>
  );
}
