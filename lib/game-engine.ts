/**
 * Game Engine
 *
 * 시나리오 실행 엔진
 * - Beat 단위로 진행
 * - 선택에 따른 분기 처리
 * - 동적 생성과 고정 콘텐츠 혼합
 * - 상태 관리 (Zustand)
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import {
  Persona,
  Episode,
  Scene,
  Beat,
  Choice,
  GameState,
  Emotion,
} from './scenarios/types';
import { openRouterService } from './openrouter';
import { elevenLabsService, TTSHookType } from './elevenlabs';
import { JUN_PERSONA, JUN_EPISODES } from './scenarios/jun-data';

// ============================================
// GAME STATE STORE
// ============================================
interface GameStore extends GameState {
  // State
  currentBeat: Beat | null;
  isLoading: boolean;
  isPlayingTTS: boolean;
  currentAudio: HTMLAudioElement | null;

  // Actions
  initGame: (personaId: string, episodeId: string) => void;
  processChoice: (choiceId: string) => Promise<void>;
  advanceToNextBeat: () => Promise<void>;
  goToBeat: (beatId: string) => void;
  goToScene: (sceneId: string) => void;
  playTTS: (text: string, hookType: TTSHookType) => Promise<void>;
  stopTTS: () => void;
  reset: () => void;

  // Getters
  getCurrentScene: () => Scene | null;
  getCurrentEpisode: () => Episode | null;
  getPersona: () => Persona | null;
}

const initialState: Omit<GameStore, keyof GameStore> = {
  personaId: '',
  currentEpisodeId: '',
  currentSceneId: '',
  currentBeatIndex: 0,
  affection: 0,
  flags: {},
  unlockedItems: [],
  conversationHistory: [],
  choicesMade: {},
  ttsPlayed: [],
  currentBeat: null,
  isLoading: false,
  isPlayingTTS: false,
  currentAudio: null,
};

export const useGameStore = create<GameStore>()(
  persist(
    (set, get) => ({
      // Initial state
      personaId: '',
      currentEpisodeId: '',
      currentSceneId: '',
      currentBeatIndex: 0,
      affection: 0,
      flags: {},
      unlockedItems: [],
      conversationHistory: [],
      choicesMade: {},
      ttsPlayed: [],
      currentBeat: null,
      isLoading: false,
      isPlayingTTS: false,
      currentAudio: null,

      // Initialize game with specific episode
      initGame: (personaId: string, episodeId: string) => {
        const episode = JUN_EPISODES.find((e) => e.id === episodeId);
        if (!episode || episode.scenes.length === 0) {
          console.error('Episode not found:', episodeId);
          return;
        }

        const firstScene = episode.scenes[0];
        const firstBeat = firstScene.beats[0];

        set({
          personaId,
          currentEpisodeId: episodeId,
          currentSceneId: firstScene.id,
          currentBeatIndex: 0,
          currentBeat: firstBeat,
          affection: 0,
          flags: {},
          conversationHistory: [],
          choicesMade: {},
          isLoading: false,
        });
      },

      // Process user choice
      processChoice: async (choiceId: string) => {
        const { currentBeat, affection, flags, conversationHistory } = get();
        if (!currentBeat || currentBeat.type !== 'choice') return;

        const choice = currentBeat.choices?.find((c) => c.id === choiceId);
        if (!choice) return;

        set({ isLoading: true });

        // Apply effects
        let newAffection = affection;
        let newFlags = { ...flags };

        if (choice.effects) {
          if (choice.effects.affectionChange) {
            newAffection += choice.effects.affectionChange;
          }
          if (choice.effects.flagSet) {
            newFlags = { ...newFlags, ...choice.effects.flagSet };
          }
        }

        // Record choice
        const newHistory = [
          ...conversationHistory,
          {
            beatId: currentBeat.id,
            content: choice.text,
            speaker: 'user',
            timestamp: Date.now(),
          },
        ];

        set({
          affection: newAffection,
          flags: newFlags,
          conversationHistory: newHistory,
          choicesMade: { ...get().choicesMade, [currentBeat.id]: choiceId },
        });

        // Navigate to next beat/scene
        if (choice.nextSceneId) {
          get().goToScene(choice.nextSceneId);
        } else if (choice.nextBeatId) {
          get().goToBeat(choice.nextBeatId);
        }

        set({ isLoading: false });
      },

      // Advance to next beat (for non-choice beats)
      advanceToNextBeat: async () => {
        const { currentBeat, currentSceneId, conversationHistory } = get();
        if (!currentBeat) return;

        const scene = get().getCurrentScene();
        if (!scene) return;

        // Record current beat in history if it has content
        if (currentBeat.content && currentBeat.speaker) {
          const newHistory = [
            ...conversationHistory,
            {
              beatId: currentBeat.id,
              content: currentBeat.content,
              speaker: currentBeat.speaker,
              timestamp: Date.now(),
            },
          ];
          set({ conversationHistory: newHistory });
        }

        // Apply effects
        if (currentBeat.effects) {
          const { affection, flags, unlockedItems } = get();
          let newAffection = affection;
          let newFlags = { ...flags };
          let newUnlocked = [...unlockedItems];

          if (currentBeat.effects.affectionChange) {
            newAffection += currentBeat.effects.affectionChange;
          }
          if (currentBeat.effects.flagSet) {
            newFlags = { ...newFlags, ...currentBeat.effects.flagSet };
          }
          if (currentBeat.effects.unlock) {
            newUnlocked.push(currentBeat.effects.unlock);
          }

          set({
            affection: newAffection,
            flags: newFlags,
            unlockedItems: newUnlocked,
          });
        }

        // Play TTS if enabled
        if (currentBeat.tts?.enabled && currentBeat.content) {
          await get().playTTS(currentBeat.content, currentBeat.tts.hookType);
        }

        // Determine next beat
        if (currentBeat.nextSceneId) {
          get().goToScene(currentBeat.nextSceneId);
        } else if (currentBeat.nextBeatId) {
          get().goToBeat(currentBeat.nextBeatId);
        } else if (currentBeat.conditionalNext) {
          // Check conditions
          const { flags } = get();
          for (const cond of currentBeat.conditionalNext) {
            if (cond.flagCheck && flags[cond.flagCheck]) {
              get().goToBeat(cond.nextBeatId);
              return;
            }
          }
          // Default: next beat in array
          const currentIndex = scene.beats.findIndex(
            (b) => b.id === currentBeat.id
          );
          if (currentIndex < scene.beats.length - 1) {
            set({
              currentBeatIndex: currentIndex + 1,
              currentBeat: scene.beats[currentIndex + 1],
            });
          }
        } else {
          // No explicit next, advance to next in array
          const currentIndex = scene.beats.findIndex(
            (b) => b.id === currentBeat.id
          );
          if (currentIndex < scene.beats.length - 1) {
            set({
              currentBeatIndex: currentIndex + 1,
              currentBeat: scene.beats[currentIndex + 1],
            });
          }
        }
      },

      // Go to specific beat
      goToBeat: (beatId: string) => {
        const scene = get().getCurrentScene();
        if (!scene) return;

        const beatIndex = scene.beats.findIndex((b) => b.id === beatId);
        if (beatIndex !== -1) {
          set({
            currentBeatIndex: beatIndex,
            currentBeat: scene.beats[beatIndex],
          });
        }
      },

      // Go to specific scene
      goToScene: (sceneId: string) => {
        const episode = get().getCurrentEpisode();
        if (!episode) return;

        const scene = episode.scenes.find((s) => s.id === sceneId);
        if (scene && scene.beats.length > 0) {
          set({
            currentSceneId: sceneId,
            currentBeatIndex: 0,
            currentBeat: scene.beats[0],
          });
        }
      },

      // Play TTS
      playTTS: async (text: string, hookType: TTSHookType) => {
        const { ttsPlayed, currentAudio } = get();

        // Stop current audio if playing
        if (currentAudio) {
          currentAudio.pause();
          currentAudio.currentTime = 0;
        }

        set({ isPlayingTTS: true });

        try {
          const config = elevenLabsService.getVoiceConfigForHook(hookType);
          const result = await elevenLabsService.textToSpeech({
            text,
            hookType,
            voiceConfig: config,
          });

          if (result) {
            const audio = new Audio(result.audioUrl);
            set({ currentAudio: audio });

            audio.onended = () => {
              set({ isPlayingTTS: false, currentAudio: null });
            };

            await audio.play();
            set({ ttsPlayed: [...ttsPlayed, text] });
          } else {
            set({ isPlayingTTS: false });
          }
        } catch (error) {
          console.error('TTS Error:', error);
          set({ isPlayingTTS: false });
        }
      },

      // Stop TTS
      stopTTS: () => {
        const { currentAudio } = get();
        if (currentAudio) {
          currentAudio.pause();
          currentAudio.currentTime = 0;
        }
        set({ isPlayingTTS: false, currentAudio: null });
      },

      // Reset game
      reset: () => {
        set({
          personaId: '',
          currentEpisodeId: '',
          currentSceneId: '',
          currentBeatIndex: 0,
          currentBeat: null,
          affection: 0,
          flags: {},
          unlockedItems: [],
          conversationHistory: [],
          choicesMade: {},
          ttsPlayed: [],
          isLoading: false,
          isPlayingTTS: false,
          currentAudio: null,
        });
      },

      // Getters
      getCurrentScene: () => {
        const { currentSceneId, currentEpisodeId } = get();
        const episode = JUN_EPISODES.find((e) => e.id === currentEpisodeId);
        return episode?.scenes.find((s) => s.id === currentSceneId) || null;
      },

      getCurrentEpisode: () => {
        const { currentEpisodeId } = get();
        return JUN_EPISODES.find((e) => e.id === currentEpisodeId) || null;
      },

      getPersona: () => {
        const { personaId } = get();
        if (personaId === 'jun') return JUN_PERSONA;
        return null;
      },
    }),
    {
      name: 'game-storage',
      partialize: (state) => ({
        personaId: state.personaId,
        currentEpisodeId: state.currentEpisodeId,
        currentSceneId: state.currentSceneId,
        currentBeatIndex: state.currentBeatIndex,
        affection: state.affection,
        flags: state.flags,
        unlockedItems: state.unlockedItems,
        conversationHistory: state.conversationHistory,
        choicesMade: state.choicesMade,
      }),
    }
  )
);

// ============================================
// DYNAMIC GENERATION HELPER
// ============================================
export async function generateDynamicResponse(
  beat: Beat,
  gameState: GameState,
  persona: Persona
): Promise<string> {
  if (beat.type !== 'dynamic' || !beat.dynamicPrompt) {
    return beat.content || '';
  }

  const context = {
    personaId: persona.id,
    episodeId: gameState.currentEpisodeId,
    sceneId: gameState.currentSceneId,
    previousMessages: gameState.conversationHistory.slice(-10).map((h) => ({
      role: h.speaker === 'user' ? 'user' as const : 'assistant' as const,
      content: h.content,
    })),
    affectionLevel: gameState.affection,
    flags: gameState.flags,
  };

  const result = await openRouterService.generateResponse(context);
  return result.characterDialogue;
}

// ============================================
// EMOTION TO STYLE MAPPING
// ============================================
export function getEmotionStyle(emotion?: Emotion): {
  textColor: string;
  bgColor: string;
  animation: string;
} {
  switch (emotion) {
    case 'happy':
      return {
        textColor: 'text-amber-100',
        bgColor: 'bg-amber-500/10',
        animation: 'animate-pulse',
      };
    case 'sad':
      return {
        textColor: 'text-blue-200',
        bgColor: 'bg-blue-500/10',
        animation: '',
      };
    case 'angry':
      return {
        textColor: 'text-red-200',
        bgColor: 'bg-red-500/10',
        animation: 'animate-shake',
      };
    case 'shy':
      return {
        textColor: 'text-pink-200',
        bgColor: 'bg-pink-500/10',
        animation: '',
      };
    case 'love':
      return {
        textColor: 'text-rose-200',
        bgColor: 'bg-rose-500/10',
        animation: 'animate-pulse',
      };
    case 'anxious':
      return {
        textColor: 'text-purple-200',
        bgColor: 'bg-purple-500/10',
        animation: '',
      };
    case 'playful':
      return {
        textColor: 'text-cyan-200',
        bgColor: 'bg-cyan-500/10',
        animation: '',
      };
    case 'tired':
      return {
        textColor: 'text-gray-300',
        bgColor: 'bg-gray-500/10',
        animation: '',
      };
    default:
      return {
        textColor: 'text-white',
        bgColor: 'bg-white/5',
        animation: '',
      };
  }
}
