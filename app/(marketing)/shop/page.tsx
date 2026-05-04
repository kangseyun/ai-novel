'use client';

import { useState, useEffect, Suspense } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronLeft, Check } from 'lucide-react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { apiClient } from '@/lib/api-client';
import { useTranslations, useLocale, t } from '@/lib/i18n';
import analytics from '@/lib/analytics';
import { SUBSCRIPTION_PRICING, type PlanPricing } from '@/lib/pricing';

type TabType = 'subscription';

// LUMIN PASS / Standard 플랜 — pricing.ts가 단일 SoT
const SHOP_PLANS: Record<'monthly' | 'yearly', PlanPricing> = {
  monthly: SUBSCRIPTION_PRICING.lumin_pass_monthly,
  yearly: SUBSCRIPTION_PRICING.lumin_pass_yearly,
};

function ShopContent() {
  const searchParams = useSearchParams();
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'yearly'>('monthly');
  const [loading, setLoading] = useState<string | null>(null);
  const [subscription, setSubscription] = useState<{
    plan: string;
    status: string;
    currentPeriodEnd: string;
    cancelAtPeriodEnd: boolean;
  } | null>(null);
  const [isVIP, setIsVIP] = useState(false);
  const tr = useTranslations();
  const locale = useLocale();

  const canceled = searchParams.get('canceled');
  const subscriptionStatus = searchParams.get('subscription');

  // 구매/구독 완료 이벤트는 Stripe Webhook에서 서버사이드로 처리됨
  // (Meta CAPI, Mixpanel 서버사이드 전송으로 더 정확한 어트리뷰션)

  useEffect(() => {
    const loadSubscription = async () => {
      try {
        const res = await apiClient.getSubscriptionStatus().catch(() => ({ subscription: null, isActive: false }));
        setSubscription(res.subscription);
        setIsVIP(res.isActive);
      } catch (error) {
        console.error('Failed to load subscription:', error);
      }
    };
    loadSubscription();
  }, []);

  const handleSubscribe = async (cycle: 'monthly' | 'yearly') => {
    const plan = SHOP_PLANS[cycle];
    try {
      setLoading(cycle);
      analytics.trackInitiateCheckout({
        items: [{ id: plan.id, name: plan.name, price: plan.unit_amount_cents }],
        totalValue: plan.unit_amount_cents,
        currency: 'USD',
      });

      const { url } = await apiClient.subscribeToVIP(plan.id);
      if (url) window.location.href = url;
    } catch (error) {
      console.error('Subscription error:', error);
      alert(tr.shop.subscriptionInitFailed);
    } finally {
      setLoading(null);
    }
  };

  const handleCancelSubscription = async () => {
    if (!confirm(tr.shop.cancelConfirm)) return;
    try {
      setLoading('cancel');
      await apiClient.cancelSubscription();
      const res = await apiClient.getSubscriptionStatus();
      setSubscription(res.subscription);
      alert(tr.shop.cancelSuccess);
    } catch (error) {
      console.error('Cancel error:', error);
    } finally {
      setLoading(null);
    }
  };

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2
    }).format(price / 100);
  };

  const selectedPlan = SHOP_PLANS[billingCycle];

  return (
    <div className="min-h-screen bg-black text-white">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-black/95 backdrop-blur-xl border-b border-white/10">
        <div className="flex items-center justify-between px-4 py-3">
          <Link href="/" className="p-2 -ml-2 text-white/70 hover:text-white transition">
            <ChevronLeft className="w-5 h-5" />
          </Link>
          <h1 className="text-base font-medium">{tr.shop.membership}</h1>
          <div className="w-9" />
        </div>
      </header>

      <div className="px-4 py-6 pb-32 max-w-lg mx-auto">
        {/* Success/Error Messages */}
        <AnimatePresence>
          {subscriptionStatus === 'success' && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="mb-6 p-4 bg-green-500/10 border border-green-500/20 rounded-xl flex items-center gap-3"
            >
              <span className="text-green-400">✓</span>
              <p className="text-sm text-green-400">{tr.shop.proMembershipJoined}</p>
            </motion.div>
          )}
          {(canceled || subscriptionStatus === 'canceled') && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="mb-6 p-4 bg-white/5 border border-white/10 rounded-xl"
            >
              <p className="text-sm text-white/60">{tr.shop.paymentCanceled}</p>
            </motion.div>
          )}
        </AnimatePresence>

        <div>
          <div>
              {/* Current Subscription Status */}
              {isVIP && subscription && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="mb-6 p-4 bg-gradient-to-r from-violet-500/10 to-purple-500/10 border border-violet-500/20 rounded-2xl"
                >
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-violet-400 text-sm">PRO</span>
                    <span className="text-sm font-medium text-violet-300">{tr.shop.membership}</span>
                    <span className={`ml-auto text-xs px-2 py-0.5 rounded-full ${
                      subscription.cancelAtPeriodEnd
                        ? 'bg-orange-500/20 text-orange-400'
                        : 'bg-green-500/20 text-green-400'
                    }`}>
                      {subscription.cancelAtPeriodEnd ? tr.shop.expiring : tr.shop.active}
                    </span>
                  </div>
                  <p className="text-xs text-white/40 mb-3">
                    {t(tr.shop.availableUntil, { date: new Date(subscription.currentPeriodEnd).toLocaleDateString(locale === 'ko' ? 'ko-KR' : 'en-US') })}
                  </p>
                  {!subscription.cancelAtPeriodEnd && (
                    <button
                      onClick={handleCancelSubscription}
                      disabled={!!loading}
                      className="text-xs text-white/40 hover:text-red-400 transition disabled:opacity-50"
                    >
                      {loading === 'cancel' ? tr.shop.processing : tr.shop.cancelSubscription}
                    </button>
                  )}
                </motion.div>
              )}

              {/* Billing Cycle Toggle */}
              <div className="flex items-center justify-center gap-3 mb-6">
                <span className={`text-sm ${billingCycle === 'monthly' ? 'text-white' : 'text-white/40'}`}>
                  {tr.shop.monthly}
                </span>
                <button
                  onClick={() => setBillingCycle(billingCycle === 'monthly' ? 'yearly' : 'monthly')}
                  className={`relative w-14 h-7 rounded-full transition ${
                    billingCycle === 'yearly' ? 'bg-violet-500' : 'bg-white/20'
                  }`}
                >
                  <div className={`absolute top-1 w-5 h-5 bg-white rounded-full transition-all ${
                    billingCycle === 'yearly' ? 'left-8' : 'left-1'
                  }`} />
                </button>
                <span className={`text-sm ${billingCycle === 'yearly' ? 'text-white' : 'text-white/40'}`}>
                  {tr.shop.yearly}
                </span>
                {billingCycle === 'yearly' && (
                  <span className="text-xs text-green-400 bg-green-500/10 px-2 py-0.5 rounded-full">
                    {t(tr.shop.discount, { n: 17 })}
                  </span>
                )}
              </div>

              {/* Subscription Card */}
              <motion.div
                key={billingCycle}
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                className="relative p-6 bg-gradient-to-br from-violet-500/10 via-purple-500/5 to-pink-500/10 border border-violet-500/20 rounded-3xl overflow-hidden"
              >
                {/* Background decoration */}
                <div className="absolute top-0 right-0 w-32 h-32 bg-violet-500/10 rounded-full blur-3xl" />
                <div className="absolute bottom-0 left-0 w-24 h-24 bg-pink-500/10 rounded-full blur-3xl" />

                <div className="relative">
                  {/* Plan Header */}
                  <div className="flex items-start justify-between mb-6">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                          <span className="text-xs font-bold px-2 py-1 bg-violet-500/20 text-violet-400 rounded">PASS</span>
                        <h3 className="text-xl font-bold">{selectedPlan.name}</h3>
                      </div>
                      <p className="text-sm text-white/50">{selectedPlan.tagline}</p>
                    </div>
                    <div className="text-right">
                      <div className="flex items-baseline gap-1">
                        <span className="text-3xl font-bold">{formatPrice(selectedPlan.unit_amount_cents)}</span>
                      </div>
                      <p className="text-xs text-white/40">
                        {billingCycle === 'monthly' ? tr.shop.perMonth : tr.shop.perYear}
                      </p>
                      {billingCycle === 'yearly' && (
                        <p className="text-xs text-green-400 mt-1">월 ${selectedPlan.monthly_usd.toFixed(2)}</p>
                      )}
                    </div>
                  </div>

                  {/* Features */}
                  <ul className="space-y-3 mb-6">
                    {selectedPlan.features.map((feature, i) => (
                      <li key={i} className="flex items-center gap-3 text-sm text-white/70">
                        <Check className="w-4 h-4 text-violet-400 flex-shrink-0" />
                        {feature}
                      </li>
                    ))}
                  </ul>

                  {/* Subscribe Button */}
                  {isVIP ? (
                    <div className="w-full py-3.5 bg-white/10 border border-white/20 text-white rounded-xl text-sm font-semibold text-center flex items-center justify-center gap-2">
                      <Check className="w-4 h-4 text-green-400" />
                      <span>{tr.shop.subscribed}</span>
                    </div>
                  ) : (
                    <button
                      onClick={() => handleSubscribe(billingCycle)}
                      disabled={loading !== null}
                      className="w-full py-3.5 bg-gradient-to-r from-violet-500 to-purple-500 text-white rounded-xl text-sm font-semibold hover:from-violet-600 hover:to-purple-600 transition disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {loading === billingCycle ? tr.shop.processing : tr.shop.startSubscription}
                    </button>
                  )}
                </div>
              </motion.div>

              {/* Free Tier Info */}
              <div className="mt-6 p-4 bg-white/[0.02] border border-white/5 rounded-xl">
                <h4 className="text-sm font-medium mb-2">{tr.shop.freePlan}</h4>
                <ul className="space-y-1.5">
                  <li className="text-xs text-white/40 flex items-center gap-2">
                    <Check className="w-3 h-3" />
                    {tr.shop.freeEpisodes}
                  </li>
                  <li className="text-xs text-white/40 flex items-center gap-2">
                    <Check className="w-3 h-3" />
                    {tr.shop.signupCredits}
                  </li>
                </ul>
              </div>
          </div>
        </div>

        {/* Security Notice */}
        <p className="mt-8 text-center text-xs text-white/30">
          {tr.shop.paymentSecure}
        </p>
      </div>
    </div>
  );
}

function ShopPageFallback() {
  const tr = useTranslations();
  return (
    <div className="min-h-screen bg-black flex items-center justify-center">
      <div className="text-sm text-white/40">{tr.shop.loading}</div>
    </div>
  );
}

export default function ShopPage() {
  return (
    <Suspense fallback={<ShopPageFallback />}>
      <ShopContent />
    </Suspense>
  );
}
