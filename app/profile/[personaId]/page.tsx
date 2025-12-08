'use client';

import { useParams, useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import Image from 'next/image';
import { 
  ArrowLeft, 
  MoreHorizontal, 
  Grid3X3, 
  Lock, 
  ShieldAlert, 
  Terminal,
  EyeOff,
  Eye,
  Unlock
} from 'lucide-react';
import { useTranslations } from '@/lib/i18n';
import { useEffect, useState, useRef } from 'react';
import analytics from '@/lib/analytics';
import { supabase } from '@/lib/supabase';
import { useHackerStore } from '@/lib/stores/hacker-store';
import { useTutorial } from '@/components/tutorial/useTutorial';

// DB에서 가져올 데이터 타입 정의
interface PersonaProfile {
  id: string;
  name: string;
  display_name: string | null;
  bio: string | null;
  avatar_url: string | null;
  is_verified: boolean;
  followers_count: string; // "8.9M" 형태의 문자열
  following_count: number;
}

interface PersonaPost {
  id: string;
  post_type: string;
  images: string[] | null;
  caption: string | null;
  likes_count: number;
  comments_count: number;
  required_relationship_stage: string;
  is_premium: boolean;
  hours_ago: number;
  created_at: string;
}

export default function PersonaProfilePage() {
  const params = useParams();
  const router = useRouter();
  const personaId = params.personaId as string;
  const tr = useTranslations();

  // 해킹 스토어 연동
  const { getProfile } = useHackerStore();
  const hackerProfile = getProfile(personaId);
  const hackLevel = hackerProfile?.hackLevel ?? 1;

  // 상태 관리
  const [profile, setProfile] = useState<PersonaProfile | null>(null);
  const [posts, setPosts] = useState<PersonaPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'public' | 'private'>('public');
  const [showHackOverlay, setShowHackOverlay] = useState(false);

  const eventTrackedRef = useRef(false);
  const tutorialTriggered = useRef(false);
  const { startProfileTutorial, isProfileTutorialCompleted } = useTutorial();

  // 데이터 로딩
  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        
        // 1. 프로필 정보 조회
        const { data: profileData, error: profileError } = await supabase
          .from('personas')
          .select('*')
          .or(`id.eq.${personaId},name.eq.${personaId}`)
          .single();

        if (profileError) {
            console.error('Error fetching profile:', profileError);
            return;
        }

        if (profileData) {
          setProfile({
            id: profileData.id,
            name: profileData.name,
            display_name: profileData.display_name,
            bio: profileData.bio,
            avatar_url: profileData.avatar_url,
            is_verified: profileData.is_verified,
            followers_count: profileData.followers_count,
            following_count: profileData.following_count,
          });

          // 2. 포스트 조회
          const { data: postsData, error: postsError } = await supabase
            .from('persona_posts')
            .select('*')
            .eq('persona_id', profileData.id)
            .order('created_at', { ascending: false });

          if (!postsError && postsData) {
            setPosts(postsData);
          }
        }
      } catch (error) {
        console.error('Failed to fetch persona data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [personaId]);

  // 프로필 조회 이벤트 트래킹
  useEffect(() => {
    if (profile && !eventTrackedRef.current) {
      eventTrackedRef.current = true;
      analytics.trackViewContent({
        contentId: personaId,
        contentName: profile.display_name || profile.name,
        contentType: 'persona_profile',
      });
    }
  }, [personaId, profile]);

  // 프로필 튜토리얼 트리거
  useEffect(() => {
    if (!loading && profile && !tutorialTriggered.current && !isProfileTutorialCompleted()) {
      tutorialTriggered.current = true;
      const timer = setTimeout(() => {
        startProfileTutorial();
      }, 800);
      return () => clearTimeout(timer);
    }
  }, [loading, profile, startProfileTutorial, isProfileTutorialCompleted]);

  // Private 탭 접근 핸들러
  const handlePrivateTabClick = () => {
    // 해킹 레벨 1부터 접근 가능하지만, 내용은 레벨에 따라 다르게 보임
    // 여기서는 탭 접근 자체는 허용하고 내용을 잠금
    if (hackLevel < 1) {
       alert("접근 권한이 없습니다.");
       return;
    }
    
    setShowHackOverlay(true);
    setTimeout(() => {
      setActiveTab('private');
      setShowHackOverlay(false);
    }, 800);
  };

  // 필터링된 포스트
  const publicPosts = posts.filter(p => p.required_relationship_stage === 'stranger' && !p.is_premium);
  const privatePosts = posts.filter(p => p.required_relationship_stage !== 'stranger' || p.is_premium);

  if (loading) {
    return <div className="min-h-screen bg-black flex items-center justify-center">
      <Terminal className="w-8 h-8 text-green-500 animate-pulse" />
    </div>;
  }

  if (!profile) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center text-white/50">
        Profile not found.
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#111] flex justify-center">
      <div className="w-full max-w-[480px] min-h-screen bg-black text-white shadow-2xl relative overflow-x-hidden">
        {/* 해킹 오버레이 효과 */}
        <AnimatePresence>
          {showHackOverlay && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 z-50 bg-black/90 flex flex-col items-center justify-center font-mono text-green-500"
            >
              <div className="space-y-2">
                <p className="typing-effect">&gt; Decrypting private files...</p>
                <p className="typing-effect delay-100">&gt; Bypassing firewall...</p>
                <p className="text-red-500 font-bold delay-300">&gt; ACCESS GRANTED</p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* 헤더 */}
        <div className={`sticky top-0 z-40 backdrop-blur-md border-b transition-colors duration-500 ${
          activeTab === 'private' 
            ? 'bg-red-950/30 border-red-500/20' 
            : 'bg-black/80 border-white/5'
        }`}>
          <div className="flex items-center justify-between px-4 py-3">
            <button
              onClick={() => window.history.back()}
              className="p-1 -ml-1 hover:bg-white/10 rounded-full transition"
            >
              <ArrowLeft className="w-6 h-6" />
            </button>
            <div className="text-center flex items-center gap-2">
              <span className={`font-semibold text-sm ${activeTab === 'private' ? 'text-red-400' : 'text-white'}`}>
                {profile.name}
              </span>
              {activeTab === 'private' && (
                <ShieldAlert className="w-3 h-3 text-red-500 animate-pulse" />
              )}
            </div>
            <button className="p-1 -mr-1 hover:bg-white/10 rounded-full transition">
              <MoreHorizontal className="w-6 h-6" />
            </button>
          </div>
        </div>

        {/* 프로필 정보 */}
        <div className="px-4 py-6">
          <div className="flex items-start gap-6">
            {/* 프로필 이미지 */}
            <div className="relative">
              <div className={`w-20 h-20 rounded-full p-[2px] ${
                activeTab === 'private'
                  ? 'bg-gradient-to-tr from-red-600 to-red-900 animate-pulse'
                  : 'bg-gradient-to-tr from-purple-500 to-pink-500'
              }`}>
                <div className="w-full h-full rounded-full overflow-hidden border-2 border-black relative">
                  <Image
                    src={profile.avatar_url || 'https://via.placeholder.com/150'}
                    alt={profile.display_name || ''}
                    fill
                    className={`object-cover ${activeTab === 'private' ? 'brightness-75 sepia' : ''}`}
                  />
                </div>
              </div>
              {activeTab === 'private' && (
                <div className="absolute -bottom-1 -right-1 bg-red-600 text-black text-[10px] font-bold px-1.5 py-0.5 rounded border border-black">
                  HACKED
                </div>
              )}
            </div>

            {/* 통계 */}
            <div className="flex-1 flex justify-around pt-2" data-tutorial="profile-stats">
              <div className="text-center">
                <p className={`font-bold ${activeTab === 'private' ? 'text-red-400' : ''}`}>
                  {activeTab === 'private' ? privatePosts.length : publicPosts.length}
                </p>
                <p className="text-xs text-white/50">{tr.profile.posts}</p>
              </div>
              <div className="text-center">
                <p className="font-bold">{profile.followers_count}</p>
                <p className="text-xs text-white/50">{tr.profile.followers}</p>
              </div>
              <div className="text-center">
                <p className="font-bold">{profile.following_count}</p>
                <p className="text-xs text-white/50">{tr.profile.following}</p>
              </div>
            </div>
          </div>

          {/* 이름 & 바이오 */}
          <div className="mt-4">
            <div className="flex items-center gap-1.5">
              <span className="font-semibold text-lg">{profile.display_name}</span>
              {profile.is_verified && (
                <div className="w-4 h-4 bg-blue-500 rounded-full flex items-center justify-center">
                  <span className="text-[8px] text-white">✓</span>
                </div>
              )}
            </div>
            <p className={`text-sm mt-1 whitespace-pre-line leading-relaxed ${
              activeTab === 'private' ? 'text-red-200/70 font-mono text-xs' : 'text-white/70'
            }`}>
              {activeTab === 'private' 
                ? "> SYSTEM: Encrypted user bio accessed.\n> Showing hidden metadata..." 
                : profile.bio}
            </p>
          </div>

          {/* 액션 버튼 */}
          <div className="flex gap-2 mt-6">
            <button
              onClick={() => router.push(`/dm/${personaId}`)}
              className={`flex-1 py-2.5 rounded-lg text-sm font-semibold transition-all ${
                activeTab === 'private'
                  ? 'bg-red-900/20 border border-red-500/50 text-red-400 hover:bg-red-900/40'
                  : 'bg-white text-black hover:bg-white/90'
              }`}
              data-tutorial="message-button"
            >
              {activeTab === 'private' ? 'INTERCEPT MESSAGE' : tr.nav.messages}
            </button>
            <button className={`px-3 py-2.5 rounded-lg border transition-all ${
               activeTab === 'private'
                 ? 'border-red-500/30 bg-black text-red-400'
                 : 'border-white/20 bg-white/5 text-white'
            }`}>
              <MoreHorizontal className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* 탭 네비게이션 */}
        <div className="mt-2 border-t border-white/10">
          <div className="flex">
            <button
              onClick={() => setActiveTab('public')}
              className={`flex-1 py-3 flex items-center justify-center gap-2 border-b-2 transition-colors ${
                activeTab === 'public'
                  ? 'border-white text-white'
                  : 'border-transparent text-white/30 hover:text-white/50'
              }`}
            >
              <Grid3X3 className="w-5 h-5" />
              <span className="text-xs font-medium">OFFICIAL</span>
            </button>
            <button
              onClick={handlePrivateTabClick}
              className={`flex-1 py-3 flex items-center justify-center gap-2 border-b-2 transition-colors ${
                activeTab === 'private'
                  ? 'border-red-500 text-red-500'
                  : 'border-transparent text-white/30 hover:text-red-400/50'
              }`}
              data-tutorial="private-tab"
            >
              {hackLevel >= 2 ? <Unlock className="w-4 h-4" /> : <Lock className="w-4 h-4" />}
              <span className="text-xs font-medium font-mono">PRIVATE_FILES</span>
            </button>
          </div>
        </div>

        {/* 게시물 그리드 */}
        <div className="min-h-[300px] bg-black">
          {activeTab === 'public' ? (
            <div className="grid grid-cols-3 gap-0.5">
              {publicPosts.map((post) => (
                <motion.div
                  key={post.id}
                  layoutId={post.id}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="aspect-square relative group cursor-pointer"
                >
                  {post.images && post.images[0] && (
                    <Image
                      src={post.images[0]}
                      alt=""
                      fill
                      className="object-cover"
                    />
                  )}
                  {/* 호버 시 좋아요 수 표시 */}
                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-1 text-white font-semibold">
                     <span className="text-xs">♥ {post.likes_count > 1000 ? `${(post.likes_count/1000).toFixed(1)}K` : post.likes_count}</span>
                  </div>
                </motion.div>
              ))}
              {publicPosts.length === 0 && (
                <div className="col-span-3 py-10 text-center text-white/30 text-sm">
                  No official posts yet.
                </div>
              )}
            </div>
          ) : (
            /* Private Tab Content */
            <div className="p-1 space-y-1">
              <div className="px-3 py-2 bg-red-950/20 border border-red-500/20 rounded mb-2 flex items-center gap-2">
                <Terminal className="w-4 h-4 text-red-400" />
                <span className="text-xs text-red-400 font-mono">
                   ACCESS LEVEL: {hackLevel} / 5
                </span>
              </div>

              <div className="grid grid-cols-3 gap-0.5">
                {privatePosts.map((post) => {
                  // 해킹 레벨에 따른 접근 권한 체크
                  let requiredLevel = 1;
                  if (post.required_relationship_stage === 'close') requiredLevel = 3;
                  if (post.required_relationship_stage === 'lover') requiredLevel = 5;
                  if (post.is_premium) requiredLevel = 2;

                  const isLocked = hackLevel < requiredLevel;

                  return (
                    <motion.div
                      key={post.id}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="aspect-square relative group overflow-hidden bg-white/5"
                    >
                      {post.images && post.images[0] && (
                        <Image
                          src={post.images[0]}
                          alt=""
                          fill
                          className={`object-cover transition-all duration-500 ${
                            isLocked ? 'blur-md brightness-50 grayscale' : 'brightness-75'
                          }`}
                        />
                      )}
                      
                      {/* 잠금 오버레이 */}
                      {isLocked ? (
                        <div className="absolute inset-0 flex flex-col items-center justify-center z-10">
                          <Lock className="w-6 h-6 text-red-500 mb-1" />
                          <span className="text-[10px] font-mono text-red-400 bg-black/50 px-1 rounded">
                            LV.{requiredLevel} REQUIRED
                          </span>
                        </div>
                      ) : (
                        <div className="absolute top-1 right-1 z-10">
                          <div className="bg-red-600 text-white text-[8px] px-1 rounded font-bold">
                             HIDDEN
                          </div>
                        </div>
                      )}
                    </motion.div>
                  );
                })}
              </div>
               {privatePosts.length === 0 && (
                <div className="py-10 text-center text-red-400/50 text-sm font-mono">
                  &gt; No hidden files found.
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
