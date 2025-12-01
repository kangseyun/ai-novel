import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { apiClient } from '../api-client';

interface User {
  id: string;
  email: string;
  nickname: string | null;
  profile_image: string | null;
  tokens: number;
  onboarding_completed: boolean;
}

interface AuthState {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  hasHydrated: boolean;
  isInitialized: boolean;

  // Actions
  initialize: () => void;
  logout: () => Promise<void>;
  forceLogout: () => void;
  loadUser: () => Promise<void>;
  updateUser: (updates: Partial<User>) => void;
  setOnboardingCompleted: () => void;
  setHasHydrated: (state: boolean) => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      isLoading: false,
      isAuthenticated: false,
      hasHydrated: false,
      isInitialized: false,

      setHasHydrated: (state: boolean) => {
        set({ hasHydrated: state });
      },

      initialize: () => {
        if (get().isInitialized) return;

        // apiClient에 인증 에러 콜백 등록
        apiClient.setOnAuthError(() => {
          get().forceLogout();
        });

        set({ isInitialized: true });
      },

      forceLogout: () => {
        set({ user: null, isAuthenticated: false });
        // 로그인 페이지로 리다이렉트
        if (typeof window !== 'undefined') {
          window.location.href = '/login';
        }
      },

      logout: async () => {
        try {
          await apiClient.logout();
        } finally {
          set({ user: null, isAuthenticated: false });
        }
      },

      loadUser: async () => {
        const { initialize } = get();
        initialize(); // 초기화 보장

        const token = apiClient.getAccessToken();
        if (!token) {
          set({ user: null, isAuthenticated: false });
          return;
        }

        set({ isLoading: true });
        try {
          const profile = await apiClient.getProfile();
          set({
            user: {
              id: profile.id,
              email: profile.email,
              nickname: profile.nickname,
              profile_image: profile.profile_image,
              tokens: profile.tokens,
              onboarding_completed: profile.onboarding_completed,
            },
            isAuthenticated: true,
            isLoading: false,
          });
        } catch {
          // 401 에러 시 apiClient 내부에서 자동 처리됨
          set({ user: null, isAuthenticated: false, isLoading: false });
        }
      },

      updateUser: (updates: Partial<User>) => {
        const { user } = get();
        if (user) {
          set({ user: { ...user, ...updates } });
        }
      },

      setOnboardingCompleted: () => {
        const { user } = get();
        if (user) {
          set({ user: { ...user, onboarding_completed: true } });
        }
      },
    }),
    {
      name: 'auth-storage',
      partialize: (state) => ({
        user: state.user,
        isAuthenticated: state.isAuthenticated,
      }),
      onRehydrateStorage: () => (state) => {
        state?.setHasHydrated(true);
        state?.initialize(); // apiClient 콜백 등록
      },
    }
  )
);
