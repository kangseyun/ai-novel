'use client';

import { useState, useEffect, useMemo, useRef } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Heart,
  MessageCircle,
  Send,
  Bookmark,
  MoreHorizontal,
  Trash2,
  MapPin,
} from 'lucide-react';
import { useFeedStore } from '@/lib/stores/feed-store';
import { useAuthStore } from '@/lib/stores/auth-store';
import { FeedSkeleton } from '@/components/ui/Skeleton';
import { useTranslations, useLocale, t } from '@/lib/i18n';
import { toast } from 'sonner';

// 통합 피드 아이템 타입
type FeedItem = {
  id: string;
  type: 'user' | 'persona';
  timestamp: number;
  // User post fields
  content?: string;
  caption?: string;
  mood?: string;
  // Persona post fields
  persona?: {
    id: string;
    name: string;
    display_name: string;
    avatar_url: string | null;
  } | null;
  personaContent?: {
    images: string[];
    caption: string;
    location: string | null;
    mood: string;
    hashtags: string[];
  };
  likes?: number;
  comments?: number;
  user_liked?: boolean;
  is_premium?: boolean;
};

export default function HomeFeed() {
  const router = useRouter();
  const userPosts = useFeedStore(state => state.userPosts);
  const personaPosts = useFeedStore(state => state.personaPosts);
  const deletePost = useFeedStore(state => state.deletePost);
  const loadFeedFromServer = useFeedStore(state => state.loadFeedFromServer);
  const isLoading = useFeedStore(state => state.isLoading);
  const [likedPosts, setLikedPosts] = useState<Set<string>>(new Set());
  const [showDeleteMenu, setShowDeleteMenu] = useState<string | null>(null);

  const isAuthenticated = useAuthStore(state => state.isAuthenticated);
  const tr = useTranslations();
  const locale = useLocale();

  const handleProfileClick = (personaId: string) => {
    router.push(`/profile/${personaId}`);
  };

  // 서버에서 피드 로드
  const hasFetched = useRef(false);
  useEffect(() => {
    if (isAuthenticated && !hasFetched.current) {
      hasFetched.current = true;
      loadFeedFromServer().catch(() => {
        toast.error('피드를 불러오지 못했어요');
      });
    }
  }, [isAuthenticated, loadFeedFromServer]);

  const handleLike = (postId: string) => {
    setLikedPosts(prev => {
      const next = new Set(prev);
      if (next.has(postId)) {
        next.delete(postId);
      } else {
        next.add(postId);
      }
      return next;
    });
  };

  const handleDelete = (postId: string) => {
    deletePost(postId);
    setShowDeleteMenu(null);
  };

  const formatTime = (timestamp: number) => {
    const diff = Date.now() - timestamp;
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);

    if (minutes < 1) return tr.feed.justNow;
    if (minutes < 60) return t(tr.feed.minutesAgo, { n: minutes });
    if (hours < 24) return t(tr.feed.hoursAgo, { n: hours });
    return tr.feed.daysAgo;
  };

  // 유저 포스트 + 페르소나 포스트 통합 피드
  const allPosts: FeedItem[] = useMemo(() => {
    const userFeedItems: FeedItem[] = userPosts.map(p => ({
      id: p.id,
      type: 'user' as const,
      timestamp: p.timestamp,
      content: p.content,
      caption: p.caption,
      mood: p.mood,
    }));

    const personaFeedItems: FeedItem[] = personaPosts.map(p => ({
      id: p.id,
      type: 'persona' as const,
      timestamp: new Date(p.created_at).getTime(),
      persona: p.persona,
      personaContent: p.content,
      likes: p.likes,
      comments: p.comments,
      user_liked: p.user_liked,
      is_premium: p.is_premium,
    }));

    return [...userFeedItems, ...personaFeedItems].sort((a, b) => b.timestamp - a.timestamp);
  }, [userPosts, personaPosts]);

  return (
    <div className="min-h-screen bg-black text-white pb-20">
      {/* Loading Skeleton */}
      {isLoading && <FeedSkeleton count={3} />}

      {/* Feed */}
      {!isLoading && (
      <div className="divide-y divide-white/5">
        {allPosts.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center px-6">
            <p className="text-white/50 mb-2">{tr.feed.empty}</p>
            <p className="text-sm text-white/30">
              {tr.feed.emptyHint}
            </p>
          </div>
        ) : (
          allPosts.map((post, idx) => (
            <motion.article
              key={post.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.05 }}
              className="bg-black"
            >
              {/* Post Header */}
              <div className="flex items-center justify-between p-3">
                <div className="flex items-center gap-3">
                  {post.type === 'persona' && post.persona ? (
                    <>
                      <div
                        className="w-8 h-8 rounded-full overflow-hidden border border-white/20 cursor-pointer"
                        onClick={() => handleProfileClick(post.persona!.id)}
                      >
                        {post.persona.avatar_url ? (
                          <Image
                            src={post.persona.avatar_url}
                            alt={post.persona.display_name}
                            width={32}
                            height={32}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="w-full h-full bg-gradient-to-br from-pink-500 to-purple-500 flex items-center justify-center text-xs font-bold">
                            {post.persona.name.charAt(0).toUpperCase()}
                          </div>
                        )}
                      </div>
                      <span
                        className="font-medium text-sm cursor-pointer hover:underline"
                        onClick={() => handleProfileClick(post.persona!.id)}
                      >
                        {post.persona.display_name}
                      </span>
                    </>
                  ) : (
                    <>
                      <div className="w-8 h-8 rounded-full overflow-hidden border border-white/20">
                        <div className="w-full h-full bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center text-xs font-bold">
                          ME
                        </div>
                      </div>
                      <span className="font-medium text-sm">Me</span>
                    </>
                  )}
                </div>

                {/* Only show delete menu for user posts */}
                {post.type === 'user' && (
                  <div className="relative">
                    <button
                      onClick={() => setShowDeleteMenu(showDeleteMenu === post.id ? null : post.id)}
                      className="p-2"
                    >
                      <MoreHorizontal className="w-5 h-5" />
                    </button>

                    <AnimatePresence>
                      {showDeleteMenu === post.id && (
                        <motion.div
                          initial={{ opacity: 0, scale: 0.95 }}
                          animate={{ opacity: 1, scale: 1 }}
                          exit={{ opacity: 0, scale: 0.95 }}
                          className="absolute right-0 top-full mt-1 bg-zinc-900 border border-white/10 rounded-xl overflow-hidden z-10"
                        >
                          <button
                            onClick={() => handleDelete(post.id)}
                            className="flex items-center gap-2 px-4 py-3 text-red-400 hover:bg-white/5 w-full"
                          >
                            <Trash2 className="w-4 h-4" />
                            <span className="text-sm">{tr.common.delete}</span>
                          </button>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                )}
              </div>

              {/* Post Image/Content */}
              <div className="relative aspect-square">
                {post.type === 'persona' && post.personaContent?.images?.[0] ? (
                  <Image
                    src={post.personaContent.images[0]}
                    alt=""
                    fill
                    className="object-cover"
                  />
                ) : post.type === 'user' && post.content && !post.mood ? (
                  <Image
                    src={post.content}
                    alt=""
                    fill
                    className="object-cover"
                  />
                ) : (
                  <div className="w-full h-full bg-gradient-to-br from-purple-600 via-pink-600 to-red-600 flex items-center justify-center p-8">
                    <p className="text-xl text-center">{post.content || post.personaContent?.caption}</p>
                  </div>
                )}
              </div>

              {/* Post Actions */}
              <div className="p-3">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-4">
                    <button onClick={() => handleLike(post.id)}>
                      <Heart
                        className={`w-6 h-6 transition ${
                          likedPosts.has(post.id) || post.user_liked
                            ? 'text-red-500 fill-red-500'
                            : 'text-white'
                        }`}
                      />
                    </button>
                    <button>
                      <MessageCircle className="w-6 h-6" />
                    </button>
                    <button>
                      <Send className="w-6 h-6" />
                    </button>
                  </div>
                  <button>
                    <Bookmark className="w-6 h-6" />
                  </button>
                </div>

                {/* Likes count for persona posts */}
                {post.type === 'persona' && post.likes !== undefined && post.likes > 0 && (
                  <div className="text-sm font-semibold mb-1">
                    {t(tr.feed.likes, { n: post.likes.toLocaleString() })}
                  </div>
                )}

                {/* Caption */}
                {(post.caption || post.personaContent?.caption) && (
                  <div className="text-sm">
                    <span className="font-medium mr-2">
                      {post.type === 'persona' ? post.persona?.display_name : 'Me'}
                    </span>
                    {post.caption || post.personaContent?.caption}
                  </div>
                )}

                {/* Location for persona posts */}
                {post.type === 'persona' && post.personaContent?.location && (
                  <div className="flex items-center gap-1 text-xs text-white/50 mt-1">
                    <MapPin className="w-3 h-3" />
                    {post.personaContent.location}
                  </div>
                )}

                {/* Hashtags for persona posts */}
                {post.type === 'persona' && post.personaContent?.hashtags && post.personaContent.hashtags.length > 0 && (
                  <div className="text-sm text-blue-400 mt-1">
                    {post.personaContent.hashtags.map(tag => `#${tag}`).join(' ')}
                  </div>
                )}

                {/* Time */}
                <div className="text-xs text-white/40 mt-2">
                  {formatTime(post.timestamp)}
                </div>
              </div>
            </motion.article>
          ))
        )}
      </div>
      )}
    </div>
  );
}
