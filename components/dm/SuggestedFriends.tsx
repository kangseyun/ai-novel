'use client';

import { useState } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { Check } from 'lucide-react';
import { useUserPersonaStore } from '@/lib/stores/user-persona-store';
import { useTranslations } from '@/lib/i18n';

// ============================================
// 타입 정의
// ============================================

interface Persona {
  id: string;
  name: string;
  username: string;
  profileImage: string;
  bio: string;
}

interface SuggestedFriendsProps {
  onUnlock?: (personaId: string) => void;
  onStartChat?: (personaId: string) => void;
}

// ============================================
// 페르소나 데이터
// ============================================

const PERSONAS: Persona[] = [
  {
    id: 'daniel',
    name: 'Daniel',
    username: 'daniel_sterling',
    profileImage: 'https://i.pravatar.cc/400?img=52',
    bio: '냉철한 CEO, 하지만 당신 앞에서만 무너지는 남자',
  },
  {
    id: 'kael',
    name: 'Kael',
    username: 'kael_vance',
    profileImage: 'https://i.pravatar.cc/400?img=53',
    bio: '말없이 지켜주는 그림자 같은 보디가드',
  },
  {
    id: 'adrian',
    name: 'Adrian',
    username: 'adrian_cruz',
    profileImage: 'https://i.pravatar.cc/400?img=57',
    bio: '후회하며 돌아온 전 남자친구',
  },
  {
    id: 'ren',
    name: 'Ren',
    username: 'ren_ito',
    profileImage: 'https://i.pravatar.cc/400?img=60',
    bio: '위험하고 매혹적인 야쿠자 후계자',
  },
];

// ============================================
// 메인 컴포넌트
// ============================================

export default function SuggestedFriends({
  onUnlock,
  onStartChat,
}: SuggestedFriendsProps) {
  const router = useRouter();
  const [selectedPersona, setSelectedPersona] = useState<Persona | null>(null);
  const [isFollowing, setIsFollowing] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const tr = useTranslations();

  const { unlockedPersonas, unlockPersona } = useUserPersonaStore();

  const handleProfileClick = (personaId: string) => {
    router.push(`/profile/${personaId}`);
  };

  // 팔로우하지 않은 페르소나만 필터링
  const unfollowedPersonas = PERSONAS.filter(
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
                className="w-11 h-11 rounded-full overflow-hidden border border-white/10 cursor-pointer"
                onClick={() => handleProfileClick(persona.id)}
              >
                <Image
                  src={persona.profileImage}
                  alt={persona.name}
                  width={44}
                  height={44}
                  className="object-cover"
                />
              </div>

              {/* 정보 - 이름 클릭 시 프로필 이동 */}
              <div className="flex-1 min-w-0">
                <p
                  className="font-medium text-white text-sm cursor-pointer hover:underline"
                  onClick={() => handleProfileClick(persona.id)}
                >
                  {persona.name}
                </p>
                <p className="text-xs text-white/40 truncate">{persona.bio}</p>
              </div>

              {/* 팔로우 버튼 */}
              <button
                onClick={() => handleFollowClick(persona)}
                className="px-4 py-1.5 bg-white/10 rounded-lg text-sm text-white/80 hover:bg-white/15 transition"
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
                    <div className="w-16 h-16 rounded-full overflow-hidden border border-white/10 mb-3">
                      <Image
                        src={selectedPersona.profileImage}
                        alt={selectedPersona.name}
                        width={64}
                        height={64}
                        className="object-cover"
                      />
                    </div>
                    <p className="font-medium text-white">{selectedPersona.name}</p>
                    <p className="text-xs text-white/40">@{selectedPersona.username}</p>
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
                        <div className="w-4 h-4 mx-auto border-2 border-white/20 border-t-white/60 rounded-full animate-spin" />
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
