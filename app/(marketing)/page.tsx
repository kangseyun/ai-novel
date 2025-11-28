'use client';

import { useState, useEffect } from 'react';
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
  Crown,
} from 'lucide-react';
import Link from 'next/link';
import HackedProfile from '@/components/sns/HackedProfile';
import StoryViewer from '@/components/sns/StoryViewer';
import DMChat from '@/components/sns/DMChat';
import HomeFeed from '@/components/feed/HomeFeed';
import CreatePost from '@/components/feed/CreatePost';
import AnalyticsPage from '@/components/analytics/AnalyticsPage';
import MyProfile from '@/components/profile/MyProfile';
import DMList from '@/components/dm/DMList';
import {
  JUN_PROFILE,
  JUN_STORIES,
  JUN_POSTS,
  JUN_HIDDEN_FILES,
  HACK_LEVELS,
  Story,
  getVisibleStories,
} from '@/lib/hacked-sns-data';
import { useHackerStore } from '@/lib/stores/hacker-store';

type Tab = 'home' | 'dm' | 'create' | 'activity' | 'profile';

export default function MainPage() {
  const router = useRouter();
  const [currentTab, setCurrentTab] = useState<Tab>('profile');
  const [showBootSequence, setShowBootSequence] = useState(false);
  const [bootStep, setBootStep] = useState(0);
  const [connectionStatus, setConnectionStatus] = useState<'connecting' | 'connected' | 'intercepted'>('connecting');
  const [isLoading, setIsLoading] = useState(true);

  // Story viewer state
  const [showStoryViewer, setShowStoryViewer] = useState(false);
  const [storyIndex, setStoryIndex] = useState(0);

  // DM state
  const [showDM, setShowDM] = useState(false);
  const [activeScenarioId, setActiveScenarioId] = useState<string | null>(null);

  // Create post modal
  const [showCreatePost, setShowCreatePost] = useState(false);

  // Zustand store
  const {
    initProfile,
    gainXP,
    viewStory,
    getProfile,
  } = useHackerStore();

  // 로그인/온보딩 체크
  useEffect(() => {
    // TODO: 실제 로그인 상태 체크 로직으로 교체
    const isLoggedIn = localStorage.getItem('user_logged_in');
    const hasCompletedOnboarding = localStorage.getItem('onboarding_completed');

    if (!isLoggedIn && !hasCompletedOnboarding) {
      // 로그인 안됨 + 온보딩 미완료 → 온보딩으로
      router.replace('/onboarding');
      return;
    }

    setIsLoading(false);
  }, [router]);

  // Initialize profile on mount
  useEffect(() => {
    initProfile('jun');
  }, [initProfile]);

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

  // Calculate visible content
  const visibleStories = getVisibleStories(JUN_STORIES, hackLevel);

  const handleStoryClick = (story: Story) => {
    const index = visibleStories.findIndex(s => s.id === story.id);
    setStoryIndex(index >= 0 ? index : 0);
    setShowStoryViewer(true);
    viewStory('jun', story.id);
  };

  const handleStoryReply = (story: Story, message: string) => {
    console.log('Reply to story:', story.id, message);
    gainXP('jun', 10);
  };

  const handleStartScenario = (scenarioId: string) => {
    setActiveScenarioId(scenarioId);
    setShowStoryViewer(false);
    setShowDM(true);
  };

  const handleCloseDM = () => {
    setShowDM(false);
    setActiveScenarioId(null);
  };

  const handleGainXP = (amount: number) => {
    gainXP('jun', amount);
  };

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
            <div className="flex items-center gap-1.5 px-2 py-1 bg-red-500/10 border border-red-500/30 rounded">
              <Eye className="w-3 h-3 text-red-400" />
              <span className="text-[10px] font-mono text-red-400">
                HACK LV.{hackLevel}
              </span>
            </div>
            <Link
              href="/shop"
              className="flex items-center gap-1 px-2 py-1 bg-amber-500/10 border border-amber-500/30 rounded hover:bg-amber-500/20 transition"
            >
              <Crown className="w-3 h-3 text-amber-400" />
              <span className="text-[10px] font-mono text-amber-400">VIP</span>
            </Link>
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

      {/* Main Content */}
      <main className="pb-20">
        {currentTab === 'home' && (
          <HomeFeed
            onOpenProfile={(personaId) => {
              if (personaId === 'jun') {
                setCurrentTab('dm'); // Jun은 DM 탭에서
              }
            }}
            onOpenStory={(personaId, story) => {
              if (personaId === 'jun') {
                handleStoryClick(story);
              }
            }}
          />
        )}

        {currentTab === 'dm' && (
          <DMList onOpenChat={(personaId) => {
            if (personaId === 'jun') {
              handleStartScenario('jun_ep1_first_contact');
            }
          }} />
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

      {/* Story Viewer */}
      <AnimatePresence>
        {showStoryViewer && (
          <StoryViewer
            stories={visibleStories}
            initialIndex={storyIndex}
            profileImage={JUN_PROFILE.profileImage}
            username={JUN_PROFILE.username}
            onClose={() => setShowStoryViewer(false)}
            onReply={handleStoryReply}
            onStartScenario={handleStartScenario}
          />
        )}
      </AnimatePresence>

      {/* DM Chat */}
      <AnimatePresence>
        {showDM && activeScenarioId && (
          <DMChat
            scenarioId={activeScenarioId}
            profile={JUN_PROFILE}
            onClose={handleCloseDM}
            onGainXP={handleGainXP}
          />
        )}
      </AnimatePresence>

      {/* Bottom Navigation */}
      <nav className="sticky bottom-0 z-40 bg-black/90 backdrop-blur-xl border-t border-white/10">
        <div className="flex items-center justify-around py-3">
          {[
            { id: 'home' as Tab, icon: Home },
            { id: 'dm' as Tab, icon: MessageCircle },
            { id: 'create' as Tab, icon: Plus, isCreate: true },
            { id: 'activity' as Tab, icon: Heart },
            { id: 'profile' as Tab, icon: User },
          ].map(({ id, icon: Icon, isCreate }) => (
            <button
              key={id}
              onClick={() => {
                if (isCreate) {
                  setShowCreatePost(true);
                } else {
                  setCurrentTab(id);
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
