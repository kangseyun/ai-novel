'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { adminFetch } from '@/lib/admin-fetch';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Loader2, ArrowLeft } from 'lucide-react';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from 'recharts';

interface AnalyticsResponse {
  funnel: {
    total: number;
    onboarded: number;
    followsDone: number;
    dmStarted: number;
    onboardedRate: number;
    followsRate: number;
    dmStartedRate: number;
  };
  last30d: {
    total: number;
    onboarded: number;
    followsDone: number;
    onboardedRate: number;
    followsRate: number;
  };
  daily: { date: string; signups: number; onboarded: number; followsDone: number }[];
  stuckCount: number;
}

export default function OnboardingAnalyticsPage() {
  const [data, setData] = useState<AnalyticsResponse | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const res = await adminFetch('/api/admin/onboarding/analytics');
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
        <Link href="/admin/onboarding" className="text-sm text-muted-foreground inline-flex items-center gap-1 mb-2">
          <ArrowLeft className="w-3 h-3" /> 온보딩 빌더
        </Link>
        <h1 className="text-3xl font-bold tracking-tight">온보딩 퍼널 분석</h1>
        <p className="text-muted-foreground">가입 → 온보딩 완료 → 초기 팔로우 → 첫 DM 시작 단계별 통과율.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>전체 누적 퍼널</CardTitle>
          <CardDescription>모든 가입 유저 기준</CardDescription>
        </CardHeader>
        <CardContent>
          <FunnelChart total={data.funnel.total} steps={[
            { label: '가입', count: data.funnel.total, rate: 100 },
            { label: '온보딩 완료', count: data.funnel.onboarded, rate: data.funnel.onboardedRate },
            { label: '초기 팔로우 완료', count: data.funnel.followsDone, rate: data.funnel.followsRate },
            { label: '첫 DM 시작', count: data.funnel.dmStarted, rate: data.funnel.dmStartedRate },
          ]} />
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>최근 30일 신규 가입</CardTitle>
            <CardDescription>{data.last30d.total}명 중 온보딩 {data.last30d.onboarded}명 ({data.last30d.onboardedRate}%) · 팔로우 {data.last30d.followsDone}명 ({data.last30d.followsRate}%)</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={data.daily}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="date" stroke="#888" fontSize={11} tickFormatter={(v: string) => v.slice(5)} />
                <YAxis stroke="#888" fontSize={11} />
                <Tooltip contentStyle={{ borderRadius: 8, border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }} />
                <Legend />
                <Bar dataKey="signups" fill="#cbd5e1" name="가입" />
                <Bar dataKey="onboarded" fill="#86efac" name="온보딩 완료" />
                <Bar dataKey="followsDone" fill="#7dd3fc" name="팔로우 완료" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>막힌 유저</CardTitle>
            <CardDescription>가입 후 24시간이 지나도 온보딩 미완료</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-4xl font-bold text-rose-600">{data.stuckCount}</div>
            <p className="text-sm text-muted-foreground mt-2">
              온보딩 단계 자체에 친화도 문제가 있을 수 있어요. ARCHITECTURE.md 7장 "튜토리얼 완성도 20%" 참고.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function FunnelChart({ steps }: { total: number; steps: { label: string; count: number; rate: number }[] }) {
  const max = Math.max(...steps.map((s) => s.count), 1);
  return (
    <div className="space-y-3">
      {steps.map((s, i) => {
        const width = Math.max(2, (s.count / max) * 100);
        const dropFromPrev = i === 0 ? null : steps[i - 1].count > 0 ? Math.round(((s.count / steps[i - 1].count) * 100) * 10) / 10 : 0;
        return (
          <div key={s.label}>
            <div className="flex items-center justify-between text-sm mb-1">
              <span className="font-medium">{s.label}</span>
              <span className="text-muted-foreground text-xs">
                {s.count.toLocaleString()}명 · 전체 {s.rate}%
                {dropFromPrev !== null && (
                  <span className="ml-2 text-rose-500">↓ 이전 단계 대비 {dropFromPrev}%</span>
                )}
              </span>
            </div>
            <div className="h-7 bg-slate-100 rounded">
              <div
                className="h-full rounded bg-gradient-to-r from-purple-500 to-pink-500 flex items-center px-3 text-xs text-white font-medium"
                style={{ width: `${width}%`, minWidth: '40px' }}
              >
                {s.rate}%
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
