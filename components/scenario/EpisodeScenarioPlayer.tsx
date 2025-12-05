'use client';

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import ScenarioPlayer, { ScenarioResult } from './ScenarioPlayer';
import { useSpecificScenario } from '@/hooks/useScenario';
import type { ScenarioChoice } from '@/lib/ai-agent/modules/scenario-service';

// ============================================
// 타입 정의
// ============================================

export interface EpisodeScenarioPlayerProps {
  /** 페르소나 ID */
  personaId: string;
  /** 에피소드/시나리오 ID */
  episodeId: string;
  /** 캐릭터 정보 */
  character: {
    id: string;
    name: string;
    image: string;
  };
  /** 이어하기 위치 (씬 ID) */
  resumeFromSceneId?: string;
  /** 호감도 변경 콜백 */
  onAffectionChange?: (delta: number, total: number) => void;
  /** 프리미엄 선택지 클릭 콜백 */
  onPremiumChoice?: (choice: ScenarioChoice) => void;
  /** 시나리오 완료 콜백 */
  onComplete?: (result: ScenarioResult) => void;
  /** 뒤로가기 콜백 */
  onBack?: () => void;
  /** 테마 */
  theme?: 'dark' | 'light';
}

// ============================================
// 메인 컴포넌트
// ============================================

export default function EpisodeScenarioPlayer({
  personaId,
  episodeId,
  character,
  resumeFromSceneId,
  onAffectionChange,
  onPremiumChoice,
  onComplete,
  onBack,
  theme = 'dark',
}: EpisodeScenarioPlayerProps) {
  const [isReady, setIsReady] = useState(false);

  const {
    scenario,
    progress,
    isLoading,
    isStarted,
    error,
    startScenario,
    totalAffection,
  } = useSpecificScenario(personaId, episodeId, {
    onComplete: (result) => {
      console.log('[Episode] Completed:', result);
    },
    onError: (err) => {
      console.error('[Episode] Error:', err);
    },
  });

  // 시작 위치 결정
  const initialSceneId = resumeFromSceneId || progress?.currentPosition?.sceneId;

  // 시나리오 로드 완료 후 시작
  useEffect(() => {
    if (scenario && !isStarted && !isReady) {
      startScenario().then(() => {
        setIsReady(true);
      });
    }
  }, [scenario, isStarted, isReady, startScenario]);

  // 로딩 상태
  if (isLoading || !isReady) {
    return (
      <div className={`min-h-screen flex items-center justify-center ${
        theme === 'dark' ? 'bg-zinc-950' : 'bg-white'
      }`}>
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="text-center space-y-4"
        >
          <div className={`w-12 h-12 border-2 rounded-full animate-spin mx-auto ${
            theme === 'dark'
              ? 'border-white/20 border-t-white/80'
              : 'border-black/20 border-t-black/80'
          }`} />
          <p className={`text-sm ${theme === 'dark' ? 'text-white/50' : 'text-black/50'}`}>
            에피소드 로딩 중...
          </p>
        </motion.div>
      </div>
    );
  }

  // 에러 상태
  if (error || !scenario?.content) {
    return (
      <div className={`min-h-screen flex items-center justify-center p-8 ${
        theme === 'dark' ? 'bg-zinc-950' : 'bg-white'
      }`}>
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center space-y-4"
        >
          <p className={theme === 'dark' ? 'text-white/70' : 'text-black/70'}>
            에피소드를 불러올 수 없습니다
          </p>
          <div className="flex gap-3 justify-center">
            {onBack && (
              <button
                onClick={onBack}
                className={`px-6 py-2 rounded-lg text-sm transition ${
                  theme === 'dark'
                    ? 'bg-white/10 text-white/70 hover:bg-white/20'
                    : 'bg-black/10 text-black/70 hover:bg-black/20'
                }`}
              >
                돌아가기
              </button>
            )}
            <button
              onClick={() => window.location.reload()}
              className={`px-6 py-2 rounded-lg text-sm transition ${
                theme === 'dark'
                  ? 'bg-white/10 text-white/70 hover:bg-white/20'
                  : 'bg-black/10 text-black/70 hover:bg-black/20'
              }`}
            >
              다시 시도
            </button>
          </div>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="relative">
      {/* 뒤로가기 버튼 */}
      {onBack && (
        <button
          onClick={onBack}
          className={`absolute top-4 left-4 z-40 p-2 rounded-full backdrop-blur-sm transition ${
            theme === 'dark'
              ? 'bg-white/5 hover:bg-white/10'
              : 'bg-black/5 hover:bg-black/10'
          }`}
        >
          <svg
            className={`w-5 h-5 ${theme === 'dark' ? 'text-white/60' : 'text-black/60'}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
      )}

      {/* 호감도 표시 */}
      <div className={`absolute top-4 left-1/2 -translate-x-1/2 z-40 px-3 py-1 rounded-full backdrop-blur-sm ${
        theme === 'dark' ? 'bg-white/5' : 'bg-black/5'
      }`}>
        <span className={`text-xs ${theme === 'dark' ? 'text-rose-300' : 'text-rose-600'}`}>
          ❤️ {totalAffection}
        </span>
      </div>

      <ScenarioPlayer
        scenario={scenario.content}
        character={character}
        initialSceneId={initialSceneId}
        onAffectionChange={onAffectionChange}
        onPremiumChoice={onPremiumChoice}
        onComplete={onComplete}
        theme={theme}
        showHistory={true}
      />
    </div>
  );
}
