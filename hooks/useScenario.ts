'use client';

import { useState, useCallback, useEffect } from 'react';
import type {
  ScenarioTemplate,
  ScenarioScene,
  ScenarioChoice,
  UserScenarioProgress,
} from '@/lib/ai-agent/modules/scenario-service';

// ============================================
// 타입 정의
// ============================================

export interface UseScenarioOptions {
  /** 페르소나 ID */
  personaId: string;
  /** 특정 시나리오 ID (없으면 첫 만남 시나리오 사용) */
  scenarioId?: string;
  /** 자동으로 시나리오 시작 */
  autoStart?: boolean;
  /** 완료 시 콜백 */
  onComplete?: (result: ScenarioCompletionResult) => void;
  /** 에러 발생 시 콜백 */
  onError?: (error: Error) => void;
}

export interface ScenarioCompletionResult {
  scenarioId: string;
  totalAffection: number;
  choicesMade: Array<{
    sceneId: string;
    choiceId: string;
    choiceText: string;
    affectionChange: number;
  }>;
  completedAt: Date;
}

export interface UseScenarioReturn {
  // 상태
  scenario: ScenarioTemplate | null;
  progress: UserScenarioProgress | null;
  currentScene: ScenarioScene | null;
  currentSceneIndex: number;
  isLoading: boolean;
  isStarted: boolean;
  isCompleted: boolean;
  error: Error | null;
  totalAffection: number;

  // 액션
  loadScenario: () => Promise<void>;
  startScenario: () => Promise<void>;
  advanceToScene: (sceneId: string, choice?: ScenarioChoice) => Promise<void>;
  advanceToNextScene: () => void;
  makeChoice: (choice: ScenarioChoice) => Promise<void>;
  completeScenario: () => Promise<void>;
  reset: () => void;
}

// ============================================
// API 헬퍼
// ============================================

async function fetchApi<T>(url: string, options?: RequestInit): Promise<T> {
  const token = typeof window !== 'undefined' ? localStorage.getItem('access_token') : null;

  const response = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options?.headers,
    },
  });

  if (!response.ok) {
    throw new Error(`API error: ${response.status}`);
  }

  return response.json();
}

// ============================================
// 훅 구현
// ============================================

export function useScenario({
  personaId,
  scenarioId,
  autoStart = false,
  onComplete,
  onError,
}: UseScenarioOptions): UseScenarioReturn {
  // 상태
  const [scenario, setScenario] = useState<ScenarioTemplate | null>(null);
  const [progress, setProgress] = useState<UserScenarioProgress | null>(null);
  const [currentSceneIndex, setCurrentSceneIndex] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [isStarted, setIsStarted] = useState(false);
  const [isCompleted, setIsCompleted] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [totalAffection, setTotalAffection] = useState(0);
  const [choicesMade, setChoicesMade] = useState<ScenarioCompletionResult['choicesMade']>([]);

  // 현재 씬 계산
  const currentScene = scenario?.content?.scenes?.[currentSceneIndex] || null;

  // 시나리오 로드
  const loadScenario = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const url = scenarioId
        ? `/api/scenario?scenarioId=${scenarioId}`
        : `/api/scenario?personaId=${personaId}&type=first_meeting`;

      const response = await fetchApi<{
        scenario?: ScenarioTemplate;
        progress?: UserScenarioProgress;
      }>(url);

      if (response.scenario) {
        setScenario(response.scenario);

        // 기존 진행 상태가 있으면 복원
        if (response.progress) {
          setProgress(response.progress);
          setIsStarted(true);

          // 현재 위치로 이동
          if (response.progress.currentPosition?.sceneIndex !== undefined) {
            setCurrentSceneIndex(response.progress.currentPosition.sceneIndex);
          } else if (response.progress.currentPosition?.sceneId) {
            const idx = response.scenario.content.scenes.findIndex(
              (s: ScenarioScene) => s.id === response.progress!.currentPosition.sceneId
            );
            if (idx >= 0) setCurrentSceneIndex(idx);
          }

          // 호감도 복원
          if (response.progress.choicesMade) {
            const total = response.progress.choicesMade.reduce(
              (sum: number, c) => sum + ((c as unknown as { affectionChange?: number }).affectionChange || 0),
              0
            );
            setTotalAffection(total);
          }
        }
      }
    } catch (err) {
      const e = err instanceof Error ? err : new Error('Failed to load scenario');
      setError(e);
      onError?.(e);
    } finally {
      setIsLoading(false);
    }
  }, [personaId, scenarioId, onError]);

  // 시나리오 시작
  const startScenario = useCallback(async () => {
    if (!scenario) {
      await loadScenario();
    }

    setIsLoading(true);
    setError(null);

    try {
      const response = await fetchApi<{ progress?: UserScenarioProgress }>('/api/scenario', {
        method: 'POST',
        body: JSON.stringify({
          personaId,
          scenarioId: scenario?.id || scenarioId,
          action: 'start',
        }),
      });

      if (response.progress) {
        setProgress(response.progress);
      }

      setIsStarted(true);
      setCurrentSceneIndex(0);
      setTotalAffection(0);
      setChoicesMade([]);
    } catch (err) {
      const e = err instanceof Error ? err : new Error('Failed to start scenario');
      setError(e);
      onError?.(e);
    } finally {
      setIsLoading(false);
    }
  }, [personaId, scenario, scenarioId, loadScenario, onError]);

  // 특정 씬으로 이동
  const advanceToScene = useCallback(async (sceneId: string, choice?: ScenarioChoice) => {
    if (!scenario) return;

    const idx = scenario.content.scenes.findIndex(s => s.id === sceneId);
    if (idx < 0) return;

    try {
      // 서버에 진행 상태 업데이트
      const response = await fetchApi<{ progress?: UserScenarioProgress }>('/api/scenario/advance', {
        method: 'POST',
        body: JSON.stringify({
          personaId,
          scenarioId: scenario.id,
          nextSceneId: sceneId,
          choice: choice ? {
            sceneId: currentScene?.id,
            choiceId: choice.id,
          } : undefined,
        }),
      });

      if (response.progress) {
        setProgress(response.progress);
      }

      setCurrentSceneIndex(idx);
    } catch (err) {
      console.error('Failed to advance scene:', err);
    }
  }, [personaId, scenario, currentScene]);

  // 다음 씬으로 이동 (선택지 없을 때)
  const advanceToNextScene = useCallback(() => {
    if (!scenario) return;

    const nextIndex = currentSceneIndex + 1;
    if (nextIndex < scenario.content.scenes.length) {
      setCurrentSceneIndex(nextIndex);
    }
  }, [scenario, currentSceneIndex]);

  // 선택지 선택
  const makeChoice = useCallback(async (choice: ScenarioChoice) => {
    if (!scenario || !currentScene) return;

    // 호감도 업데이트
    if (choice.affectionChange) {
      setTotalAffection(prev => prev + choice.affectionChange);
    }

    // 선택 기록
    setChoicesMade(prev => [...prev, {
      sceneId: currentScene.id,
      choiceId: choice.id,
      choiceText: choice.text,
      affectionChange: choice.affectionChange,
    }]);

    // 다음 씬으로 이동
    if (choice.nextScene) {
      await advanceToScene(choice.nextScene, choice);
    } else {
      // 다음 씬이 지정되지 않으면 순차 이동
      const nextIndex = currentSceneIndex + 1;
      if (nextIndex < scenario.content.scenes.length) {
        setCurrentSceneIndex(nextIndex);
      } else {
        // 마지막이면 완료
        await completeScenarioInternal();
      }
    }
  }, [scenario, currentScene, currentSceneIndex, advanceToScene]);

  // 시나리오 완료 (내부용)
  const completeScenarioInternal = useCallback(async () => {
    if (!scenario) return;

    setIsLoading(true);

    try {
      await fetchApi('/api/scenario/advance', {
        method: 'POST',
        body: JSON.stringify({
          personaId,
          scenarioId: scenario.id,
          action: 'complete',
          totalAffection,
        }),
      });

      setIsCompleted(true);

      onComplete?.({
        scenarioId: scenario.id,
        totalAffection,
        choicesMade,
        completedAt: new Date(),
      });
    } catch (err) {
      const e = err instanceof Error ? err : new Error('Failed to complete scenario');
      setError(e);
      onError?.(e);
    } finally {
      setIsLoading(false);
    }
  }, [personaId, scenario, totalAffection, choicesMade, onComplete, onError]);

  // 시나리오 완료 (외부 호출용)
  const completeScenario = useCallback(async () => {
    await completeScenarioInternal();
  }, [completeScenarioInternal]);

  // 리셋
  const reset = useCallback(() => {
    setScenario(null);
    setProgress(null);
    setCurrentSceneIndex(0);
    setIsStarted(false);
    setIsCompleted(false);
    setError(null);
    setTotalAffection(0);
    setChoicesMade([]);
  }, []);

  // 자동 시작
  useEffect(() => {
    if (autoStart && !scenario && !isLoading) {
      loadScenario();
    }
  }, [autoStart, scenario, isLoading, loadScenario]);

  return {
    scenario,
    progress,
    currentScene,
    currentSceneIndex,
    isLoading,
    isStarted,
    isCompleted,
    error,
    totalAffection,
    loadScenario,
    startScenario,
    advanceToScene,
    advanceToNextScene,
    makeChoice,
    completeScenario,
    reset,
  };
}

// ============================================
// 편의 훅들
// ============================================

/**
 * 첫 만남 시나리오 전용 훅
 */
export function useFirstMeetingScenario(
  personaId: string,
  options?: Omit<UseScenarioOptions, 'personaId'>
) {
  return useScenario({
    personaId,
    autoStart: true,
    ...options,
  });
}

/**
 * 특정 시나리오 전용 훅
 */
export function useSpecificScenario(
  personaId: string,
  scenarioId: string,
  options?: Omit<UseScenarioOptions, 'personaId' | 'scenarioId'>
) {
  return useScenario({
    personaId,
    scenarioId,
    autoStart: true,
    ...options,
  });
}
