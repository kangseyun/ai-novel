'use client';

import { useState, useEffect, useRef } from 'react';
import Image from 'next/image';
import { motion } from 'framer-motion';
import {
  Settings,
  Grid3X3,
  Bookmark,
  Heart,
  MessageCircle,
} from 'lucide-react';
import { useFeedStore } from '@/lib/stores/feed-store';
import { useUserPersonaStore, PERSONALITY_LABELS, COMMUNICATION_LABELS } from '@/lib/stores/user-persona-store';
import { useAuthStore } from '@/lib/stores/auth-store';
import ProfileEditModal from './ProfileEditModal';
import SettingsModal from './SettingsModal';
import { ProfileSkeleton } from '@/components/ui/Skeleton';
import { useTranslations } from '@/lib/i18n';

export default function MyProfile() {
  const [activeTab, setActiveTab] = useState<'posts' | 'saved'>('posts');
  const [showEditModal, setShowEditModal] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const userPosts = useFeedStore(state => state.userPosts);
  const persona = useUserPersonaStore(state => state.persona);
  const loadFromServer = useUserPersonaStore(state => state.loadFromServer);
  const isSyncing = useUserPersonaStore(state => state.isSyncing);
  const isAuthenticated = useAuthStore(state => state.isAuthenticated);
  const hasHydrated = useAuthStore(state => state.hasHydrated);
  const tr = useTranslations();

  // 마운트 시 서버에서 데이터 동기화
  const hasFetched = useRef(false);
  useEffect(() => {
    if (isAuthenticated && !hasFetched.current) {
      hasFetched.current = true;
      loadFromServer().catch(() => {
        // 동기화 실패 시 무시 (로컬 데이터 사용)
      });
    }
  }, [loadFromServer, isAuthenticated]);

  // hydration이 완료될 때까지 또는 동기화 중일 때 스켈레톤 표시
  if (!hasHydrated || isSyncing) {
    return <ProfileSkeleton />;
  }

  // 비로그인 상태면 로그인 페이지로 유도
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-black text-white flex flex-col items-center justify-center p-6">
        <div className="text-center">
          <h2 className="text-xl font-bold mb-2">{tr.common.loginRequired}</h2>
          <p className="text-white/50 mb-6">{tr.profile.title}</p>
          <a
            href="/login"
            className="inline-block px-6 py-3 bg-white text-black rounded-xl font-medium"
          >
            {tr.common.login}
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-white">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
        <h1 className="text-lg font-bold">{tr.profile.title}</h1>
        <button
          onClick={() => setShowSettingsModal(true)}
          className="p-2 hover:bg-white/10 rounded-full transition"
        >
          <Settings className="w-5 h-5" />
        </button>
      </div>

      {/* Profile Info */}
      <div className="p-6">
        <div className="flex items-center gap-6">
          {/* Profile Image */}
          <div className="w-20 h-20 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center text-2xl font-bold border-2 border-white/20 overflow-hidden">
            {persona.profileImage ? (
              <img
                src={persona.profileImage}
                alt="Profile"
                className="w-full h-full object-cover"
              />
            ) : (
              persona.nickname?.[0]?.toUpperCase() || '?'
            )}
          </div>

          {/* Stats */}
          <div className="flex-1 flex justify-around">
            <div className="text-center">
              <div className="text-xl font-bold">{userPosts.length}</div>
              <div className="text-xs text-white/50">{tr.profile.posts}</div>
            </div>
            <div className="text-center">
              <div className="text-xl font-bold">1</div>
              <div className="text-xs text-white/50">{tr.profile.followers}</div>
            </div>
            <div className="text-center">
              <div className="text-xl font-bold">1</div>
              <div className="text-xs text-white/50">{tr.profile.following}</div>
            </div>
          </div>
        </div>

        {/* Bio */}
        <div className="mt-4">
          <div className="font-medium">
            {isSyncing ? (
              <span className="text-white/50">{tr.common.loading}</span>
            ) : (
              persona.nickname || tr.profile.setNickname
            )}
          </div>
          {persona.bio ? (
            <div className="text-sm text-white/60 mt-1">{persona.bio}</div>
          ) : (
            <div className="text-sm text-white/40 mt-1">{tr.profile.writeBio}</div>
          )}
        </div>

        {/* Persona Tags */}
        {(persona.personality || persona.interests.length > 0) && (
          <div className="mt-3 flex flex-wrap gap-1.5">
            <span className="px-2 py-0.5 bg-white/10 rounded-full text-xs text-white/60">
              {PERSONALITY_LABELS[persona.personality].label}
            </span>
            <span className="px-2 py-0.5 bg-white/10 rounded-full text-xs text-white/60">
              {COMMUNICATION_LABELS[persona.communicationStyle].label}
            </span>
            {persona.interests.slice(0, 2).map((interest) => (
              <span key={interest} className="px-2 py-0.5 bg-white/10 rounded-full text-xs text-white/60">
                {interest}
              </span>
            ))}
          </div>
        )}

        {/* Edit Profile Button */}
        <button
          onClick={() => setShowEditModal(true)}
          className="w-full mt-4 py-2 bg-white/10 hover:bg-white/15 rounded-lg text-sm font-medium transition"
        >
          {tr.profile.editProfile}
        </button>
      </div>

      {/* Profile Edit Modal */}
      <ProfileEditModal
        isOpen={showEditModal}
        onClose={() => setShowEditModal(false)}
      />

      {/* Settings Modal */}
      <SettingsModal
        isOpen={showSettingsModal}
        onClose={() => setShowSettingsModal(false)}
      />

      {/* Tabs */}
      <div className="flex border-b border-white/10">
        <button
          onClick={() => setActiveTab('posts')}
          className={`flex-1 py-3 flex justify-center ${
            activeTab === 'posts' ? 'border-b-2 border-white' : 'text-white/50'
          }`}
        >
          <Grid3X3 className="w-5 h-5" />
        </button>
        <button
          onClick={() => setActiveTab('saved')}
          className={`flex-1 py-3 flex justify-center ${
            activeTab === 'saved' ? 'border-b-2 border-white' : 'text-white/50'
          }`}
        >
          <Bookmark className="w-5 h-5" />
        </button>
      </div>

      {/* Content */}
      <div className="pb-20">
        {activeTab === 'posts' && (
          <>
            {userPosts.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-center px-6">
                <div className="w-16 h-16 rounded-full border-2 border-white/20 flex items-center justify-center mb-4">
                  <Grid3X3 className="w-8 h-8 text-white/30" />
                </div>
                <p className="text-white/50 mb-1">{tr.profile.noPosts}</p>
                <p className="text-sm text-white/30">
                  {tr.profile.noPostsHint}
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-3 gap-0.5">
                {userPosts.map((post, idx) => (
                  <motion.div
                    key={post.id}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: idx * 0.05 }}
                    className="aspect-square relative group cursor-pointer"
                  >
                    {post.type === 'text' || post.type === 'mood' ? (
                      <div className="w-full h-full bg-gradient-to-br from-purple-600 via-pink-600 to-red-600 flex items-center justify-center p-2">
                        <p className="text-xs text-center line-clamp-3">{post.content}</p>
                      </div>
                    ) : (
                      <Image
                        src={post.content}
                        alt=""
                        fill
                        className="object-cover"
                      />
                    )}
                    {/* Hover overlay */}
                    <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition flex items-center justify-center gap-4">
                      <div className="flex items-center gap-1 text-sm">
                        <Heart className="w-4 h-4 fill-white" />
                        <span>0</span>
                      </div>
                      <div className="flex items-center gap-1 text-sm">
                        <MessageCircle className="w-4 h-4 fill-white" />
                        <span>0</span>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>
            )}
          </>
        )}

        {activeTab === 'saved' && (
          <div className="flex flex-col items-center justify-center py-16 text-center px-6">
            <div className="w-16 h-16 rounded-full border-2 border-white/20 flex items-center justify-center mb-4">
              <Bookmark className="w-8 h-8 text-white/30" />
            </div>
            <p className="text-white/50 mb-1">{tr.profile.noSavedPosts}</p>
            <p className="text-sm text-white/30">
              {tr.profile.noSavedPostsHint}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
