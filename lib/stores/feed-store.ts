import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import {
  UserPost,
  FeedEvent,
  PersonaProgress,
  getProgressStage,
} from '@/lib/user-feed-system';
import { apiClient } from '../api-client';

// ============================================
// TYPES
// ============================================

// 페르소나 포스트 타입
interface PersonaPost {
  id: string;
  type: 'persona_post';
  persona_id: string;
  persona: {
    id: string;
    name: string;
    display_name: string;
    avatar_url: string | null;
  } | null;
  content: {
    images: string[];
    caption: string;
    location: string | null;
    mood: string;
    hashtags: string[];
  };
  likes: number;
  comments: number;
  user_liked: boolean;
  is_premium: boolean;
  created_at: string;
}

interface FeedState {
  // 유저 포스트
  userPosts: UserPost[];

  // 페르소나 포스트
  personaPosts: PersonaPost[];

  // 이벤트/알림
  events: FeedEvent[];
  unreadCount: number;

  // 페르소나 진행도
  personaProgress: Record<string, PersonaProgress>;

  // 현재 활성 DM
  activeDMScenarioId: string | null;
  activeDMPersonaId: string | null;

  // 로딩 상태
  isLoading: boolean;
  lastError: string | null;

  // Actions
  addEvent: (event: Omit<FeedEvent, 'id' | 'timestamp' | 'isRead'>) => void;
  markEventAsRead: (eventId: string) => void;
  markAllEventsAsRead: () => void;
  deletePost: (postId: string) => void;

  // Persona Progress
  initPersonaProgress: (personaId: string) => void;
  updatePersonaAffection: (personaId: string, change: number) => void;
  completePersonaScenario: (personaId: string, scenarioId: string) => void;
  getPersonaProgress: (personaId: string) => PersonaProgress | null;

  // DM
  setActiveDM: (personaId: string | null, scenarioId: string | null) => void;

  // API Actions
  loadFeedFromServer: (page?: number) => Promise<void>;
  loadEventsFromServer: () => Promise<void>;
  createPostToServer: (data: { type: string; mood?: string; caption: string; image?: string }) => Promise<void>;

  reset: () => void;
}

// ============================================
// INITIAL STATE
// ============================================

const initialPersonaProgress = (personaId: string): PersonaProgress => ({
  personaId,
  stage: 'stranger',
  affection: 0,
  completedScenarios: [],
  unlockedScenarios: [],
  lastInteraction: Date.now(),
  flags: {},
});

// ============================================
// STORE
// ============================================

export const useFeedStore = create<FeedState>()(
  persist(
    (set, get) => ({
      userPosts: [],
      personaPosts: [],
      events: [],
      unreadCount: 0,
      personaProgress: {},
      activeDMScenarioId: null,
      activeDMPersonaId: null,
      isLoading: false,
      lastError: null,

      addEvent: (eventData) => {
        const newEvent: FeedEvent = {
          ...eventData,
          id: `event_${Date.now()}`,
          timestamp: Date.now(),
          isRead: false,
        };

        set(state => ({
          events: [newEvent, ...state.events],
          unreadCount: state.unreadCount + 1,
        }));
      },

      markEventAsRead: (eventId: string) => {
        set(state => {
          const event = state.events.find(e => e.id === eventId);
          if (!event || event.isRead) return state;

          return {
            events: state.events.map(e =>
              e.id === eventId ? { ...e, isRead: true } : e
            ),
            unreadCount: Math.max(0, state.unreadCount - 1),
          };
        });
      },

      markAllEventsAsRead: () => {
        set(state => ({
          events: state.events.map(e => ({ ...e, isRead: true })),
          unreadCount: 0,
        }));
      },

      deletePost: (postId: string) => {
        set(state => ({
          userPosts: state.userPosts.filter(p => p.id !== postId),
        }));
      },

      initPersonaProgress: (personaId: string) => {
        const state = get();
        if (!state.personaProgress[personaId]) {
          set({
            personaProgress: {
              ...state.personaProgress,
              [personaId]: initialPersonaProgress(personaId),
            },
          });
        }
      },

      updatePersonaAffection: (personaId: string, change: number) => {
        const state = get();
        let progress = state.personaProgress[personaId];

        if (!progress) {
          get().initPersonaProgress(personaId);
          progress = get().personaProgress[personaId];
        }

        const newAffection = progress.affection + change;
        const newStage = getProgressStage(newAffection);

        set({
          personaProgress: {
            ...state.personaProgress,
            [personaId]: {
              ...progress,
              affection: newAffection,
              stage: newStage,
              lastInteraction: Date.now(),
            },
          },
        });
      },

      completePersonaScenario: (personaId: string, scenarioId: string) => {
        const state = get();
        const progress = state.personaProgress[personaId];

        if (!progress) {
          get().initPersonaProgress(personaId);
          return get().completePersonaScenario(personaId, scenarioId);
        }

        if (!progress.completedScenarios.includes(scenarioId)) {
          set({
            personaProgress: {
              ...state.personaProgress,
              [personaId]: {
                ...progress,
                completedScenarios: [...progress.completedScenarios, scenarioId],
                lastInteraction: Date.now(),
              },
            },
          });
        }
      },

      getPersonaProgress: (personaId: string) => {
        return get().personaProgress[personaId] || null;
      },

      setActiveDM: (personaId: string | null, scenarioId: string | null) => {
        set({
          activeDMPersonaId: personaId,
          activeDMScenarioId: scenarioId,
        });
      },

      // API: 서버에서 피드 불러오기
      loadFeedFromServer: async (page = 1) => {
        set({ isLoading: true, lastError: null });
        try {
          const data = await apiClient.getFeed(page);

          // 유저 포스트 변환
          const serverUserPosts: UserPost[] = data.posts
            .filter((p: { type: string }) => p.type === 'user_post')
            .map((p: { id: string; content: { mood?: string; caption?: string; image?: string }; created_at: string }) => ({
              id: p.id,
              type: (p.content.mood ? 'mood' : 'text') as UserPost['type'],
              content: p.content.image || p.content.caption || '',
              caption: p.content.caption || '',
              mood: p.content.mood as UserPost['mood'],
              timestamp: new Date(p.created_at).getTime(),
              triggeredEvents: [],
            }));

          // 페르소나 포스트 변환
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const serverPersonaPosts: PersonaPost[] = data.posts
            .filter((p: { type: string }) => p.type === 'persona_post')
            .map((p: any) => ({
              id: p.id,
              type: 'persona_post' as const,
              persona_id: p.persona_id,
              persona: p.persona,
              content: {
                images: p.content?.images || [],
                caption: p.content?.caption || '',
                location: p.content?.location || null,
                mood: p.content?.mood || '',
                hashtags: p.content?.hashtags || [],
              },
              likes: p.likes || 0,
              comments: p.comments || 0,
              user_liked: p.user_liked || false,
              is_premium: p.is_premium || false,
              created_at: p.created_at,
            }));

          set((state) => ({
            userPosts: page === 1 ? serverUserPosts : [...state.userPosts, ...serverUserPosts],
            personaPosts: page === 1 ? serverPersonaPosts : [...state.personaPosts, ...serverPersonaPosts],
            isLoading: false,
          }));
        } catch (error) {
          const message = error instanceof Error ? error.message : '피드 로드 실패';
          set({ isLoading: false, lastError: message });
        }
      },

      // API: 서버에서 이벤트 불러오기
      loadEventsFromServer: async () => {
        set({ isLoading: true, lastError: null });
        try {
          const data = await apiClient.getEvents();

          // 서버 이벤트를 로컬 형식으로 변환
          const serverEvents: FeedEvent[] = data.events.map((e: {
            id: string;
            type: string;
            persona_id: string | null;
            title: string | null;
            preview: string | null;
            read: boolean;
            created_at: string;
          }) => ({
            id: e.id,
            personaId: e.persona_id || 'unknown',
            type: e.type as FeedEvent['type'],
            title: e.title || '',
            preview: e.preview || '',
            timestamp: new Date(e.created_at).getTime(),
            isRead: e.read,
          }));

          set({
            events: serverEvents,
            unreadCount: data.unread_count,
            isLoading: false,
          });
        } catch (error) {
          const message = error instanceof Error ? error.message : '이벤트 로드 실패';
          set({ isLoading: false, lastError: message });
        }
      },

      // API: 서버에 포스트 생성
      createPostToServer: async (data) => {
        set({ isLoading: true, lastError: null });
        try {
          const result = await apiClient.createPost(data);

          // 로컬 스토어에도 추가
          const newPost: UserPost = {
            id: result.post.id,
            type: (data.mood ? 'mood' : 'text') as UserPost['type'],
            content: data.image || data.caption,
            caption: data.caption,
            mood: data.mood as UserPost['mood'],
            timestamp: new Date(result.post.created_at).getTime(),
            triggeredEvents: result.triggered_events.map((e: { id: string }) => e.id),
          };

          set((state) => ({
            userPosts: [newPost, ...state.userPosts],
            isLoading: false,
          }));

          // 트리거된 이벤트가 있으면 로컬에도 추가
          if (result.triggered_events.length > 0) {
            for (const event of result.triggered_events) {
              get().addEvent({
                personaId: event.persona_id,
                type: event.type as FeedEvent['type'],
                title: 'Jun님이 DM을 보냈습니다',
                preview: event.preview,
              });
            }
          }
        } catch (error) {
          const message = error instanceof Error ? error.message : '포스트 생성 실패';
          set({ isLoading: false, lastError: message });
          throw error;
        }
      },

      reset: () => {
        set({
          userPosts: [],
          personaPosts: [],
          events: [],
          unreadCount: 0,
          personaProgress: {},
          activeDMScenarioId: null,
          activeDMPersonaId: null,
          isLoading: false,
          lastError: null,
        });
      },
    }),
    {
      name: 'feed-storage',
      partialize: (state) => ({
        userPosts: state.userPosts,
        personaPosts: state.personaPosts,
        events: state.events,
        unreadCount: state.unreadCount,
        personaProgress: state.personaProgress,
      }),
    }
  )
);

// ============================================
// SELECTORS
// ============================================

export const useUnreadCount = () =>
  useFeedStore((state) => state.unreadCount);

export const useUserPosts = () =>
  useFeedStore((state) => state.userPosts);

export const usePersonaPosts = () =>
  useFeedStore((state) => state.personaPosts);

export const useEvents = () =>
  useFeedStore((state) => state.events);

export const usePersonaStage = (personaId: string) =>
  useFeedStore((state) => state.personaProgress[personaId]?.stage ?? 'stranger');
