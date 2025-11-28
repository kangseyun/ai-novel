import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import {
  UserPost,
  FeedEvent,
  PostTemplate,
  PersonaProgress,
  ReactionTrigger,
  findMatchingTriggers,
  getProgressStage,
  JUN_REACTION_TRIGGERS,
  JUN_REACTION_SCENARIOS,
} from '@/lib/user-feed-system';

// ============================================
// TYPES
// ============================================

interface FeedState {
  // 유저 포스트
  userPosts: UserPost[];

  // 이벤트/알림
  events: FeedEvent[];
  unreadCount: number;

  // 페르소나 진행도
  personaProgress: Record<string, PersonaProgress>;

  // 현재 활성 DM
  activeDMScenarioId: string | null;
  activeDMPersonaId: string | null;

  // Actions
  createPost: (template: PostTemplate, customCaption?: string) => UserPost;
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

  // Process triggers (포스트 후 반응 체크)
  processPostTriggers: (post: UserPost) => FeedEvent[];

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
      events: [],
      unreadCount: 0,
      personaProgress: {},
      activeDMScenarioId: null,
      activeDMPersonaId: null,

      createPost: (template: PostTemplate, customCaption?: string) => {
        const newPost: UserPost = {
          id: `post_${Date.now()}`,
          type: template.type,
          content: template.preview,
          caption: customCaption || template.caption,
          mood: template.mood,
          timestamp: Date.now(),
          triggeredEvents: [],
        };

        set(state => ({
          userPosts: [newPost, ...state.userPosts],
        }));

        // 트리거 처리
        setTimeout(() => {
          const triggeredEvents = get().processPostTriggers(newPost);

          if (triggeredEvents.length > 0) {
            // 포스트에 트리거된 이벤트 기록
            set(state => ({
              userPosts: state.userPosts.map(p =>
                p.id === newPost.id
                  ? { ...p, triggeredEvents: triggeredEvents.map(e => e.id) }
                  : p
              ),
            }));
          }
        }, 2000 + Math.random() * 3000); // 2-5초 후 반응

        return newPost;
      },

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

      processPostTriggers: (post: UserPost) => {
        const state = get();
        const triggeredEvents: FeedEvent[] = [];

        // 각 페르소나에 대해 트리거 체크
        const personas = ['jun']; // 나중에 더 추가

        for (const personaId of personas) {
          let progress = state.personaProgress[personaId];

          if (!progress) {
            get().initPersonaProgress(personaId);
            progress = get().personaProgress[personaId];
          }

          // Jun의 트리거만 체크 (나중에 확장)
          const triggers = personaId === 'jun' ? JUN_REACTION_TRIGGERS : [];

          const matchingTriggers = findMatchingTriggers(
            personaId,
            post,
            progress,
            triggers
          );

          // 가장 높은 우선순위 트리거만 발동
          if (matchingTriggers.length > 0) {
            const trigger = matchingTriggers[0];

            const event: FeedEvent = {
              id: `event_${Date.now()}_${personaId}`,
              personaId,
              type: trigger.notification.type,
              title: trigger.notification.title,
              preview: trigger.notification.preview,
              timestamp: Date.now(),
              isRead: false,
              scenarioId: trigger.scenarioId,
              triggeredBy: post.id,
            };

            triggeredEvents.push(event);
            get().addEvent(event);
          }
        }

        return triggeredEvents;
      },

      reset: () => {
        set({
          userPosts: [],
          events: [],
          unreadCount: 0,
          personaProgress: {},
          activeDMScenarioId: null,
          activeDMPersonaId: null,
        });
      },
    }),
    {
      name: 'feed-storage',
      partialize: (state) => ({
        userPosts: state.userPosts,
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

export const useEvents = () =>
  useFeedStore((state) => state.events);

export const usePersonaStage = (personaId: string) =>
  useFeedStore((state) => state.personaProgress[personaId]?.stage ?? 'stranger');
