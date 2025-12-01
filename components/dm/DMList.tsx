'use client';

import { useState, useEffect, useRef } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { MessageCircle } from 'lucide-react';
import { JUN_PROFILE } from '@/lib/hacked-sns-data';
import { useAuthStore } from '@/lib/stores/auth-store';
import { apiClient } from '@/lib/api-client';
import SuggestedFriends from './SuggestedFriends';
import { DMListSkeleton } from '@/components/ui/Skeleton';

interface DMListProps {
  onOpenChat: (personaId: string) => void;
}

interface DMConversation {
  personaId: string;
  personaName: string;
  personaDisplayName: string;
  personaImage: string;
  isVerified: boolean;
  lastMessage: string;
  lastMessageAt: string;
  unreadCount: number;
  isOnline: boolean;
}

export default function DMList({ onOpenChat }: DMListProps) {
  const router = useRouter();
  const [conversations, setConversations] = useState<DMConversation[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const isAuthenticated = useAuthStore(state => state.isAuthenticated);
  const hasFetched = useRef(false);

  // 서버에서 DM 목록 로드
  useEffect(() => {
    if (isAuthenticated && !hasFetched.current) {
      hasFetched.current = true;
      loadDMList();
    } else if (!isAuthenticated) {
      setIsLoading(false);
    }
  }, [isAuthenticated]);

  const loadDMList = async () => {
    try {
      setIsLoading(true);
      const data = await apiClient.getDMList();
      setConversations(data.conversations);
    } catch (error) {
      console.error('[DMList] Failed to load:', error);
      // 에러 시 빈 목록 표시
      setConversations([]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleProfileClick = (personaId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    router.push(`/profile/${personaId}`);
  };

  const formatTime = (timestamp: string): string => {
    const diff = Date.now() - new Date(timestamp).getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return '방금';
    if (minutes < 60) return `${minutes}분`;
    if (hours < 24) return `${hours}시간`;
    if (days < 7) return `${days}일`;
    return '오래전';
  };

  // 로딩 중 스켈레톤 표시
  if (isLoading) {
    return (
      <div className="min-h-screen bg-black text-white">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
          <h1 className="text-lg font-bold">메시지</h1>
          <div className="text-xs text-white/50">로딩 중...</div>
        </div>
        <DMListSkeleton count={3} />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-white">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
        <h1 className="text-lg font-bold">메시지</h1>
        <div className="text-xs text-white/50">
          {conversations.length}개의 대화
        </div>
      </div>

      {/* DM List */}
      <div className="divide-y divide-white/5">
        {conversations.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center px-6">
            <div className="w-16 h-16 rounded-full border-2 border-white/20 flex items-center justify-center mb-4">
              <MessageCircle className="w-8 h-8 text-white/30" />
            </div>
            <p className="text-white/50 mb-2">아직 대화가 없어요</p>
            <p className="text-sm text-white/30">
              페르소나의 스토리에 답장하거나<br />
              포스팅을 올려 대화를 시작해보세요
            </p>
          </div>
        ) : (
          conversations.map((convo, idx) => (
            <motion.button
              key={convo.personaId}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.05 }}
              onClick={() => onOpenChat(convo.personaId)}
              className="w-full flex items-center gap-3 p-4 hover:bg-white/5 transition text-left"
            >
              {/* Profile Image - 클릭 시 프로필 이동 */}
              <div
                className="relative cursor-pointer"
                onClick={(e) => handleProfileClick(convo.personaId, e)}
              >
                <div className="w-14 h-14 rounded-full overflow-hidden border-2 border-white/20">
                  <Image
                    src={convo.personaImage}
                    alt={convo.personaDisplayName}
                    width={56}
                    height={56}
                    className="object-cover"
                  />
                </div>
                {convo.isOnline && (
                  <div className="absolute bottom-0 right-0 w-4 h-4 bg-green-500 rounded-full border-2 border-black" />
                )}
              </div>

              {/* Content */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span
                    className={`font-medium cursor-pointer hover:underline ${convo.unreadCount > 0 ? 'text-white' : 'text-white/80'}`}
                    onClick={(e) => handleProfileClick(convo.personaId, e)}
                  >
                    {convo.personaDisplayName}
                  </span>
                  {convo.isVerified && (
                    <div className="w-4 h-4 bg-blue-500 rounded-full flex items-center justify-center flex-shrink-0">
                      <span className="text-[8px] text-white">✓</span>
                    </div>
                  )}
                  <span className="text-xs text-white/40">@{convo.personaName}</span>
                </div>
                <div className="flex items-center gap-2 mt-0.5">
                  <p className={`text-sm truncate ${convo.unreadCount > 0 ? 'text-white' : 'text-white/50'}`}>
                    {convo.lastMessage}
                  </p>
                  <span className="text-xs text-white/30 flex-shrink-0">· {formatTime(convo.lastMessageAt)}</span>
                </div>
              </div>

              {/* Unread indicator */}
              {convo.unreadCount > 0 && (
                <div className="w-5 h-5 bg-blue-500 rounded-full flex items-center justify-center flex-shrink-0">
                  <span className="text-[10px] text-white font-medium">
                    {convo.unreadCount > 9 ? '9+' : convo.unreadCount}
                  </span>
                </div>
              )}
            </motion.button>
          ))
        )}
      </div>

      {/* 대화가 없을 때 Jun 시작 카드 */}
      {conversations.length === 0 && (
        <div className="px-4 pt-6">
          <h2 className="text-sm font-medium text-white/50 mb-3">대화 시작하기</h2>
          <div className="flex items-center gap-3 p-3 bg-white/5 rounded-xl">
            <div
              className="w-12 h-12 rounded-full overflow-hidden border border-white/20 cursor-pointer"
              onClick={() => router.push('/profile/jun')}
            >
              <Image
                src={JUN_PROFILE.profileImage}
                alt={JUN_PROFILE.displayName}
                width={48}
                height={48}
                className="object-cover"
              />
            </div>
            <div className="flex-1 text-left">
              <div className="flex items-center gap-2">
                <span
                  className="font-medium cursor-pointer hover:underline"
                  onClick={() => router.push('/profile/jun')}
                >
                  {JUN_PROFILE.displayName}
                </span>
                <div className="w-4 h-4 bg-blue-500 rounded-full flex items-center justify-center">
                  <span className="text-[8px] text-white">✓</span>
                </div>
              </div>
              <p className="text-sm text-white/50 line-clamp-1">{JUN_PROFILE.bio}</p>
            </div>
            <button
              onClick={() => onOpenChat('jun')}
              className="px-3 py-1.5 bg-white/10 rounded-lg text-sm hover:bg-white/15 transition"
            >
              대화하기
            </button>
          </div>
        </div>
      )}

      {/* 추천 친구 (프리미엄 페르소나 해금) */}
      <SuggestedFriends
        onUnlock={(personaId) => {
          console.log('[DMList] Persona unlocked:', personaId);
          // 목록 새로고침
          loadDMList();
        }}
        onStartChat={onOpenChat}
      />
    </div>
  );
}
