'use client';

import { useEffect, ReactNode } from 'react';
import SpotlightTutorial from './SpotlightTutorial';
import { useTutorialStore } from '@/lib/stores/tutorial-store';
import { ALL_TUTORIALS } from '@/lib/tutorial-data';

interface TutorialProviderProps {
  children: ReactNode;
}

/**
 * TutorialProvider
 * - 모든 튜토리얼을 등록하고 SpotlightTutorial을 렌더링합니다
 * - 앱 최상위에 배치하세요
 */
export default function TutorialProvider({ children }: TutorialProviderProps) {
  const registerTutorial = useTutorialStore((state) => state.registerTutorial);

  // 앱 시작 시 모든 튜토리얼 등록
  useEffect(() => {
    ALL_TUTORIALS.forEach((tutorial) => {
      registerTutorial(tutorial);
    });
  }, [registerTutorial]);

  return (
    <>
      {children}
      <SpotlightTutorial />
    </>
  );
}
