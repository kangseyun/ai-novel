'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Terminal,
  Wifi,
  Shield,
  ShieldAlert,
  Eye,
  MessageCircle,
  Home,
  Heart,
  User,
  Plus,
  Flame,
} from 'lucide-react';
import Link from 'next/link';
import HomeFeed from '@/components/feed/HomeFeed';
import CreatePost from '@/components/feed/CreatePost';
import AnalyticsPage from '@/components/analytics/AnalyticsPage';
import MyProfile from '@/components/profile/MyProfile';
import DMList from '@/components/dm/DMList';
import { useHackerStore } from '@/lib/stores/hacker-store';
import { supabase } from '@/lib/supabase';
import { useTutorial } from '@/components/tutorial';

// 해킹 레벨 정의 (XP bar에 사용)
const HACK_LEVELS = [
  { level: 1, xpRequired: 0 },
  { level: 2, xpRequired: 100 },
  { level: 3, xpRequired: 300 },
  { level: 4, xpRequired: 600 },
  { level: 5, xpRequired: 1000 },
];

type Tab = 'home' | 'dm' | 'create' | 'activity' | 'profile';

export default function MainPage() {
  const router = useRouter();

  // sessionStorage에서 저장된 탭 복원 (뒤로가기 시)
  const [currentTab, setCurrentTab] = useState<Tab>(() => {
    if (typeof window !== 'undefined') {
      const savedTab = sessionStorage.getItem('mainPageTab') as Tab | null;
      if (savedTab) {
        return savedTab;
      }
    }
    return 'profile';
  });

  const feedScrollRef = useRef<number>(0); // 피드 스크롤 위치 저장
  const prevTabRef = useRef<Tab>(currentTab); // 이전 탭 저장

  // 페이지 로드 시 스크롤 위치 복원 (뒤로가기 시)
  useEffect(() => {
    const savedScroll = Number(sessionStorage.getItem('feedScrollY')) || 0;
    feedScrollRef.current = savedScroll;

    if (currentTab === 'home' && savedScroll > 0) {
      setTimeout(() => {
        window.scrollTo(0, savedScroll);
      }, 100);
    }
  }, []);
  const [showBootSequence, setShowBootSequence] = useState(false);
  const [bootStep, setBootStep] = useState(0);
  const [connectionStatus, setConnectionStatus] = useState<'connecting' | 'connected' | 'intercepted'>('connecting');
  const [isLoading, setIsLoading] = useState(true);

  // Create post modal
  const [showCreatePost, setShowCreatePost] = useState(false);

  // User tokens & streak
  const [userTokens, setUserTokens] = useState<number | null>(null);
  const [streakCount, setStreakCount] = useState<number>(0);
  const [showStreakBonus, setShowStreakBonus] = useState<{ amount: number } | null>(null);

  // Zustand store
  const {
    initProfile,
    gainXP,
    getProfile,
  } = useHackerStore();

  // Tutorial hook
  const { startInitialTutorial, isInitialTutorialCompleted } = useTutorial();
  const tutorialStartedRef = useRef(false);

  // 로그인 체크 - Supabase 세션 확인
  useEffect(() => {
    const checkAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession();

      if (!session) {
        // 로그인 안됨 → 온보딩으로 (온보딩에서 로그인으로 유도)
        router.replace('/onboarding');
        return;
      }

      // 사용자 토큰 정보 가져오기
      const { data: userData } = await supabase
        .from('users')
        .select('tokens, streak_count')
        .eq('id', session.user.id)
        .single();

      if (userData) {
        setUserTokens(userData.tokens);
        setStreakCount(userData.streak_count || 0);
      }

      // 출석 체크 실행 (하루에 한 번)
      const { data: streakResult } = await supabase.rpc('check_daily_streak', {
        p_user_id: session.user.id
      });

      if (streakResult && streakResult.updated) {
        setStreakCount(streakResult.streak);
        if (streakResult.bonus > 0) {
          setShowStreakBonus({ amount: streakResult.bonus });
          // 보너스 받았으니 토큰도 업데이트
          setUserTokens((prev) => (prev || 0) + streakResult.bonus);
        }
      }

      setIsLoading(false);
    };

    checkAuth();
  }, [router]);

  // Initialize profile on mount
  useEffect(() => {
    initProfile('jun');
  }, [initProfile]);

  // 로딩 완료 후 튜토리얼 시작 (처음 접속한 사용자만)
  useEffect(() => {
    if (!isLoading && !tutorialStartedRef.current && !isInitialTutorialCompleted()) {
      tutorialStartedRef.current = true;
      // 잠시 대기 후 튜토리얼 시작 (UI가 완전히 렌더링된 후)
      const timer = setTimeout(() => {
        startInitialTutorial();
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [isLoading, startInitialTutorial, isInitialTutorialCompleted]);

  // Get profile data
  const profile = getProfile('jun');
  const hackLevel = profile?.hackLevel ?? 1;
  const hackXP = profile?.hackXP ?? 0;

  // Boot sequence messages
  const bootMessages = [
    '> Initializing PHANTOM.exe...',
    '> Bypassing firewall... [OK]',
    '> Injecting packet sniffer... [OK]',
    '> Intercepting SSL handshake... [OK]',
    '> Target acquired: @eclipse_jun',
    '> Establishing covert connection...',
    '> ACCESS GRANTED',
  ];

  // Boot sequence effect
  useEffect(() => {
    if (showBootSequence && bootStep < bootMessages.length) {
      const timer = setTimeout(() => {
        setBootStep(bootStep + 1);
        if (bootStep === 4) {
          setConnectionStatus('connected');
        }
        if (bootStep === 5) {
          setConnectionStatus('intercepted');
        }
      }, 600);
      return () => clearTimeout(timer);
    } else if (bootStep >= bootMessages.length) {
      const timer = setTimeout(() => {
        setShowBootSequence(false);
      }, 800);
      return () => clearTimeout(timer);
    }
  }, [bootStep, showBootSequence, bootMessages.length]);

  // 로딩 중
  if (isLoading) {
    return <div className="min-h-screen bg-black" />;
  }

  // Boot sequence overlay
  if (showBootSequence) {
    return (
      <div className="min-h-screen bg-black text-green-400 font-mono p-6 flex flex-col justify-center">
        <div className="max-w-lg mx-auto w-full space-y-2">
          <div className="flex items-center gap-2 mb-6">
            <Terminal className="w-6 h-6" />
            <span className="text-lg">PHANTOM v3.7.2</span>
          </div>

          {bootMessages.slice(0, bootStep).map((msg, idx) => (
            <motion.div
              key={idx}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              className={`text-sm ${
                msg.includes('[OK]') ? 'text-green-400' :
                msg.includes('ACCESS GRANTED') ? 'text-red-400 text-lg font-bold' :
                'text-green-400/70'
              }`}
            >
              {msg}
            </motion.div>
          ))}

          {bootStep < bootMessages.length && (
            <div className="flex items-center gap-2 text-green-400/50">
              <span className="animate-pulse">█</span>
            </div>
          )}

          {bootStep >= bootMessages.length && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="mt-8 text-center"
            >
              <div className="text-red-400 text-2xl font-bold mb-2">
                [SYSTEM COMPROMISED]
              </div>
              <div className="text-green-400/50 text-xs">
                Entering stealth mode...
              </div>
            </motion.div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-white">
      {/* Status Bar */}
      <div className="sticky top-0 z-50 bg-black/90 backdrop-blur-xl border-b border-red-500/20">
        <div className="flex items-center justify-between px-4 py-2">
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1.5">
              {connectionStatus === 'intercepted' ? (
                <ShieldAlert className="w-4 h-4 text-red-400" />
              ) : (
                <Shield className="w-4 h-4 text-green-400" />
              )}
              <span className="text-[10px] font-mono text-red-400">
                {connectionStatus === 'intercepted' ? 'INTERCEPTED' : 'SECURE'}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Link
              href="/shop"
              className="flex items-center gap-1.5 px-2 py-1 bg-yellow-500/10 border border-yellow-500/30 rounded hover:bg-yellow-500/20 transition"
            >
              <span className="text-yellow-400 text-xs">◆</span>
              <span className="text-[10px] font-mono text-yellow-400">
                {userTokens !== null ? userTokens.toLocaleString() : '---'}
              </span>
            </Link>
            {streakCount > 0 && (
              <div className="flex items-center gap-1 px-2 py-1 bg-orange-500/10 border border-orange-500/30 rounded animate-pulse">
                <Flame className="w-3 h-3 text-orange-500 fill-orange-500" />
                <span className="text-[10px] font-bold text-orange-400">
                  {streakCount}
                </span>
              </div>
            )}
            <Link
              href="/shop"
              className="flex items-center gap-1 px-2 py-1 bg-amber-500/10 border border-amber-500/30 rounded hover:bg-amber-500/20 transition"
            >
              <span className="text-[10px] font-bold text-amber-400">VIP</span>
            </Link>
            <div className="flex items-center gap-1.5 px-2 py-1 bg-red-500/10 border border-red-500/30 rounded">
              <Eye className="w-3 h-3 text-red-400" />
              <span className="text-[10px] font-mono text-red-400">
                HACK LV.{hackLevel}
              </span>
            </div>
            <div className="flex items-center gap-1">
              <Wifi className="w-4 h-4 text-green-400" />
            </div>
          </div>
        </div>

        {/* XP Bar */}
        <div className="h-0.5 bg-black">
          <motion.div
            className="h-full bg-gradient-to-r from-red-500 to-purple-500"
            initial={{ width: 0 }}
            animate={{
              width: `${(hackXP / (HACK_LEVELS.find(l => l.level === hackLevel + 1)?.xpRequired || HACK_LEVELS[hackLevel - 1]?.xpRequired || 100)) * 100}%`
            }}
            transition={{ duration: 0.5 }}
          />
        </div>
      </div>

      {/* Streak Bonus Modal */}
      <AnimatePresence>
        {showStreakBonus && (
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-black/80 backdrop-blur-sm"
            onClick={() => setShowStreakBonus(null)}
          >
            <div 
              className="bg-[#1A1F2E] border border-orange-500/30 rounded-2xl p-8 text-center max-w-xs w-full shadow-[0_0_50px_rgba(249,115,22,0.2)]"
              onClick={e => e.stopPropagation()}
            >
              <div className="w-20 h-20 bg-orange-500/20 rounded-full flex items-center justify-center mx-auto mb-6 animate-bounce">
                <Flame className="w-10 h-10 text-orange-500 fill-orange-500" />
              </div>
              <h2 className="text-2xl font-bold text-white mb-2">
                {streakCount}일 연속 출석! 🔥
              </h2>
              <p className="text-white/60 mb-6">
                꾸준함에 대한 보상으로<br/>
                <span className="text-yellow-400 font-bold">+{showStreakBonus.amount} 크레딧</span>을 드려요!
              </p>
              <button
                onClick={() => setShowStreakBonus(null)}
                className="w-full py-3 bg-gradient-to-r from-orange-500 to-red-500 text-white font-bold rounded-xl hover:from-orange-600 hover:to-red-600 transition shadow-lg shadow-orange-500/20"
              >
                받기
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main Content */}
      <main className="pb-20" data-tutorial="home-feed">
        {currentTab === 'home' && (
          <HomeFeed />
        )}

        {currentTab === 'dm' && (
          <DMList />
        )}

        {currentTab === 'activity' && (
          <AnalyticsPage />
        )}

        {currentTab === 'profile' && (
          <MyProfile />
        )}
      </main>

      {/* Create Post Modal */}
      <AnimatePresence>
        {showCreatePost && (
          <CreatePost onClose={() => setShowCreatePost(false)} />
        )}
      </AnimatePresence>

      {/* Bottom Navigation */}
      <nav className="sticky bottom-0 z-40 bg-black/90 backdrop-blur-xl border-t border-white/10">
        <div className="flex items-center justify-around py-3">
          {[
            { id: 'home' as Tab, icon: Home, tutorialId: 'home-button' },
            { id: 'dm' as Tab, icon: MessageCircle, tutorialId: 'dm-button' },
            { id: 'create' as Tab, icon: Plus, isCreate: true, tutorialId: 'create-button' },
            { id: 'activity' as Tab, icon: Heart, tutorialId: 'activity-button' },
            { id: 'profile' as Tab, icon: User, tutorialId: 'profile-button' },
          ].map(({ id, icon: Icon, isCreate, tutorialId }) => (
            <button
              key={id}
              data-tutorial={tutorialId}
              onClick={() => {
                if (isCreate) {
                  setShowCreatePost(true);
                } else {
                  // 피드에서 다른 탭으로 이동 시 스크롤 위치 저장
                  if (prevTabRef.current === 'home') {
                    feedScrollRef.current = window.scrollY;
                    sessionStorage.setItem('feedScrollY', String(window.scrollY));
                  }

                  // 탭 전환 및 저장
                  setCurrentTab(id);
                  prevTabRef.current = id;
                  sessionStorage.setItem('mainPageTab', id);

                  // 피드로 돌아갈 때는 저장된 위치로, 다른 탭은 상단으로
                  if (id === 'home') {
                    setTimeout(() => {
                      window.scrollTo(0, feedScrollRef.current);
                    }, 0);
                  } else {
                    window.scrollTo(0, 0);
                  }
                }
              }}
              className={`relative p-2 ${
                isCreate
                  ? 'bg-gradient-to-r from-purple-500 to-pink-500 rounded-lg'
                  : currentTab === id ? 'text-white' : 'text-white/50'
              }`}
            >
              <Icon className="w-6 h-6" />
            </button>
          ))}
        </div>
      </nav>
    </div>
  );
}
