import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { apiClient } from '../api-client';

interface User {
  id: string;
  email: string;
  nickname: string | null;
  profile_image: string | null;
  gems: number;
  onboarding_completed: boolean;
}

interface AuthState {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;

  // Actions
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, nickname?: string) => Promise<void>;
  logout: () => Promise<void>;
  loadUser: () => Promise<void>;
  updateUser: (updates: Partial<User>) => void;
  setOnboardingCompleted: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      isLoading: false,
      isAuthenticated: false,

      login: async (email: string, password: string) => {
        set({ isLoading: true });
        try {
          const { user } = await apiClient.login(email, password);
          set({
            user: {
              id: user.id,
              email: user.email,
              nickname: user.nickname,
              profile_image: null,
              gems: user.gems,
              onboarding_completed: user.onboarding_completed,
            },
            isAuthenticated: true,
            isLoading: false,
          });
        } catch (error) {
          set({ isLoading: false });
          throw error;
        }
      },

      register: async (email: string, password: string, nickname?: string) => {
        set({ isLoading: true });
        try {
          const { user, session } = await apiClient.register(email, password, nickname);
          if (session) {
            set({
              user: {
                id: user.id,
                email: user.email,
                nickname: user.nickname,
                profile_image: null,
                gems: 100,
                onboarding_completed: false,
              },
              isAuthenticated: true,
              isLoading: false,
            });
          } else {
            // 이메일 인증이 필요한 경우
            set({ isLoading: false });
          }
        } catch (error) {
          set({ isLoading: false });
          throw error;
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
              gems: profile.gems,
              onboarding_completed: profile.onboarding_completed,
            },
            isAuthenticated: true,
            isLoading: false,
          });
        } catch {
          // 토큰이 유효하지 않으면 리프레시 시도
          try {
            await apiClient.refreshToken();
            const profile = await apiClient.getProfile();
            set({
              user: {
                id: profile.id,
                email: profile.email,
                nickname: profile.nickname,
                profile_image: profile.profile_image,
                gems: profile.gems,
                onboarding_completed: profile.onboarding_completed,
              },
              isAuthenticated: true,
              isLoading: false,
            });
          } catch {
            set({ user: null, isAuthenticated: false, isLoading: false });
          }
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
    }
  )
);
