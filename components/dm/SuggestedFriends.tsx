'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { Check, Loader2, RefreshCw, Coins, Clock } from 'lucide-react';
import { useUserPersonaStore } from '@/lib/stores/user-persona-store';
import { useAuthStore } from '@/lib/stores/auth-store';
import { apiClient } from '@/lib/api-client';
import { useTranslations, t } from '@/lib/i18n';
import { toast } from 'sonner';

// ============================================
// 타입 정의
// ============================================

interface Persona {
  id: string;
  name: string;
  display_name: string;
  username: string;
  bio: string;
  avatar_url: string;
  is_verified: boolean;
  is_premium: boolean;
  category: string;
}

interface SuggestedFriendsProps {
  onUnlock?: (personaId: string) => void;
  onStartChat?: (personaId: string) => void;
}

// 팔로우 비용 계산
const FOLLOW_COST = 10;
const PREMIUM_FOLLOW_COSTS: Record<string, number> = {
  daniel: 100,
  kael: 100,
  adrian: 150,
  ren: 200,
};
const REFRESH_COST = 5;

const getFollowCost = (personaId: string, isPremium: boolean): number => {
  if (isPremium && PREMIUM_FOLLOW_COSTS[personaId]) {
    return PREMIUM_FOLLOW_COSTS[personaId];
  }
  return FOLLOW_COST;
};

// 시간 포맷팅 (MM:SS)
const formatTime = (seconds: number): string => {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
};

// ============================================
// 메인 컴포넌트
// ============================================

export default function SuggestedFriends({
  onUnlock,
}: SuggestedFriendsProps) {
  const router = useRouter();
  const [personas, setPersonas] = useState<Persona[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [selectedPersona, setSelectedPersona] = useState<Persona | null>(null);
  const [isFollowing, setIsFollowing] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [userTokens, setUserTokens] = useState(0);

  // 무료 새로고침 관련 상태
  const [canFreeRefresh, setCanFreeRefresh] = useState(true);
  const [secondsUntilFreeRefresh, setSecondsUntilFreeRefresh] = useState(0);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const tr = useTranslations();

  const { unlockPersona } = useUserPersonaStore();
  const { user, updateUser } = useAuthStore();

  // 타이머 시작
  const startTimer = useCallback((seconds: number) => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
    }

    setSecondsUntilFreeRefresh(seconds);
    setCanFreeRefresh(false);

    timerRef.current = setInterval(() => {
      setSecondsUntilFreeRefresh(prev => {
        if (prev <= 1) {
          if (timerRef.current) {
            clearInterval(timerRef.current);
            timerRef.current = null;
          }
          setCanFreeRefresh(true);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  }, []);

  // 컴포넌트 언마운트 시 타이머 정리
  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, []);

  // 추천 페르소나 목록 로드
  useEffect(() => {
    loadSuggestedPersonas();
  }, []);

  // 유저 토큰 동기화
  useEffect(() => {
    if (user?.tokens !== undefined) {
      setUserTokens(user.tokens);
    }
  }, [user?.tokens]);

  const loadSuggestedPersonas = async () => {
    try {
      setIsLoading(true);
      const data = await apiClient.getSuggestedPersonas();
      setPersonas(data.personas);
      setUserTokens(data.userTokens);

      // 무료 새로고침 상태 설정
      setCanFreeRefresh(data.canFreeRefresh);
      if (!data.canFreeRefresh && data.secondsUntilFreeRefresh > 0) {
        startTimer(data.secondsUntilFreeRefresh);
      }
    } catch (error) {
      console.error('[SuggestedFriends] Failed to load:', error);
      // 폴백: 기존 API 사용
      try {
        const response = await fetch('/api/personas');
        if (response.ok) {
          const fallbackData = await response.json();
          if (fallbackData.personas) {
            const filtered = fallbackData.personas.filter((p: { id: string }) => p.id !== 'jun');
            setPersonas(filtered.slice(0, 5));
          }
        }
      } catch {
        console.error('[SuggestedFriends] Fallback also failed');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const goToShop = () => {
    router.push('/shop?tab=credits');
  };

  // 무료 새로고침
  const handleFreeRefresh = async () => {
    if (!canFreeRefresh || isRefreshing) return;

    try {
      setIsRefreshing(true);
      const data = await apiClient.refreshSuggestedPersonas(true); // useFreeRefresh = true

      if (data.success) {
        setPersonas(data.personas);
        setUserTokens(data.remainingTokens);
        updateUser({ tokens: data.remainingTokens });

        // 타이머 시작
        startTimer(data.secondsUntilFreeRefresh);

        toast.success(tr.dm.refreshSuccess);
      }
    } catch (error) {
      console.error('[SuggestedFriends] Free refresh failed:', error);
      toast.error('새로고침에 실패했어요');
    } finally {
      setIsRefreshing(false);
    }
  };

  // 유료 새로고침
  const handlePaidRefresh = async () => {
    if (userTokens < REFRESH_COST) {
      toast.error(t(tr.dm.insufficientTokensForRefresh, { n: REFRESH_COST }), {
        action: {
          label: tr.dm.recharge,
          onClick: goToShop,
        },
      });
      return;
    }

    try {
      setIsRefreshing(true);
      const data = await apiClient.refreshSuggestedPersonas(false); // useFreeRefresh = false

      if (data.success) {
        setPersonas(data.personas);
        setUserTokens(data.remainingTokens);
        updateUser({ tokens: data.remainingTokens });
        toast.success(tr.dm.refreshSuccess);
      }
    } catch (error) {
      console.error('[SuggestedFriends] Paid refresh failed:', error);
      toast.error('새로고침에 실패했어요');
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleProfileClick = (personaId: string) => {
    router.push(`/profile/${personaId}`);
  };

  const handleFollowClick = (persona: Persona) => {
    const cost = getFollowCost(persona.id, persona.is_premium);
    if (userTokens < cost) {
      // 토큰 부족 시 충전 페이지로 이동
      toast.error(t(tr.dm.insufficientTokensForFollow, { n: cost }), {
        action: {
          label: tr.dm.recharge,
          onClick: goToShop,
        },
      });
      return;
    }
    setSelectedPersona(persona);
  };

  const handleConfirmFollow = async () => {
    if (!selectedPersona) return;

    const cost = getFollowCost(selectedPersona.id, selectedPersona.is_premium);

    setIsFollowing(true);

    try {
      const data = await apiClient.followPersona(selectedPersona.id);

      if (data.success) {
        // 로컬 상태 업데이트
        unlockPersona(selectedPersona.id);
        setUserTokens(data.remainingTokens);
        updateUser({ tokens: data.remainingTokens });

        // 목록에서 해당 페르소나 제거
        setPersonas(prev => prev.filter(p => p.id !== selectedPersona.id));

        // 성공 처리
        setShowSuccess(true);
        toast.success(t(tr.dm.followSuccess, { name: selectedPersona.display_name }));

        setTimeout(() => {
          setShowSuccess(false);
          setSelectedPersona(null);
          onUnlock?.(selectedPersona.id);
        }, 1000);
      }

    } catch (error) {
      console.error('Follow failed:', error);
      toast.error('팔로우에 실패했어요');
    } finally {
      setIsFollowing(false);
    }
  };

  if (isLoading) {
    return (
      <div className="px-4 pt-[300px] pb-4">
        <h2 className="text-sm font-medium text-white/50 mb-3">{tr.dm.suggestedFriends}</h2>
        <div className="flex items-center justify-center py-8">
          <Loader2 className="w-6 h-6 text-white/30 animate-spin" />
        </div>
      </div>
    );
  }

  // 새로고침 버튼 렌더링
  const renderRefreshButtons = () => (
    <div className="flex items-center gap-2">
      {/* 무료 새로고침 버튼 */}
      {canFreeRefresh ? (
        <button
          onClick={handleFreeRefresh}
          disabled={isRefreshing}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-green-500/20 rounded-lg text-xs text-green-400 hover:bg-green-500/30 transition disabled:opacity-50"
          data-tutorial="refresh-button"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
          <span>무료</span>
        </button>
      ) : (
        <div className="flex items-center gap-1.5 px-3 py-1.5 bg-white/5 rounded-lg text-xs text-white/40">
          <Clock className="w-3.5 h-3.5" />
          <span>{formatTime(secondsUntilFreeRefresh)}</span>
        </div>
      )}

      {/* 유료 새로고침 버튼 */}
      <button
        onClick={handlePaidRefresh}
        disabled={isRefreshing}
        className="flex items-center gap-1.5 px-3 py-1.5 bg-white/5 rounded-lg text-xs text-white/60 hover:bg-white/10 transition disabled:opacity-50"
      >
        <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
        <span>{REFRESH_COST}</span>
        <Coins className="w-3 h-3 text-yellow-400" />
      </button>
    </div>
  );

  if (personas.length === 0) {
    return (
      <div className="px-4 pt-[300px] pb-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-medium text-white/50">{tr.dm.suggestedFriends}</h2>
          {renderRefreshButtons()}
        </div>
        <div className="text-center py-8 text-white/40 text-sm">
          {tr.dm.noMoreSuggestions}
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="px-4 pt-[300px] pb-4">
        {/* 헤더: 제목 + 토큰 정보 + 새로고침 */}
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-medium text-white/50">{tr.dm.suggestedFriends}</h2>
          <div className="flex items-center gap-3">
            {/* 보유 토큰 */}
            <div className="flex items-center gap-1.5 text-xs text-white/50">
              <Coins className="w-3.5 h-3.5 text-yellow-400" />
              <span>{userTokens.toLocaleString()}</span>
            </div>
            {/* 새로고침 버튼들 */}
            {renderRefreshButtons()}
          </div>
        </div>

        {/* 추천 친구 목록 */}
        <div className="space-y-2" data-tutorial="suggested-friends-list">
          {personas.map((persona, idx) => {
            const cost = getFollowCost(persona.id, persona.is_premium);

            return (
              <motion.div
                key={persona.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.05 }}
                className="flex items-center gap-3 p-3 bg-white/5 rounded-xl"
              >
                {/* 프로필 이미지 */}
                <div
                  className="relative w-11 h-11 rounded-full overflow-hidden border border-white/10 cursor-pointer"
                  onClick={() => handleProfileClick(persona.id)}
                >
                  <Image
                    src={persona.avatar_url}
                    alt={persona.display_name}
                    width={44}
                    height={44}
                    className="object-cover"
                  />
                  {persona.is_premium && (
                    <div className="absolute -top-1 -right-1 w-4 h-4 bg-gradient-to-r from-yellow-400 to-orange-500 rounded-full flex items-center justify-center">
                      <span className="text-[8px]">👑</span>
                    </div>
                  )}
                </div>

                {/* 정보 */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <p
                      className="font-medium text-white text-sm cursor-pointer hover:underline truncate"
                      onClick={() => handleProfileClick(persona.id)}
                    >
                      {persona.display_name}
                    </p>
                    {persona.is_verified && (
                      <div className="w-4 h-4 bg-blue-500 rounded-full flex items-center justify-center flex-shrink-0">
                        <span className="text-[8px] text-white">✓</span>
                      </div>
                    )}
                  </div>
                  <p className="text-xs text-white/40 truncate">{persona.bio}</p>
                </div>

                {/* 팔로우 버튼 + 비용 */}
                <button
                  onClick={() => handleFollowClick(persona)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm transition flex-shrink-0 bg-white/10 text-white/80 hover:bg-white/15"
                  {...(idx === 0 ? { 'data-tutorial': 'follow-button' } : {})}
                >
                  <span>{tr.dm.follow}</span>
                  <span className="text-xs opacity-70">{cost}</span>
                  <Coins className="w-3 h-3 text-yellow-400" />
                </button>
              </motion.div>
            );
          })}
        </div>
      </div>

      {/* 팔로우 확인 팝업 */}
      <AnimatePresence>
        {selectedPersona && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-6"
            onClick={() => !isFollowing && setSelectedPersona(null)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              onClick={e => e.stopPropagation()}
              className="w-full max-w-[300px] bg-zinc-900 rounded-2xl overflow-hidden"
            >
              {showSuccess ? (
                <div className="p-6 text-center">
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    className="w-12 h-12 mx-auto mb-3 bg-white/10 rounded-full flex items-center justify-center"
                  >
                    <Check className="w-6 h-6 text-white" />
                  </motion.div>
                  <p className="text-white text-sm">{tr.dm.followComplete}</p>
                </div>
              ) : (
                <div className="p-5">
                  {/* 프로필 */}
                  <div className="flex flex-col items-center text-center mb-5">
                    <div className="relative w-16 h-16 rounded-full overflow-hidden border border-white/10 mb-3">
                      <Image
                        src={selectedPersona.avatar_url}
                        alt={selectedPersona.display_name}
                        width={64}
                        height={64}
                        className="object-cover"
                      />
                      {selectedPersona.is_premium && (
                        <div className="absolute -top-1 -right-1 w-5 h-5 bg-gradient-to-r from-yellow-400 to-orange-500 rounded-full flex items-center justify-center">
                          <span className="text-[10px]">👑</span>
                        </div>
                      )}
                    </div>
                    <div className="flex items-center gap-1.5">
                      <p className="font-medium text-white">{selectedPersona.display_name}</p>
                      {selectedPersona.is_verified && (
                        <div className="w-4 h-4 bg-blue-500 rounded-full flex items-center justify-center">
                          <span className="text-[8px] text-white">✓</span>
                        </div>
                      )}
                    </div>
                    <p className="text-xs text-white/40">@{selectedPersona.username}</p>
                    {selectedPersona.is_premium && (
                      <p className="text-xs text-yellow-400 mt-1">Premium Character</p>
                    )}
                  </div>

                  {/* 비용 정보 */}
                  <div className="flex items-center justify-center gap-2 mb-4 p-3 bg-white/5 rounded-xl">
                    <Coins className="w-5 h-5 text-yellow-400" />
                    <span className="text-white font-medium">
                      {getFollowCost(selectedPersona.id, selectedPersona.is_premium)}
                    </span>
                    <span className="text-white/50 text-sm">토큰 소모</span>
                  </div>

                  {/* 보유 토큰 */}
                  <div className="text-center text-xs text-white/40 mb-4">
                    {tr.dm.yourTokens}: <span className="text-yellow-400">{userTokens.toLocaleString()}</span>
                  </div>

                  {/* 버튼 */}
                  <div className="flex gap-2">
                    <button
                      onClick={() => setSelectedPersona(null)}
                      className="flex-1 py-2.5 bg-white/5 rounded-xl text-white/50 text-sm hover:bg-white/10 transition"
                    >
                      {tr.common.cancel}
                    </button>
                    <button
                      onClick={handleConfirmFollow}
                      disabled={isFollowing}
                      className="flex-1 py-2.5 bg-gradient-to-r from-pink-500 to-purple-500 rounded-xl text-white text-sm hover:opacity-90 transition disabled:opacity-50"
                    >
                      {isFollowing ? (
                        <Loader2 className="w-4 h-4 mx-auto animate-spin" />
                      ) : (
                        tr.dm.follow
                      )}
                    </button>
                  </div>
                </div>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
