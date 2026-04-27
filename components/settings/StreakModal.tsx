'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { X, Flame, Calendar, Gift, CheckCircle2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useTranslations, t as translate } from '@/lib/i18n';

interface StreakModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function StreakModal({ isOpen, onClose }: StreakModalProps) {
  const [streak, setStreak] = useState(0);
  const [lastActive, setLastActive] = useState<string | null>(null);
  const tr = useTranslations();
  const t = tr.settings.streak;
  
  useEffect(() => {
    if (isOpen) {
      const fetchStreak = async () => {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          const { data } = await supabase
            .from('users')
            .select('streak_count, last_active_date')
            .eq('id', user.id)
            .single();
          
          if (data) {
            setStreak(data.streak_count || 0);
            setLastActive(data.last_active_date);
          }
        }
      };
      fetchStreak();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  // 다음 보상까지 남은 일수 계산 (7일 주기)
  const daysUntilBonus = 7 - (streak % 7);
  const progress = ((streak % 7) / 7) * 100;

  // 주간 출석 현황 (가상의 데이터로 시각화 - 실제로는 recent_activity 테이블 등이 필요하지만 간소화)
  // 여기서는 현재 스트릭을 기준으로 역산하여 표시
  const weekDays = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
  const todayIndex = new Date().getDay() === 0 ? 6 : new Date().getDay() - 1; // 월요일=0, 일요일=6

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          className="relative w-full max-w-sm bg-[#121212] border border-white/10 rounded-2xl overflow-hidden shadow-2xl"
        >
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-5 border-b border-white/[0.05]">
            <h2 className="text-base font-medium text-white flex items-center gap-2">
              <Flame className="w-4 h-4 text-orange-500 fill-orange-500" />
              {t.title}
            </h2>
            <button onClick={onClose} className="text-white/40 hover:text-white transition">
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="p-6 space-y-8">
            {/* Main Streak Display */}
            <div className="text-center space-y-2">
              <div className="relative w-24 h-24 mx-auto flex items-center justify-center">
                {/* Background Glow */}
                <div className="absolute inset-0 bg-orange-500/20 blur-2xl rounded-full animate-pulse" />
                <Flame className="w-20 h-20 text-orange-500 fill-orange-500 drop-shadow-[0_0_15px_rgba(249,115,22,0.5)]" />
              </div>
              <h3 className="text-4xl font-bold text-white tracking-tight">
                {streak}<span className="text-lg text-white/40 ml-1 font-normal">{t.days}</span>
              </h3>
              <p className="text-sm text-orange-400 font-medium">
                {t.consecutiveStreak}
              </p>
            </div>

            {/* Next Bonus Progress */}
            <div className="bg-white/[0.03] border border-white/10 rounded-xl p-4 space-y-3">
              <div className="flex items-center justify-between text-xs">
                <span className="text-white/60">{t.nextBonus}</span>
                <span className="text-white font-bold">{translate(t.daysLeft, { n: daysUntilBonus })}</span>
              </div>
              <div className="relative h-2 bg-white/10 rounded-full overflow-hidden">
                <motion.div 
                  initial={{ width: 0 }}
                  animate={{ width: `${progress}%` }}
                  className="absolute h-full bg-gradient-to-r from-orange-500 to-red-500 rounded-full"
                />
              </div>
              <div className="flex items-center gap-2 text-xs text-yellow-400 bg-yellow-500/10 px-3 py-2 rounded-lg border border-yellow-500/20">
                <Gift className="w-3 h-3" />
                <span>{t.bonusReward}</span>
              </div>
            </div>

            {/* Weekly Status (Visual Only for MVP) */}
            <div className="space-y-3">
              <p className="text-[10px] font-semibold text-white/30 uppercase tracking-widest px-1">
                {t.weeklyActivity}
              </p>
              <div className="flex justify-between">
                {weekDays.map((day, idx) => {
                  // 단순화된 로직: 오늘 포함해서 streak 수만큼 뒤로 가면서 체크
                  const isChecked = idx <= todayIndex && (todayIndex - idx) < streak;
                  const isToday = idx === todayIndex;
                  
                  return (
                    <div key={idx} className="flex flex-col items-center gap-2">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center border transition-all ${
                        isChecked 
                          ? 'bg-orange-500 border-orange-500 text-white shadow-[0_0_10px_rgba(249,115,22,0.3)]' 
                          : isToday 
                            ? 'bg-white/10 border-white/30 text-white'
                            : 'bg-transparent border-white/10 text-white/20'
                      }`}>
                        {isChecked ? <CheckCircle2 className="w-4 h-4" /> : <span className="text-[10px]">{day}</span>}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <p className="text-center text-xs text-white/30">
              {t.keepStreak}
            </p>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
