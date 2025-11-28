'use client';

import { useState } from 'react';
import Image from 'next/image';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Shield,
  ShieldAlert,
  Lock,
  Unlock,
  Eye,
  EyeOff,
  Terminal,
  Wifi,
  Settings,
  Grid3X3,
  Bookmark,
  MessageCircle,
  Heart,
  MoreHorizontal,
  ChevronLeft,
  X,
} from 'lucide-react';
import {
  SNSProfile,
  Story,
  Post,
  HiddenFile,
  HACK_LEVELS,
  getVisibleStories,
  getVisiblePosts,
  getUnlockedFiles,
} from '@/lib/hacked-sns-data';

interface HackedProfileProps {
  profile: SNSProfile;
  stories: Story[];
  posts: Post[];
  hiddenFiles: HiddenFile[];
  hackLevel: number;
  hackXP: number;
  onStoryClick: (story: Story) => void;
  onStartDM: (scenarioId: string) => void;
  onBack?: () => void;
}

export default function HackedProfile({
  profile,
  stories,
  posts,
  hiddenFiles,
  hackLevel,
  hackXP,
  onStoryClick,
  onStartDM,
  onBack,
}: HackedProfileProps) {
  const [activeTab, setActiveTab] = useState<'posts' | 'hidden'>('posts');
  const [showHackInfo, setShowHackInfo] = useState(false);

  const visibleStories = getVisibleStories(stories, hackLevel);
  const visiblePosts = getVisiblePosts(posts, hackLevel);
  const filesWithStatus = getUnlockedFiles(hiddenFiles, hackLevel);
  const currentLevelInfo = HACK_LEVELS[hackLevel - 1];
  const nextLevelInfo = HACK_LEVELS[hackLevel];

  return (
    <div className="min-h-screen bg-black text-white">
      {/* Hacked Status Bar */}
      <div className="sticky top-0 z-50 bg-black/90 backdrop-blur-md border-b border-red-500/20">
        <div className="flex items-center justify-between px-4 py-2">
          <div className="flex items-center gap-2">
            {onBack && (
              <button onClick={onBack} className="p-1">
                <ChevronLeft className="w-5 h-5" />
              </button>
            )}
            <div className="flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 text-red-500 animate-pulse" />
              <span className="text-xs font-mono text-red-500">[HACKED]</span>
            </div>
          </div>

          <button
            onClick={() => setShowHackInfo(true)}
            className="flex items-center gap-2 px-3 py-1 bg-red-500/10 border border-red-500/30 rounded-full"
          >
            <Terminal className="w-3 h-3 text-red-400" />
            <span className="text-xs font-mono text-red-400">
              LVL {hackLevel}
            </span>
          </button>
        </div>

        {/* Glitch effect line */}
        <div className="h-[1px] bg-gradient-to-r from-transparent via-red-500/50 to-transparent" />
      </div>

      {/* Profile Header */}
      <div className="px-4 pt-4">
        {/* Username & Verified */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Lock className="w-4 h-4 text-red-500/50" />
            <span className="font-semibold">@{profile.username}</span>
            {profile.isVerified && (
              <span className="text-blue-500">✓</span>
            )}
          </div>
          <MoreHorizontal className="w-5 h-5 text-white/50" />
        </div>

        {/* Profile Info */}
        <div className="flex gap-6">
          {/* Profile Image with Hack Ring */}
          <div className="relative">
            <div className="w-20 h-20 rounded-full p-[2px] bg-gradient-to-tr from-red-500 via-purple-500 to-red-500 animate-pulse">
              <div className="w-full h-full rounded-full overflow-hidden border-2 border-black">
                <Image
                  src={profile.profileImage}
                  alt={profile.displayName}
                  width={80}
                  height={80}
                  className="object-cover"
                />
              </div>
            </div>
            {/* Hacked indicator */}
            <div className="absolute -bottom-1 -right-1 w-6 h-6 bg-red-500 rounded-full flex items-center justify-center border-2 border-black">
              <Eye className="w-3 h-3" />
            </div>
          </div>

          {/* Stats */}
          <div className="flex-1">
            <div className="flex justify-around mb-3">
              <div className="text-center">
                <div className="font-bold">{visiblePosts.length}</div>
                <div className="text-xs text-white/50">posts</div>
              </div>
              <div className="text-center">
                <div className="font-bold">{profile.followers}</div>
                <div className="text-xs text-white/50">followers</div>
              </div>
              <div className="text-center">
                <div className="font-bold">{profile.following}</div>
                <div className="text-xs text-white/50">following</div>
              </div>
            </div>
          </div>
        </div>

        {/* Bio */}
        <div className="mt-4">
          <div className="font-semibold">{profile.displayName}</div>
          <p className="text-sm text-white/70 whitespace-pre-line mt-1">
            {profile.bio}
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-2 mt-4">
          <button
            onClick={() => onStartDM('jun_ep1')}
            className="flex-1 py-2 bg-gradient-to-r from-red-500/20 to-purple-500/20 border border-red-500/30 rounded-lg text-sm font-medium flex items-center justify-center gap-2"
          >
            <MessageCircle className="w-4 h-4" />
            <span>Message</span>
            <span className="text-[10px] text-red-400">[INTERCEPT]</span>
          </button>
          <button className="px-4 py-2 bg-white/10 rounded-lg">
            <Wifi className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Stories */}
      <div className="mt-6 px-4">
        <div className="flex items-center justify-between mb-3">
          <span className="text-xs text-white/50 font-mono">
            STORIES [{visibleStories.length}/{stories.length}]
          </span>
          {stories.length > visibleStories.length && (
            <span className="text-xs text-red-400 flex items-center gap-1">
              <Lock className="w-3 h-3" />
              {stories.length - visibleStories.length} hidden
            </span>
          )}
        </div>

        <div className="flex gap-4 overflow-x-auto pb-2 scrollbar-hide">
          {stories.map((story) => {
            const isAccessible = !story.isSecret || hackLevel >= story.requiredHackLevel;

            return (
              <button
                key={story.id}
                onClick={() => isAccessible && onStoryClick(story)}
                className={`flex-shrink-0 flex flex-col items-center gap-1 ${
                  !isAccessible ? 'opacity-40' : ''
                }`}
                disabled={!isAccessible}
              >
                <div
                  className={`w-16 h-16 rounded-full p-[2px] ${
                    story.isSecret
                      ? 'bg-gradient-to-tr from-red-500 to-purple-500'
                      : story.isViewed
                      ? 'bg-white/20'
                      : 'bg-gradient-to-tr from-amber-500 to-rose-500'
                  }`}
                >
                  <div className="w-full h-full rounded-full overflow-hidden border-2 border-black relative">
                    {story.type === 'text' ? (
                      <div className="w-full h-full bg-gradient-to-br from-purple-600 to-pink-600 flex items-center justify-center">
                        <span className="text-[8px] text-center px-1">Aa</span>
                      </div>
                    ) : (
                      <Image
                        src={story.content}
                        alt=""
                        width={64}
                        height={64}
                        className={`object-cover ${!isAccessible ? 'blur-sm' : ''}`}
                      />
                    )}
                    {!isAccessible && (
                      <div className="absolute inset-0 flex items-center justify-center bg-black/50">
                        <Lock className="w-4 h-4 text-red-400" />
                      </div>
                    )}
                    {story.isSecret && isAccessible && (
                      <div className="absolute bottom-0 right-0 w-4 h-4 bg-red-500 rounded-full flex items-center justify-center">
                        <EyeOff className="w-2 h-2" />
                      </div>
                    )}
                  </div>
                </div>
                <span className="text-[10px] text-white/50 max-w-[60px] truncate">
                  {story.isSecret ? '비밀' : story.timestamp}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Tabs */}
      <div className="mt-6 border-t border-white/10">
        <div className="flex">
          <button
            onClick={() => setActiveTab('posts')}
            className={`flex-1 py-3 flex items-center justify-center gap-2 border-b-2 transition-colors ${
              activeTab === 'posts'
                ? 'border-white text-white'
                : 'border-transparent text-white/50'
            }`}
          >
            <Grid3X3 className="w-5 h-5" />
          </button>
          <button
            onClick={() => setActiveTab('hidden')}
            className={`flex-1 py-3 flex items-center justify-center gap-2 border-b-2 transition-colors ${
              activeTab === 'hidden'
                ? 'border-red-500 text-red-400'
                : 'border-transparent text-white/50'
            }`}
          >
            <Lock className="w-5 h-5" />
            <span className="text-xs font-mono">[HIDDEN]</span>
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="pb-20">
        {activeTab === 'posts' && (
          <div className="grid grid-cols-3 gap-[2px]">
            {visiblePosts.map((post) => (
              <div key={post.id} className="aspect-square relative group">
                <Image
                  src={post.images[0]}
                  alt=""
                  fill
                  className={`object-cover ${post.isHidden ? 'saturate-50' : ''}`}
                />
                {post.isHidden && (
                  <div className="absolute top-2 left-2">
                    <span className="px-1.5 py-0.5 bg-red-500/80 text-[8px] font-mono rounded">
                      RECOVERED
                    </span>
                  </div>
                )}
                <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-4">
                  <span className="flex items-center gap-1 text-sm">
                    <Heart className="w-4 h-4 fill-white" />
                    {post.likes}
                  </span>
                </div>
                {post.type === 'carousel' && (
                  <div className="absolute top-2 right-2">
                    <div className="w-5 h-5 bg-black/50 rounded flex items-center justify-center">
                      <span className="text-[10px]">📷+</span>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {activeTab === 'hidden' && (
          <div className="p-4 space-y-3">
            <div className="text-xs text-red-400 font-mono mb-4 flex items-center gap-2">
              <Terminal className="w-4 h-4" />
              <span>RECOVERED FILES ({filesWithStatus.filter(f => f.isUnlocked).length}/{filesWithStatus.length})</span>
            </div>

            {filesWithStatus.map((file) => (
              <div
                key={file.id}
                className={`p-4 rounded-xl border ${
                  file.isUnlocked
                    ? 'bg-white/5 border-white/10'
                    : 'bg-red-500/5 border-red-500/20'
                }`}
              >
                <div className="flex items-center gap-4">
                  {file.thumbnail ? (
                    <div className="w-12 h-12 rounded-lg overflow-hidden relative">
                      <Image
                        src={file.thumbnail}
                        alt=""
                        fill
                        className={`object-cover ${!file.isUnlocked ? 'blur-md' : ''}`}
                      />
                      {!file.isUnlocked && (
                        <div className="absolute inset-0 flex items-center justify-center">
                          <Lock className="w-4 h-4 text-red-400" />
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="w-12 h-12 rounded-lg bg-red-500/10 flex items-center justify-center">
                      {file.isUnlocked ? (
                        <Unlock className="w-5 h-5 text-green-400" />
                      ) : (
                        <Lock className="w-5 h-5 text-red-400" />
                      )}
                    </div>
                  )}

                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{file.title}</span>
                      <span className="text-[10px] px-1.5 py-0.5 bg-white/10 rounded font-mono">
                        .{file.type}
                      </span>
                    </div>
                    <p className="text-xs text-white/50 mt-0.5">
                      {file.description}
                    </p>
                    {!file.isUnlocked && (
                      <p className="text-xs text-red-400 mt-1 font-mono">
                        🔒 {file.unlockCondition}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Hack Info Modal */}
      <AnimatePresence>
        {showHackInfo && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/90 backdrop-blur-md flex items-center justify-center p-6"
            onClick={() => setShowHackInfo(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-zinc-900 border border-red-500/30 rounded-2xl p-6 max-w-sm w-full"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-2">
                  <Terminal className="w-5 h-5 text-red-400" />
                  <span className="font-mono text-red-400">HACK STATUS</span>
                </div>
                <button onClick={() => setShowHackInfo(false)}>
                  <X className="w-5 h-5 text-white/50" />
                </button>
              </div>

              {/* Current Level */}
              <div className="mb-6">
                <div className="text-3xl font-bold mb-1">
                  Level {hackLevel}
                </div>
                <div className="text-lg text-red-400 font-mono">
                  {currentLevelInfo?.name}
                </div>
                <p className="text-sm text-white/50 mt-2">
                  {currentLevelInfo?.description}
                </p>
              </div>

              {/* XP Progress */}
              {nextLevelInfo && (
                <div className="mb-6">
                  <div className="flex justify-between text-xs text-white/50 mb-2">
                    <span>XP</span>
                    <span>
                      {hackXP} / {nextLevelInfo.xpRequired}
                    </span>
                  </div>
                  <div className="h-2 bg-white/10 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-red-500 to-purple-500"
                      style={{
                        width: `${(hackXP / nextLevelInfo.xpRequired) * 100}%`,
                      }}
                    />
                  </div>
                </div>
              )}

              {/* Unlocked Features */}
              <div>
                <div className="text-xs text-white/50 mb-2 font-mono">
                  UNLOCKED FEATURES
                </div>
                <ul className="space-y-2">
                  {currentLevelInfo?.features.map((feature, idx) => (
                    <li
                      key={idx}
                      className="flex items-center gap-2 text-sm text-green-400"
                    >
                      <Unlock className="w-3 h-3" />
                      {feature}
                    </li>
                  ))}
                </ul>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
