'use client';

import { useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Volume2, VolumeX, ChevronLeft, Settings } from 'lucide-react';
import { useGameStore, getEmotionStyle } from '@/lib/game-engine';
import { Beat, Choice } from '@/lib/scenarios/types';

interface GamePlayerProps {
  personaId: string;
  episodeId: string;
  onBack?: () => void;
}

export default function GamePlayer({
  personaId,
  episodeId,
  onBack,
}: GamePlayerProps) {
  const {
    currentBeat,
    isLoading,
    isPlayingTTS,
    affection,
    initGame,
    processChoice,
    advanceToNextBeat,
    stopTTS,
    getCurrentScene,
    getPersona,
  } = useGameStore();

  const scene = getCurrentScene();
  const persona = getPersona();

  // Initialize game on mount
  useEffect(() => {
    initGame(personaId, episodeId);
  }, [personaId, episodeId, initGame]);

  // Handle tap to advance (for non-choice beats)
  const handleTap = useCallback(() => {
    if (!currentBeat || isLoading) return;

    // Don't advance if it's a choice beat
    if (currentBeat.type === 'choice') return;

    // Stop TTS if playing
    if (isPlayingTTS) {
      stopTTS();
    }

    advanceToNextBeat();
  }, [currentBeat, isLoading, isPlayingTTS, stopTTS, advanceToNextBeat]);

  // Handle choice selection
  const handleChoice = useCallback(
    async (choiceId: string) => {
      await processChoice(choiceId);
    },
    [processChoice]
  );

  if (!currentBeat) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-white/50">Loading...</div>
      </div>
    );
  }

  return (
    <div
      className="min-h-screen bg-black text-white relative overflow-hidden select-none"
      onClick={handleTap}
    >
      {/* Background */}
      <Background scene={scene} />

      {/* Header */}
      <Header
        onBack={onBack}
        affection={affection}
        isPlayingTTS={isPlayingTTS}
        onStopTTS={stopTTS}
      />

      {/* Main Content Area */}
      <main className="relative z-10 min-h-screen flex flex-col justify-end pb-8 px-6">
        <AnimatePresence mode="wait">
          {/* Beat Content */}
          <BeatDisplay key={currentBeat.id} beat={currentBeat} persona={persona} />

          {/* Choices */}
          {currentBeat.type === 'choice' && currentBeat.choices && (
            <ChoicePanel
              choices={currentBeat.choices}
              onSelect={handleChoice}
              isLoading={isLoading}
            />
          )}
        </AnimatePresence>

        {/* Tap indicator (for non-choice beats) */}
        {currentBeat.type !== 'choice' && !isLoading && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="absolute bottom-4 left-1/2 -translate-x-1/2"
          >
            <span className="text-white/30 text-xs tracking-widest uppercase">
              Tap to continue
            </span>
          </motion.div>
        )}
      </main>
    </div>
  );
}

// ============================================
// SUB COMPONENTS
// ============================================

function Background({ scene }: { scene: ReturnType<typeof useGameStore.getState>['getCurrentScene'] extends () => infer R ? R : never }) {
  // Use persona image or scene-specific background
  const bgImage =
    'https://images.unsplash.com/photo-1513956589380-bad6acb9b9d4?w=1200&q=80';

  return (
    <div className="absolute inset-0 z-0">
      <div
        className="absolute inset-0 bg-cover bg-center opacity-40 blur-sm scale-105"
        style={{ backgroundImage: `url(${bgImage})` }}
      />
      <div className="absolute inset-0 bg-gradient-to-b from-black/60 via-black/40 to-black/90" />

      {/* Scene info overlay */}
      {scene && (
        <div className="absolute top-20 left-6 z-10">
          <div className="text-white/40 text-xs tracking-wider">
            {scene.setting.location}
          </div>
          <div className="text-white/30 text-xs">{scene.setting.time}</div>
        </div>
      )}
    </div>
  );
}

function Header({
  onBack,
  affection,
  isPlayingTTS,
  onStopTTS,
}: {
  onBack?: () => void;
  affection: number;
  isPlayingTTS: boolean;
  onStopTTS: () => void;
}) {
  return (
    <header className="absolute top-0 left-0 right-0 z-50 px-4 py-4 flex justify-between items-center bg-gradient-to-b from-black/80 to-transparent">
      <button
        onClick={(e) => {
          e.stopPropagation();
          onBack?.();
        }}
        className="p-2 rounded-full bg-white/10 backdrop-blur-sm"
      >
        <ChevronLeft className="w-5 h-5 text-white/80" />
      </button>

      <div className="flex items-center gap-4">
        {/* Affection indicator */}
        <div className="flex items-center gap-2 bg-white/10 backdrop-blur-sm rounded-full px-3 py-1">
          <span className="text-rose-400">❤</span>
          <span className="text-white/80 text-sm">{affection}</span>
        </div>

        {/* TTS control */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            if (isPlayingTTS) onStopTTS();
          }}
          className="p-2 rounded-full bg-white/10 backdrop-blur-sm"
        >
          {isPlayingTTS ? (
            <Volume2 className="w-5 h-5 text-rose-400 animate-pulse" />
          ) : (
            <VolumeX className="w-5 h-5 text-white/50" />
          )}
        </button>
      </div>
    </header>
  );
}

function BeatDisplay({
  beat,
  persona,
}: {
  beat: Beat;
  persona: ReturnType<typeof useGameStore.getState>['getPersona'] extends () => infer R ? R : never;
}) {
  const emotionStyle = getEmotionStyle(beat.emotion);

  // Speaker label
  const getSpeakerLabel = () => {
    switch (beat.speaker) {
      case 'jun':
        return persona?.name || 'Jun';
      case 'user':
        return 'You';
      case 'narrator':
        return null;
      default:
        return null;
    }
  };

  const speakerLabel = getSpeakerLabel();

  // Content styling based on type
  const getContentStyle = () => {
    if (beat.speaker === 'narrator') {
      return 'text-white/80 text-lg leading-relaxed font-light';
    }
    if (beat.speaker === 'jun') {
      return `text-2xl font-serif italic ${emotionStyle.textColor}`;
    }
    if (beat.speaker === 'user') {
      return 'text-xl text-rose-200 italic text-right';
    }
    return 'text-lg text-white/80';
  };

  // Handle whisper style
  const isWhisper = beat.style === 'whisper';

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      transition={{ duration: 0.4 }}
      className="mb-8"
    >
      {/* Speaker label */}
      {speakerLabel && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className={`text-xs uppercase tracking-[0.3em] mb-3 ${
            beat.speaker === 'jun' ? 'text-rose-400/60' : 'text-white/40'
          }`}
        >
          {speakerLabel}
        </motion.div>
      )}

      {/* Main content */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.1 }}
        className={`${getContentStyle()} ${isWhisper ? 'opacity-70 text-sm' : ''}`}
      >
        {beat.type === 'dialogue' && (
          <span className="text-white/40 mr-1">"</span>
        )}

        {/* Split content by newlines for proper formatting */}
        {beat.content?.split('\n').map((line, idx) => (
          <span key={idx}>
            {line}
            {idx < (beat.content?.split('\n').length || 0) - 1 && <br />}
          </span>
        ))}

        {beat.type === 'dialogue' && (
          <span className="text-white/40 ml-1">"</span>
        )}
      </motion.div>

      {/* TTS indicator */}
      {beat.tts?.enabled && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="mt-4 flex items-center gap-2"
        >
          <Volume2 className="w-4 h-4 text-rose-400" />
          <span className="text-xs text-rose-400/60">Voice available</span>
        </motion.div>
      )}
    </motion.div>
  );
}

function ChoicePanel({
  choices,
  onSelect,
  isLoading,
}: {
  choices: Choice[];
  onSelect: (id: string) => void;
  isLoading: boolean;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 30 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 30 }}
      transition={{ delay: 0.3 }}
      className="space-y-3 mb-16"
      onClick={(e) => e.stopPropagation()}
    >
      {choices.map((choice, idx) => (
        <motion.button
          key={choice.id}
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.4 + idx * 0.1 }}
          onClick={() => !isLoading && onSelect(choice.id)}
          disabled={isLoading}
          className={`
            w-full text-left px-5 py-4 rounded-xl
            bg-white/5 backdrop-blur-md border border-white/10
            hover:bg-white/10 hover:border-white/20
            transition-all duration-300
            ${isLoading ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
            ${choice.isPremium ? 'border-rose-500/30' : ''}
          `}
        >
          <div className="flex items-center justify-between">
            <span className="text-white/90">{choice.text}</span>

            {choice.isPremium && (
              <span className="text-rose-400 text-xs flex items-center gap-1">
                <span>💎</span>
                <span>{choice.unlockCost || 50}</span>
              </span>
            )}

            {choice.effects?.affectionChange && choice.effects.affectionChange > 0 && (
              <span className="text-rose-400 text-xs">
                +{choice.effects.affectionChange} ❤
              </span>
            )}
          </div>
        </motion.button>
      ))}
    </motion.div>
  );
}
