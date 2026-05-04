'use client';

import { useEffect, useState, useCallback } from 'react';
import { adminFetch } from '@/lib/admin-fetch';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Loader2, Plus, Trash2, ExternalLink } from 'lucide-react';

interface Influencer {
  id: string;
  name: string;
  handle: string | null;
  platform: string;
  tier: string;
  follower_count: number | null;
  payout_usd: number;
  utm_campaign: string | null;
  contact: string | null;
  notes: string | null;
  status: string;
  seeded_at: string | null;
  attribution: {
    signups: number;
    standard: number;
    pass: number;
    mrrUsd: number;
    cacUsd: number;
    roas: number;
  };
}

interface ResponseShape {
  influencers: Influencer[];
  totals: { payout: number; signups: number; pass: number; mrr: number };
}

const PLATFORM_COLOR: Record<string, string> = {
  tiktok: 'bg-rose-100 text-rose-700',
  instagram: 'bg-pink-100 text-pink-700',
  youtube: 'bg-red-100 text-red-700',
  x: 'bg-sky-100 text-sky-700',
  reddit: 'bg-orange-100 text-orange-700',
  twitch: 'bg-purple-100 text-purple-700',
  other: 'bg-slate-100 text-slate-700',
};

const STATUS_COLOR: Record<string, string> = {
  prospect: 'bg-slate-100 text-slate-700',
  active: 'bg-emerald-100 text-emerald-700',
  paused: 'bg-amber-100 text-amber-700',
  dropped: 'bg-rose-100 text-rose-700',
  completed: 'bg-blue-100 text-blue-700',
};

export default function AdminInfluencersPage() {
  const [data, setData] = useState<ResponseShape | null>(null);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await adminFetch('/api/admin/influencers');
      if (res.ok) setData(await res.json());
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function deleteInfluencer(id: string) {
    if (!confirm('인플루언서를 삭제할까요?')) return;
    await adminFetch(`/api/admin/influencers/${id}`, { method: 'DELETE' });
    load();
  }

  async function patchStatus(id: string, status: string) {
    await adminFetch(`/api/admin/influencers/${id}`, {
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
          <h1 className="text-3xl font-bold tracking-tight">인플루언서 시딩</h1>
          <p className="text-muted-foreground">
            UTM 캠페인 태그로 자동 어트리뷰션. STRATEGY.md 기준 5–10명 @ $300–1000 페이아웃.
          </p>
        </div>
        <Button onClick={() => setShowForm((v) => !v)}>
          <Plus className="w-4 h-4 mr-1" /> 인플루언서 추가
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <KpiCard label="총 페이아웃" value={`$${(data?.totals.payout ?? 0).toLocaleString()}`} />
        <KpiCard label="유입 가입" value={(data?.totals.signups ?? 0).toLocaleString()} />
        <KpiCard label="PASS 전환" value={(data?.totals.pass ?? 0).toLocaleString()} />
        <KpiCard label="누적 MRR" value={`$${(data?.totals.mrr ?? 0).toLocaleString(undefined, { maximumFractionDigits: 2 })}`} />
      </div>

      {showForm && <CreateForm onCreated={() => { setShowForm(false); load(); }} />}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">인플루언서 목록</CardTitle>
          <CardDescription>utm_campaign이 매칭되면 자동으로 가입 + PASS + CAC + ROAS 계산</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-12 flex justify-center"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
          ) : !data || data.influencers.length === 0 ? (
            <div className="p-12 text-center text-muted-foreground">아직 인플루언서가 없습니다.</div>
          ) : (
            <table className="w-full text-sm">
              <thead className="border-b">
                <tr className="text-left text-muted-foreground">
                  <th className="px-4 py-2 font-medium">이름</th>
                  <th className="px-4 py-2 font-medium">플랫폼</th>
                  <th className="px-4 py-2 font-medium">UTM</th>
                  <th className="px-4 py-2 font-medium text-right">페이아웃</th>
                  <th className="px-4 py-2 font-medium text-right">가입</th>
                  <th className="px-4 py-2 font-medium text-right">PASS</th>
                  <th className="px-4 py-2 font-medium text-right">CAC</th>
                  <th className="px-4 py-2 font-medium text-right">MRR</th>
                  <th className="px-4 py-2 font-medium text-right">ROAS</th>
                  <th className="px-4 py-2 font-medium">상태</th>
                  <th className="px-4 py-2"></th>
                </tr>
              </thead>
              <tbody>
                {data.influencers.map((i) => (
                  <tr key={i.id} className="border-b last:border-b-0 hover:bg-slate-50">
                    <td className="px-4 py-2">
                      <div className="font-medium">{i.name}</div>
                      <div className="text-xs text-muted-foreground">
                        {i.handle ?? '—'}
                        {i.follower_count && <span className="ml-1">· {(i.follower_count / 1000).toFixed(0)}k</span>}
                      </div>
                    </td>
                    <td className="px-4 py-2">
                      <Badge className={PLATFORM_COLOR[i.platform] ?? ''} variant="secondary">{i.platform}</Badge>
                      <div className="text-xs text-muted-foreground mt-1">{i.tier}</div>
                    </td>
                    <td className="px-4 py-2"><code className="text-xs">{i.utm_campaign ?? '—'}</code></td>
                    <td className="px-4 py-2 text-right">${Number(i.payout_usd).toFixed(2)}</td>
                    <td className="px-4 py-2 text-right">{i.attribution.signups}</td>
                    <td className="px-4 py-2 text-right font-medium">{i.attribution.pass}</td>
                    <td className="px-4 py-2 text-right text-muted-foreground">
                      {i.attribution.cacUsd > 0 ? `$${i.attribution.cacUsd}` : '—'}
                    </td>
                    <td className="px-4 py-2 text-right">${i.attribution.mrrUsd.toFixed(2)}</td>
                    <td className="px-4 py-2 text-right">
                      {i.attribution.roas > 0 ? <span className={i.attribution.roas >= 1 ? 'text-emerald-600' : 'text-rose-600'}>{i.attribution.roas}x</span> : '—'}
                    </td>
                    <td className="px-4 py-2">
                      <select
                        className="border rounded px-2 py-1 text-xs bg-white"
                        value={i.status}
                        onChange={(e) => patchStatus(i.id, e.target.value)}
                      >
                        <option value="prospect">prospect</option>
                        <option value="active">active</option>
                        <option value="paused">paused</option>
                        <option value="completed">completed</option>
                        <option value="dropped">dropped</option>
                      </select>
                    </td>
                    <td className="px-4 py-2">
                      <Button variant="ghost" size="icon" onClick={() => deleteInfluencer(i.id)}>
                        <Trash2 className="w-4 h-4 text-rose-500" />
                      </Button>
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

function KpiCard({ label, value }: { label: string; value: string | number }) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{label}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
      </CardContent>
    </Card>
  );
}

function CreateForm({ onCreated }: { onCreated: () => void }) {
  const [name, setName] = useState('');
  const [handle, setHandle] = useState('');
  const [platform, setPlatform] = useState('tiktok');
  const [tier, setTier] = useState('micro');
  const [followers, setFollowers] = useState('');
  const [payout, setPayout] = useState('');
  const [utmCampaign, setUtmCampaign] = useState('');
  const [contact, setContact] = useState('');
  const [notes, setNotes] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function submit() {
    setBusy(true);
    setErr(null);
    try {
      const body = {
        name, handle: handle || null, platform, tier,
        follower_count: followers ? parseInt(followers, 10) : null,
        payout_usd: payout ? Number(payout) : 0,
        utm_campaign: utmCampaign || null,
        contact: contact || null,
        notes: notes || null,
      };
      const res = await adminFetch('/api/admin/influencers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const data = await res.json();
        setErr(data.error ?? '실패');
      } else {
        onCreated();
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card className="border-emerald-200 bg-emerald-50/40">
      <CardHeader><CardTitle className="text-base">새 인플루언서</CardTitle></CardHeader>
      <CardContent className="space-y-3 text-sm">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
          <Input placeholder="이름 *" value={name} onChange={(e) => setName(e.target.value)} />
          <Input placeholder="@핸들" value={handle} onChange={(e) => setHandle(e.target.value)} />
          <select className="border rounded px-3 py-1.5 text-sm bg-white" value={platform} onChange={(e) => setPlatform(e.target.value)}>
            <option value="tiktok">TikTok</option>
            <option value="instagram">Instagram</option>
            <option value="youtube">YouTube</option>
            <option value="x">X (Twitter)</option>
            <option value="reddit">Reddit</option>
            <option value="twitch">Twitch</option>
            <option value="other">기타</option>
          </select>
          <select className="border rounded px-3 py-1.5 text-sm bg-white" value={tier} onChange={(e) => setTier(e.target.value)}>
            <option value="nano">nano (~1k)</option>
            <option value="micro">micro (1k–100k)</option>
            <option value="mid">mid (100k–1M)</option>
            <option value="macro">macro (1M+)</option>
          </select>
          <Input placeholder="팔로워 수" type="number" value={followers} onChange={(e) => setFollowers(e.target.value)} />
          <Input placeholder="페이아웃 (USD)" type="number" step="0.01" value={payout} onChange={(e) => setPayout(e.target.value)} />
          <Input placeholder="utm_campaign 태그 (예: tt_micro_haeon_jan)" value={utmCampaign} onChange={(e) => setUtmCampaign(e.target.value)} />
          <Input placeholder="연락처 (이메일/DM)" value={contact} onChange={(e) => setContact(e.target.value)} />
        </div>
        <Input placeholder="메모" value={notes} onChange={(e) => setNotes(e.target.value)} />
        {err && <div className="text-sm text-rose-600">{err}</div>}
        <Button onClick={submit} disabled={busy || !name}>
          {busy ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : null} 추가
        </Button>
      </CardContent>
    </Card>
  );
}
