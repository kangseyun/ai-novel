'use client';

import { useState, useEffect, useCallback } from 'react';
import Image from 'next/image';
import { motion, AnimatePresence } from 'framer-motion';
import { useTranslations } from '@/lib/i18n';
import {
  X,
  ChevronLeft,
  ChevronRight,
  Heart,
  Send,
  MoreHorizontal,
  Eye,
  EyeOff,
  Lock,
  MessageCircle,
} from 'lucide-react';
import { Story } from '@/lib/hacked-sns-data';

interface StoryViewerProps {
  stories: Story[];
  initialIndex: number;
  profileImage: string;
  username: string;
  onClose: () => void;
  onReply: (story: Story, message: string) => void;
  onStartScenario?: (scenarioId: string) => void;
}

export default function StoryViewer({
  stories,
  initialIndex,
  profileImage,
  username,
  onClose,
  onReply,
  onStartScenario,
}: StoryViewerProps) {
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const [progress, setProgress] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [replyText, setReplyText] = useState('');
  const [showReplyInput, setShowReplyInput] = useState(false);
  const tr = useTranslations();

  const currentStory = stories[currentIndex];
  const STORY_DURATION = 5000; // 5 seconds per story

  // Progress timer
  useEffect(() => {
    if (isPaused || showReplyInput) return;

    const interval = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 100) {
          // Go to next story or close
          if (currentIndex < stories.length - 1) {
            setCurrentIndex(currentIndex + 1);
            return 0;
          } else {
            onClose();
            return 100;
          }
        }
        return prev + (100 / (STORY_DURATION / 100));
      });
    }, 100);

    return () => clearInterval(interval);
  }, [currentIndex, isPaused, showReplyInput, stories.length, onClose]);

  // Reset progress on story change
  useEffect(() => {
    setProgress(0);
  }, [currentIndex]);

  const handlePrev = useCallback(() => {
    if (currentIndex > 0) {
      setCurrentIndex(currentIndex - 1);
    }
  }, [currentIndex]);

  const handleNext = useCallback(() => {
    if (currentIndex < stories.length - 1) {
      setCurrentIndex(currentIndex + 1);
    } else {
      onClose();
    }
  }, [currentIndex, stories.length, onClose]);

  const handleReply = () => {
    if (!replyText.trim()) return;

    onReply(currentStory, replyText);
    setReplyText('');
    setShowReplyInput(false);

    // If story has linked scenario, prompt to start it
    if (currentStory.linkedDMScenario && onStartScenario) {
      onStartScenario(currentStory.linkedDMScenario);
    }
  };

  const handleTap = (e: React.MouseEvent) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const width = rect.width;

    if (x < width / 3) {
      handlePrev();
    } else if (x > (width * 2) / 3) {
      handleNext();
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 bg-black flex justify-center"
    >
      <div className="w-full max-w-[430px] min-h-screen relative bg-black">
      {/* Progress bars */}
      <div className="absolute top-0 left-0 right-0 z-20 flex gap-1 p-2">
        {stories.map((_, idx) => (
          <div
            key={idx}
            className="flex-1 h-0.5 bg-white/30 rounded-full overflow-hidden"
          >
            <div
              className="h-full bg-white transition-all duration-100"
              style={{
                width:
                  idx < currentIndex
                    ? '100%'
                    : idx === currentIndex
                    ? `${progress}%`
                    : '0%',
              }}
            />
          </div>
        ))}
      </div>

      {/* Header */}
      <div className="absolute top-4 left-0 right-0 z-20 px-4 pt-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full overflow-hidden border border-white/20">
            <Image
              src={profileImage}
              alt={username}
              width={32}
              height={32}
              className="object-cover"
            />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium">{username}</span>
              {currentStory.isSecret && (
                <span className="px-1.5 py-0.5 bg-red-500/20 border border-red-500/30 rounded text-[8px] font-mono text-red-400 flex items-center gap-1">
                  <EyeOff className="w-2 h-2" />
                  SECRET
                </span>
              )}
            </div>
            <span className="text-xs text-white/50">{currentStory.timestamp}</span>
          </div>
        </div>

        <button onClick={onClose} className="p-2">
          <X className="w-6 h-6" />
        </button>
      </div>

      {/* Story Content */}
      <div
        className="absolute inset-0 flex items-center justify-center"
        onClick={handleTap}
        onMouseDown={() => setIsPaused(true)}
        onMouseUp={() => setIsPaused(false)}
        onMouseLeave={() => setIsPaused(false)}
        onTouchStart={() => setIsPaused(true)}
        onTouchEnd={() => setIsPaused(false)}
      >
        <AnimatePresence mode="wait">
          <motion.div
            key={currentStory.id}
            initial={{ opacity: 0, scale: 1.1 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            transition={{ duration: 0.2 }}
            className="w-full h-full"
          >
            {currentStory.type === 'text' ? (
              <div className="w-full h-full bg-gradient-to-br from-purple-600 via-pink-600 to-red-600 flex items-center justify-center p-8">
                <p className="text-2xl text-center leading-relaxed whitespace-pre-line">
                  {currentStory.content}
                </p>
              </div>
            ) : (
              <div className="relative w-full h-full">
                <Image
                  src={currentStory.content}
                  alt=""
                  fill
                  className="object-cover"
                  priority
                />
              </div>
            )}
          </motion.div>
        </AnimatePresence>

        {/* Caption overlay */}
        {currentStory.caption && currentStory.type !== 'text' && (
          <div className="absolute bottom-32 left-0 right-0 px-6">
            <div className="bg-black/50 backdrop-blur-sm rounded-xl p-4">
              <p className="text-sm">{currentStory.caption}</p>
            </div>
          </div>
        )}

        {/* Navigation hints */}
        <div className="absolute left-4 top-1/2 -translate-y-1/2 opacity-0 hover:opacity-100 transition-opacity">
          {currentIndex > 0 && <ChevronLeft className="w-8 h-8 text-white/50" />}
        </div>
        <div className="absolute right-4 top-1/2 -translate-y-1/2 opacity-0 hover:opacity-100 transition-opacity">
          {currentIndex < stories.length - 1 && (
            <ChevronRight className="w-8 h-8 text-white/50" />
          )}
        </div>
      </div>

      {/* Reply Section */}
      <div className="absolute bottom-0 left-0 right-0 z-20 p-4 bg-gradient-to-t from-black via-black/80 to-transparent">
        {/* Linked Scenario Prompt */}
        {currentStory.linkedDMScenario && !showReplyInput && (
          <motion.button
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            onClick={() => onStartScenario?.(currentStory.linkedDMScenario!)}
            className="w-full mb-4 p-4 bg-gradient-to-r from-red-500/20 to-purple-500/20 border border-red-500/30 rounded-xl flex items-center justify-center gap-3"
          >
            <MessageCircle className="w-5 h-5 text-red-400" />
            <span className="text-sm">{tr.story.replyToStory}</span>
            <span className="text-xs text-red-400 font-mono">[{tr.story.startDM}]</span>
          </motion.button>
        )}

        {/* Reply Input */}
        {showReplyInput ? (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex gap-2"
          >
            <input
              type="text"
              value={replyText}
              onChange={(e) => setReplyText(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleReply()}
              placeholder={tr.dm.sendPlaceholder}
              className="flex-1 px-4 py-3 bg-white/10 border border-white/20 rounded-full text-sm focus:outline-none focus:border-white/40"
              autoFocus
            />
            <button
              onClick={handleReply}
              disabled={!replyText.trim()}
              className="p-3 bg-white/10 rounded-full disabled:opacity-50"
            >
              <Send className="w-5 h-5" />
            </button>
          </motion.div>
        ) : (
          <div className="flex items-center gap-4">
            <button
              onClick={() => setShowReplyInput(true)}
              className="flex-1 px-4 py-3 bg-white/10 border border-white/20 rounded-full text-left text-sm text-white/50"
            >
              {tr.dm.sendPlaceholder}
            </button>
            <button className="p-2">
              <Heart className="w-6 h-6" />
            </button>
            <button className="p-2">
              <Send className="w-6 h-6" />
            </button>
          </div>
        )}
      </div>
      </div>
    </motion.div>
  );
}
