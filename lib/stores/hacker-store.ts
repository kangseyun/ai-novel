import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { HACK_LEVELS, DMEnding } from '@/lib/hacked-sns-data';

// ============================================
// TYPES
// ============================================

interface ProfileProgress {
  profileId: string;
  hackLevel: number;
  hackXP: number;
  viewedStories: string[];
  unlockedFiles: string[];
  completedScenarios: string[];
  affectionLevel: number;
  endings: string[];        // 획득한 엔딩 IDs
  lastInteraction: number;  // timestamp
}

interface HackerState {
  // Global state
  isInitialized: boolean;
  totalXP: number;
  globalHackLevel: number;

  // Per-profile progress
  profiles: Record<string, ProfileProgress>;

  // Actions
  initProfile: (profileId: string) => void;
  gainXP: (profileId: string, amount: number) => void;
  viewStory: (profileId: string, storyId: string) => void;
  unlockFile: (profileId: string, fileId: string) => void;
  completeScenario: (profileId: string, scenarioId: string, ending: DMEnding) => void;
  updateAffection: (profileId: string, change: number) => void;
  getProfile: (profileId: string) => ProfileProgress | null;
  canAccessContent: (profileId: string, requiredLevel: number) => boolean;
  reset: () => void;
}

// ============================================
// INITIAL STATE
// ============================================

const initialProfileProgress = (profileId: string): ProfileProgress => ({
  profileId,
  hackLevel: 1,
  hackXP: 0,
  viewedStories: [],
  unlockedFiles: [],
  completedScenarios: [],
  affectionLevel: 0,
  endings: [],
  lastInteraction: Date.now(),
});

// ============================================
// STORE
// ============================================

export const useHackerStore = create<HackerState>()(
  persist(
    (set, get) => ({
      isInitialized: false,
      totalXP: 0,
      globalHackLevel: 1,
      profiles: {},

      initProfile: (profileId: string) => {
        const state = get();
        if (!state.profiles[profileId]) {
          set({
            isInitialized: true,
            profiles: {
              ...state.profiles,
              [profileId]: initialProfileProgress(profileId),
            },
          });
        }
      },

      gainXP: (profileId: string, amount: number) => {
        const state = get();
        const profile = state.profiles[profileId];

        if (!profile) {
          // Auto-initialize if needed
          get().initProfile(profileId);
          return get().gainXP(profileId, amount);
        }

        const newXP = profile.hackXP + amount;
        const newTotalXP = state.totalXP + amount;

        // Check for level up
        let newLevel = profile.hackLevel;
        for (const level of HACK_LEVELS) {
          if (newXP >= level.xpRequired && level.level > newLevel) {
            newLevel = level.level;
          }
        }

        // Update global level too
        let newGlobalLevel = state.globalHackLevel;
        for (const level of HACK_LEVELS) {
          if (newTotalXP >= level.xpRequired * 2 && level.level > newGlobalLevel) {
            newGlobalLevel = level.level;
          }
        }

        set({
          totalXP: newTotalXP,
          globalHackLevel: newGlobalLevel,
          profiles: {
            ...state.profiles,
            [profileId]: {
              ...profile,
              hackXP: newXP,
              hackLevel: newLevel,
              lastInteraction: Date.now(),
            },
          },
        });
      },

      viewStory: (profileId: string, storyId: string) => {
        const state = get();
        const profile = state.profiles[profileId];

        if (!profile) {
          get().initProfile(profileId);
          return get().viewStory(profileId, storyId);
        }

        if (!profile.viewedStories.includes(storyId)) {
          set({
            profiles: {
              ...state.profiles,
              [profileId]: {
                ...profile,
                viewedStories: [...profile.viewedStories, storyId],
                lastInteraction: Date.now(),
              },
            },
          });

          // Grant XP for viewing secret stories
          if (storyId.includes('secret')) {
            get().gainXP(profileId, 15);
          } else {
            get().gainXP(profileId, 5);
          }
        }
      },

      unlockFile: (profileId: string, fileId: string) => {
        const state = get();
        const profile = state.profiles[profileId];

        if (!profile) {
          get().initProfile(profileId);
          return get().unlockFile(profileId, fileId);
        }

        if (!profile.unlockedFiles.includes(fileId)) {
          set({
            profiles: {
              ...state.profiles,
              [profileId]: {
                ...profile,
                unlockedFiles: [...profile.unlockedFiles, fileId],
                lastInteraction: Date.now(),
              },
            },
          });

          // Grant XP for unlocking files
          get().gainXP(profileId, 25);
        }
      },

      completeScenario: (profileId: string, scenarioId: string, ending: DMEnding) => {
        const state = get();
        const profile = state.profiles[profileId];

        if (!profile) {
          get().initProfile(profileId);
          return get().completeScenario(profileId, scenarioId, ending);
        }

        const updatedProfile = { ...profile };

        // Add scenario to completed list
        if (!updatedProfile.completedScenarios.includes(scenarioId)) {
          updatedProfile.completedScenarios = [...updatedProfile.completedScenarios, scenarioId];
        }

        // Add ending
        if (!updatedProfile.endings.includes(ending.id)) {
          updatedProfile.endings = [...updatedProfile.endings, ending.id];
        }

        updatedProfile.lastInteraction = Date.now();

        set({
          profiles: {
            ...state.profiles,
            [profileId]: updatedProfile,
          },
        });

        // Grant XP based on ending type
        const xpRewards: Record<string, number> = {
          good: 50,
          normal: 30,
          bad: 10,
          secret: 100,
        };
        get().gainXP(profileId, xpRewards[ending.type] || 20);

        // Unlock any files from ending
        if (ending.unlocks) {
          ending.unlocks.forEach(unlockId => {
            if (unlockId.startsWith('file_')) {
              get().unlockFile(profileId, unlockId);
            }
          });
        }
      },

      updateAffection: (profileId: string, change: number) => {
        const state = get();
        const profile = state.profiles[profileId];

        if (!profile) {
          get().initProfile(profileId);
          return get().updateAffection(profileId, change);
        }

        set({
          profiles: {
            ...state.profiles,
            [profileId]: {
              ...profile,
              affectionLevel: profile.affectionLevel + change,
              lastInteraction: Date.now(),
            },
          },
        });
      },

      getProfile: (profileId: string) => {
        return get().profiles[profileId] || null;
      },

      canAccessContent: (profileId: string, requiredLevel: number) => {
        const profile = get().profiles[profileId];
        if (!profile) return requiredLevel <= 1;
        return profile.hackLevel >= requiredLevel;
      },

      reset: () => {
        set({
          isInitialized: false,
          totalXP: 0,
          globalHackLevel: 1,
          profiles: {},
        });
      },
    }),
    {
      name: 'hacker-storage',
      partialize: (state) => ({
        totalXP: state.totalXP,
        globalHackLevel: state.globalHackLevel,
        profiles: state.profiles,
      }),
    }
  )
);

// ============================================
// SELECTORS
// ============================================

export const useHackLevel = (profileId: string) =>
  useHackerStore((state) => state.profiles[profileId]?.hackLevel ?? 1);

export const useHackXP = (profileId: string) =>
  useHackerStore((state) => state.profiles[profileId]?.hackXP ?? 0);

export const useAffection = (profileId: string) =>
  useHackerStore((state) => state.profiles[profileId]?.affectionLevel ?? 0);

export const useViewedStories = (profileId: string) =>
  useHackerStore((state) => state.profiles[profileId]?.viewedStories ?? []);

export const useCompletedScenarios = (profileId: string) =>
  useHackerStore((state) => state.profiles[profileId]?.completedScenarios ?? []);
