'use client';

import { useState, useEffect, Suspense } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronLeft, Check } from 'lucide-react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { apiClient } from '@/lib/api-client';

type TabType = 'subscription' | 'credits';

// 구독 플랜 정의 (Kling AI 스타일)
const SUBSCRIPTION_PLANS = {
  monthly: {
    name: 'Pro',
    nameKr: '프로',
    price: 9900,
    interval: 'month',
    credits: 660, // 매월 지급되는 크레딧
    features: [
      '매월 660 크레딧 지급',
      '프리미엄 에피소드 무료',
      '광고 제거',
      '독점 스토리 액세스',
      '우선 고객 지원',
    ],
    popular: true,
  },
  yearly: {
    name: 'Pro',
    nameKr: '프로',
    price: 99000,
    interval: 'year',
    credits: 8000, // 연간 총 크레딧 (월 666 크레딧 + 보너스)
    features: [
      '연간 8,000 크레딧 지급',
      '프리미엄 에피소드 무료',
      '광고 제거',
      '독점 스토리 액세스',
      '우선 고객 지원',
      '신규 캐릭터 선공개',
    ],
    popular: false,
    discount: 17, // 17% 할인
  },
};

// 크레딧 패키지 정의
const CREDIT_PACKAGES = [
  { id: 'starter', credits: 100, price: 1900, bonus: 0 },
  { id: 'basic', credits: 500, price: 8900, bonus: 50 },
  { id: 'standard', credits: 1000, price: 16900, bonus: 150, popular: true },
  { id: 'pro', credits: 3000, price: 45900, bonus: 600 },
  { id: 'premium', credits: 6000, price: 85900, bonus: 1500 },
];

function ShopContent() {
  const searchParams = useSearchParams();
  const [activeTab, setActiveTab] = useState<TabType>('subscription');
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'yearly'>('monthly');
  const [loading, setLoading] = useState<string | null>(null);
  const [subscription, setSubscription] = useState<{
    plan: string;
    status: string;
    currentPeriodEnd: string;
    cancelAtPeriodEnd: boolean;
  } | null>(null);
  const [isVIP, setIsVIP] = useState(false);

  const success = searchParams.get('success');
  const credits = searchParams.get('credits') || searchParams.get('tokens');
  const canceled = searchParams.get('canceled');
  const subscriptionStatus = searchParams.get('subscription');

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

  const handlePurchaseCredits = async (packageId: string) => {
    try {
      setLoading(packageId);
      const { url } = await apiClient.purchaseTokens(packageId);
      if (url) window.location.href = url;
    } catch (error) {
      console.error('Purchase error:', error);
      alert('결제 초기화에 실패했습니다.');
    } finally {
      setLoading(null);
    }
  };

  const handleSubscribe = async (planId: string) => {
    try {
      setLoading(planId);
      const { url } = await apiClient.subscribeToVIP(planId);
      if (url) window.location.href = url;
    } catch (error) {
      console.error('Subscription error:', error);
      alert('구독 초기화에 실패했습니다.');
    } finally {
      setLoading(null);
    }
  };

  const handleCancelSubscription = async () => {
    if (!confirm('정말 구독을 취소하시겠습니까?')) return;
    try {
      setLoading('cancel');
      await apiClient.cancelSubscription();
      const res = await apiClient.getSubscriptionStatus();
      setSubscription(res.subscription);
      alert('구독이 기간 종료 시 취소됩니다.');
    } catch (error) {
      console.error('Cancel error:', error);
    } finally {
      setLoading(null);
    }
  };

  const formatPrice = (price: number) => new Intl.NumberFormat('ko-KR').format(price);

  const selectedPlan = SUBSCRIPTION_PLANS[billingCycle];

  return (
    <div className="min-h-screen bg-black text-white">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-black/95 backdrop-blur-xl border-b border-white/10">
        <div className="flex items-center justify-between px-4 py-3">
          <Link href="/" className="p-2 -ml-2 text-white/70 hover:text-white transition">
            <ChevronLeft className="w-5 h-5" />
          </Link>
          <h1 className="text-base font-medium">멤버십</h1>
          <div className="w-9" />
        </div>
      </header>

      <div className="px-4 py-6 pb-32 max-w-lg mx-auto">
        {/* Success/Error Messages */}
        <AnimatePresence>
          {success && credits && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="mb-6 p-4 bg-green-500/10 border border-green-500/20 rounded-xl flex items-center gap-3"
            >
              <span className="text-green-400">✓</span>
              <p className="text-sm text-green-400">{credits}개의 크레딧을 획득했습니다!</p>
            </motion.div>
          )}
          {subscriptionStatus === 'success' && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="mb-6 p-4 bg-green-500/10 border border-green-500/20 rounded-xl flex items-center gap-3"
            >
              <span className="text-green-400">✓</span>
              <p className="text-sm text-green-400">Pro 멤버십에 가입되었습니다!</p>
            </motion.div>
          )}
          {(canceled || subscriptionStatus === 'canceled') && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="mb-6 p-4 bg-white/5 border border-white/10 rounded-xl"
            >
              <p className="text-sm text-white/60">결제가 취소되었습니다.</p>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Tab Navigation */}
        <div className="flex bg-white/5 rounded-xl p-1 mb-6">
          <button
            onClick={() => setActiveTab('subscription')}
            className={`flex-1 py-2.5 text-sm font-medium rounded-lg transition ${
              activeTab === 'subscription'
                ? 'bg-white text-black'
                : 'text-white/60 hover:text-white'
            }`}
          >
            구독 플랜
          </button>
          <button
            onClick={() => setActiveTab('credits')}
            className={`flex-1 py-2.5 text-sm font-medium rounded-lg transition ${
              activeTab === 'credits'
                ? 'bg-white text-black'
                : 'text-white/60 hover:text-white'
            }`}
          >
            크레딧 충전
          </button>
        </div>

        <AnimatePresence mode="wait">
          {activeTab === 'subscription' ? (
            <motion.div
              key="subscription"
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 10 }}
              transition={{ duration: 0.2 }}
            >
              {/* Current Subscription Status */}
              {isVIP && subscription && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="mb-6 p-4 bg-gradient-to-r from-violet-500/10 to-purple-500/10 border border-violet-500/20 rounded-2xl"
                >
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-violet-400 text-sm">PRO</span>
                    <span className="text-sm font-medium text-violet-300">멤버십</span>
                    <span className={`ml-auto text-xs px-2 py-0.5 rounded-full ${
                      subscription.cancelAtPeriodEnd
                        ? 'bg-orange-500/20 text-orange-400'
                        : 'bg-green-500/20 text-green-400'
                    }`}>
                      {subscription.cancelAtPeriodEnd ? '만료 예정' : '활성'}
                    </span>
                  </div>
                  <p className="text-xs text-white/40 mb-3">
                    {new Date(subscription.currentPeriodEnd).toLocaleDateString('ko-KR')}까지 이용 가능
                  </p>
                  {!subscription.cancelAtPeriodEnd && (
                    <button
                      onClick={handleCancelSubscription}
                      disabled={!!loading}
                      className="text-xs text-white/40 hover:text-red-400 transition disabled:opacity-50"
                    >
                      {loading === 'cancel' ? '처리 중...' : '구독 취소'}
                    </button>
                  )}
                </motion.div>
              )}

              {/* Billing Cycle Toggle */}
              <div className="flex items-center justify-center gap-3 mb-6">
                <span className={`text-sm ${billingCycle === 'monthly' ? 'text-white' : 'text-white/40'}`}>
                  월간
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
                  연간
                </span>
                {billingCycle === 'yearly' && (
                  <span className="text-xs text-green-400 bg-green-500/10 px-2 py-0.5 rounded-full">
                    17% 할인
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
                          <span className="text-xs font-bold px-2 py-1 bg-violet-500/20 text-violet-400 rounded">PRO</span>
                        <h3 className="text-xl font-bold">{selectedPlan.name}</h3>
                      </div>
                      <p className="text-sm text-white/50">
                        {billingCycle === 'monthly' ? '월간 구독' : '연간 구독'}
                      </p>
                    </div>
                    <div className="text-right">
                      <div className="flex items-baseline gap-1">
                        <span className="text-3xl font-bold">₩{formatPrice(selectedPlan.price)}</span>
                      </div>
                      <p className="text-xs text-white/40">
                        {billingCycle === 'monthly' ? '/월' : '/년'}
                      </p>
                      {billingCycle === 'yearly' && (
                        <p className="text-xs text-green-400 mt-1">월 ₩8,250</p>
                      )}
                    </div>
                  </div>

                  {/* Credits Badge */}
                  <div className="flex items-center gap-2 p-3 bg-white/5 rounded-xl mb-5">
                    <span className="text-yellow-400 text-lg">◆</span>
                    <div>
                      <p className="text-sm font-medium">
                        {billingCycle === 'monthly' ? '매월' : '연간'} {selectedPlan.credits.toLocaleString()} 크레딧
                      </p>
                      <p className="text-xs text-white/40">
                        {billingCycle === 'monthly'
                          ? '구독 시작 시 즉시 지급'
                          : '12개월 동안 매월 분할 지급'}
                      </p>
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
                      <span>구독 중</span>
                    </div>
                  ) : (
                    <button
                      onClick={() => handleSubscribe(billingCycle)}
                      disabled={!!loading}
                      className="w-full py-3.5 bg-gradient-to-r from-violet-500 to-purple-500 text-white rounded-xl text-sm font-semibold hover:from-violet-600 hover:to-purple-600 transition disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {loading === billingCycle ? '처리 중...' : '구독 시작하기'}
                    </button>
                  )}
                </div>
              </motion.div>

              {/* Free Tier Info */}
              <div className="mt-6 p-4 bg-white/[0.02] border border-white/5 rounded-xl">
                <h4 className="text-sm font-medium mb-2">무료 플랜</h4>
                <ul className="space-y-1.5">
                  <li className="text-xs text-white/40 flex items-center gap-2">
                    <Check className="w-3 h-3" />
                    기본 에피소드 무료 이용
                  </li>
                  <li className="text-xs text-white/40 flex items-center gap-2">
                    <Check className="w-3 h-3" />
                    가입 시 100 크레딧 지급
                  </li>
                </ul>
              </div>
            </motion.div>
          ) : (
            <motion.div
              key="credits"
              initial={{ opacity: 0, x: 10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -10 }}
              transition={{ duration: 0.2 }}
            >
              {/* Credits Header */}
              <div className="text-center mb-6">
                <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-yellow-500/10 rounded-full mb-3">
                  <span className="text-yellow-400">◆</span>
                  <span className="text-sm text-yellow-400">크레딧</span>
                </div>
                <p className="text-sm text-white/50">
                  프리미엄 선택지, 에피소드 해금에 사용됩니다
                </p>
              </div>

              {/* Credit Packages Grid */}
              <div className="space-y-3">
                {CREDIT_PACKAGES.map((pkg, index) => (
                  <motion.button
                    key={pkg.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.05 }}
                    onClick={() => handlePurchaseCredits(pkg.id)}
                    disabled={!!loading}
                    className={`w-full p-4 rounded-2xl text-left transition relative overflow-hidden ${
                      pkg.popular
                        ? 'bg-gradient-to-r from-yellow-500/10 to-orange-500/10 border border-yellow-500/20'
                        : 'bg-white/[0.03] border border-white/10 hover:border-white/20'
                    } disabled:opacity-50`}
                  >
                    {pkg.popular && (
                      <span className="absolute top-3 right-3 text-[10px] font-medium px-2 py-0.5 bg-yellow-500 text-black rounded-full">
                        인기
                      </span>
                    )}

                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                          pkg.popular ? 'bg-yellow-500/20' : 'bg-white/5'
                        }`}>
                          <span className={`text-lg ${pkg.popular ? 'text-yellow-400' : 'text-white/40'}`}>◆</span>
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-lg">
                              {pkg.credits.toLocaleString()}
                            </span>
                            {pkg.bonus > 0 && (
                              <span className="text-xs text-green-400 bg-green-500/10 px-1.5 py-0.5 rounded">
                                +{pkg.bonus}
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-white/40">
                            {pkg.bonus > 0
                              ? `총 ${(pkg.credits + pkg.bonus).toLocaleString()} 크레딧`
                              : '크레딧'}
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <span className="font-bold">
                          {loading === pkg.id ? '처리 중...' : `₩${formatPrice(pkg.price)}`}
                        </span>
                        <p className="text-[10px] text-white/30">
                          ₩{(pkg.price / (pkg.credits + pkg.bonus)).toFixed(0)}/크레딧
                        </p>
                      </div>
                    </div>
                  </motion.button>
                ))}
              </div>

              {/* Pro Member Bonus */}
              <div className="mt-6 p-4 bg-gradient-to-r from-violet-500/5 to-purple-500/5 border border-violet-500/10 rounded-xl">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-xs font-bold px-1.5 py-0.5 bg-violet-500/20 text-violet-400 rounded">PRO</span>
                  <span className="text-sm font-medium text-violet-300">멤버 혜택</span>
                </div>
                <p className="text-xs text-white/40">
                  Pro 구독 시 매월 크레딧이 자동으로 지급되며, 추가 구매 시에도 보너스 크레딧을 받을 수 있습니다.
                </p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Security Notice */}
        <p className="mt-8 text-center text-xs text-white/30">
          결제는 Stripe를 통해 안전하게 처리됩니다
        </p>
      </div>
    </div>
  );
}

export default function ShopPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-sm text-white/40">로딩 중...</div>
      </div>
    }>
      <ShopContent />
    </Suspense>
  );
}
