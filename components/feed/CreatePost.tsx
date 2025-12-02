'use client';

import { useState } from 'react';
import Image from 'next/image';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X,
  Camera,
  Type,
  Smile,
  Sparkles,
  Lock,
  ChevronRight,
  Check,
} from 'lucide-react';
import { POST_TEMPLATES, PostTemplate, UserMood } from '@/lib/user-feed-system';
import { useFeedStore } from '@/lib/stores/feed-store';
import { useTranslations } from '@/lib/i18n';

interface CreatePostProps {
  onClose: () => void;
  onPostCreated?: () => void;
}

type Category = 'daily' | 'night' | 'special' | 'provoke';

const MOOD_EMOJIS: Record<UserMood, string> = {
  happy: '😊',
  sad: '😢',
  lonely: '🥺',
  excited: '🤩',
  tired: '😴',
  romantic: '💕',
  mysterious: '🌙',
  angry: '😤',
};


export default function CreatePost({ onClose, onPostCreated }: CreatePostProps) {
  const [selectedCategory, setSelectedCategory] = useState<Category>('daily');
  const [selectedTemplate, setSelectedTemplate] = useState<PostTemplate | null>(null);
  const [customCaption, setCustomCaption] = useState('');
  const [step, setStep] = useState<'category' | 'template' | 'customize'>('category');
  const [isPosting, setIsPosting] = useState(false);
  const [postError, setPostError] = useState<string | null>(null);
  const tr = useTranslations();

  const createPostToServer = useFeedStore(state => state.createPostToServer);

  const CATEGORY_INFO: Record<Category, { label: string; icon: string; color: string }> = {
    daily: { label: tr.createPost.daily, icon: '☀️', color: 'text-amber-400' },
    night: { label: tr.createPost.night, icon: '🌙', color: 'text-indigo-400' },
    special: { label: tr.createPost.special, icon: '✨', color: 'text-pink-400' },
    provoke: { label: tr.createPost.provoke, icon: '💬', color: 'text-red-400' },
  };

  const filteredTemplates = POST_TEMPLATES.filter(t => t.category === selectedCategory);

  const handleSelectCategory = (category: Category) => {
    setSelectedCategory(category);
    setStep('template');
  };

  const handleSelectTemplate = (template: PostTemplate) => {
    setSelectedTemplate(template);
    setCustomCaption(template.caption);
    setStep('customize');
  };

  const handlePost = async () => {
    if (!selectedTemplate) return;

    setIsPosting(true);
    setPostError(null);

    try {
      await createPostToServer({
        type: selectedTemplate.type,
        mood: selectedTemplate.mood,
        caption: customCaption,
        image: selectedTemplate.type === 'photo' ? selectedTemplate.preview : undefined,
      });

      // 애니메이션 대기
      await new Promise(resolve => setTimeout(resolve, 1000));

      setIsPosting(false);
      onPostCreated?.();
      onClose();
    } catch (error) {
      setIsPosting(false);
      setPostError(error instanceof Error ? error.message : tr.createPost.postFailed);
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
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
        <button onClick={onClose} className="p-2">
          <X className="w-6 h-6" />
        </button>
        <span className="font-medium">{tr.createPost.newPost}</span>
        {step === 'customize' && (
          <button
            onClick={handlePost}
            disabled={isPosting}
            className="px-4 py-1.5 bg-blue-500 text-white text-sm font-medium rounded-lg disabled:opacity-50"
          >
            {isPosting ? tr.createPost.posting : tr.createPost.share}
          </button>
        )}
        {step !== 'customize' && <div className="w-16" />}
      </div>

      {/* Error message */}
      {postError && (
        <div className="mx-4 mt-4 p-3 bg-red-500/20 border border-red-500/50 rounded-xl">
          <p className="text-sm text-red-400">{postError}</p>
        </div>
      )}

      <AnimatePresence mode="wait">
        {/* Step 1: Category Selection */}
        {step === 'category' && (
          <motion.div
            key="category"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="p-6"
          >
            <h2 className="text-lg font-medium mb-2">{tr.createPost.howAreYouFeeling}</h2>
            <p className="text-sm text-white/50 mb-6">
              {tr.createPost.maybeReaction}
            </p>

            <div className="space-y-3">
              {(Object.keys(CATEGORY_INFO) as Category[]).map(cat => {
                const info = CATEGORY_INFO[cat];
                return (
                  <button
                    key={cat}
                    onClick={() => handleSelectCategory(cat)}
                    className="w-full p-4 bg-white/5 border border-white/10 rounded-2xl flex items-center justify-between hover:bg-white/10 transition"
                  >
                    <div className="flex items-center gap-4">
                      <span className="text-2xl">{info.icon}</span>
                      <div className="text-left">
                        <div className={`font-medium ${info.color}`}>{info.label}</div>
                        <div className="text-xs text-white/40">
                          {cat === 'provoke' ? tr.createPost.highReactionChance : tr.createPost.normalPost}
                        </div>
                      </div>
                    </div>
                    <ChevronRight className="w-5 h-5 text-white/30" />
                  </button>
                );
              })}
            </div>
          </motion.div>
        )}

        {/* Step 2: Template Selection */}
        {step === 'template' && (
          <motion.div
            key="template"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="p-4"
          >
            <button
              onClick={() => setStep('category')}
              className="flex items-center gap-2 text-sm text-white/50 mb-4"
            >
              ← {tr.createPost.selectCategory}
            </button>

            <h2 className="text-lg font-medium mb-4">
              {CATEGORY_INFO[selectedCategory].icon} {CATEGORY_INFO[selectedCategory].label}
            </h2>

            <div className="grid grid-cols-2 gap-3">
              {filteredTemplates.map(template => (
                <button
                  key={template.id}
                  onClick={() => handleSelectTemplate(template)}
                  className="relative aspect-square rounded-xl overflow-hidden border border-white/10 hover:border-white/30 transition group"
                >
                  {template.type === 'photo' ? (
                    <Image
                      src={template.preview}
                      alt=""
                      fill
                      className="object-cover group-hover:scale-105 transition"
                    />
                  ) : (
                    <div className="w-full h-full bg-gradient-to-br from-purple-600 to-pink-600 flex items-center justify-center p-4">
                      <p className="text-sm text-center line-clamp-3">{template.preview}</p>
                    </div>
                  )}

                  {/* Mood badge */}
                  <div className="absolute bottom-2 left-2 px-2 py-1 bg-black/70 rounded-full text-xs flex items-center gap-1">
                    <span>{MOOD_EMOJIS[template.mood]}</span>
                  </div>

                  {/* Premium lock */}
                  {template.isPremium && (
                    <div className="absolute top-2 right-2 w-6 h-6 bg-amber-500 rounded-full flex items-center justify-center">
                      <Lock className="w-3 h-3 text-black" />
                    </div>
                  )}
                </button>
              ))}
            </div>
          </motion.div>
        )}

        {/* Step 3: Customize & Post */}
        {step === 'customize' && selectedTemplate && (
          <motion.div
            key="customize"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="h-full flex flex-col"
          >
            <button
              onClick={() => setStep('template')}
              className="flex items-center gap-2 text-sm text-white/50 px-4 py-2"
            >
              ← {tr.createPost.selectOtherTemplate}
            </button>

            {/* Preview */}
            <div className="flex-1 p-4">
              <div className="relative aspect-square rounded-xl overflow-hidden mb-4">
                {selectedTemplate.type === 'photo' ? (
                  <Image
                    src={selectedTemplate.preview}
                    alt=""
                    fill
                    className="object-cover"
                  />
                ) : (
                  <div className="w-full h-full bg-gradient-to-br from-purple-600 to-pink-600 flex items-center justify-center p-8">
                    <p className="text-xl text-center">{selectedTemplate.preview}</p>
                  </div>
                )}
              </div>

              {/* Caption input */}
              <div className="space-y-3">
                <textarea
                  value={customCaption}
                  onChange={(e) => setCustomCaption(e.target.value)}
                  placeholder={tr.createPost.writeCaption}
                  className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-sm resize-none focus:outline-none focus:border-white/30"
                  rows={3}
                />

                {/* Mood indicator */}
                <div className="flex items-center gap-2 text-sm text-white/50">
                  <span>{tr.createPost.mood}:</span>
                  <span className="px-2 py-1 bg-white/10 rounded-full flex items-center gap-1">
                    {MOOD_EMOJIS[selectedTemplate.mood]}
                    <span className="capitalize">{selectedTemplate.mood}</span>
                  </span>
                </div>

                {/* Hint */}
                <div className="p-3 bg-gradient-to-r from-purple-500/10 to-pink-500/10 border border-purple-500/20 rounded-xl">
                  <div className="flex items-start gap-2">
                    <Sparkles className="w-4 h-4 text-purple-400 mt-0.5" />
                    <div className="text-xs text-white/60">
                      <span className="text-purple-400 font-medium">{tr.createPost.tip}</span>{' '}
                      {tr.createPost.postTip}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Posting Animation Overlay */}
      <AnimatePresence>
        {isPosting && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-black/80 flex flex-col items-center justify-center"
          >
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              className="w-16 h-16 bg-green-500 rounded-full flex items-center justify-center mb-4"
            >
              <Check className="w-8 h-8 text-white" />
            </motion.div>
            <p className="text-white font-medium">{tr.feed.posted}</p>
          </motion.div>
        )}
      </AnimatePresence>
      </div>
    </motion.div>
  );
}
