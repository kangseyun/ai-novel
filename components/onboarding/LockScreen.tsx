'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface LockScreenProps {
  onUnlock: () => void;
}

export default function LockScreen({ onUnlock }: LockScreenProps) {
  const [time, setTime] = useState('');
  const [date, setDate] = useState('');
  const [showSwipeHint, setShowSwipeHint] = useState(false);

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setTime(now.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', hour12: false }));
      setDate(now.toLocaleDateString('ko-KR', { month: 'long', day: 'numeric', weekday: 'long' }));
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  // 스와이프 힌트만 약간 딜레이
  useEffect(() => {
    setTimeout(() => setShowSwipeHint(true), 500);
  }, []);

  // 알림은 처음부터 모두 표시
  const notifications = [0, 1, 2];

  const dmPreviews = [
    { name: 'Jun', message: '...잠이 안 와. 너도?', time: '방금' },
    { name: 'Minho', message: '귀찮게 왜 자꾸 신경 쓰이는 건데...', time: '2분 전' },
    { name: 'Hana', message: '오늘도 좋은 하루! ...거짓말이야', time: '5분 전' },
  ];

  return (
    <div className="h-[100dvh] bg-black text-white flex flex-col relative overflow-hidden">
      {/* 배경 그라데이션 */}
      <div className="absolute inset-0 bg-gradient-to-b from-zinc-900/50 to-black" />

      {/* 시간 표시 - 상단 */}
      <div className="relative z-10 flex flex-col items-center pt-16 pb-6 shrink-0">
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="text-white/50 text-sm mb-1"
        >
          {date}
        </motion.p>
        <motion.h1
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="text-7xl font-extralight tracking-tight"
        >
          {time}
        </motion.h1>
      </div>

      {/* DM 알림들 - 시계 아래 */}
      <div className="relative z-10 px-4 space-y-2 overflow-y-auto flex-1 min-h-0">
        <AnimatePresence>
          {notifications.map((idx) => (
            <motion.div
              key={idx}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.1, duration: 0.3 }}
              className="bg-white/10 backdrop-blur-xl rounded-2xl p-3 border border-white/5"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center text-sm font-medium">
                  {dmPreviews[idx].name[0]}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-0.5">
                    <span className="font-medium text-sm">{dmPreviews[idx].name}</span>
                    <span className="text-xs text-white/40">{dmPreviews[idx].time}</span>
                  </div>
                  <p className="text-sm text-white/60 truncate">{dmPreviews[idx].message}</p>
                </div>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {/* 스와이프 힌트 - 하단 */}
      <div className="relative z-10 px-4 pb-8 shrink-0">
        <AnimatePresence>
          {showSwipeHint && (
            <motion.button
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={onUnlock}
              className="w-full py-4"
            >
              <motion.div
                animate={{ y: [0, -8, 0] }}
                transition={{ repeat: Infinity, duration: 1.5 }}
                className="text-center"
              >
                <div className="w-10 h-1 bg-white/30 rounded-full mx-auto mb-3" />
                <p className="text-sm text-white/40">위로 스와이프하여 확인</p>
              </motion.div>
            </motion.button>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
