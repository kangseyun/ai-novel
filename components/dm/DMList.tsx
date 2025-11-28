'use client';

import { useState } from 'react';
import Image from 'next/image';
import { motion } from 'framer-motion';
import { MessageCircle, Circle } from 'lucide-react';
import { JUN_PROFILE } from '@/lib/hacked-sns-data';
import { useFeedStore } from '@/lib/stores/feed-store';
import { useHackerStore } from '@/lib/stores/hacker-store';

interface DMListProps {
  onOpenChat: (personaId: string) => void;
}

interface DMConversation {
  personaId: string;
  profile: {
    displayName: string;
    username: string;
    profileImage: string;
    isVerified?: boolean;
  };
  lastMessage: string;
  timestamp: string;
  unread: boolean;
  isOnline: boolean;
}

export default function DMList({ onOpenChat }: DMListProps) {
  const events = useFeedStore(state => state.events);
  const personaProgress = useFeedStore(state => state.personaProgress);
  const hackerProfile = useHackerStore(state => state.profiles['jun']);

  // Jun과의 대화 생성
  const junProgress = personaProgress['jun'];
  const junEvents = events.filter(e => e.personaId === 'jun');
  const lastJunEvent = junEvents[0];
  const hasInteracted = hackerProfile?.completedScenarios?.length > 0 || junEvents.length > 0;

  const conversations: DMConversation[] = [];

  // Jun 대화 추가
  if (hasInteracted || junProgress) {
    conversations.push({
      personaId: 'jun',
      profile: {
        displayName: JUN_PROFILE.displayName,
        username: JUN_PROFILE.username,
        profileImage: JUN_PROFILE.profileImage,
        isVerified: JUN_PROFILE.isVerified,
      },
      lastMessage: lastJunEvent?.preview || '스토리에 답장해보세요',
      timestamp: lastJunEvent
        ? formatTime(lastJunEvent.timestamp)
        : '최근',
      unread: lastJunEvent ? !lastJunEvent.isRead : false,
      isOnline: true,
    });
  }

  function formatTime(timestamp: number): string {
    const diff = Date.now() - timestamp;
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return '방금';
    if (minutes < 60) return `${minutes}분`;
    if (hours < 24) return `${hours}시간`;
    if (days < 7) return `${days}일`;
    return '오래전';
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
              {/* Profile Image */}
              <div className="relative">
                <div className="w-14 h-14 rounded-full overflow-hidden border-2 border-white/20">
                  <Image
                    src={convo.profile.profileImage}
                    alt={convo.profile.displayName}
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
                  <span className={`font-medium ${convo.unread ? 'text-white' : 'text-white/80'}`}>
                    {convo.profile.displayName}
                  </span>
                  {convo.profile.isVerified && (
                    <div className="w-4 h-4 bg-blue-500 rounded-full flex items-center justify-center flex-shrink-0">
                      <span className="text-[8px] text-white">✓</span>
                    </div>
                  )}
                  <span className="text-xs text-white/40">@{convo.profile.username}</span>
                </div>
                <div className="flex items-center gap-2 mt-0.5">
                  <p className={`text-sm truncate ${convo.unread ? 'text-white' : 'text-white/50'}`}>
                    {convo.lastMessage}
                  </p>
                  <span className="text-xs text-white/30 flex-shrink-0">· {convo.timestamp}</span>
                </div>
              </div>

              {/* Unread indicator */}
              {convo.unread && (
                <div className="w-3 h-3 bg-blue-500 rounded-full flex-shrink-0" />
              )}
            </motion.button>
          ))
        )}
      </div>

      {/* Suggested Personas */}
      {conversations.length === 0 && (
        <div className="px-4 pt-6">
          <h2 className="text-sm font-medium text-white/50 mb-3">추천 페르소나</h2>
          <button
            onClick={() => onOpenChat('jun')}
            className="w-full flex items-center gap-3 p-3 bg-white/5 rounded-xl hover:bg-white/10 transition"
          >
            <div className="w-12 h-12 rounded-full overflow-hidden border border-white/20">
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
                <span className="font-medium">{JUN_PROFILE.displayName}</span>
                <div className="w-4 h-4 bg-blue-500 rounded-full flex items-center justify-center">
                  <span className="text-[8px] text-white">✓</span>
                </div>
              </div>
              <p className="text-sm text-white/50">{JUN_PROFILE.bio}</p>
            </div>
            <div className="px-3 py-1.5 bg-white/10 rounded-lg text-sm">
              대화하기
            </div>
          </button>
        </div>
      )}
    </div>
  );
}
