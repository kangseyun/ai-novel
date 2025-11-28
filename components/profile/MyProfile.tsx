'use client';

import { useState } from 'react';
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
import ProfileEditModal from './ProfileEditModal';
import SettingsModal from './SettingsModal';

export default function MyProfile() {
  const [activeTab, setActiveTab] = useState<'posts' | 'saved'>('posts');
  const [showEditModal, setShowEditModal] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const userPosts = useFeedStore(state => state.userPosts);
  const persona = useUserPersonaStore(state => state.persona);

  return (
    <div className="min-h-screen bg-black text-white">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
        <h1 className="text-lg font-bold">내 프로필</h1>
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
              <div className="text-xs text-white/50">게시물</div>
            </div>
            <div className="text-center">
              <div className="text-xl font-bold">1</div>
              <div className="text-xs text-white/50">팔로워</div>
            </div>
            <div className="text-center">
              <div className="text-xl font-bold">1</div>
              <div className="text-xs text-white/50">팔로잉</div>
            </div>
          </div>
        </div>

        {/* Bio */}
        <div className="mt-4">
          <div className="font-medium">{persona.nickname || '닉네임을 설정해주세요'}</div>
          {persona.bio ? (
            <div className="text-sm text-white/60 mt-1">{persona.bio}</div>
          ) : (
            <div className="text-sm text-white/40 mt-1">한 줄 소개를 작성해보세요</div>
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
          프로필 편집
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
                <p className="text-white/50 mb-1">아직 게시물이 없어요</p>
                <p className="text-sm text-white/30">
                  + 버튼을 눌러 첫 포스팅을 해보세요
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
            <p className="text-white/50 mb-1">저장된 게시물이 없어요</p>
            <p className="text-sm text-white/30">
              마음에 드는 게시물을 저장해보세요
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
