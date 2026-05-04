import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth';
import { createClient } from '@/lib/supabase-server';
import { createClient as createServiceClient } from '@supabase/supabase-js';
import { stripe } from '@/lib/stripe';
import { recordAdminAction } from '@/lib/admin-audit';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;

  if (!stripe) {
    return NextResponse.json({ error: 'Stripe is not configured' }, { status: 500 });
  }

  const { id } = await params;

  const body = await request.json().catch(() => ({}));
  const reason = typeof body.reason === 'string' ? body.reason.slice(0, 500) : null;
  const cancelImmediately = body.cancel_immediately === true;

  const supabase = await createClient();

  const { data: sub, error: subError } = await supabase
    .from('subscriptions')
    .select('id, user_id, stripe_subscription_id, stripe_customer_id, plan_id, status')
    .eq('id', id)
    .single();

  if (subError || !sub || !sub.stripe_subscription_id) {
    return NextResponse.json({ error: 'Subscription not found or missing Stripe id' }, { status: 404 });
  }

  let refundedAmount = 0;
  let refundIds: string[] = [];

  try {
    const invoices = await stripe.invoices.list({
      subscription: sub.stripe_subscription_id,
      limit: 1,
      status: 'paid',
    });

    const latestInvoice = invoices.data[0];
    if (!latestInvoice) {
      return NextResponse.json({ error: 'No paid invoice found for this subscription' }, { status: 400 });
    }

    const paymentIntentId = (latestInvoice as unknown as { payment_intent?: string }).payment_intent;
    if (!paymentIntentId) {
      return NextResponse.json({ error: 'Latest invoice has no payment_intent to refund' }, { status: 400 });
    }

    const refund = await stripe.refunds.create({
      payment_intent: paymentIntentId,
      reason: 'requested_by_customer',
      metadata: {
        admin_user_id: guard.userId,
        admin_email: guard.email,
        subscription_id: sub.id,
        note: reason ?? '',
      },
    });

    refundedAmount = refund.amount ?? 0;
    refundIds.push(refund.id);

    if (cancelImmediately) {
      await stripe.subscriptions.cancel(sub.stripe_subscription_id);
    } else {
      await stripe.subscriptions.update(sub.stripe_subscription_id, {
        cancel_at_period_end: true,
      });
    }
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Stripe refund failed' },
      { status: 500 }
    );
  }

  const serviceUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (serviceUrl && serviceKey) {
    const admin = createServiceClient(serviceUrl, serviceKey);
    await admin.from('purchases').insert({
      user_id: sub.user_id,
      type: 'refund',
      amount: -refundedAmount,
      price: -(refundedAmount / 100),
      currency: 'usd',
      metadata: {
        subscription_id: sub.id,
        stripe_refund_ids: refundIds,
        admin_user_id: guard.userId,
        admin_email: guard.email,
        reason,
        cancel_immediately: cancelImmediately,
      },
    });

    await admin
      .from('subscriptions')
      .update({
        cancel_at_period_end: !cancelImmediately,
        status: cancelImmediately ? 'canceled' : sub.status,
      })
      .eq('id', sub.id);

    if (cancelImmediately) {
      await admin
        .from('users')
        .update({ is_premium: false, subscription_tier: 'free' })
        .eq('id', sub.user_id);
    }
  }

  await recordAdminAction({
    adminUserId: guard.userId,
    adminEmail: guard.email,
    action: 'refund',
    targetType: 'subscription',
    targetId: sub.id,
    reason,
    before: { status: sub.status, plan_id: sub.plan_id },
    after: { status: cancelImmediately ? 'canceled' : sub.status, cancel_at_period_end: !cancelImmediately },
    metadata: {
      stripe_refund_ids: refundIds,
      refunded_amount_cents: refundedAmount,
      stripe_subscription_id: sub.stripe_subscription_id,
      target_user_id: sub.user_id,
    },
  });

  return NextResponse.json({
    refundedAmountCents: refundedAmount,
    refundIds,
    canceled: cancelImmediately,
  });
}
