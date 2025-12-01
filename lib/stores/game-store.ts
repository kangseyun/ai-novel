import { create } from 'zustand';
import { apiClient } from '../api-client';

interface GameState {
  personaId: string | null;
  affection: number;
  relationshipStage: string;
  completedEpisodes: string[];
  unlockedEpisodes: string[];
  currentSession: {
    sessionId: string;
    episodeId: string;
    sceneId: string;
    beatIndex: number;
  } | null;
  storyFlags: Record<string, boolean>;
  isLoading: boolean;
}

interface GameActions {
  loadGameState: (personaId: string) => Promise<void>;
  startEpisode: (personaId: string, episodeId: string) => Promise<{
    sessionId: string;
    initialScene: { id: string; setting: { location: string; time: string; mood: string } };
  }>;
  makeChoice: (choiceId: string, isPremium?: boolean) => Promise<{
    affectionChange: number;
    nextBeat: { id: string; type: string; speaker: string; emotion: string; text: string };
    stageChanged: { from: string; to: string } | null;
  }>;
  completeEpisode: () => Promise<{
    newAffection: number;
    unlockedItems: Array<{ id: string; type: string }>;
    stageChanged: { from: string; to: string } | null;
  }>;
  resetSession: () => void;
}

export const useGameStore = create<GameState & GameActions>((set, get) => ({
  personaId: null,
  affection: 0,
  relationshipStage: 'stranger',
  completedEpisodes: [],
  unlockedEpisodes: ['ep1'],
  currentSession: null,
  storyFlags: {},
  isLoading: false,

  loadGameState: async (personaId: string) => {
    set({ isLoading: true });
    try {
      const state = await apiClient.getGameState(personaId);
      set({
        personaId,
        affection: state.affection,
        relationshipStage: state.relationship_stage,
        completedEpisodes: state.completed_episodes,
        unlockedEpisodes: state.unlocked_episodes,
        storyFlags: state.story_flags,
        currentSession: state.current_episode ? {
          sessionId: '',
          episodeId: state.current_episode.id,
          sceneId: state.current_episode.scene_id,
          beatIndex: state.current_episode.beat_index,
        } : null,
        isLoading: false,
      });
    } catch (error) {
      console.error('Failed to load game state:', error);
      set({ isLoading: false });
    }
  },

  startEpisode: async (personaId: string, episodeId: string) => {
    set({ isLoading: true });
    try {
      const result = await apiClient.startEpisode(personaId, episodeId);
      set({
        personaId,
        currentSession: {
          sessionId: result.session_id,
          episodeId: result.episode.id,
          sceneId: result.initial_scene.id,
          beatIndex: 0,
        },
        isLoading: false,
      });
      return {
        sessionId: result.session_id,
        initialScene: result.initial_scene,
      };
    } catch (error) {
      set({ isLoading: false });
      throw error;
    }
  },

  makeChoice: async (choiceId: string, isPremium = false) => {
    const { currentSession } = get();
    if (!currentSession) throw new Error('No active session');

    set({ isLoading: true });
    try {
      const result = await apiClient.makeChoice({
        session_id: currentSession.sessionId,
        scene_id: currentSession.sceneId,
        choice_id: choiceId,
        is_premium: isPremium,
      });

      set((state) => ({
        affection: result.new_affection,
        relationshipStage: result.stage_changed?.to || state.relationshipStage,
        storyFlags: { ...state.storyFlags, ...result.flags_updated },
        currentSession: state.currentSession ? {
          ...state.currentSession,
          beatIndex: state.currentSession.beatIndex + 1,
        } : null,
        isLoading: false,
      }));

      return {
        affectionChange: result.affection_change,
        nextBeat: result.next_beat,
        stageChanged: result.stage_changed,
      };
    } catch (error) {
      set({ isLoading: false });
      throw error;
    }
  },

  completeEpisode: async () => {
    const { currentSession } = get();
    if (!currentSession) throw new Error('No active session');

    set({ isLoading: true });
    try {
      const result = await apiClient.completeEpisode(
        currentSession.sessionId,
        currentSession.episodeId
      );

      set((state) => ({
        affection: result.new_affection,
        relationshipStage: result.stage_changed?.to || state.relationshipStage,
        completedEpisodes: [...state.completedEpisodes, currentSession.episodeId],
        unlockedEpisodes: [...new Set([...state.unlockedEpisodes, ...result.unlocked_episodes])],
        currentSession: null,
        isLoading: false,
      }));

      return {
        newAffection: result.new_affection,
        unlockedItems: result.unlocked_items,
        stageChanged: result.stage_changed,
      };
    } catch (error) {
      set({ isLoading: false });
      throw error;
    }
  },

  resetSession: () => {
    set({ currentSession: null });
  },
}));
