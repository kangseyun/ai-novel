'use client';

import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import ScenarioPlayer, { ScenarioResult } from './ScenarioPlayer';
import { useFirstMeetingScenario } from '@/hooks/useScenario';
import type { ScenarioChoice } from '@/lib/ai-agent/modules/scenario-service';

// ============================================
// 타입 정의
// ============================================

export interface OnboardingScenarioWrapperProps {
  /** 페르소나 ID */
  personaId: string;
  /** 캐릭터 정보 (서버에서 가져오지 않을 경우) */
  character?: {
    id: string;
    name: string;
    image: string;
  };
  /** 호감도 변경 콜백 */
  onAffectionChange?: (delta: number, total: number) => void;
  /** 프리미엄 선택지 클릭 콜백 (업셀 용도) */
  onPremiumChoice?: () => void;
  /** 시나리오 완료 콜백 */
  onComplete?: (result: ScenarioResult) => void;
  /** 완료 후 보여줄 컴포넌트 */
  completionComponent?: React.ReactNode;
  /** 폴백 시나리오 데이터 (API 실패 시) */
  fallbackScenario?: {
    scenes: Array<{
      id: string;
      type: 'narration' | 'dialogue' | 'choice' | 'character_appear' | 'transition';
      text?: string;
      character?: string;
      expression?: string;
      choices?: Array<{
        id: string;
        text: string;
        tone: string;
        nextScene: string;
        affectionChange: number;
        isPremium?: boolean;
      }>;
    }>;
  };
}

// 기본 캐릭터 정보 (Jun)
const DEFAULT_CHARACTER = {
  id: 'jun',
  name: 'Jun',
  image: 'https://i.pravatar.cc/400?img=68',
};

// ============================================
// 메인 컴포넌트
// ============================================

export default function OnboardingScenarioWrapper({
  personaId,
  character = DEFAULT_CHARACTER,
  onAffectionChange,
  onPremiumChoice,
  onComplete,
  completionComponent,
  fallbackScenario,
}: OnboardingScenarioWrapperProps) {
  const [showCompletion, setShowCompletion] = useState(false);
  const [completionResult, setCompletionResult] = useState<ScenarioResult | null>(null);

  const {
    scenario,
    isLoading,
    isStarted,
    error,
    startScenario,
  } = useFirstMeetingScenario(personaId, {
    onComplete: (result) => {
      console.log('[Onboarding] Scenario completed:', result);
    },
    onError: (err) => {
      console.error('[Onboarding] Scenario error:', err);
    },
  });

  // 시나리오 데이터 (API에서 가져온 것 또는 폴백)
  const scenarioContent = scenario?.content || fallbackScenario;

  // 자동 시작
  useEffect(() => {
    if (scenario && !isStarted) {
      startScenario();
    }
  }, [scenario, isStarted, startScenario]);

  // 프리미엄 선택지 핸들러
  const handlePremiumChoice = (choice: ScenarioChoice) => {
    console.log('[Onboarding] Premium choice clicked:', choice);
    onPremiumChoice?.();
  };

  // 완료 핸들러
  const handleComplete = (result: ScenarioResult) => {
    setCompletionResult(result);
    setShowCompletion(true);
    onComplete?.(result);
  };

  // 로딩 상태
  if (isLoading && !scenarioContent) {
    return (
      <div className="h-[100dvh] bg-zinc-950 flex items-center justify-center">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="text-center space-y-4"
        >
          <div className="w-12 h-12 border-2 border-white/20 border-t-white/80 rounded-full animate-spin mx-auto" />
          <p className="text-white/50 text-sm">시나리오 로딩 중...</p>
        </motion.div>
      </div>
    );
  }

  // 에러 상태 (폴백이 없는 경우)
  if (error && !scenarioContent) {
    return (
      <div className="h-[100dvh] bg-zinc-950 flex items-center justify-center p-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center space-y-4"
        >
          <p className="text-white/70">시나리오를 불러올 수 없습니다</p>
          <button
            onClick={() => window.location.reload()}
            className="px-6 py-2 bg-white/10 rounded-lg text-white/70 text-sm hover:bg-white/20 transition"
          >
            다시 시도
          </button>
        </motion.div>
      </div>
    );
  }

  // 완료 화면
  if (showCompletion && completionComponent) {
    return <>{completionComponent}</>;
  }

  // 시나리오 없음
  if (!scenarioContent) {
    return null;
  }

  return (
    <ScenarioPlayer
      scenario={scenarioContent}
      character={character}
      onChoice={(choice, sceneId) => {
        console.log('[Onboarding] Choice made:', choice.text, 'at scene:', sceneId);
      }}
      onAffectionChange={(delta, total) => {
        console.log('[Onboarding] Affection changed:', delta, 'total:', total);
        onAffectionChange?.(delta, total);
      }}
      onPremiumChoice={handlePremiumChoice}
      onComplete={handleComplete}
      theme="dark"
      showHistory={true}
    />
  );
}
