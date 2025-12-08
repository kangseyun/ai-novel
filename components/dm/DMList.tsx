'use client';

import { useState, useEffect, useRef } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { MessageCircle } from 'lucide-react';
import { useAuthStore } from '@/lib/stores/auth-store';
import { apiClient } from '@/lib/api-client';
import SuggestedFriends from './SuggestedFriends';
import { DMListSkeleton } from '@/components/ui/Skeleton';
import { useTranslations, useLocale, t } from '@/lib/i18n';
import { toast } from 'sonner';
import { useTutorial } from '@/components/tutorial/useTutorial';

interface DMListProps {
  onOpenChat?: (personaId: string) => void; // Optional - 기본은 URL 라우팅 사용
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

interface PersonaProfile {
  id: string;
  name: string;
  display_name: string;
  bio: string;
  avatar_url: string;
  is_verified: boolean;
}

export default function DMList({ onOpenChat }: DMListProps = {}) {
  const router = useRouter();

  // 채팅 열기 핸들러 - URL 라우팅 사용
  const handleOpenChat = (personaId: string) => {
    router.push(`/dm/${personaId}`);
  };
  const [conversations, setConversations] = useState<DMConversation[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [junProfile, setJunProfile] = useState<PersonaProfile | null>(null);
  const isAuthenticated = useAuthStore(state => state.isAuthenticated);
  const hasFetched = useRef(false);
  const tutorialTriggered = useRef(false);
  const tr = useTranslations();
  const locale = useLocale();
  const { startSuggestedFriendsTutorial, isSuggestedFriendsTutorialCompleted } = useTutorial();

  // 서버에서 DM 목록 로드
  useEffect(() => {
    if (isAuthenticated && !hasFetched.current) {
      hasFetched.current = true;
      loadDMList();
      loadJunProfile();
    } else if (!isAuthenticated) {
      setIsLoading(false);
    }
  }, [isAuthenticated]);

  // 추천 친구 튜토리얼 트리거
  useEffect(() => {
    if (!isLoading && !tutorialTriggered.current && !isSuggestedFriendsTutorialCompleted()) {
      tutorialTriggered.current = true;
      // 로딩 완료 후 약간의 딜레이를 두고 튜토리얼 시작
      const timer = setTimeout(() => {
        startSuggestedFriendsTutorial();
      }, 800);
      return () => clearTimeout(timer);
    }
  }, [isLoading, startSuggestedFriendsTutorial, isSuggestedFriendsTutorialCompleted]);

  const loadDMList = async () => {
    try {
      setIsLoading(true);
      const data = await apiClient.getDMList();
      setConversations(data.conversations);
    } catch (error) {
      console.error('[DMList] Failed to load:', error);
      toast.error('메시지 목록을 불러오지 못했어요');
      setConversations([]);
    } finally {
      setIsLoading(false);
    }
  };

  const loadJunProfile = async () => {
    try {
      const res = await fetch('/api/personas/jun');
      if (res.ok) {
        const data = await res.json();
        setJunProfile(data.persona);
      }
    } catch (error) {
      console.error('[DMList] Failed to load Jun profile:', error);
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

    if (minutes < 1) return tr.feed.justNow;
    if (minutes < 60) return t(tr.feed.minutesAgo, { n: minutes });
    if (hours < 24) return t(tr.feed.hoursAgo, { n: hours });
    if (days < 7) return locale === 'ko' ? `${days}일` : `${days}d`;
    return tr.feed.daysAgo;
  };

  // 로딩 중 스켈레톤 표시
  if (isLoading) {
    return (
      <div className="min-h-screen bg-black text-white">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
          <h1 className="text-lg font-bold">{tr.dm.title}</h1>
          <div className="text-xs text-white/50">{tr.common.loading}</div>
        </div>
        <DMListSkeleton count={3} />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-white">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
        <h1 className="text-lg font-bold">{tr.dm.title}</h1>
        <div className="text-xs text-white/50">
          {t(tr.dm.conversations, { n: conversations.length })}
        </div>
      </div>

      {/* DM List */}
      <div className="divide-y divide-white/5">
        {conversations.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center px-6">
            <div className="w-16 h-16 rounded-full border-2 border-white/20 flex items-center justify-center mb-4">
              <MessageCircle className="w-8 h-8 text-white/30" />
            </div>
            <p className="text-white/50 mb-2">{tr.dm.empty}</p>
            <p className="text-sm text-white/30 whitespace-pre-line">
              {tr.dm.emptyHint}
            </p>
          </div>
        ) : (
          conversations.map((convo, idx) => (
            <motion.button
              key={convo.personaId}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.05 }}
              onClick={() => handleOpenChat(convo.personaId)}
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
      {conversations.length === 0 && junProfile && (
        <div className="px-4 pt-6">
          <h2 className="text-sm font-medium text-white/50 mb-3">{tr.dm.startChat}</h2>
          <div className="flex items-center gap-3 p-3 bg-white/5 rounded-xl">
            <div
              className="w-12 h-12 rounded-full overflow-hidden border border-white/20 cursor-pointer"
              onClick={() => router.push('/profile/jun')}
            >
              <Image
                src={junProfile.avatar_url}
                alt={junProfile.display_name}
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
                  {junProfile.display_name}
                </span>
                {junProfile.is_verified && (
                  <div className="w-4 h-4 bg-blue-500 rounded-full flex items-center justify-center">
                    <span className="text-[8px] text-white">✓</span>
                  </div>
                )}
              </div>
              <p className="text-sm text-white/50 line-clamp-1">{junProfile.bio}</p>
            </div>
            <button
              onClick={() => handleOpenChat('jun')}
              className="px-3 py-1.5 bg-white/10 rounded-lg text-sm hover:bg-white/15 transition"
            >
              {tr.dm.chat}
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
        onStartChat={handleOpenChat}
      />
    </div>
  );
}
