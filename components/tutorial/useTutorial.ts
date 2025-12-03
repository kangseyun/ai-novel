'use client';

import { useCallback } from 'react';
import { useTutorialStore } from '@/lib/stores/tutorial-store';

/**
 * useTutorial Hook
 * - 컴포넌트에서 튜토리얼을 쉽게 시작/제어할 수 있습니다
 */
export function useTutorial() {
  const {
    startTutorial,
    nextStep,
    prevStep,
    skipTutorial,
    completeTutorial,
    resetTutorial,
    resetAllTutorials,
    getCurrentStep,
    isActive,
    isTutorialCompleted,
    activeTutorialId,
    currentStepIndex,
    tutorials,
  } = useTutorialStore();

  // 초기 튜토리얼 시작 (온보딩 완료 후)
  const startInitialTutorial = useCallback(() => {
    startTutorial('initial-tutorial');
  }, [startTutorial]);

  // DM 튜토리얼 시작
  const startDMTutorial = useCallback(() => {
    startTutorial('dm-tutorial');
  }, [startTutorial]);

  // 시나리오 튜토리얼 시작
  const startScenarioTutorial = useCallback(() => {
    startTutorial('scenario-tutorial');
  }, [startTutorial]);

  // 현재 튜토리얼 정보
  const tutorial = activeTutorialId ? tutorials[activeTutorialId] : null;
  const currentStep = getCurrentStep();
  const totalSteps = tutorial?.steps.length || 0;
  const progress = totalSteps > 0 ? (currentStepIndex + 1) / totalSteps : 0;

  return {
    // 액션
    startTutorial,
    startInitialTutorial,
    startDMTutorial,
    startScenarioTutorial,
    nextStep,
    prevStep,
    skipTutorial,
    completeTutorial,
    resetTutorial,
    resetAllTutorials,

    // 상태
    isActive: isActive(),
    activeTutorialId,
    currentStep,
    currentStepIndex,
    totalSteps,
    progress,

    // 체크
    isTutorialCompleted,
    isInitialTutorialCompleted: () => isTutorialCompleted('initial-tutorial'),
    isDMTutorialCompleted: () => isTutorialCompleted('dm-tutorial'),
    isScenarioTutorialCompleted: () => isTutorialCompleted('scenario-tutorial'),
  };
}
