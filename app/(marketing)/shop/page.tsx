'use client';

import { useState, Suspense } from 'react';
import { motion } from 'framer-motion';
import { ChevronLeft, Check } from 'lucide-react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';

function ShopContent() {
  const searchParams = useSearchParams();
  const [loading, setLoading] = useState<string | null>(null);
  const success = searchParams.get('success');
  const canceled = searchParams.get('canceled');

  const handleCheckout = async (planType: string, priceId?: string, mode: 'payment' | 'subscription' = 'payment') => {
    try {
      setLoading(planType);

      const response = await fetch('/api/checkout', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          planName: planType,
          priceId,
          mode,
        }),
      });

      const data = await response.json();

      if (data.url) {
        window.location.href = data.url;
      } else {
        console.error('Checkout error:', data.error);
        alert('결제 초기화 실패: ' + (data.error || 'Unknown error'));
      }
    } catch (error) {
      console.error('Checkout error:', error);
      alert('오류가 발생했습니다. 다시 시도해주세요.');
    } finally {
      setLoading(null);
    }
  };

  return (
    <div className="min-h-screen bg-black text-white">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-black/95 backdrop-blur-xl border-b border-white/10">
        <div className="flex items-center justify-between px-4 py-3">
          <Link href="/" className="p-2 -ml-2 text-white/70 hover:text-white transition">
            <ChevronLeft className="w-5 h-5" />
          </Link>
          <h1 className="text-base font-medium">구독</h1>
          <div className="w-9" />
        </div>
      </header>

      <div className="px-4 py-6 pb-32">
        {/* Success/Error Messages */}
        {success && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-6 p-4 bg-green-500/10 border border-green-500/20 rounded-xl"
          >
            <p className="text-sm text-green-400">결제가 완료되었습니다.</p>
          </motion.div>
        )}
        {canceled && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-6 p-4 bg-white/5 border border-white/10 rounded-xl"
          >
            <p className="text-sm text-white/60">결제가 취소되었습니다.</p>
          </motion.div>
        )}

        {/* Hero */}
        <div className="mb-8 text-center">
          <h2 className="text-2xl font-bold mb-2">Premium</h2>
          <p className="text-sm text-white/50">
            더 깊은 스토리를 경험하세요
          </p>
        </div>

        {/* Plans */}
        <div className="space-y-3">
          {/* Plan 1: Basic */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="p-5 bg-white/[0.03] border border-white/10 rounded-2xl hover:border-white/20 transition"
          >
            <div className="flex items-start justify-between mb-4">
              <div>
                <h3 className="font-medium text-white">Starter</h3>
                <p className="text-xs text-white/40 mt-0.5">1회 결제</p>
              </div>
              <div className="text-right">
                <span className="text-xl font-bold">$4.99</span>
              </div>
            </div>

            <ul className="space-y-2 mb-5">
              {['500 크레딧', '광고 24시간 제거', '시나리오 1개 해금'].map((item, i) => (
                <li key={i} className="flex items-center gap-2 text-sm text-white/60">
                  <Check className="w-4 h-4 text-white/30" />
                  {item}
                </li>
              ))}
            </ul>

            <button
              onClick={() => handleCheckout('starter', undefined, 'payment')}
              disabled={!!loading}
              className="w-full py-3 bg-white/10 rounded-xl text-sm font-medium hover:bg-white/15 transition disabled:opacity-50"
            >
              {loading === 'starter' ? '처리 중...' : '구매하기'}
            </button>
          </motion.div>

          {/* Plan 2: Pro - Recommended */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 }}
            className="p-5 bg-white/[0.03] border border-white/20 rounded-2xl relative"
          >
            <div className="absolute -top-2.5 left-4">
              <span className="px-2 py-0.5 bg-white text-black text-[10px] font-medium rounded-full">
                추천
              </span>
            </div>

            <div className="flex items-start justify-between mb-4 mt-1">
              <div>
                <h3 className="font-medium text-white">Monthly</h3>
                <p className="text-xs text-white/40 mt-0.5">월간 구독</p>
              </div>
              <div className="text-right">
                <span className="text-xl font-bold">$14.99</span>
                <span className="text-xs text-white/40">/월</span>
              </div>
            </div>

            <ul className="space-y-2 mb-5">
              {['매월 2,000 크레딧', 'DM 무제한', '광고 제거', '프리미엄 시나리오'].map((item, i) => (
                <li key={i} className="flex items-center gap-2 text-sm text-white/60">
                  <Check className="w-4 h-4 text-white/30" />
                  {item}
                </li>
              ))}
            </ul>

            <button
              onClick={() => handleCheckout('monthly', process.env.NEXT_PUBLIC_STRIPE_PRICE_ID_MONTHLY, 'subscription')}
              disabled={!!loading}
              className="w-full py-3 bg-white text-black rounded-xl text-sm font-medium hover:bg-white/90 transition disabled:opacity-50"
            >
              {loading === 'monthly' ? '처리 중...' : '구독하기'}
            </button>
          </motion.div>

          {/* Plan 3: Annual */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="p-5 bg-white/[0.03] border border-white/10 rounded-2xl"
          >
            <div className="flex items-start justify-between mb-4">
              <div>
                <h3 className="font-medium text-white">Annual</h3>
                <p className="text-xs text-white/40 mt-0.5">연간 구독</p>
              </div>
              <div className="text-right">
                <span className="text-xl font-bold">$119.99</span>
                <span className="text-xs text-white/40">/년</span>
                <p className="text-[10px] text-green-400 mt-0.5">33% 할인</p>
              </div>
            </div>

            <ul className="space-y-2 mb-5">
              {['50,000 크레딧', '전체 시나리오 해금', '히든 스토리', '신규 캐릭터 선공개', 'VIP 지원'].map((item, i) => (
                <li key={i} className="flex items-center gap-2 text-sm text-white/60">
                  <Check className="w-4 h-4 text-white/30" />
                  {item}
                </li>
              ))}
            </ul>

            <button
              onClick={() => handleCheckout('yearly', process.env.NEXT_PUBLIC_STRIPE_PRICE_ID_YEARLY, 'subscription')}
              disabled={!!loading}
              className="w-full py-3 bg-white/10 rounded-xl text-sm font-medium hover:bg-white/15 transition disabled:opacity-50"
            >
              {loading === 'yearly' ? '처리 중...' : '구독하기'}
            </button>
          </motion.div>
        </div>

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
