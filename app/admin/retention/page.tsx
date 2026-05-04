'use client';

import { useEffect, useState } from 'react';
import { adminFetch } from '@/lib/admin-fetch';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Loader2 } from 'lucide-react';

interface CohortRow {
  week: string;
  size: number;
  d1: number; d1Pct: number;
  d7: number; d7Pct: number;
  d30: number; d30Pct: number;
}

interface ResponseShape {
  windowDays: number;
  cohorts: CohortRow[];
  overall: { size: number; d1: number; d1Pct: number; d7: number; d7Pct: number; d30: number; d30Pct: number };
  targets: number[];
  note: string;
}

const STRATEGY_TARGETS = { d1: 50, d7: 25, d30: 15 };

function colorForPct(pct: number, target: number): string {
  if (pct === 0) return 'bg-slate-50 text-slate-400';
  if (pct >= target) return 'bg-emerald-100 text-emerald-700';
  if (pct >= target * 0.7) return 'bg-amber-100 text-amber-700';
  return 'bg-rose-100 text-rose-700';
}

export default function AdminRetentionPage() {
  const [data, setData] = useState<ResponseShape | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const res = await adminFetch('/api/admin/retention');
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

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">코호트 리텐션</h1>
        <p className="text-muted-foreground">
          최근 {data.windowDays}일 가입 코호트의 D1 / D7 / D30 잔존율.
          STRATEGY.md 목표: D1 50% / D7 25% / D30 15%.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <KpiCard label="총 신규 가입" value={data.overall.size.toLocaleString()} />
        <KpiCard
          label="평균 D1"
          value={`${data.overall.d1Pct}%`}
          target={STRATEGY_TARGETS.d1}
          actual={data.overall.d1Pct}
        />
        <KpiCard
          label="평균 D7"
          value={`${data.overall.d7Pct}%`}
          target={STRATEGY_TARGETS.d7}
          actual={data.overall.d7Pct}
        />
        <KpiCard
          label="평균 D30"
          value={`${data.overall.d30Pct}%`}
          target={STRATEGY_TARGETS.d30}
          actual={data.overall.d30Pct}
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>주별 코호트 (히트맵)</CardTitle>
          <CardDescription>
            셀 색깔: <span className="text-emerald-600 font-medium">목표 달성</span> ·
            <span className="text-amber-600 font-medium ml-1">목표의 70% 이상</span> ·
            <span className="text-rose-600 font-medium ml-1">미달</span>
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {data.cohorts.length === 0 ? (
            <div className="p-12 text-center text-muted-foreground">아직 코호트가 형성되지 않았습니다.</div>
          ) : (
            <table className="w-full text-sm">
              <thead className="border-b">
                <tr className="text-left text-muted-foreground">
                  <th className="px-4 py-2 font-medium">코호트 시작 (월요일)</th>
                  <th className="px-4 py-2 font-medium text-right">크기</th>
                  <th className="px-4 py-2 font-medium text-center">D1</th>
                  <th className="px-4 py-2 font-medium text-center">D7</th>
                  <th className="px-4 py-2 font-medium text-center">D30</th>
                </tr>
              </thead>
              <tbody>
                {data.cohorts.map((c) => (
                  <tr key={c.week} className="border-b last:border-b-0">
                    <td className="px-4 py-2 text-xs">{c.week}</td>
                    <td className="px-4 py-2 text-right">{c.size.toLocaleString()}</td>
                    <td className="px-4 py-2 text-center">
                      <Cell pct={c.d1Pct} count={c.d1} target={STRATEGY_TARGETS.d1} />
                    </td>
                    <td className="px-4 py-2 text-center">
                      <Cell pct={c.d7Pct} count={c.d7} target={STRATEGY_TARGETS.d7} />
                    </td>
                    <td className="px-4 py-2 text-center">
                      <Cell pct={c.d30Pct} count={c.d30} target={STRATEGY_TARGETS.d30} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>

      <Card className="border-slate-200 bg-slate-50">
        <CardContent className="p-3 text-xs text-muted-foreground">{data.note}</CardContent>
      </Card>
    </div>
  );
}

function Cell({ pct, count, target }: { pct: number; count: number; target: number }) {
  const color = colorForPct(pct, target);
  return (
    <div className={`inline-flex flex-col items-center px-3 py-1 rounded ${color}`}>
      <span className="font-semibold">{pct}%</span>
      <span className="text-[10px] opacity-70">{count}명</span>
    </div>
  );
}

function KpiCard({ label, value, target, actual }: { label: string; value: string; target?: number; actual?: number }) {
  const onTarget = target !== undefined && actual !== undefined && actual >= target;
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{label}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className={`text-2xl font-bold ${onTarget ? 'text-emerald-600' : ''}`}>{value}</div>
        {target !== undefined && (
          <div className="text-xs text-muted-foreground mt-1">목표 {target}%</div>
        )}
      </CardContent>
    </Card>
  );
}
