import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { requireAdmin } from '@/lib/auth';
import { recordAdminAction } from '@/lib/admin-audit';
import { lookupPlan } from '@/lib/pricing';

const PLATFORMS = ['tiktok','instagram','youtube','x','reddit','twitch','other'];
const TIERS = ['nano','micro','mid','macro'];
const STATUSES = ['prospect','active','paused','dropped','completed'];

function service() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key);
}

export async function GET() {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;

  const admin = service();
  if (!admin) return NextResponse.json({ error: 'Service role not configured' }, { status: 500 });

  const [{ data: influencers }, { data: users }, { data: subs }] = await Promise.all([
    admin.from('influencers').select('*').order('created_at', { ascending: false }),
    admin.from('users').select('id, utm_campaign'),
    admin.from('subscriptions').select('user_id, plan_id, status').in('status', ['active','trialing']),
  ]);

  const subByUser = new Map(((subs ?? []) as { user_id: string; plan_id: string }[]).map((s) => [s.user_id, s]));
  const usersByCampaign = new Map<string, string[]>();
  for (const u of (users ?? []) as { id: string; utm_campaign: string | null }[]) {
    if (!u.utm_campaign) continue;
    if (!usersByCampaign.has(u.utm_campaign)) usersByCampaign.set(u.utm_campaign, []);
    usersByCampaign.get(u.utm_campaign)!.push(u.id);
  }

  const rows = ((influencers ?? []) as Array<{
    id: string; name: string; handle: string | null; platform: string; tier: string;
    follower_count: number | null; payout_usd: number; utm_campaign: string | null;
    contact: string | null; notes: string | null; status: string;
    seeded_at: string | null; ended_at: string | null; created_at: string;
  }>).map((inf) => {
    const userIds = inf.utm_campaign ? (usersByCampaign.get(inf.utm_campaign) ?? []) : [];
    let pass = 0, standard = 0, mrrUsd = 0;
    for (const uid of userIds) {
      const sub = subByUser.get(uid);
      if (!sub) continue;
      const plan = lookupPlan(sub.plan_id);
      if (plan?.tier === 'lumin_pass') pass += 1;
      else if (plan?.tier === 'standard') standard += 1;
      if (plan) mrrUsd += plan.monthly_usd;
    }
    return {
      ...inf,
      attribution: {
        signups: userIds.length,
        standard,
        pass,
        mrrUsd: Math.round(mrrUsd * 100) / 100,
        cacUsd: userIds.length > 0 && Number(inf.payout_usd) > 0
          ? Math.round((Number(inf.payout_usd) / userIds.length) * 100) / 100
          : 0,
        roas: Number(inf.payout_usd) > 0
          ? Math.round((mrrUsd / Number(inf.payout_usd)) * 100) / 100
          : 0,
      },
    };
  });

  const totals = rows.reduce(
    (acc, r) => ({
      payout: acc.payout + Number(r.payout_usd),
      signups: acc.signups + r.attribution.signups,
      pass: acc.pass + r.attribution.pass,
      mrr: acc.mrr + r.attribution.mrrUsd,
    }),
    { payout: 0, signups: 0, pass: 0, mrr: 0 }
  );

  return NextResponse.json({ influencers: rows, totals });
}

export async function POST(request: NextRequest) {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;

  const body = await request.json().catch(() => ({}));
  if (!body.name) return NextResponse.json({ error: 'name required' }, { status: 400 });
  if (!body.platform || !PLATFORMS.includes(body.platform)) {
    return NextResponse.json({ error: `platform must be one of ${PLATFORMS.join(', ')}` }, { status: 400 });
  }
  if (body.tier && !TIERS.includes(body.tier)) {
    return NextResponse.json({ error: `tier must be one of ${TIERS.join(', ')}` }, { status: 400 });
  }
  if (body.status && !STATUSES.includes(body.status)) {
    return NextResponse.json({ error: `status must be one of ${STATUSES.join(', ')}` }, { status: 400 });
  }

  const admin = service();
  if (!admin) return NextResponse.json({ error: 'Service role not configured' }, { status: 500 });

  const insert: Record<string, unknown> = {
    name: body.name,
    handle: body.handle ?? null,
    platform: body.platform,
    tier: body.tier ?? 'micro',
    follower_count: body.follower_count ?? null,
    payout_usd: body.payout_usd ?? 0,
    utm_campaign: body.utm_campaign ?? null,
    contact: body.contact ?? null,
    notes: body.notes ?? null,
    status: body.status ?? 'prospect',
    seeded_at: body.seeded_at ?? null,
  };

  const { data, error } = await admin.from('influencers').insert(insert).select('*').single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await recordAdminAction({
    adminUserId: guard.userId,
    adminEmail: guard.email,
    action: 'influencer_create',
    targetType: 'influencer',
    targetId: (data as { id: string }).id,
    after: data as Record<string, unknown>,
  });

  return NextResponse.json(data);
}
