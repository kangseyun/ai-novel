'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Heart,
  MessageCircle,
  UserPlus,
  Bell,
  ChevronRight,
  Sparkles,
  Clock,
  Zap,
  Star,
  Gift,
  AlertCircle,
} from 'lucide-react';
import { useFeedStore } from '@/lib/stores/feed-store';
import { JUN_PROFILE } from '@/lib/hacked-sns-data';
import { FeedEvent } from '@/lib/user-feed-system';
import { useAuthStore } from '@/lib/stores/auth-store';
import { ActivityListSkeleton } from '@/components/ui/Skeleton';
import { useTranslations, useLocale, t } from '@/lib/i18n';

interface ActivityFeedProps {
  onOpenDM: (scenarioId: string) => void;
}

type FilterType = 'all' | 'dm' | 'reactions' | 'system';

const EVENT_ICONS = {
  dm: MessageCircle,
  story_reply: MessageCircle,
  comment: MessageCircle,
  like: Heart,
  follow: UserPlus,
};

const PERSONA_IMAGES: Record<string, string> = {
  jun: JUN_PROFILE.profileImage,
};

const PERSONA_NAMES: Record<string, string> = {
  jun: JUN_PROFILE.displayName,
};

export default function ActivityFeed({ onOpenDM }: ActivityFeedProps) {
  const [filter, setFilter] = useState<FilterType>('all');
  const events = useFeedStore(state => state.events);
  const markEventAsRead = useFeedStore(state => state.markEventAsRead);
  const markAllEventsAsRead = useFeedStore(state => state.markAllEventsAsRead);
  const unreadCount = useFeedStore(state => state.unreadCount);
  const loadEventsFromServer = useFeedStore(state => state.loadEventsFromServer);
  const isLoading = useFeedStore(state => state.isLoading);

  const isAuthenticated = useAuthStore(state => state.isAuthenticated);
  const tr = useTranslations();
  const locale = useLocale();

  // 로그인 상태면 서버에서 이벤트 로드
  useEffect(() => {
    if (isAuthenticated) {
      loadEventsFromServer().catch(() => {
        // 로드 실패 시 로컬 데이터 사용
      });
    }
  }, [isAuthenticated, loadEventsFromServer]);

  // 필터링된 이벤트
  const filteredEvents = events.filter(event => {
    if (filter === 'all') return true;
    if (filter === 'dm') return event.type === 'dm' || event.type === 'story_reply';
    if (filter === 'reactions') return event.type === 'like' || event.type === 'comment' || event.type === 'follow';
    return false;
  });

  // 오늘/이번주/이전 분류
  const now = Date.now();
  const todayStart = new Date().setHours(0, 0, 0, 0);
  const weekStart = now - 7 * 24 * 60 * 60 * 1000;

  const todayEvents = filteredEvents.filter(e => e.timestamp >= todayStart);
  const weekEvents = filteredEvents.filter(e => e.timestamp >= weekStart && e.timestamp < todayStart);
  const olderEvents = filteredEvents.filter(e => e.timestamp < weekStart);

  const handleEventClick = (event: FeedEvent) => {
    markEventAsRead(event.id);

    if (event.scenarioId && (event.type === 'dm' || event.type === 'story_reply')) {
      onOpenDM(event.scenarioId);
    }
  };

  const formatTime = (timestamp: number) => {
    const diff = Date.now() - timestamp;
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return tr.feed.justNow;
    if (minutes < 60) return t(tr.feed.minutesAgo, { n: minutes });
    if (hours < 24) return t(tr.feed.hoursAgo, { n: hours });
    if (days < 7) return t(tr.feed.daysAgo, { n: days });
    return new Date(timestamp).toLocaleDateString(locale === 'ko' ? 'ko-KR' : 'en-US', { month: 'short', day: 'numeric' });
  };

  const getEventDescription = (event: FeedEvent) => {
    switch (event.type) {
      case 'dm':
        return tr.notifications.newMessage;
      case 'story_reply':
        return tr.notifications.storyReply;
      case 'like':
        return tr.notifications.liked;
      case 'comment':
        return tr.notifications.commented;
      case 'follow':
        return tr.notifications.followed;
      default:
        return '';
    }
  };

  const renderEventCard = (event: FeedEvent, idx: number) => {
    const Icon = EVENT_ICONS[event.type];
    const isNew = !event.isRead;
    const isDM = event.type === 'dm' || event.type === 'story_reply';

    return (
      <motion.button
        key={event.id}
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: idx * 0.03 }}
        onClick={() => handleEventClick(event)}
        className={`w-full p-4 flex items-start gap-3 text-left transition rounded-xl mb-2 ${
          isNew
            ? 'bg-gradient-to-r from-blue-500/10 to-purple-500/10 border border-blue-500/20'
            : 'bg-white/5 border border-transparent hover:border-white/10'
        } hover:bg-white/10`}
      >
        {/* Avatar with glow effect for unread */}
        <div className="relative flex-shrink-0">
          <div className={`w-12 h-12 rounded-full overflow-hidden ${
            isNew ? 'ring-2 ring-blue-500/50' : 'border border-white/20'
          }`}>
            <Image
              src={PERSONA_IMAGES[event.personaId] || '/default-avatar.png'}
              alt={event.title}
              width={48}
              height={48}
              className="object-cover"
            />
          </div>
          {/* Event type badge */}
          <div className={`absolute -bottom-1 -right-1 w-6 h-6 rounded-full flex items-center justify-center shadow-lg ${
            event.type === 'like' ? 'bg-gradient-to-br from-red-500 to-pink-500' :
            isDM ? 'bg-gradient-to-br from-blue-500 to-cyan-500' :
            'bg-gradient-to-br from-purple-500 to-pink-500'
          }`}>
            <Icon className="w-3 h-3 text-white" />
          </div>
          {/* New indicator pulse */}
          {isNew && (
            <div className="absolute -top-1 -right-1 w-3 h-3">
              <span className="absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75 animate-ping" />
              <span className="relative inline-flex rounded-full h-3 w-3 bg-blue-500" />
            </div>
          )}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-0.5">
            <span className="font-semibold text-white">
              {PERSONA_NAMES[event.personaId] || event.title}
            </span>
            <span className="text-xs text-white/40">
              {formatTime(event.timestamp)}
            </span>
          </div>
          <p className="text-sm text-white/60 mb-1">
            {getEventDescription(event)}
          </p>
          {/* Preview message */}
          <div className={`text-sm ${isNew ? 'text-white' : 'text-white/70'} line-clamp-2`}>
            "{event.preview}"
          </div>
        </div>

        {/* Action button for DMs */}
        {isDM && event.scenarioId && (
          <div className="flex-shrink-0 self-center">
            <div className={`px-3 py-1.5 rounded-full text-xs font-medium ${
              isNew
                ? 'bg-blue-500 text-white'
                : 'bg-white/10 text-white/70'
            }`}>
              {tr.notifications.reply}
            </div>
          </div>
        )}
      </motion.button>
    );
  };

  const renderSection = (title: string, sectionEvents: FeedEvent[], icon: React.ReactNode) => {
    if (sectionEvents.length === 0) return null;

    return (
      <div className="mb-6">
        <div className="flex items-center gap-2 px-4 mb-3">
          {icon}
          <h3 className="text-sm font-medium text-white/50">{title}</h3>
          <span className="text-xs text-white/30">({sectionEvents.length})</span>
        </div>
        <div className="px-4">
          {sectionEvents.map((event, idx) => renderEventCard(event, idx))}
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-black text-white pb-20">
      {/* Header */}
      <div className="sticky top-0 z-40 bg-black/95 backdrop-blur-xl border-b border-white/10">
        <div className="flex items-center justify-between px-4 py-3">
          <div className="flex items-center gap-2">
            <h1 className="text-lg font-bold">{tr.notifications.title}</h1>
            {unreadCount > 0 && (
              <span className="px-2 py-0.5 bg-red-500 rounded-full text-xs font-bold">
                {unreadCount}
              </span>
            )}
          </div>
          {unreadCount > 0 && (
            <button
              onClick={markAllEventsAsRead}
              className="text-sm text-blue-400 hover:text-blue-300 transition"
            >
              {tr.notifications.markAllRead}
            </button>
          )}
        </div>

        {/* Filter tabs */}
        <div className="flex gap-2 px-4 pb-3 overflow-x-auto scrollbar-hide">
          {[
            { id: 'all' as FilterType, label: tr.feed.all, icon: Bell },
            { id: 'dm' as FilterType, label: tr.dm.title, icon: MessageCircle },
            { id: 'reactions' as FilterType, label: tr.feed.reactions, icon: Heart },
          ].map(({ id, label, icon: TabIcon }) => (
            <button
              key={id}
              onClick={() => setFilter(id)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm whitespace-nowrap transition ${
                filter === id
                  ? 'bg-white text-black font-medium'
                  : 'bg-white/10 text-white/70 hover:bg-white/15'
              }`}
            >
              <TabIcon className="w-4 h-4" />
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="pt-4">
        {/* Loading Skeleton */}
        {isLoading && <ActivityListSkeleton count={5} />}

        {!isLoading && filteredEvents.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center px-6">
            <div className="w-20 h-20 bg-gradient-to-br from-purple-500/20 to-pink-500/20 rounded-full flex items-center justify-center mb-4">
              <Bell className="w-10 h-10 text-white/30" />
            </div>
            <p className="text-white/70 font-medium mb-2">{tr.notifications.empty}</p>
            <p className="text-sm text-white/40 mb-6">
              {tr.notifications.emptyHint}
            </p>

            {/* Quick action cards */}
            <div className="w-full max-w-sm space-y-3">
              <div className="p-4 bg-gradient-to-r from-blue-500/10 to-cyan-500/10 border border-blue-500/20 rounded-xl text-left">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 bg-blue-500/20 rounded-full flex items-center justify-center flex-shrink-0">
                    <Zap className="w-5 h-5 text-blue-400" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-blue-300">{tr.notifications.quickReaction}</p>
                    <p className="text-xs text-white/50 mt-1">
                      {tr.notifications.quickReactionHint}
                    </p>
                  </div>
                </div>
              </div>

              <div className="p-4 bg-gradient-to-r from-purple-500/10 to-pink-500/10 border border-purple-500/20 rounded-xl text-left">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 bg-purple-500/20 rounded-full flex items-center justify-center flex-shrink-0">
                    <Star className="w-5 h-5 text-purple-400" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-purple-300">{tr.notifications.specialMoment}</p>
                    <p className="text-xs text-white/50 mt-1">
                      {tr.notifications.specialMomentHint}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        ) : !isLoading && (
          <>
            {/* Today's events */}
            {renderSection(
              tr.notifications.today,
              todayEvents,
              <Clock className="w-4 h-4 text-green-400" />
            )}

            {/* This week's events */}
            {renderSection(
              tr.notifications.thisWeek,
              weekEvents,
              <Clock className="w-4 h-4 text-blue-400" />
            )}

            {/* Older events */}
            {renderSection(
              tr.notifications.earlier,
              olderEvents,
              <Clock className="w-4 h-4 text-white/40" />
            )}
          </>
        )}

        {/* Tips section when there are some events */}
        {filteredEvents.length > 0 && filteredEvents.length < 5 && (
          <div className="mx-4 mt-4 p-4 bg-gradient-to-r from-amber-500/10 to-orange-500/10 border border-amber-500/20 rounded-xl">
            <div className="flex items-start gap-3">
              <Gift className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-amber-300">{tr.notifications.moreReactions}</p>
                <p className="text-xs text-white/50 mt-1 leading-relaxed">
                  {tr.notifications.moreReactionsHint}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Scenario unlock hint */}
        {events.some(e => e.type === 'dm' && !e.isRead) && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="mx-4 mt-4 p-4 bg-gradient-to-r from-red-500/10 to-pink-500/10 border border-red-500/30 rounded-xl"
          >
            <div className="flex items-start gap-3">
              <div className="relative">
                <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0" />
                <span className="absolute -top-1 -right-1 w-2 h-2 bg-red-500 rounded-full animate-pulse" />
              </div>
              <div>
                <p className="text-sm font-medium text-red-300">{tr.notifications.newScenario}</p>
                <p className="text-xs text-white/50 mt-1">
                  {tr.notifications.newScenarioHint}
                </p>
              </div>
            </div>
          </motion.div>
        )}
      </div>
    </div>
  );
}
