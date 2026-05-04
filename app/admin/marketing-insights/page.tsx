'use client';

import { useEffect, useState } from 'react';
import { adminFetch } from '@/lib/admin-fetch';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Loader2, TrendingUp, AlertCircle } from 'lucide-react';

interface ChannelRow {
  source: string;
  signups: number;
  standard: number;
  pass: number;
  mrrUsd: number;
  signupRate: number;
  standardRate: number;
  passRate: number;
  spendUsd30d: number;
  cacUsd: number;
}

interface ResponseShape {
  channels: ChannelRow[];
  totals: {
    users: number;
    untracked: number;
    activePass: number;
    activeStandard: number;
    spendUsd30d: number;
  };
  untrackedShare: number;
  notes: string[];
}

const PLATFORM_COLOR: Record<string, string> = {
  tiktok: 'bg-rose-100 text-rose-700',
  twitter: 'bg-sky-100 text-sky-700',
  x: 'bg-sky-100 text-sky-700',
  youtube: 'bg-red-100 text-red-700',
  reddit: 'bg-orange-100 text-orange-700',
  instagram: 'bg-pink-100 text-pink-700',
  meta: 'bg-blue-100 text-blue-700',
  google: 'bg-emerald-100 text-emerald-700',
  influencer: 'bg-purple-100 text-purple-700',
};

export default function AdminMarketingInsightsPage() {
  const [data, setData] = useState<ResponseShape | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const res = await adminFetch('/api/admin/marketing-insights');
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
        <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
          <TrendingUp className="w-7 h-7" /> 마케팅 어트리뷰션
        </h1>
        <p className="text-muted-foreground">채널별 가입 → Standard → PASS 전환과 CAC를 추적합니다.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard label="누적 가입자" value={data.totals.users.toLocaleString()} sub="전체 유저" />
        <KpiCard label="활성 LUMIN PASS" value={data.totals.activePass.toLocaleString()} sub={`/ ${data.totals.activeStandard} Standard`} />
        <KpiCard label="30일 광고 지출" value={`$${data.totals.spendUsd30d.toLocaleString()}`} sub="marketing_campaigns 합산" />
        <KpiCard label="UTM 미추적 비율" value={`${data.untrackedShare}%`} sub={`${data.totals.untracked}명`} />
      </div>

      {data.untrackedShare > 50 && (
        <Card className="border-amber-200 bg-amber-50">
          <CardContent className="p-4 flex items-start gap-3 text-sm">
            <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
            <div>
              <div className="font-medium text-amber-800">UTM 추적률이 낮습니다 ({data.untrackedShare}% 미추적)</div>
              <div className="text-amber-700/80 mt-1">
                기존 가입자는 UTM이 없어 (untracked)로 잡히지만, 마이그레이션 026 이후 모든 신규 가입은
                자동으로 UTM이 캡처됩니다. 광고 URL에 <code>?utm_source=tiktok&utm_campaign=...</code> 형식으로
                태그하면 채널별 attribution이 채워집니다.
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>채널별 퍼널</CardTitle>
          <CardDescription>가입자 수 기준 정렬</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {data.channels.length === 0 ? (
            <div className="p-12 text-center text-muted-foreground">데이터 없음</div>
          ) : (
            <table className="w-full text-sm">
              <thead className="border-b">
                <tr className="text-left text-muted-foreground">
                  <th className="px-4 py-2 font-medium">채널 (utm_source)</th>
                  <th className="px-4 py-2 font-medium text-right">가입</th>
                  <th className="px-4 py-2 font-medium text-right">Standard</th>
                  <th className="px-4 py-2 font-medium text-right">PASS</th>
                  <th className="px-4 py-2 font-medium text-right">PASS 전환율</th>
                  <th className="px-4 py-2 font-medium text-right">MRR (USD)</th>
                  <th className="px-4 py-2 font-medium text-right">30d 지출</th>
                  <th className="px-4 py-2 font-medium text-right">CAC</th>
                </tr>
              </thead>
              <tbody>
                {data.channels.map((c) => (
                  <tr key={c.source} className="border-b last:border-b-0 hover:bg-slate-50">
                    <td className="px-4 py-2">
                      <Badge className={PLATFORM_COLOR[c.source.toLowerCase()] ?? 'bg-slate-100 text-slate-700'} variant="secondary">
                        {c.source}
                      </Badge>
                    </td>
                    <td className="px-4 py-2 text-right">{c.signups.toLocaleString()}</td>
                    <td className="px-4 py-2 text-right">{c.standard.toLocaleString()}</td>
                    <td className="px-4 py-2 text-right font-medium">{c.pass.toLocaleString()}</td>
                    <td className="px-4 py-2 text-right text-muted-foreground">{c.passRate}%</td>
                    <td className="px-4 py-2 text-right font-medium">${c.mrrUsd.toFixed(2)}</td>
                    <td className="px-4 py-2 text-right">${c.spendUsd30d.toFixed(2)}</td>
                    <td className="px-4 py-2 text-right">
                      {c.cacUsd > 0 ? `$${c.cacUsd.toFixed(2)}` : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>

      <Card className="border-slate-200 bg-slate-50">
        <CardContent className="p-4 text-xs text-muted-foreground space-y-1">
          {data.notes.map((n) => (
            <div key={n}>· {n}</div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}

function KpiCard({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{label}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
        <div className="text-xs text-muted-foreground mt-1">{sub}</div>
      </CardContent>
    </Card>
  );
}
