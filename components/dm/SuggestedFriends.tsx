'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { Check, Loader2 } from 'lucide-react';
import { useUserPersonaStore } from '@/lib/stores/user-persona-store';
import { useTranslations } from '@/lib/i18n';
import { apiClient } from '@/lib/api-client';

// ============================================
// 타입 정의
// ============================================

interface Persona {
  id: string;
  name: string;
  displayName: string;
  username: string;
  bio: string;
  avatarUrl: string;
  isVerified: boolean;
  isPremium: boolean;
  category: string;
}

interface SuggestedFriendsProps {
  onUnlock?: (personaId: string) => void;
  onStartChat?: (personaId: string) => void;
}

// ============================================
// 메인 컴포넌트
// ============================================

export default function SuggestedFriends({
  onUnlock,
}: SuggestedFriendsProps) {
  const router = useRouter();
  const [personas, setPersonas] = useState<Persona[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedPersona, setSelectedPersona] = useState<Persona | null>(null);
  const [isFollowing, setIsFollowing] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const tr = useTranslations();

  const { unlockedPersonas, unlockPersona } = useUserPersonaStore();

  // 페르소나 목록 로드
  useEffect(() => {
    const loadPersonas = async () => {
      try {
        setIsLoading(true);
        const response = await apiClient.get<{ personas: Persona[] }>('/api/personas');
        if (response.personas) {
          // jun을 제외한 페르소나 (jun은 기본 해금)
          const filtered = response.personas.filter(p => p.id !== 'jun');
          setPersonas(filtered);
        }
      } catch (error) {
        console.error('[SuggestedFriends] Failed to load personas:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadPersonas();
  }, []);

  const handleProfileClick = (personaId: string) => {
    router.push(`/profile/${personaId}`);
  };

  // 팔로우하지 않은 페르소나만 필터링
  const unfollowedPersonas = personas.filter(
    p => !unlockedPersonas.includes(p.id)
  );

  const handleFollowClick = (persona: Persona) => {
    setSelectedPersona(persona);
  };

  const handleConfirmFollow = async () => {
    if (!selectedPersona) return;

    setIsFollowing(true);

    try {
      // API 호출
      const response = await fetch('/api/personas/unlock', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ personaId: selectedPersona.id }),
      });

      if (!response.ok) {
        throw new Error('Failed to follow');
      }

      // 로컬 상태 업데이트
      unlockPersona(selectedPersona.id);

      // 성공 처리
      setShowSuccess(true);
      setTimeout(() => {
        setShowSuccess(false);
        setSelectedPersona(null);
        onUnlock?.(selectedPersona.id);
      }, 1000);

    } catch (error) {
      console.error('Follow failed:', error);
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

  if (unfollowedPersonas.length === 0) {
    return null;
  }

  return (
    <>
      <div className="px-4 pt-[300px] pb-4">
        <h2 className="text-sm font-medium text-white/50 mb-3">{tr.dm.suggestedFriends}</h2>
        <div className="space-y-2">
          {unfollowedPersonas.map((persona, idx) => (
            <motion.div
              key={persona.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.05 }}
              className="flex items-center gap-3 p-3 bg-white/5 rounded-xl"
            >
              {/* 프로필 이미지 - 클릭 시 프로필 이동 */}
              <div
                className="relative w-11 h-11 rounded-full overflow-hidden border border-white/10 cursor-pointer"
                onClick={() => handleProfileClick(persona.id)}
              >
                <Image
                  src={persona.avatarUrl}
                  alt={persona.displayName}
                  width={44}
                  height={44}
                  className="object-cover"
                />
                {persona.isPremium && (
                  <div className="absolute -top-1 -right-1 w-4 h-4 bg-gradient-to-r from-yellow-400 to-orange-500 rounded-full flex items-center justify-center">
                    <span className="text-[8px]">👑</span>
                  </div>
                )}
              </div>

              {/* 정보 - 이름 클릭 시 프로필 이동 */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <p
                    className="font-medium text-white text-sm cursor-pointer hover:underline truncate"
                    onClick={() => handleProfileClick(persona.id)}
                  >
                    {persona.displayName}
                  </p>
                  {persona.isVerified && (
                    <div className="w-4 h-4 bg-blue-500 rounded-full flex items-center justify-center flex-shrink-0">
                      <span className="text-[8px] text-white">✓</span>
                    </div>
                  )}
                </div>
                <p className="text-xs text-white/40 truncate">{persona.bio}</p>
              </div>

              {/* 팔로우 버튼 */}
              <button
                onClick={() => handleFollowClick(persona)}
                className="px-4 py-1.5 bg-white/10 rounded-lg text-sm text-white/80 hover:bg-white/15 transition flex-shrink-0"
              >
                {tr.dm.follow}
              </button>
            </motion.div>
          ))}
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
                        src={selectedPersona.avatarUrl}
                        alt={selectedPersona.displayName}
                        width={64}
                        height={64}
                        className="object-cover"
                      />
                      {selectedPersona.isPremium && (
                        <div className="absolute -top-1 -right-1 w-5 h-5 bg-gradient-to-r from-yellow-400 to-orange-500 rounded-full flex items-center justify-center">
                          <span className="text-[10px]">👑</span>
                        </div>
                      )}
                    </div>
                    <div className="flex items-center gap-1.5">
                      <p className="font-medium text-white">{selectedPersona.displayName}</p>
                      {selectedPersona.isVerified && (
                        <div className="w-4 h-4 bg-blue-500 rounded-full flex items-center justify-center">
                          <span className="text-[8px] text-white">✓</span>
                        </div>
                      )}
                    </div>
                    <p className="text-xs text-white/40">@{selectedPersona.username}</p>
                    {selectedPersona.isPremium && (
                      <p className="text-xs text-yellow-400 mt-1">Premium Character</p>
                    )}
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
                      className="flex-1 py-2.5 bg-white/10 rounded-xl text-white text-sm hover:bg-white/15 transition"
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
