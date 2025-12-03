'use client';

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface TutorialStep {
  id: string;
  /** 타겟 요소의 selector (예: '[data-tutorial="dm-button"]') */
  targetSelector: string;
  /** 안내 메시지 */
  message: string;
  /** 메시지 위치 */
  position: 'top' | 'bottom' | 'left' | 'right';
  /** 다음 스텝으로 넘어가는 조건 */
  advanceOn: 'click' | 'auto';
  /** auto일 경우 딜레이 (ms) */
  autoDelay?: number;
  /** 하이라이트 패딩 */
  padding?: number;
  /** 추가 설명 */
  subMessage?: string;
}

export interface TutorialSequence {
  id: string;
  name: string;
  steps: TutorialStep[];
}

interface TutorialState {
  // 현재 진행 중인 튜토리얼
  activeTutorialId: string | null;
  currentStepIndex: number;

  // 완료된 튜토리얼 목록
  completedTutorials: string[];

  // 튜토리얼 시퀀스 저장소
  tutorials: Record<string, TutorialSequence>;

  // Actions
  registerTutorial: (tutorial: TutorialSequence) => void;
  startTutorial: (tutorialId: string) => void;
  nextStep: () => void;
  prevStep: () => void;
  skipTutorial: () => void;
  completeTutorial: () => void;
  resetTutorial: (tutorialId: string) => void;
  resetAllTutorials: () => void;

  // Getters
  getCurrentStep: () => TutorialStep | null;
  isActive: () => boolean;
  isTutorialCompleted: (tutorialId: string) => boolean;
}

export const useTutorialStore = create<TutorialState>()(
  persist(
    (set, get) => ({
      activeTutorialId: null,
      currentStepIndex: 0,
      completedTutorials: [],
      tutorials: {},

      registerTutorial: (tutorial) => {
        set((state) => ({
          tutorials: {
            ...state.tutorials,
            [tutorial.id]: tutorial,
          },
        }));
      },

      startTutorial: (tutorialId) => {
        const tutorial = get().tutorials[tutorialId];
        if (!tutorial) {
          console.warn(`Tutorial "${tutorialId}" not found`);
          return;
        }

        // 이미 완료된 튜토리얼은 시작하지 않음
        if (get().completedTutorials.includes(tutorialId)) {
          console.log(`Tutorial "${tutorialId}" already completed`);
          return;
        }

        set({
          activeTutorialId: tutorialId,
          currentStepIndex: 0,
        });
      },

      nextStep: () => {
        const { activeTutorialId, currentStepIndex, tutorials } = get();
        if (!activeTutorialId) return;

        const tutorial = tutorials[activeTutorialId];
        if (!tutorial) return;

        if (currentStepIndex < tutorial.steps.length - 1) {
          set({ currentStepIndex: currentStepIndex + 1 });
        } else {
          // 마지막 스텝이면 완료
          get().completeTutorial();
        }
      },

      prevStep: () => {
        const { currentStepIndex } = get();
        if (currentStepIndex > 0) {
          set({ currentStepIndex: currentStepIndex - 1 });
        }
      },

      skipTutorial: () => {
        const { activeTutorialId } = get();
        if (activeTutorialId) {
          set((state) => ({
            activeTutorialId: null,
            currentStepIndex: 0,
            completedTutorials: [...state.completedTutorials, activeTutorialId],
          }));
        }
      },

      completeTutorial: () => {
        const { activeTutorialId } = get();
        if (activeTutorialId) {
          set((state) => ({
            activeTutorialId: null,
            currentStepIndex: 0,
            completedTutorials: [...state.completedTutorials, activeTutorialId],
          }));
        }
      },

      resetTutorial: (tutorialId) => {
        set((state) => ({
          completedTutorials: state.completedTutorials.filter((id) => id !== tutorialId),
        }));
      },

      resetAllTutorials: () => {
        set({
          activeTutorialId: null,
          currentStepIndex: 0,
          completedTutorials: [],
        });
      },

      getCurrentStep: () => {
        const { activeTutorialId, currentStepIndex, tutorials } = get();
        if (!activeTutorialId) return null;

        const tutorial = tutorials[activeTutorialId];
        if (!tutorial) return null;

        return tutorial.steps[currentStepIndex] || null;
      },

      isActive: () => {
        return get().activeTutorialId !== null;
      },

      isTutorialCompleted: (tutorialId) => {
        return get().completedTutorials.includes(tutorialId);
      },
    }),
    {
      name: 'tutorial-storage',
      partialize: (state) => ({
        completedTutorials: state.completedTutorials,
      }),
    }
  )
);
