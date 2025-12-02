'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { RotateCcw, Play, ChevronLeft } from 'lucide-react';
import Link from 'next/link';
import OnboardingScenario, { ScenarioResultData } from '@/components/onboarding/OnboardingScenario';
import { useTranslations } from '@/lib/i18n';

export default function ScenarioTestPage() {
  const [isPlaying, setIsPlaying] = useState(false);
  const [key, setKey] = useState(0); // 리셋용
  const [confirmedResult, setConfirmedResult] = useState<ScenarioResultData | null>(null);
  const tr = useTranslations();

  const handleProgress = (affection: number, isPremiumTease: boolean) => {
    console.log('Progress:', { affection, isPremiumTease });
  };

  const handleCliffhanger = () => {
    console.log('Cliffhanger reached!');
    // 결과 화면이 있으므로 여기서는 아무것도 안함
  };

  const handleReset = () => {
    setKey(prev => prev + 1);
    setIsPlaying(true);
    setConfirmedResult(null);
  };

  const handleRestart = () => {
    console.log('Restart requested (유료)');
    // 실제로는 코인 차감 로직 필요
    alert('💎 50코인이 차감됩니다. (테스트에서는 무료)');
    handleReset();
  };

  const handleConfirm = (result: ScenarioResultData) => {
    console.log('Confirmed result:', result);
    setConfirmedResult(result);
    setIsPlaying(false);
  };

  return (
    <div className="min-h-screen bg-zinc-950 flex justify-center">
      <div className="w-full max-w-[430px] min-h-screen relative bg-zinc-950">
      {!isPlaying ? (
        <div className="min-h-screen flex flex-col items-center justify-center p-6">
          <div className="text-center mb-8">
            <h1 className="text-2xl font-bold text-white mb-2">
              🎬 시나리오 테스트
            </h1>
            <p className="text-white/60 text-sm">
              온보딩 없이 시나리오 시스템만 테스트
            </p>
          </div>

          {/* 확정된 결과 표시 */}
          {confirmedResult && (
            <div className="mb-8 p-4 bg-green-500/10 border border-green-500/30 rounded-xl max-w-xs w-full">
              <p className="text-green-400 text-sm font-medium mb-2">✓ 스토리 확정됨</p>
              <div className="space-y-1 text-xs text-white/60">
                <p>캐릭터: {confirmedResult.characterName}</p>
                <p>호감도: +{confirmedResult.affectionGained}</p>
                <p>선택: {confirmedResult.selectedChoices.length}개</p>
              </div>
            </div>
          )}

          <div className="space-y-4 w-full max-w-xs">
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => setIsPlaying(true)}
              className="w-full py-4 bg-gradient-to-r from-purple-500 to-pink-500 rounded-2xl text-white font-medium flex items-center justify-center gap-2"
            >
              <Play className="w-5 h-5" />
              {confirmedResult ? '다시 플레이' : '시나리오 시작'}
            </motion.button>

            <Link
              href="/"
              className="block w-full py-4 bg-white/10 rounded-2xl text-white/70 text-center hover:bg-white/15 transition"
            >
              <span className="flex items-center justify-center gap-2">
                <ChevronLeft className="w-4 h-4" />
                메인으로
              </span>
            </Link>
          </div>

          <div className="mt-12 text-xs text-white/30 max-w-sm text-center">
            <p>콘솔에서 progress, confirm 이벤트 확인 가능</p>
          </div>
        </div>
      ) : (
        <div className="relative">
          {/* 리셋 버튼 - 좌측 상단 (히스토리 버튼과 겹치지 않도록) */}
          <button
            onClick={handleReset}
            className="fixed top-4 left-4 z-[200] p-2 bg-white/10 backdrop-blur-xl rounded-full hover:bg-white/20 transition"
          >
            <RotateCcw className="w-5 h-5 text-white" />
          </button>

          {/* 시나리오 */}
          <OnboardingScenario
            key={key}
            onProgress={handleProgress}
            onCliffhanger={handleCliffhanger}
            onRestart={handleRestart}
            onConfirm={handleConfirm}
          />
        </div>
      )}
      </div>
    </div>
  );
}
