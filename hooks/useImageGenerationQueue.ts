'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { createClient } from '@/lib/supabase-browser';
import type { RealtimeChannel } from '@supabase/supabase-js';

export interface ImageGenerationTask {
  id: string;
  persona_id: string;
  external_task_id: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  prompt: string | null;
  image_type: string;
  error_message: string | null;
  created_at: string;
  updated_at: string;
  // Join된 데이터
  persona_name?: string;
}

export interface ImageHistoryItem {
  id: string;
  persona_id: string;
  task_id: string | null;
  image_url: string;
  prompt: string | null;
  is_current: boolean;
  created_at: string;
}

// 전역 싱글톤으로 폴링 관리 (여러 훅 인스턴스에서 중복 폴링 방지)
let globalPollingInterval: NodeJS.Timeout | null = null;
let globalPollingActive = false;
const processingTaskIds = new Set<string>(); // 현재 처리 중인 태스크 ID 추적

export function useImageGenerationQueue() {
  const [tasks, setTasks] = useState<ImageGenerationTask[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const supabase = createClient();
  const tasksRef = useRef<ImageGenerationTask[]>([]); // 최신 tasks를 ref로 관리

  // 초기 로드 및 Realtime 구독
  useEffect(() => {
    let channel: RealtimeChannel;

    async function loadTasks() {
      setIsLoading(true);
      const { data, error } = await supabase
        .from('persona_image_tasks')
        .select(`
          *,
          persona_core!inner(name)
        `)
        .in('status', ['pending', 'processing'])
        .order('created_at', { ascending: false });

      if (!error && data) {
        const tasksWithName = data.map((t: any) => ({
          ...t,
          persona_name: t.persona_core?.name,
        }));
        setTasks(tasksWithName);
      }
      setIsLoading(false);
    }

    loadTasks();

    // Realtime 구독
    channel = supabase
      .channel('persona_image_tasks_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'persona_image_tasks',
        },
        async (payload) => {
          if (payload.eventType === 'INSERT') {
            // 새 태스크 추가 시 페르소나 이름 가져오기
            const newTask = payload.new as ImageGenerationTask;
            const { data: persona } = await supabase
              .from('persona_core')
              .select('name')
              .eq('id', newTask.persona_id)
              .single();

            setTasks((prev) => [
              { ...newTask, persona_name: persona?.name },
              ...prev.filter((t) => t.id !== newTask.id),
            ]);
          } else if (payload.eventType === 'UPDATE') {
            const updatedTask = payload.new as ImageGenerationTask;
            if (updatedTask.status === 'completed' || updatedTask.status === 'failed') {
              // 완료/실패 시 목록에서 제거
              setTasks((prev) => prev.filter((t) => t.id !== updatedTask.id));
            } else {
              // 상태 업데이트
              setTasks((prev) =>
                prev.map((t) =>
                  t.id === updatedTask.id ? { ...t, ...updatedTask } : t
                )
              );
            }
          } else if (payload.eventType === 'DELETE') {
            const deletedId = (payload.old as any).id;
            setTasks((prev) => prev.filter((t) => t.id !== deletedId));
          }
        }
      )
      .subscribe();

    return () => {
      channel?.unsubscribe();
    };
  }, [supabase]);

  // tasks가 변경될 때마다 ref 업데이트
  useEffect(() => {
    tasksRef.current = tasks;
  }, [tasks]);

  // 백그라운드 폴링: processing 상태인 태스크들의 Kling AI 상태를 확인
  useEffect(() => {
    const processingTasks = tasks.filter(
      (t) => t.status === 'pending' || t.status === 'processing'
    );

    // 처리할 태스크가 없으면 폴링 중지
    if (processingTasks.length === 0) {
      if (globalPollingInterval) {
        clearInterval(globalPollingInterval);
        globalPollingInterval = null;
        globalPollingActive = false;
      }
      return;
    }

    // 이미 전역 폴링이 실행 중이면 스킵
    if (globalPollingActive) return;

    globalPollingActive = true;

    async function pollKlingStatus() {
      // ref에서 최신 tasks 가져오기 (클로저 문제 해결)
      const currentTasks = tasksRef.current.filter(
        (t) => t.status === 'pending' || t.status === 'processing'
      );

      for (const task of currentTasks) {
        // 이미 처리 중인 태스크는 스킵 (중복 처리 방지)
        if (processingTaskIds.has(task.id)) {
          continue;
        }

        try {
          processingTaskIds.add(task.id); // 처리 시작 마킹

          const res = await fetch(
            `/api/admin/persona/generate-image/status?taskId=${task.external_task_id}`
          );
          const data = await res.json();

          if (data.status === 'succeed' && data.images?.length > 0) {
            const imageUrl = data.images[0].url;

            // 히스토리에 이미 같은 task_id로 추가되었는지 확인 (중복 방지)
            const { data: existingHistory } = await supabase
              .from('persona_image_history')
              .select('id')
              .eq('task_id', task.id)
              .limit(1);

            if (!existingHistory || existingHistory.length === 0) {
              // persona_core 업데이트
              await supabase
                .from('persona_core')
                .update({ profile_image_url: imageUrl })
                .eq('id', task.persona_id);

              // 히스토리에 추가 (중복이 없을 때만)
              await supabase.from('persona_image_history').insert({
                persona_id: task.persona_id,
                task_id: task.id,
                image_url: imageUrl,
                prompt: task.prompt,
                is_current: true,
              });

              console.log(`[ImageQueue] Task ${task.id} completed for ${task.persona_name}`);
            } else {
              console.log(`[ImageQueue] Task ${task.id} already processed, skipping history insert`);
            }

            // 태스크 완료 처리
            await supabase
              .from('persona_image_tasks')
              .update({ status: 'completed' })
              .eq('id', task.id);

            processingTaskIds.delete(task.id); // 완료 후 제거
          } else if (data.status === 'failed') {
            // 태스크 실패 처리
            await supabase
              .from('persona_image_tasks')
              .update({
                status: 'failed',
                error_message: data.statusMessage || 'Image generation failed',
              })
              .eq('id', task.id);

            console.log(`[ImageQueue] Task ${task.id} failed for ${task.persona_name}`);
            processingTaskIds.delete(task.id); // 실패 후 제거
          } else {
            // 아직 처리 중이면 다음 폴링에서 다시 확인할 수 있도록 제거
            processingTaskIds.delete(task.id);
          }
        } catch (error) {
          console.error(`[ImageQueue] Failed to poll status for task ${task.id}:`, error);
          processingTaskIds.delete(task.id); // 에러 시에도 제거
        }
      }
    }

    // 즉시 한번 실행
    pollKlingStatus();

    // 5초마다 폴링
    globalPollingInterval = setInterval(pollKlingStatus, 5000);

    return () => {
      // 컴포넌트가 언마운트되어도 전역 폴링은 유지
      // 모든 태스크가 완료되면 위에서 자동으로 중지됨
    };
  }, [tasks, supabase]);

  // 태스크 생성
  const createTask = useCallback(
    async (data: {
      personaId: string;
      externalTaskId: string;
      prompt?: string;
      imageType?: string;
    }) => {
      const { data: task, error } = await supabase
        .from('persona_image_tasks')
        .insert({
          persona_id: data.personaId,
          external_task_id: data.externalTaskId,
          prompt: data.prompt || null,
          image_type: data.imageType || 'profile',
          status: 'processing',
        })
        .select()
        .single();

      if (error) {
        console.error('Failed to create task:', error);
        return null;
      }
      return task;
    },
    [supabase]
  );

  // 태스크 업데이트
  const updateTask = useCallback(
    async (
      externalTaskId: string,
      updates: { status?: string; error_message?: string }
    ) => {
      const { error } = await supabase
        .from('persona_image_tasks')
        .update(updates)
        .eq('external_task_id', externalTaskId);

      if (error) {
        console.error('Failed to update task:', error);
      }
    },
    [supabase]
  );

  // 특정 페르소나의 진행중인 태스크 확인
  const getTaskForPersona = useCallback(
    (personaId: string) => {
      return tasks.find((t) => t.persona_id === personaId);
    },
    [tasks]
  );

  // 진행중인 태스크 목록
  const processingTasks = tasks.filter(
    (t) => t.status === 'pending' || t.status === 'processing'
  );

  return {
    tasks,
    processingTasks,
    isLoading,
    createTask,
    updateTask,
    getTaskForPersona,
  };
}

// 이미지 히스토리 훅
export function useImageHistory(personaId: string | null) {
  const [history, setHistory] = useState<ImageHistoryItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const supabase = createClient();

  useEffect(() => {
    if (!personaId) {
      setHistory([]);
      return;
    }

    let channel: RealtimeChannel;

    async function loadHistory() {
      setIsLoading(true);
      const { data, error } = await supabase
        .from('persona_image_history')
        .select('*')
        .eq('persona_id', personaId)
        .order('created_at', { ascending: false });

      if (!error && data) {
        setHistory(data);
      }
      setIsLoading(false);
    }

    loadHistory();

    // Realtime 구독
    channel = supabase
      .channel(`persona_image_history_${personaId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'persona_image_history',
          filter: `persona_id=eq.${personaId}`,
        },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            setHistory((prev) => [payload.new as ImageHistoryItem, ...prev]);
          } else if (payload.eventType === 'UPDATE') {
            setHistory((prev) =>
              prev.map((h) =>
                h.id === (payload.new as ImageHistoryItem).id
                  ? (payload.new as ImageHistoryItem)
                  : h
              )
            );
          } else if (payload.eventType === 'DELETE') {
            setHistory((prev) =>
              prev.filter((h) => h.id !== (payload.old as any).id)
            );
          }
        }
      )
      .subscribe();

    return () => {
      channel?.unsubscribe();
    };
  }, [personaId, supabase]);

  // 이미지를 히스토리에 추가
  const addToHistory = useCallback(
    async (data: {
      imageUrl: string;
      taskId?: string;
      prompt?: string;
      isCurrent?: boolean;
    }) => {
      if (!personaId) return null;

      const { data: item, error } = await supabase
        .from('persona_image_history')
        .insert({
          persona_id: personaId,
          task_id: data.taskId || null,
          image_url: data.imageUrl,
          prompt: data.prompt || null,
          is_current: data.isCurrent ?? true,
        })
        .select()
        .single();

      if (error) {
        console.error('Failed to add to history:', error);
        return null;
      }
      return item;
    },
    [personaId, supabase]
  );

  // 이미지를 현재 프로필로 설정
  const setAsCurrent = useCallback(
    async (historyId: string) => {
      if (!personaId) return false;

      // 히스토리 아이템의 is_current를 true로 설정 (트리거가 나머지를 false로 변경)
      const { data: historyItem, error: historyError } = await supabase
        .from('persona_image_history')
        .update({ is_current: true })
        .eq('id', historyId)
        .select()
        .single();

      if (historyError) {
        console.error('Failed to set as current:', historyError);
        return false;
      }

      // persona_core의 profile_image_url도 업데이트
      const { error: personaError } = await supabase
        .from('persona_core')
        .update({ profile_image_url: historyItem.image_url })
        .eq('id', personaId);

      if (personaError) {
        console.error('Failed to update persona image:', personaError);
        return false;
      }

      return true;
    },
    [personaId, supabase]
  );

  // 히스토리 아이템 삭제
  const deleteFromHistory = useCallback(
    async (historyId: string) => {
      const { error } = await supabase
        .from('persona_image_history')
        .delete()
        .eq('id', historyId);

      if (error) {
        console.error('Failed to delete from history:', error);
        return false;
      }
      return true;
    },
    [supabase]
  );

  return {
    history,
    isLoading,
    addToHistory,
    setAsCurrent,
    deleteFromHistory,
  };
}
