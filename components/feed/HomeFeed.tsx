'use client';

import { useState } from 'react';
import Image from 'next/image';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Heart,
  MessageCircle,
  Send,
  Bookmark,
  MoreHorizontal,
  Trash2,
  Plus,
  Play,
} from 'lucide-react';
import { useFeedStore } from '@/lib/stores/feed-store';
import { JUN_PROFILE, JUN_POSTS, JUN_STORIES, getVisiblePosts, getVisibleStories, Story } from '@/lib/hacked-sns-data';
import { useHackerStore } from '@/lib/stores/hacker-store';

interface HomeFeedProps {
  onOpenProfile: (personaId: string) => void;
  onOpenStory?: (personaId: string, story: Story) => void;
}

export default function HomeFeed({ onOpenProfile, onOpenStory }: HomeFeedProps) {
  const userPosts = useFeedStore(state => state.userPosts);
  const deletePost = useFeedStore(state => state.deletePost);
  const personaProgress = useFeedStore(state => state.personaProgress);
  const [likedPosts, setLikedPosts] = useState<Set<string>>(new Set());
  const [showDeleteMenu, setShowDeleteMenu] = useState<string | null>(null);
  const [viewedStoryIds, setViewedStoryIds] = useState<Set<string>>(new Set());

  const hackLevel = useHackerStore(state => state.profiles['jun']?.hackLevel ?? 1);
  const junProfile = useHackerStore(state => state.profiles['jun']);
  const visibleJunPosts = getVisiblePosts(JUN_POSTS, hackLevel);

  // 페르소나와 관계가 형성되었는지 확인 (첫 시나리오 완료 또는 호감도 > 0)
  const hasRelationshipWithJun =
    (junProfile?.completedScenarios?.length ?? 0) > 0 ||
    (junProfile?.affectionLevel ?? 0) > 0 ||
    (personaProgress['jun']?.affection ?? 0) > 0;

  // 보이는 스토리 (관계 형성 후에만)
  const visibleJunStories = hasRelationshipWithJun ? getVisibleStories(JUN_STORIES, hackLevel) : [];

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

    if (minutes < 1) return '방금';
    if (minutes < 60) return `${minutes}분`;
    if (hours < 24) return `${hours}시간`;
    return '며칠 전';
  };

  // 모든 포스트를 시간순으로 정렬
  const allPosts = [
    ...userPosts.map(p => ({ ...p, isUser: true, author: 'me' })),
    ...visibleJunPosts.map(p => ({
      id: p.id,
      type: p.type,
      content: p.images[0],
      caption: p.caption,
      timestamp: Date.now() - Math.random() * 86400000 * 7, // 랜덤 과거 시간
      isUser: false,
      author: 'jun',
      likes: p.likes,
      comments: p.comments,
    })),
  ].sort((a, b) => b.timestamp - a.timestamp);

  const handleStoryClick = (story: Story) => {
    setViewedStoryIds(prev => new Set([...prev, story.id]));
    if (onOpenStory) {
      onOpenStory('jun', story);
    }
  };

  // 스토리 데이터 구성
  const storyUsers = [];

  // 내 스토리 (추후 구현)
  storyUsers.push({
    id: 'me',
    name: '내 스토리',
    image: null,
    isMe: true,
    hasUnread: false,
    stories: [],
  });

  // Jun 스토리 (관계 형성 후에만)
  if (visibleJunStories.length > 0) {
    const hasUnreadJunStory = visibleJunStories.some(s => !viewedStoryIds.has(s.id));
    storyUsers.push({
      id: 'jun',
      name: JUN_PROFILE.displayName,
      image: JUN_PROFILE.profileImage,
      isMe: false,
      hasUnread: hasUnreadJunStory,
      stories: visibleJunStories,
      isVerified: JUN_PROFILE.isVerified,
    });
  }

  return (
    <div className="min-h-screen bg-black text-white pb-20">
      {/* Stories Section */}
      {storyUsers.length > 0 && (
        <div className="border-b border-white/10">
          <div className="flex gap-4 px-4 py-4 overflow-x-auto scrollbar-hide">
            {storyUsers.map((user) => (
              <button
                key={user.id}
                onClick={() => {
                  if (user.isMe) {
                    // 내 스토리 추가 (추후 구현)
                  } else if (user.stories.length > 0) {
                    handleStoryClick(user.stories[0]);
                  }
                }}
                className="flex flex-col items-center gap-1 flex-shrink-0"
              >
                <div className="relative">
                  {/* Story ring */}
                  <div
                    className={`w-16 h-16 rounded-full p-[2px] ${
                      user.isMe
                        ? 'bg-white/20'
                        : user.hasUnread
                        ? 'bg-gradient-to-tr from-yellow-400 via-red-500 to-purple-500'
                        : 'bg-white/30'
                    }`}
                  >
                    <div className="w-full h-full rounded-full bg-black p-[2px]">
                      {user.isMe ? (
                        <div className="w-full h-full rounded-full bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center">
                          <Plus className="w-6 h-6 text-white" />
                        </div>
                      ) : (
                        <div className="w-full h-full rounded-full overflow-hidden">
                          <Image
                            src={user.image!}
                            alt={user.name}
                            width={60}
                            height={60}
                            className="object-cover"
                          />
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Video indicator for stories */}
                  {!user.isMe && user.stories.some(s => s.type === 'video') && (
                    <div className="absolute bottom-0 right-0 w-5 h-5 bg-red-500 rounded-full flex items-center justify-center border-2 border-black">
                      <Play className="w-2.5 h-2.5 text-white fill-white" />
                    </div>
                  )}

                  {/* Unread count badge */}
                  {!user.isMe && user.hasUnread && user.stories.length > 1 && (
                    <div className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 rounded-full flex items-center justify-center text-[10px] font-bold border-2 border-black">
                      {user.stories.filter(s => !viewedStoryIds.has(s.id)).length}
                    </div>
                  )}
                </div>

                <span className="text-[11px] text-white/70 max-w-[64px] truncate">
                  {user.name}
                </span>

                {/* Verified badge */}
                {user.isVerified && (
                  <div className="absolute bottom-6 right-0 w-4 h-4 bg-blue-500 rounded-full flex items-center justify-center">
                    <span className="text-[8px] text-white">✓</span>
                  </div>
                )}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Feed */}
      <div className="divide-y divide-white/5">
        {allPosts.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center px-6">
            <p className="text-white/50 mb-2">피드가 비어있어요</p>
            <p className="text-sm text-white/30">
              + 버튼을 눌러 첫 포스팅을 해보세요
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
                <button
                  onClick={() => !post.isUser && onOpenProfile(post.author)}
                  className="flex items-center gap-3"
                >
                  <div className="w-8 h-8 rounded-full overflow-hidden border border-white/20">
                    {post.isUser ? (
                      <div className="w-full h-full bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center text-xs font-bold">
                        ME
                      </div>
                    ) : (
                      <Image
                        src={JUN_PROFILE.profileImage}
                        alt={JUN_PROFILE.username}
                        width={32}
                        height={32}
                        className="object-cover"
                      />
                    )}
                  </div>
                  <span className="font-medium text-sm">
                    {post.isUser ? 'Me' : JUN_PROFILE.username}
                  </span>
                </button>

                <div className="relative">
                  <button
                    onClick={() => setShowDeleteMenu(showDeleteMenu === post.id ? null : post.id)}
                    className="p-2"
                  >
                    <MoreHorizontal className="w-5 h-5" />
                  </button>

                  {/* Delete menu for user posts */}
                  <AnimatePresence>
                    {showDeleteMenu === post.id && post.isUser && (
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
                          <span className="text-sm">삭제</span>
                        </button>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </div>

              {/* Post Image */}
              <div className="relative aspect-square">
                {post.type === 'text' || post.type === 'mood' ? (
                  <div className="w-full h-full bg-gradient-to-br from-purple-600 via-pink-600 to-red-600 flex items-center justify-center p-8">
                    <p className="text-xl text-center">{post.content}</p>
                  </div>
                ) : (
                  <Image
                    src={post.content}
                    alt=""
                    fill
                    className="object-cover"
                  />
                )}
              </div>

              {/* Post Actions */}
              <div className="p-3">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-4">
                    <button onClick={() => handleLike(post.id)}>
                      <Heart
                        className={`w-6 h-6 transition ${
                          likedPosts.has(post.id)
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

                {/* Likes */}
                {!post.isUser && 'likes' in post && (
                  <div className="text-sm font-medium mb-1">
                    좋아요 {post.likes}개
                  </div>
                )}

                {/* Caption */}
                {post.caption && (
                  <div className="text-sm">
                    <span className="font-medium mr-2">
                      {post.isUser ? 'Me' : JUN_PROFILE.username}
                    </span>
                    {post.caption}
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
    </div>
  );
}
