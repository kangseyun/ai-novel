'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { Gift, Clock, X } from 'lucide-react';
import { useState, useEffect } from 'react';
import { useTranslations, t } from '@/lib/i18n';

interface WelcomeOfferFloatingCTAProps {
  isVisible: boolean;
  remainingSeconds: number;
  onClick: () => void;
  onDismiss: () => void;
}

export default function WelcomeOfferFloatingCTA({
  isVisible,
  remainingSeconds,
  onClick,
  onDismiss,
}: WelcomeOfferFloatingCTAProps) {
  const [isMinimized, setIsMinimized] = useState(false);
  const [localRemaining, setLocalRemaining] = useState(remainingSeconds);
  const tr = useTranslations();
  const f = tr.shop.welcomeOffer.floating;

  useEffect(() => {
    setLocalRemaining(remainingSeconds);
  }, [remainingSeconds]);

  useEffect(() => {
    const timer = setInterval(() => {
      setLocalRemaining(prev => Math.max(0, prev - 1));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const formatTime = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  if (!isVisible || localRemaining <= 0) return null;

  return (
    <AnimatePresence>
      {isMinimized ? (
        // 최소화된 상태: 작은 아이콘만 표시
        <motion.button
          initial={{ scale: 0, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0, opacity: 0 }}
          onClick={() => setIsMinimized(false)}
          className="fixed bottom-24 right-4 z-50 w-14 h-14 bg-gradient-to-r from-pink-500 to-purple-500 rounded-full shadow-lg shadow-purple-500/30 flex items-center justify-center animate-pulse"
        >
          <Gift className="w-6 h-6 text-white" />
          <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 rounded-full text-[10px] font-bold text-white flex items-center justify-center">
            70%
          </span>
        </motion.button>
      ) : (
        // 확장된 상태
        <motion.div
          initial={{ y: 100, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 100, opacity: 0 }}
          className="fixed bottom-20 left-4 right-4 z-50 max-w-sm mx-auto"
        >
          <div className="relative bg-gradient-to-r from-pink-500/90 via-purple-500/90 to-violet-500/90 backdrop-blur-xl rounded-2xl p-4 shadow-2xl shadow-purple-500/30 border border-white/20">
            {/* 닫기/최소화 버튼들 */}
            <div className="absolute -top-2 -right-2 flex gap-1">
              <button
                onClick={() => setIsMinimized(true)}
                className="w-6 h-6 bg-black/50 rounded-full flex items-center justify-center text-white/60 hover:text-white transition"
                title="최소화"
              >
                <span className="text-xs">−</span>
              </button>
              <button
                onClick={onDismiss}
                className="w-6 h-6 bg-black/50 rounded-full flex items-center justify-center text-white/60 hover:text-white transition"
                title="닫기"
              >
                <X className="w-3 h-3" />
              </button>
            </div>

            {/* 배지 */}
            <div className="absolute -top-3 left-4">
              <span className="px-2 py-1 bg-red-500 text-white text-[10px] font-bold rounded-full shadow-lg animate-pulse">
                {t(tr.shop.welcomeOffer.badge, {})} 70% OFF
              </span>
            </div>

            <div className="flex items-center gap-3">
              {/* 아이콘 */}
              <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center flex-shrink-0">
                <Gift className="w-6 h-6 text-white" />
              </div>

              {/* 내용 */}
              <div className="flex-1 min-w-0">
                <p className="text-white font-bold text-sm truncate">
                  {f.title}
                </p>
                <div className="flex items-center gap-2 mt-1">
                  <Clock className="w-3 h-3 text-white/80" />
                  <span className="text-white/90 text-xs font-mono">
                    {formatTime(localRemaining)}
                  </span>
                  <span className="text-white/60 text-xs">{f.remaining}</span>
                </div>
              </div>

              {/* CTA 버튼 */}
              <button
                onClick={onClick}
                className="px-4 py-2 bg-white text-purple-600 rounded-xl font-bold text-sm hover:bg-white/90 transition shadow-lg flex-shrink-0"
              >
                {f.check}
              </button>
            </div>

            {/* 하단 혜택 표시 */}
            <div className="mt-3 pt-3 border-t border-white/20 flex items-center justify-center gap-4 text-[10px] text-white/80">
              <span>✨ 6,000 {f.bonusCredits}</span>
              <span>•</span>
              <span>🎯 {t(f.startingAt, { n: '$2.49' })}</span>
              <span>•</span>
              <span>⚡ {f.instant}</span>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
