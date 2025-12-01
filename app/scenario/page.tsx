'use client';

import { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { motion } from 'framer-motion';
import { ArrowLeft, Loader2 } from 'lucide-react';
import { EpisodeScenarioPlayer } from '@/components/scenario';
import { SCENARIO_CHARACTERS } from '@/lib/scenario-fallback';

function ScenarioContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const personaId = searchParams.get('personaId') || 'jun';
  const scenarioType = searchParams.get('type') || 'first_meeting';
  const context = searchParams.get('context') || '';
  const location = searchParams.get('location') || '';

  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // 캐릭터 정보 가져오기
  const character = SCENARIO_CHARACTERS[personaId as keyof typeof SCENARIO_CHARACTERS] || {
    id: personaId,
    name: personaId,
    image: 'https://i.pravatar.cc/400?img=68',
  };

  useEffect(() => {
    // 시나리오 로딩 시뮬레이션 (실제로는 API에서 시나리오 가져옴)
    const timer = setTimeout(() => {
      setIsLoading(false);
    }, 500);
    return () => clearTimeout(timer);
  }, []);

  const handleComplete = () => {
    // 시나리오 완료 후 DM 채팅으로 돌아가기
    router.back();
  };

  const handleBack = () => {
    router.back();
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="text-center space-y-4"
        >
          <Loader2 className="w-8 h-8 text-white animate-spin mx-auto" />
          <p className="text-white/50 text-sm">시나리오 준비 중...</p>
        </motion.div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center p-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center space-y-4"
        >
          <p className="text-red-400">{error}</p>
          <button
            onClick={handleBack}
            className="px-6 py-2 bg-white/10 rounded-lg text-white/70 text-sm hover:bg-white/20 transition"
          >
            돌아가기
          </button>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black">
      {/* 헤더 */}
      <div className="fixed top-0 left-0 right-0 z-50 bg-gradient-to-b from-black via-black/80 to-transparent">
        <div className="max-w-[430px] mx-auto px-4 py-4 flex items-center gap-4">
          <button
            onClick={handleBack}
            className="p-2 -ml-2 hover:bg-white/10 rounded-full transition"
          >
            <ArrowLeft className="w-5 h-5 text-white" />
          </button>
          <div className="flex-1">
            <h1 className="text-white font-medium">{character.name}</h1>
            <p className="text-white/50 text-xs capitalize">{scenarioType.replace('_', ' ')}</p>
          </div>
        </div>
      </div>

      {/* 시나리오 플레이어 */}
      <div className="pt-16">
        <EpisodeScenarioPlayer
          personaId={personaId}
          episodeId={`${scenarioType}_${personaId}`}
          character={character}
          onComplete={handleComplete}
          onBack={handleBack}
        />
      </div>
    </div>
  );
}

export default function ScenarioPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-black flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-white animate-spin" />
      </div>
    }>
      <ScenarioContent />
    </Suspense>
  );
}
