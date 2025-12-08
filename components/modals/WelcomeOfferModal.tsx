'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { X, Clock, Zap, Gift, Sparkles, ChevronRight, Check, Crown, Star } from 'lucide-react';
import { useEffect, useState, useCallback } from 'react';
import { apiClient } from '@/lib/api-client';
import { useTranslations, t } from '@/lib/i18n';
import analytics from '@/lib/analytics';
import confetti from 'canvas-confetti';

// dev 환경 체크
const isDev = process.env.NODE_ENV === 'development';

interface WelcomeOfferModalProps {
  isOpen: boolean;
  onClose: () => void;
  userCreatedAt?: string; // ISO date string
  onPurchaseComplete?: () => void;
}

// 24시간 한정 특가 가격 (70% 할인)
const WELCOME_OFFER = {
  original: {
    monthly: 999, // $9.99
    yearly: 9999, // $99.99
  },
  discounted: {
    monthly: 299, // $2.99 (70% OFF)
    yearly: 2999, // $29.99 (70% OFF)
  },
  credits: {
    monthly: 500, // 보너스 크레딧
    yearly: 6000, // 보너스 크레딧
  },
};

export default function WelcomeOfferModal({
  isOpen,
  onClose,
  userCreatedAt,
  onPurchaseComplete,
}: WelcomeOfferModalProps) {
  const [remainingTime, setRemainingTime] = useState({ hours: 0, minutes: 0, seconds: 0 });
  const [isExpired, setIsExpired] = useState(false);
  const [loading, setLoading] = useState<'monthly' | 'yearly' | null>(null);
  const [selectedPlan, setSelectedPlan] = useState<'yearly' | 'monthly'>('yearly');
  const [showExitConfirm, setShowExitConfirm] = useState(false);
  const tr = useTranslations();

  // 컨페티 효과
  const fireConfetti = useCallback(() => {
    const count = 200;
    const defaults = {
      origin: { y: 0.7 },
      zIndex: 9999,
    };

    function fire(particleRatio: number, opts: confetti.Options) {
      confetti({
        ...defaults,
        ...opts,
        particleCount: Math.floor(count * particleRatio),
      });
    }

    fire(0.25, { spread: 26, startVelocity: 55 });
    fire(0.2, { spread: 60 });
    fire(0.35, { spread: 100, decay: 0.91, scalar: 0.8 });
    fire(0.1, { spread: 120, startVelocity: 25, decay: 0.92, scalar: 1.2 });
    fire(0.1, { spread: 120, startVelocity: 45 });
  }, []);

  // 타이머 계산
  useEffect(() => {
    if (!isOpen) return;

    // dev 환경에서는 항상 24시간으로 고정
    if (isDev) {
      setRemainingTime({ hours: 23, minutes: 59, seconds: 59 });
      setIsExpired(false);
      // 모달 열릴 때 컨페티 효과
      setTimeout(() => fireConfetti(), 500);

      // dev에서도 초 카운트다운 (UI 확인용)
      const timer = setInterval(() => {
        setRemainingTime(prev => {
          let { hours, minutes, seconds } = prev;
          seconds--;
          if (seconds < 0) {
            seconds = 59;
            minutes--;
          }
          if (minutes < 0) {
            minutes = 59;
            hours--;
          }
          if (hours < 0) {
            // dev에서는 리셋
            return { hours: 23, minutes: 59, seconds: 59 };
          }
          return { hours, minutes, seconds };
        });
      }, 1000);
      return () => clearInterval(timer);
    }

    const getExpireTime = () => {
      if (userCreatedAt) {
        return new Date(userCreatedAt).getTime() + 24 * 60 * 60 * 1000;
      }
      // 폴백: 로컬 스토리지 사용
      const stored = localStorage.getItem('welcome_offer_start');
      if (stored) {
        return new Date(stored).getTime() + 24 * 60 * 60 * 1000;
      }
      const now = new Date().toISOString();
      localStorage.setItem('welcome_offer_start', now);
      return new Date(now).getTime() + 24 * 60 * 60 * 1000;
    };

    const calculateTimeLeft = () => {
      const expireTime = getExpireTime();
      const now = Date.now();
      const diff = expireTime - now;

      if (diff <= 0) {
        setIsExpired(true);
        return { hours: 0, minutes: 0, seconds: 0 };
      }

      return {
        hours: Math.floor(diff / (1000 * 60 * 60)),
        minutes: Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60)),
        seconds: Math.floor((diff % (1000 * 60)) / 1000),
      };
    };

    setRemainingTime(calculateTimeLeft());

    // 모달 열릴 때 컨페티 효과
    setTimeout(() => fireConfetti(), 500);

    const timer = setInterval(() => {
      setRemainingTime(calculateTimeLeft());
    }, 1000);

    return () => clearInterval(timer);
  }, [isOpen, userCreatedAt, fireConfetti]);

  // 분석 추적
  useEffect(() => {
    if (isOpen) {
      analytics.track('welcome_offer_viewed', {
        remaining_hours: remainingTime.hours,
      });
    }
  }, [isOpen]);

  const handlePurchase = async (plan: 'monthly' | 'yearly') => {
    try {
      setLoading(plan);

      analytics.trackInitiateCheckout({
        items: [{
          id: `welcome_${plan}`,
          name: `Welcome Offer ${plan}`,
          price: WELCOME_OFFER.discounted[plan]
        }],
        totalValue: WELCOME_OFFER.discounted[plan],
        currency: 'USD',
      });

      // 특별 웰컴 오퍼 결제 API 호출
      const { url } = await apiClient.subscribeToWelcomeOffer(plan);
      if (url) {
        window.location.href = url;
      }
    } catch (error) {
      console.error('Welcome offer purchase error:', error);
      alert('결제 시작에 실패했습니다. 다시 시도해주세요.');
    } finally {
      setLoading(null);
    }
  };

  const handleClose = () => {
    if (!showExitConfirm) {
      setShowExitConfirm(true);
      return;
    }
    analytics.track('welcome_offer_dismissed', {
      remaining_hours: remainingTime.hours,
    });
    onClose();
  };

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
    }).format(price / 100);
  };

  const discountPercent = Math.round(
    (1 - WELCOME_OFFER.discounted[selectedPlan] / WELCOME_OFFER.original[selectedPlan]) * 100
  );

  // dev 환경에서는 isExpired 무시
  if (!isOpen || (!isDev && isExpired)) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="absolute inset-0 bg-black/90 backdrop-blur-md"
          onClick={handleClose}
        />

        {/* Modal */}
        <motion.div
          initial={{ opacity: 0, scale: 0.9, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.9, y: 20 }}
          transition={{ type: 'spring', damping: 25, stiffness: 300 }}
          className="relative w-full max-w-sm bg-gradient-to-b from-[#1a1a2e] to-[#0f0f1a] border border-white/10 rounded-3xl overflow-hidden shadow-2xl"
        >
          {/* Animated Background */}
          <div className="absolute inset-0 overflow-hidden">
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[200%] h-32 bg-gradient-to-r from-pink-500/20 via-purple-500/30 to-pink-500/20 blur-3xl" />
            <div className="absolute bottom-0 left-0 w-full h-48 bg-gradient-to-t from-violet-600/10 to-transparent" />
            {/* Sparkle particles */}
            {[...Array(6)].map((_, i) => (
              <motion.div
                key={i}
                className="absolute w-1 h-1 bg-white rounded-full"
                style={{
                  left: `${Math.random() * 100}%`,
                  top: `${Math.random() * 100}%`,
                }}
                animate={{
                  opacity: [0, 1, 0],
                  scale: [0, 1.5, 0],
                }}
                transition={{
                  duration: 2,
                  repeat: Infinity,
                  delay: i * 0.3,
                }}
              />
            ))}
          </div>

          {/* Close Button */}
          <button
            onClick={handleClose}
            className="absolute top-4 right-4 z-10 p-2 text-white/40 hover:text-white transition rounded-full hover:bg-white/10"
          >
            <X className="w-5 h-5" />
          </button>

          {/* Content */}
          <div className="relative p-6 pt-8">
            {/* Header Badge */}
            <motion.div
              initial={{ y: -10, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.2 }}
              className="flex justify-center mb-4"
            >
              <div className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-pink-500/20 to-purple-500/20 border border-pink-500/30 rounded-full">
                <Gift className="w-4 h-4 text-pink-400" />
                <span className="text-sm font-bold text-pink-300">신규 가입 특별 혜택</span>
                <Sparkles className="w-4 h-4 text-pink-400 animate-pulse" />
              </div>
            </motion.div>

            {/* Main Title */}
            <motion.div
              initial={{ y: 10, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.3 }}
              className="text-center mb-6"
            >
              <h2 className="text-2xl font-bold text-white mb-2">
                가입 축하 <span className="text-transparent bg-clip-text bg-gradient-to-r from-pink-400 to-purple-400">{discountPercent}% 할인</span>
              </h2>
              <p className="text-sm text-white/60">
                딱 24시간만 제공되는 특별 가격이에요
              </p>
            </motion.div>

            {/* Countdown Timer */}
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: 0.4 }}
              className="mb-6"
            >
              <div className="flex items-center justify-center gap-2 mb-2">
                <Clock className="w-4 h-4 text-red-400 animate-pulse" />
                <span className="text-xs font-medium text-red-400">남은 시간</span>
              </div>
              <div className="flex justify-center gap-3">
                {[
                  { value: remainingTime.hours, label: '시간' },
                  { value: remainingTime.minutes, label: '분' },
                  { value: remainingTime.seconds, label: '초' },
                ].map((item, idx) => (
                  <div key={idx} className="text-center">
                    <div className="w-16 h-16 bg-black/50 border border-red-500/30 rounded-xl flex items-center justify-center mb-1">
                      <span className="text-2xl font-bold text-white tabular-nums">
                        {item.value.toString().padStart(2, '0')}
                      </span>
                    </div>
                    <span className="text-[10px] text-white/40">{item.label}</span>
                  </div>
                ))}
              </div>
            </motion.div>

            {/* Plan Selection */}
            <motion.div
              initial={{ y: 10, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.5 }}
              className="space-y-3 mb-6"
            >
              {/* Yearly Plan (Recommended) */}
              <button
                onClick={() => setSelectedPlan('yearly')}
                className={`w-full p-4 rounded-2xl text-left transition relative overflow-hidden ${
                  selectedPlan === 'yearly'
                    ? 'bg-gradient-to-r from-violet-500/20 to-purple-500/20 border-2 border-violet-500/50 ring-2 ring-violet-500/20'
                    : 'bg-white/5 border border-white/10 hover:border-white/20'
                }`}
              >
                {/* Best Value Badge */}
                <div className="absolute top-0 right-0">
                  <div className="bg-gradient-to-r from-violet-500 to-purple-500 text-white text-[10px] font-bold px-3 py-1 rounded-bl-xl">
                    BEST VALUE
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                    selectedPlan === 'yearly' ? 'border-violet-500 bg-violet-500' : 'border-white/30'
                  }`}>
                    {selectedPlan === 'yearly' && <Check className="w-3 h-3 text-white" />}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <Crown className="w-4 h-4 text-yellow-400" />
                      <span className="font-bold text-white">연간 구독</span>
                    </div>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-xs text-white/40 line-through">
                        {formatPrice(WELCOME_OFFER.original.yearly)}
                      </span>
                      <span className="text-lg font-bold text-white">
                        {formatPrice(WELCOME_OFFER.discounted.yearly)}
                      </span>
                      <span className="text-xs text-green-400 bg-green-500/10 px-2 py-0.5 rounded-full">
                        월 {formatPrice(Math.round(WELCOME_OFFER.discounted.yearly / 12))}
                      </span>
                    </div>
                  </div>
                </div>
                <div className="mt-3 flex items-center gap-2 text-xs text-violet-300 bg-violet-500/10 px-3 py-2 rounded-lg">
                  <Star className="w-3 h-3" />
                  <span>{WELCOME_OFFER.credits.yearly.toLocaleString()} 보너스 크레딧 즉시 지급!</span>
                </div>
              </button>

              {/* Monthly Plan */}
              <button
                onClick={() => setSelectedPlan('monthly')}
                className={`w-full p-4 rounded-2xl text-left transition ${
                  selectedPlan === 'monthly'
                    ? 'bg-gradient-to-r from-pink-500/20 to-rose-500/20 border-2 border-pink-500/50'
                    : 'bg-white/5 border border-white/10 hover:border-white/20'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                    selectedPlan === 'monthly' ? 'border-pink-500 bg-pink-500' : 'border-white/30'
                  }`}>
                    {selectedPlan === 'monthly' && <Check className="w-3 h-3 text-white" />}
                  </div>
                  <div className="flex-1">
                    <span className="font-bold text-white">월간 구독</span>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-xs text-white/40 line-through">
                        {formatPrice(WELCOME_OFFER.original.monthly)}
                      </span>
                      <span className="text-lg font-bold text-white">
                        {formatPrice(WELCOME_OFFER.discounted.monthly)}
                      </span>
                    </div>
                  </div>
                </div>
                <div className="mt-2 text-xs text-pink-300">
                  +{WELCOME_OFFER.credits.monthly.toLocaleString()} 보너스 크레딧
                </div>
              </button>
            </motion.div>

            {/* Features */}
            <motion.div
              initial={{ y: 10, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.6 }}
              className="mb-6"
            >
              <div className="grid grid-cols-2 gap-2 text-xs">
                {[
                  '모든 프리미엄 에피소드 무료',
                  '광고 완전 제거',
                  '독점 스토리 해금',
                  '우선 고객 지원',
                ].map((feature, idx) => (
                  <div key={idx} className="flex items-center gap-2 text-white/70">
                    <Check className="w-3 h-3 text-green-400 flex-shrink-0" />
                    <span>{feature}</span>
                  </div>
                ))}
              </div>
            </motion.div>

            {/* CTA Button */}
            <motion.button
              initial={{ y: 10, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.7 }}
              onClick={() => handlePurchase(selectedPlan)}
              disabled={!!loading}
              className="w-full py-4 bg-gradient-to-r from-pink-500 via-purple-500 to-violet-500 text-white rounded-2xl font-bold text-base hover:opacity-90 transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-lg shadow-purple-500/30"
            >
              {loading ? (
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <>
                  <Zap className="w-5 h-5" />
                  <span>지금 {discountPercent}% 할인받기</span>
                  <ChevronRight className="w-5 h-5" />
                </>
              )}
            </motion.button>

            {/* Urgency Text */}
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.8 }}
              className="mt-4 text-center text-xs text-white/40"
            >
              ⚠️ 이 가격은 24시간 후 사라집니다
            </motion.p>

            {/* Trust Badges */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.9 }}
              className="mt-4 flex items-center justify-center gap-4 text-[10px] text-white/30"
            >
              <span>🔒 안전한 결제</span>
              <span>•</span>
              <span>언제든 취소 가능</span>
              <span>•</span>
              <span>즉시 이용 가능</span>
            </motion.div>
          </div>
        </motion.div>

        {/* Exit Confirmation Modal */}
        <AnimatePresence>
          {showExitConfirm && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 z-[101] flex items-center justify-center p-4 bg-black/80"
            >
              <motion.div
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.9, opacity: 0 }}
                className="w-full max-w-xs bg-[#1a1a2e] border border-white/10 rounded-2xl p-6 text-center"
              >
                <div className="w-16 h-16 mx-auto mb-4 bg-red-500/10 rounded-full flex items-center justify-center">
                  <span className="text-3xl">😢</span>
                </div>
                <h3 className="text-lg font-bold text-white mb-2">
                  정말 떠나시겠어요?
                </h3>
                <p className="text-sm text-white/60 mb-6">
                  이 특별 가격은 다시 제공되지 않아요!<br />
                  <span className="text-pink-400 font-medium">{discountPercent}% 할인</span>을 놓치게 됩니다.
                </p>
                <div className="space-y-3">
                  <button
                    onClick={() => setShowExitConfirm(false)}
                    className="w-full py-3 bg-gradient-to-r from-pink-500 to-purple-500 text-white rounded-xl font-bold"
                  >
                    할인 받을래요! 🎉
                  </button>
                  <button
                    onClick={() => {
                      setShowExitConfirm(false);
                      onClose();
                    }}
                    className="w-full py-3 text-white/40 text-sm hover:text-white/60 transition"
                  >
                    나중에 정가로 구매할게요
                  </button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </AnimatePresence>
  );
}
