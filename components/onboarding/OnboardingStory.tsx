'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Image from 'next/image';
import {
  X,
  Send,
  Heart,
  MessageCircle,
  Lock,
  ShieldAlert,
  Eye,
} from 'lucide-react';
import { JUN_PROFILE } from '@/lib/hacked-sns-data';
import { ONBOARDING_STORY_SEQUENCE } from '@/lib/onboarding-data';

interface OnboardingStoryProps {
  onComplete: () => void;
}

export default function OnboardingStory({ onComplete }: OnboardingStoryProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [showReplyPrompt, setShowReplyPrompt] = useState(false);
  const [progress, setProgress] = useState(0);
  const [isPaused, setIsPaused] = useState(false);

  const currentContent = ONBOARDING_STORY_SEQUENCE[currentIndex];

  // 스토리 자동 진행
  useEffect(() => {
    if (isPaused || showReplyPrompt) return;

    const duration = currentContent?.delay || 3000;
    const interval = 50;
    let elapsed = 0;

    const timer = setInterval(() => {
      elapsed += interval;
      setProgress((elapsed / duration) * 100);

      if (elapsed >= duration) {
        clearInterval(timer);

        // 답장 트리거인 경우
        if (currentContent?.isReplyTrigger) {
          setShowReplyPrompt(true);
          setIsPaused(true);
        } else if (currentIndex < ONBOARDING_STORY_SEQUENCE.length - 1) {
          setCurrentIndex(prev => prev + 1);
          setProgress(0);
        }
      }
    }, interval);

    return () => clearInterval(timer);
  }, [currentIndex, isPaused, showReplyPrompt, currentContent]);

  // 답장하기 클릭
  const handleReply = () => {
    onComplete();
  };

  return (
    <div className="min-h-screen bg-black relative">
      {/* 배경 이미지 */}
      <div className="absolute inset-0">
        <Image
          src="https://images.unsplash.com/photo-1519681393784-d120267933ba?w=800&q=80"
          alt="Story background"
          fill
          className="object-cover opacity-30"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-black/50 via-transparent to-black/80" />
      </div>

      {/* 상단 바 */}
      <div className="absolute top-0 left-0 right-0 z-20 p-4">
        {/* 해킹 상태 표시 */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2 px-2 py-1 bg-red-500/20 border border-red-500/50 rounded-lg">
            <ShieldAlert className="w-3 h-3 text-red-400" />
            <span className="text-[10px] text-red-400 font-mono">INTERCEPTED</span>
          </div>
          <div className="flex items-center gap-2 px-2 py-1 bg-black/50 rounded-lg">
            <Lock className="w-3 h-3 text-white/50" />
            <span className="text-[10px] text-white/50">비공개 스토리</span>
          </div>
        </div>

        {/* 프로그레스 바 */}
        <div className="flex gap-1">
          {ONBOARDING_STORY_SEQUENCE.map((_, idx) => (
            <div key={idx} className="flex-1 h-0.5 bg-white/30 rounded-full overflow-hidden">
              {idx < currentIndex ? (
                <div className="w-full h-full bg-white" />
              ) : idx === currentIndex ? (
                <motion.div
                  className="h-full bg-white"
                  initial={{ width: 0 }}
                  animate={{ width: `${progress}%` }}
                />
              ) : null}
            </div>
          ))}
        </div>

        {/* 프로필 */}
        <div className="flex items-center gap-3 mt-4">
          <div className="w-10 h-10 rounded-full overflow-hidden border-2 border-red-500/50">
            <Image
              src={JUN_PROFILE.profileImage}
              alt={JUN_PROFILE.displayName}
              width={40}
              height={40}
              className="object-cover"
            />
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <span className="font-medium text-white text-sm">{JUN_PROFILE.displayName}</span>
              <span className="text-[10px] text-red-400 bg-red-500/20 px-1.5 py-0.5 rounded">
                비공개
              </span>
            </div>
            <span className="text-xs text-white/50">방금 전</span>
          </div>
        </div>
      </div>

      {/* 스토리 컨텐츠 */}
      <div className="absolute inset-0 flex items-center justify-center p-8 pt-32 pb-40">
        <AnimatePresence mode="wait">
          <motion.div
            key={currentIndex}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="text-center"
          >
            {currentContent?.type === 'text' && (
              <p className="text-xl text-white font-medium leading-relaxed whitespace-pre-line">
                {currentContent.content}
              </p>
            )}
          </motion.div>
        </AnimatePresence>
      </div>

      {/* 하단: 답장 프롬프트 */}
      <AnimatePresence>
        {showReplyPrompt && (
          <motion.div
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            className="absolute bottom-0 left-0 right-0 p-6 bg-gradient-to-t from-black via-black/90 to-transparent"
          >
            {/* 감정 반응 */}
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: 0.3, type: 'spring' }}
              className="flex items-center justify-center gap-4 mb-6"
            >
              <button className="w-12 h-12 rounded-full bg-white/10 flex items-center justify-center hover:bg-white/20 transition">
                <Heart className="w-6 h-6 text-red-400" />
              </button>
              <button className="w-12 h-12 rounded-full bg-white/10 flex items-center justify-center hover:bg-white/20 transition">
                <span className="text-2xl">😢</span>
              </button>
              <button className="w-12 h-12 rounded-full bg-white/10 flex items-center justify-center hover:bg-white/20 transition">
                <span className="text-2xl">🥺</span>
              </button>
            </motion.div>

            {/* 답장 버튼 */}
            <motion.button
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.5 }}
              onClick={handleReply}
              className="w-full py-4 bg-gradient-to-r from-blue-500 to-purple-500 rounded-2xl flex items-center justify-center gap-3 hover:from-blue-400 hover:to-purple-400 transition"
            >
              <MessageCircle className="w-5 h-5 text-white" />
              <span className="text-white font-medium">답장하기</span>
            </motion.button>

            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.7 }}
              className="text-center text-xs text-white/50 mt-4"
            >
              비밀 스토리에 답장할 수 있어요
            </motion.p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 탭 가이드 (답장 프롬프트 전) */}
      {!showReplyPrompt && currentIndex > 0 && (
        <div className="absolute inset-x-0 bottom-8 flex justify-center">
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 0.5 }}
            className="text-xs text-white/50"
          >
            탭하여 계속
          </motion.p>
        </div>
      )}

      {/* 터치 영역 (다음으로 넘기기) */}
      {!showReplyPrompt && (
        <button
          onClick={() => {
            if (currentContent?.isReplyTrigger) {
              setShowReplyPrompt(true);
              setIsPaused(true);
            } else if (currentIndex < ONBOARDING_STORY_SEQUENCE.length - 1) {
              setCurrentIndex(prev => prev + 1);
              setProgress(0);
            }
          }}
          className="absolute inset-0 z-10"
        />
      )}
    </div>
  );
}
