'use client';

import { useEffect, useState, use } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { adminFetch } from '@/lib/admin-fetch';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { format } from 'date-fns';
import { ArrowLeft, ExternalLink, Loader2 } from 'lucide-react';

interface DetailResponse {
  subscription: {
    id: string;
    user_id: string;
    stripe_subscription_id: string | null;
    stripe_customer_id: string | null;
    plan_id: string;
    planName: string;
    tier: string | null;
    monthlyUsd: number;
    status: string;
    current_period_start: string | null;
    current_period_end: string | null;
    cancel_at_period_end: boolean;
    created_at: string;
    users: {
      id: string;
      email: string | null;
      nickname: string | null;
      role: string;
      subscription_tier: string;
      tokens: number;
      created_at: string;
    } | null;
  };
  purchases: Array<{
    id: string;
    type: string;
    amount: number;
    price: number;
    currency: string;
    stripe_session_id: string | null;
    metadata: Record<string, unknown>;
    created_at: string;
  }>;
  welcomeOffer: {
    id: string;
    plan_type: string;
    paid_price: number;
    discount_percent: number;
    bonus_credits: number;
    purchased_at: string;
  } | null;
}

export default function SubscriptionDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const [data, setData] = useState<DetailResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [refunding, setRefunding] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [reason, setReason] = useState('');
  const [cancelImmediately, setCancelImmediately] = useState(true);
  const [confirmText, setConfirmText] = useState('');
  const [refundResult, setRefundResult] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      const res = await adminFetch(`/api/admin/subscriptions/${id}`);
      if (res.ok) setData(await res.json());
      setLoading(false);
    }
    load();
  }, [id]);

  async function handleRefund() {
    if (confirmText !== 'REFUND') return;
    setRefunding(true);
    try {
      const res = await adminFetch(`/api/admin/subscriptions/${id}/refund`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason, cancel_immediately: cancelImmediately }),
      });
      const result = await res.json();
      if (!res.ok) {
        setRefundResult(`실패: ${result.error}`);
      } else {
        setRefundResult(
          `환불 완료: $${(result.refundedAmountCents / 100).toFixed(2)} ` +
          `(${result.refundIds?.[0] ?? ''})${result.canceled ? ' · 즉시 해지됨' : ' · 다음 결제일에 해지'}`
        );
        setTimeout(() => router.refresh(), 2000);
      }
    } finally {
      setRefunding(false);
      setShowConfirm(false);
    }
  }

  if (loading) {
    return <div className="p-12 flex justify-center"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>;
  }
  if (!data) {
    return <div className="p-6 text-muted-foreground">구독을 찾을 수 없습니다.</div>;
  }

  const sub = data.subscription;
  const user = sub.users;
  const stripeBaseUrl = sub.stripe_subscription_id?.startsWith('sub_')
    ? `https://dashboard.stripe.com/${sub.stripe_subscription_id.startsWith('sub_test_') ? 'test/' : ''}subscriptions/${sub.stripe_subscription_id}`
    : null;

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <Link href="/admin/subscriptions" className="text-sm text-muted-foreground inline-flex items-center gap-1 mb-2">
            <ArrowLeft className="w-3 h-3" /> 구독 목록
          </Link>
          <h1 className="text-3xl font-bold tracking-tight">구독 상세</h1>
        </div>
        <div className="flex gap-2">
          {stripeBaseUrl && (
            <a href={stripeBaseUrl} target="_blank" rel="noopener noreferrer">
              <Button variant="outline" size="sm" className="gap-1">
                <ExternalLink className="w-3 h-3" /> Stripe 대시보드
              </Button>
            </a>
          )}
          {user && (
            <Link href={`/admin/users/${user.id}`}>
              <Button variant="outline" size="sm">유저 페이지</Button>
            </Link>
          )}
        </div>
      </div>

      {refundResult && (
        <Card className="border-emerald-200 bg-emerald-50">
          <CardContent className="p-4 text-sm">{refundResult}</CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardHeader><CardTitle className="text-base">구독 정보</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm">
            <Row label="플랜" value={sub.planName} />
            <Row label="티어" value={sub.tier ?? '—'} />
            <Row label="월 환산 (USD)" value={`$${sub.monthlyUsd.toFixed(2)}`} />
            <Row label="상태" value={<Badge variant="secondary">{sub.status}</Badge>} />
            <Row label="기간 시작" value={sub.current_period_start ? format(new Date(sub.current_period_start), 'yyyy-MM-dd HH:mm') : '—'} />
            <Row label="다음 결제일" value={sub.current_period_end ? format(new Date(sub.current_period_end), 'yyyy-MM-dd HH:mm') : '—'} />
            <Row label="기간 만료시 해지" value={sub.cancel_at_period_end ? '예' : '아니오'} />
            <Row label="Stripe Subscription ID" value={<code className="text-xs">{sub.stripe_subscription_id ?? '—'}</code>} />
            <Row label="Stripe Customer ID" value={<code className="text-xs">{sub.stripe_customer_id ?? '—'}</code>} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">유저 정보</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm">
            {user ? (
              <>
                <Row label="이메일" value={user.email ?? '—'} />
                <Row label="닉네임" value={user.nickname ?? '—'} />
                <Row label="users.subscription_tier" value={user.subscription_tier} />
                <Row label="토큰 잔액" value={user.tokens.toLocaleString()} />
                <Row label="가입일" value={format(new Date(user.created_at), 'yyyy-MM-dd')} />
              </>
            ) : (
              <div className="text-muted-foreground">유저를 찾을 수 없습니다.</div>
            )}
          </CardContent>
        </Card>
      </div>

      {data.welcomeOffer && (
        <Card>
          <CardHeader><CardTitle className="text-base">Welcome Offer</CardTitle></CardHeader>
          <CardContent className="text-sm space-y-2">
            <Row label="플랜" value={data.welcomeOffer.plan_type} />
            <Row label="결제 금액" value={`$${(data.welcomeOffer.paid_price / 100).toFixed(2)}`} />
            <Row label="할인율" value={`${data.welcomeOffer.discount_percent}%`} />
            <Row label="보너스 크레딧" value={data.welcomeOffer.bonus_credits.toLocaleString()} />
            <Row label="구매일" value={format(new Date(data.welcomeOffer.purchased_at), 'yyyy-MM-dd HH:mm')} />
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader><CardTitle className="text-base">최근 결제 / 환불 (최대 20건)</CardTitle></CardHeader>
        <CardContent className="p-0">
          {data.purchases.length === 0 ? (
            <div className="p-6 text-center text-muted-foreground text-sm">기록 없음</div>
          ) : (
            <table className="w-full text-sm">
              <thead className="border-b">
                <tr className="text-left text-muted-foreground">
                  <th className="px-4 py-2 font-medium">시간</th>
                  <th className="px-4 py-2 font-medium">유형</th>
                  <th className="px-4 py-2 font-medium">금액</th>
                  <th className="px-4 py-2 font-medium">통화</th>
                  <th className="px-4 py-2 font-medium">Stripe ID</th>
                </tr>
              </thead>
              <tbody>
                {data.purchases.map((p) => (
                  <tr key={p.id} className="border-b last:border-b-0">
                    <td className="px-4 py-2 text-xs text-muted-foreground">{format(new Date(p.created_at), 'yyyy-MM-dd HH:mm')}</td>
                    <td className="px-4 py-2">{p.type}</td>
                    <td className={`px-4 py-2 font-medium ${p.price < 0 ? 'text-rose-600' : ''}`}>
                      {p.price < 0 ? '-' : ''}${Math.abs(p.price).toFixed(2)}
                    </td>
                    <td className="px-4 py-2 uppercase text-xs">{p.currency}</td>
                    <td className="px-4 py-2"><code className="text-xs text-muted-foreground">{p.stripe_session_id ?? '—'}</code></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>

      <Card className="border-rose-200">
        <CardHeader>
          <CardTitle className="text-base text-rose-700">환불 / 해지</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <p className="text-muted-foreground">
            마지막 결제 invoice의 payment_intent를 환불합니다. Stripe API를 직접 호출하므로 실 결제 금액이 환불됩니다.
            STRATEGY.md의 "7일 무조건 환불" 정책 실행에 사용하세요.
          </p>

          {!showConfirm ? (
            <Button variant="destructive" onClick={() => setShowConfirm(true)} disabled={!sub.stripe_subscription_id}>
              환불 시작
            </Button>
          ) : (
            <div className="space-y-3 border rounded p-4 bg-rose-50">
              <div>
                <label className="text-xs text-muted-foreground block mb-1">사유 (필수, 메타데이터 + 내부 기록용)</label>
                <textarea
                  className="w-full border rounded px-2 py-1 text-sm"
                  rows={2}
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="예: 7일 환불 정책 / CS 요청"
                />
              </div>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={cancelImmediately}
                  onChange={(e) => setCancelImmediately(e.target.checked)}
                />
                즉시 구독 해지 (체크 해제 시 다음 결제일에 해지)
              </label>
              <div>
                <label className="text-xs text-muted-foreground block mb-1">확인을 위해 <code className="font-mono">REFUND</code>를 입력하세요</label>
                <input
                  className="w-full border rounded px-2 py-1 text-sm font-mono"
                  value={confirmText}
                  onChange={(e) => setConfirmText(e.target.value)}
                />
              </div>
              <div className="flex gap-2">
                <Button
                  variant="destructive"
                  disabled={confirmText !== 'REFUND' || !reason || refunding}
                  onClick={handleRefund}
                >
                  {refunding ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : null}
                  환불 실행
                </Button>
                <Button variant="outline" onClick={() => { setShowConfirm(false); setConfirmText(''); }}>
                  취소
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-4">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-right">{value}</span>
    </div>
  );
}
