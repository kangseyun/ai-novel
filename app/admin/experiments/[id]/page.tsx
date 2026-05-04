'use client';

import { useEffect, useState, use } from 'react';
import Link from 'next/link';
import { adminFetch } from '@/lib/admin-fetch';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, Loader2 } from 'lucide-react';

interface VariantResult {
  variant: string;
  assigned: number;
  conversions: { event: string; converters: number; rate: number; totalEvents: number; sumValue: number }[];
}

interface ResponseShape {
  experiment: {
    id: string;
    key: string;
    name: string;
    status: string;
    variants: { name: string; weight: number }[];
    conversion_events: string[];
  };
  results: VariantResult[];
}

export default function ExperimentResultsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [data, setData] = useState<ResponseShape | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const res = await adminFetch(`/api/admin/experiments/${id}/results`);
      if (res.ok) setData(await res.json());
      setLoading(false);
    }
    load();
  }, [id]);

  if (loading) {
    return <div className="p-12 flex justify-center"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>;
  }
  if (!data) return <div className="p-6">실험을 찾을 수 없습니다.</div>;

  const events = data.experiment.conversion_events ?? [];

  return (
    <div className="p-6 space-y-6">
      <div>
        <Link href="/admin/experiments" className="text-sm text-muted-foreground inline-flex items-center gap-1 mb-2">
          <ArrowLeft className="w-3 h-3" /> 실험 목록
        </Link>
        <h1 className="text-3xl font-bold tracking-tight">{data.experiment.name}</h1>
        <div className="flex items-center gap-2 mt-2">
          <code className="bg-slate-100 px-2 py-0.5 rounded text-xs">{data.experiment.key}</code>
          <Badge variant="secondary">{data.experiment.status}</Badge>
        </div>
      </div>

      {events.length === 0 ? (
        <Card><CardContent className="p-6 text-sm text-muted-foreground">
          conversion_events가 비어 있습니다. 실험 설정에서 추적할 이벤트를 등록한 뒤 다시 보세요.
        </CardContent></Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Variant 비교</CardTitle>
            <CardDescription>각 conversion event 별 전환율</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <table className="w-full text-sm">
              <thead className="border-b">
                <tr className="text-left text-muted-foreground">
                  <th className="px-4 py-2 font-medium">Variant</th>
                  <th className="px-4 py-2 font-medium text-right">할당</th>
                  {events.map((ev) => (
                    <th key={ev} className="px-4 py-2 font-medium text-center">
                      <code className="text-xs">{ev}</code>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.results.map((r) => (
                  <tr key={r.variant} className="border-b last:border-b-0">
                    <td className="px-4 py-2 font-medium">{r.variant}</td>
                    <td className="px-4 py-2 text-right">{r.assigned.toLocaleString()}</td>
                    {events.map((ev) => {
                      const c = r.conversions.find((x) => x.event === ev);
                      if (!c) return <td key={ev} className="px-4 py-2 text-center text-muted-foreground">—</td>;
                      return (
                        <td key={ev} className="px-4 py-2 text-center">
                          <div className="font-semibold">{c.rate}%</div>
                          <div className="text-xs text-muted-foreground">{c.converters} / {r.assigned}</div>
                          {c.sumValue > 0 && (
                            <div className="text-xs text-emerald-600">합산값 {c.sumValue.toFixed(2)}</div>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}

      <Card className="border-slate-200 bg-slate-50">
        <CardContent className="p-4 text-xs text-muted-foreground space-y-1">
          <div>· Variant 할당: <code>assignVariant(userId, &apos;{data.experiment.key}&apos;)</code> 첫 호출 시 sticky 결정</div>
          <div>· 이벤트 기록: <code>recordExperimentEvent(userId, &apos;{data.experiment.key}&apos;, &apos;event_name&apos;)</code></div>
          <div>· status가 running일 때만 신규 할당이 들어갑니다.</div>
        </CardContent>
      </Card>
    </div>
  );
}
