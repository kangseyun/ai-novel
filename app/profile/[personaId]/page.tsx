'use client';

import { useParams, useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import Image from 'next/image';
import { ArrowLeft, Settings, MoreHorizontal, Grid3X3, Bookmark, Heart } from 'lucide-react';
import { JUN_PROFILE, JUN_POSTS } from '@/lib/hacked-sns-data';
import { useUserPersonaStore } from '@/lib/stores/user-persona-store';
import { useTranslations } from '@/lib/i18n';
import { useEffect } from 'react';
import analytics from '@/lib/analytics';

// 페르소나 프로필 데이터
const PERSONA_PROFILES: Record<string, {
  id: string;
  username: string;
  displayName: string;
  bio: string;
  profileImage: string;
  isVerified: boolean;
  followers: string;
  following: number;
  posts: number;
}> = {
  jun: {
    id: 'jun',
    username: JUN_PROFILE.username,
    displayName: JUN_PROFILE.displayName,
    bio: JUN_PROFILE.bio,
    profileImage: JUN_PROFILE.profileImage,
    isVerified: JUN_PROFILE.isVerified,
    followers: JUN_PROFILE.followers,
    following: JUN_PROFILE.following,
    posts: JUN_POSTS.length,
  },
  daniel: {
    id: 'daniel',
    username: 'daniel_sterling',
    displayName: 'Daniel Sterling',
    bio: 'CEO, Sterling Industries\n일과 삶의 경계는 없다',
    profileImage: 'https://i.pravatar.cc/400?img=52',
    isVerified: true,
    followers: '2.1M',
    following: 48,
    posts: 127,
  },
  kael: {
    id: 'kael',
    username: 'kael_vance',
    displayName: 'Kael',
    bio: '그림자처럼\n조용히',
    profileImage: 'https://i.pravatar.cc/400?img=53',
    isVerified: false,
    followers: '892K',
    following: 3,
    posts: 12,
  },
  adrian: {
    id: 'adrian',
    username: 'adrian_cruz',
    displayName: 'Adrian Cruz',
    bio: '음악 | 기타 | 후회\n다시 시작할 수 있을까',
    profileImage: 'https://i.pravatar.cc/400?img=57',
    isVerified: true,
    followers: '1.5M',
    following: 234,
    posts: 89,
  },
  ren: {
    id: 'ren',
    username: 'ren_ito',
    displayName: 'Ren',
    bio: '東京 | 夜\n위험한 게 좋아?',
    profileImage: 'https://i.pravatar.cc/400?img=60',
    isVerified: false,
    followers: '567K',
    following: 7,
    posts: 34,
  },
};

export default function PersonaProfilePage() {
  const params = useParams();
  const router = useRouter();
  const personaId = params.personaId as string;
  const tr = useTranslations();

  const { unlockedPersonas } = useUserPersonaStore();
  const isFollowing = unlockedPersonas.includes(personaId);

  const profile = PERSONA_PROFILES[personaId];

  // 프로필 조회 이벤트
  useEffect(() => {
    if (profile) {
      analytics.trackViewContent({
        contentId: personaId,
        contentName: profile.displayName,
        contentType: 'persona_profile',
      });
    }
  }, [personaId, profile]);

  if (!profile) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <p className="text-white/50">{tr.common.noData}</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-white">
      {/* 헤더 */}
      <div className="sticky top-0 z-40 bg-black/80 backdrop-blur-sm border-b border-white/5">
        <div className="flex items-center justify-between px-4 py-3">
          <button
            onClick={() => {
              // 브라우저 히스토리 back 사용 - 스크롤 위치 자동 복원
              window.history.back();
            }}
            className="p-1 -ml-1"
          >
            <ArrowLeft className="w-6 h-6" />
          </button>
          <div className="text-center">
            <p className="font-semibold text-sm">{profile.username}</p>
          </div>
          <button className="p-1 -mr-1">
            <MoreHorizontal className="w-6 h-6" />
          </button>
        </div>
      </div>

      {/* 프로필 정보 */}
      <div className="px-4 py-4">
        <div className="flex items-start gap-6">
          {/* 프로필 이미지 */}
          <div className="w-20 h-20 rounded-full overflow-hidden border-2 border-white/10">
            <Image
              src={profile.profileImage}
              alt={profile.displayName}
              width={80}
              height={80}
              className="object-cover"
            />
          </div>

          {/* 통계 */}
          <div className="flex-1 flex justify-around pt-2">
            <div className="text-center">
              <p className="font-bold">{profile.posts}</p>
              <p className="text-xs text-white/50">{tr.profile.posts}</p>
            </div>
            <div className="text-center">
              <p className="font-bold">{profile.followers}</p>
              <p className="text-xs text-white/50">{tr.profile.followers}</p>
            </div>
            <div className="text-center">
              <p className="font-bold">{profile.following}</p>
              <p className="text-xs text-white/50">{tr.profile.following}</p>
            </div>
          </div>
        </div>

        {/* 이름 & 바이오 */}
        <div className="mt-4">
          <div className="flex items-center gap-1.5">
            <span className="font-semibold">{profile.displayName}</span>
            {profile.isVerified && (
              <div className="w-4 h-4 bg-blue-500 rounded-full flex items-center justify-center">
                <span className="text-[8px] text-white">✓</span>
              </div>
            )}
          </div>
          <p className="text-sm text-white/70 mt-1 whitespace-pre-line">
            {profile.bio}
          </p>
        </div>

        {/* 버튼 */}
        <div className="flex gap-2 mt-4">
          {isFollowing ? (
            <>
              <button className="flex-1 py-2 bg-white/10 rounded-lg text-sm font-medium">
                {tr.profile.following}
              </button>
              <button
                onClick={() => router.push(`/dm?persona=${personaId}`)}
                className="flex-1 py-2 bg-white/10 rounded-lg text-sm font-medium"
              >
                {tr.nav.messages}
              </button>
            </>
          ) : (
            <button className="flex-1 py-2 bg-white text-black rounded-lg text-sm font-medium">
              {tr.dm.follow}
            </button>
          )}
        </div>
      </div>

      {/* 탭 */}
      <div className="flex border-t border-white/10">
        <button className="flex-1 py-3 flex justify-center border-b border-white">
          <Grid3X3 className="w-5 h-5" />
        </button>
        <button className="flex-1 py-3 flex justify-center text-white/30">
          <Bookmark className="w-5 h-5" />
        </button>
        <button className="flex-1 py-3 flex justify-center text-white/30">
          <Heart className="w-5 h-5" />
        </button>
      </div>

      {/* 게시물 그리드 */}
      <div className="grid grid-cols-3 gap-0.5">
        {personaId === 'jun' ? (
          JUN_POSTS.filter(p => !p.isHidden).map((post) => (
            <motion.div
              key={post.id}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="aspect-square relative"
            >
              <Image
                src={post.images[0]}
                alt=""
                fill
                className="object-cover"
              />
              {post.type === 'carousel' && (
                <div className="absolute top-2 right-2">
                  <svg className="w-4 h-4 text-white drop-shadow" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M4 6h2v12H4V6zm4 0h10c1.1 0 2 .9 2 2v8c0 1.1-.9 2-2 2H8c-1.1 0-2-.9-2-2V8c0-1.1.9-2 2-2z"/>
                  </svg>
                </div>
              )}
            </motion.div>
          ))
        ) : (
          // 다른 페르소나는 placeholder
          Array.from({ length: 9 }).map((_, i) => (
            <div
              key={i}
              className="aspect-square bg-white/5"
            />
          ))
        )}
      </div>
    </div>
  );
}
