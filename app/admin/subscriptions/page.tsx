'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { adminFetch } from '@/lib/admin-fetch';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { format } from 'date-fns';
import { Loader2, CreditCard } from 'lucide-react';

interface Sub {
  id: string;
  userId: string;
  email: string | null;
  nickname: string | null;
  planId: string;
  planName: string;
  tier: 'standard' | 'lumin_pass' | null;
  monthlyUsd: number;
  status: string;
  currentPeriodEnd: string | null;
  cancelAtPeriodEnd: boolean;
  stripeSubscriptionId: string | null;
}

const STATUS_BADGE: Record<string, string> = {
  active: 'bg-emerald-100 text-emerald-700',
  trialing: 'bg-blue-100 text-blue-700',
  past_due: 'bg-amber-100 text-amber-700',
  canceled: 'bg-slate-100 text-slate-600',
  unpaid: 'bg-rose-100 text-rose-700',
};

const TIER_BADGE: Record<string, string> = {
  lumin_pass: 'bg-purple-100 text-purple-700',
  standard: 'bg-sky-100 text-sky-700',
};

export default function AdminSubscriptionsPage() {
  const [subs, setSubs] = useState<Sub[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [tierFilter, setTierFilter] = useState<string>('');
  const [expiringFilter, setExpiringFilter] = useState<string>('');

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const params = new URLSearchParams();
        if (statusFilter) params.set('status', statusFilter);
        if (tierFilter) params.set('tier', tierFilter);
        if (expiringFilter) params.set('expiring_within_days', expiringFilter);

        const res = await adminFetch(`/api/admin/subscriptions?${params}`);
        const data = await res.json();
        setSubs(data.subscriptions ?? []);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [statusFilter, tierFilter, expiringFilter]);

  const totalActiveMrr = subs
    .filter((s) => s.status === 'active' || s.status === 'trialing')
    .reduce((acc, s) => acc + s.monthlyUsd, 0);

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">구독 관리</h1>
          <p className="text-muted-foreground">활성 구독, 만료 예정, 환불 처리를 관리합니다.</p>
        </div>
        <div className="flex items-center gap-2 text-sm">
          <CreditCard className="w-4 h-4 text-muted-foreground" />
          <span className="text-muted-foreground">필터된 활성 MRR:</span>
          <span className="font-bold">${totalActiveMrr.toLocaleString(undefined, { maximumFractionDigits: 2 })}</span>
        </div>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">필터</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-3">
          <select
            className="border rounded px-3 py-1.5 text-sm bg-white"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="">상태: 전체</option>
            <option value="active">active</option>
            <option value="trialing">trialing</option>
            <option value="past_due">past_due</option>
            <option value="canceled">canceled</option>
            <option value="unpaid">unpaid</option>
          </select>
          <select
            className="border rounded px-3 py-1.5 text-sm bg-white"
            value={tierFilter}
            onChange={(e) => setTierFilter(e.target.value)}
          >
            <option value="">티어: 전체</option>
            <option value="lumin_pass">LUMIN PASS</option>
            <option value="standard">Standard</option>
          </select>
          <select
            className="border rounded px-3 py-1.5 text-sm bg-white"
            value={expiringFilter}
            onChange={(e) => setExpiringFilter(e.target.value)}
          >
            <option value="">만료 임박: 전체</option>
            <option value="7">7일 이내</option>
            <option value="14">14일 이내</option>
            <option value="30">30일 이내</option>
          </select>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-12 flex justify-center"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
          ) : subs.length === 0 ? (
            <div className="p-12 text-center text-muted-foreground">조건에 맞는 구독이 없습니다.</div>
          ) : (
            <table className="w-full text-sm">
              <thead className="border-b">
                <tr className="text-left text-muted-foreground">
                  <th className="px-4 py-3 font-medium">유저</th>
                  <th className="px-4 py-3 font-medium">티어</th>
                  <th className="px-4 py-3 font-medium">플랜</th>
                  <th className="px-4 py-3 font-medium">상태</th>
                  <th className="px-4 py-3 font-medium">MRR (USD)</th>
                  <th className="px-4 py-3 font-medium">다음 결제일</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody>
                {subs.map((s) => (
                  <tr key={s.id} className="border-b last:border-b-0 hover:bg-slate-50">
                    <td className="px-4 py-3">
                      <div className="font-medium">{s.nickname || s.email || s.userId.slice(0, 8)}</div>
                      <div className="text-xs text-muted-foreground">{s.email}</div>
                    </td>
                    <td className="px-4 py-3">
                      {s.tier ? (
                        <Badge className={TIER_BADGE[s.tier] ?? ''} variant="secondary">
                          {s.tier === 'lumin_pass' ? 'PASS' : 'Standard'}
                        </Badge>
                      ) : (
                        <span className="text-xs text-muted-foreground">unknown</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">{s.planName}</td>
                    <td className="px-4 py-3">
                      <Badge className={STATUS_BADGE[s.status] ?? ''} variant="secondary">{s.status}</Badge>
                      {s.cancelAtPeriodEnd && (
                        <span className="ml-2 text-xs text-amber-600">cancel@period_end</span>
                      )}
                    </td>
                    <td className="px-4 py-3 font-medium">${s.monthlyUsd.toFixed(2)}</td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {s.currentPeriodEnd ? format(new Date(s.currentPeriodEnd), 'yyyy-MM-dd') : '—'}
                    </td>
                    <td className="px-4 py-3">
                      <Link href={`/admin/subscriptions/${s.id}`}>
                        <Button variant="outline" size="sm">상세</Button>
                      </Link>
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
