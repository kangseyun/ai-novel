'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { Check, Heart, Sparkles, Users, ChevronRight } from 'lucide-react';
import { useAuthStore } from '@/lib/stores/auth-store';

interface Persona {
  id: string;
  name: string;
  displayName: string;
  username: string;
  bio: string;
  avatarUrl: string;
  coverImageUrl?: string;
  isVerified: boolean;
  isPremium: boolean;
  category: string;
  targetAudience: string;
  tags: string[];
  followersCount: string;
  isFollowed: boolean;
}

type TargetAudience = 'female' | 'male' | 'anime';

const AUDIENCE_OPTIONS: { id: TargetAudience; label: string; description: string; icon: string }[] = [
  { id: 'female', label: '여성향', description: '매력적인 남성 캐릭터들', icon: '💜' },
  { id: 'male', label: '남성향', description: '매력적인 여성 캐릭터들', icon: '💖' },
  { id: 'anime', label: '애니', description: '애니메이션 스타일 캐릭터', icon: '✨' },
];

const MIN_FOLLOWS = 5;

export default function FollowPersonasPage() {
  const router = useRouter();
  const { isAuthenticated, isLoading: authLoading } = useAuthStore();

  const [step, setStep] = useState<'category' | 'select'>('category');
  const [selectedAudience, setSelectedAudience] = useState<TargetAudience | null>(null);
  const [personas, setPersonas] = useState<Persona[]>([]);
  const [selectedPersonas, setSelectedPersonas] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // 인증 체크
  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.replace('/login');
    }
  }, [authLoading, isAuthenticated, router]);

  // 카테고리 선택 후 페르소나 로드
  useEffect(() => {
    if (selectedAudience && step === 'select') {
      loadPersonas(selectedAudience);
    }
  }, [selectedAudience, step]);

  const loadPersonas = async (audience: TargetAudience) => {
    setIsLoading(true);
    try {
      const res = await fetch(`/api/onboarding/follow?target_audience=${audience}`);
      const response: { personas: Persona[]; initialFollowsCompleted: boolean } = await res.json();

      if (response.initialFollowsCompleted) {
        // 이미 초기 팔로우를 완료한 경우 홈으로
        router.replace('/');
        return;
      }

      setPersonas(response.personas);

      // 이미 팔로우된 페르소나 선택 상태로 설정
      const alreadyFollowed = new Set<string>(
        response.personas.filter((p: Persona) => p.isFollowed).map((p: Persona) => p.id)
      );
      setSelectedPersonas(alreadyFollowed);
    } catch (error) {
      console.error('Failed to load personas:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleAudienceSelect = (audience: TargetAudience) => {
    setSelectedAudience(audience);
    setStep('select');
  };

  const togglePersona = (personaId: string) => {
    setSelectedPersonas(prev => {
      const next = new Set(prev);
      if (next.has(personaId)) {
        next.delete(personaId);
      } else {
        next.add(personaId);
      }
      return next;
    });
  };

  const handleSubmit = async () => {
    if (selectedPersonas.size < MIN_FOLLOWS) return;

    setIsSubmitting(true);
    try {
      await fetch('/api/onboarding/follow', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          personaIds: Array.from(selectedPersonas),
          targetAudience: selectedAudience,
        }),
      });

      router.replace('/?from_onboarding=true');
    } catch (error) {
      console.error('Failed to follow personas:', error);
      alert('팔로우 처리 중 오류가 발생했습니다. 다시 시도해주세요.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (authLoading) {
    return (
      <div className="min-h-[100dvh] bg-black flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-white/30 border-t-white rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-[100dvh] bg-black flex flex-col">
      <AnimatePresence mode="wait">
        {step === 'category' ? (
          <CategoryStep
            key="category"
            onSelect={handleAudienceSelect}
          />
        ) : (
          <SelectStep
            key="select"
            personas={personas}
            selectedPersonas={selectedPersonas}
            isLoading={isLoading}
            isSubmitting={isSubmitting}
            onToggle={togglePersona}
            onSubmit={handleSubmit}
            onBack={() => setStep('category')}
            audienceLabel={AUDIENCE_OPTIONS.find(o => o.id === selectedAudience)?.label || ''}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

// 카테고리 선택 스텝
function CategoryStep({ onSelect }: { onSelect: (audience: TargetAudience) => void }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="flex-1 flex flex-col p-6"
    >
      {/* Header */}
      <div className="pt-8 pb-6 text-center">
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ delay: 0.2, type: 'spring' }}
          className="w-16 h-16 mx-auto mb-6 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center"
        >
          <Users className="w-8 h-8 text-white" />
        </motion.div>
        <h1 className="text-2xl font-bold text-white mb-2">
          어떤 캐릭터와 대화하고 싶으세요?
        </h1>
        <p className="text-white/50 text-sm">
          취향에 맞는 캐릭터를 추천해드릴게요
        </p>
      </div>

      {/* Options */}
      <div className="flex-1 flex flex-col justify-center gap-4 max-w-md mx-auto w-full">
        {AUDIENCE_OPTIONS.map((option, index) => (
          <motion.button
            key={option.id}
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.3 + index * 0.1 }}
            onClick={() => onSelect(option.id)}
            className="w-full p-5 rounded-2xl bg-white/5 border border-white/10 hover:bg-white/10 hover:border-white/20 transition-all text-left group"
          >
            <div className="flex items-center gap-4">
              <span className="text-3xl">{option.icon}</span>
              <div className="flex-1">
                <p className="text-white font-semibold text-lg">{option.label}</p>
                <p className="text-white/50 text-sm">{option.description}</p>
              </div>
              <ChevronRight className="w-5 h-5 text-white/30 group-hover:text-white/60 transition-colors" />
            </div>
          </motion.button>
        ))}
      </div>
    </motion.div>
  );
}

// 페르소나 선택 스텝
function SelectStep({
  personas,
  selectedPersonas,
  isLoading,
  isSubmitting,
  onToggle,
  onSubmit,
  onBack,
  audienceLabel,
}: {
  personas: Persona[];
  selectedPersonas: Set<string>;
  isLoading: boolean;
  isSubmitting: boolean;
  onToggle: (id: string) => void;
  onSubmit: () => void;
  onBack: () => void;
  audienceLabel: string;
}) {
  const canSubmit = selectedPersonas.size >= MIN_FOLLOWS;
  const remaining = Math.max(0, MIN_FOLLOWS - selectedPersonas.size);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="flex-1 flex flex-col"
    >
      {/* Header */}
      <div className="p-6 pb-4">
        <button
          onClick={onBack}
          className="text-white/50 text-sm mb-4 hover:text-white transition-colors"
        >
          ← 다시 선택
        </button>
        <h1 className="text-xl font-bold text-white mb-1">
          팔로우할 캐릭터를 선택하세요
        </h1>
        <p className="text-white/50 text-sm">
          {audienceLabel} 캐릭터 중 최소 {MIN_FOLLOWS}명을 선택해주세요
        </p>
      </div>

      {/* Progress */}
      <div className="px-6 pb-4">
        <div className="flex items-center gap-2 mb-2">
          <Heart className="w-4 h-4 text-pink-400" />
          <span className="text-white text-sm font-medium">
            {selectedPersonas.size}명 선택됨
          </span>
          {remaining > 0 && (
            <span className="text-white/40 text-sm">
              (최소 {remaining}명 더 선택)
            </span>
          )}
        </div>
        <div className="h-1 bg-white/10 rounded-full overflow-hidden">
          <motion.div
            className="h-full bg-gradient-to-r from-purple-500 to-pink-500"
            initial={{ width: 0 }}
            animate={{ width: `${Math.min(100, (selectedPersonas.size / MIN_FOLLOWS) * 100)}%` }}
            transition={{ type: 'spring', stiffness: 300, damping: 30 }}
          />
        </div>
      </div>

      {/* Persona Grid */}
      <div className="flex-1 overflow-auto px-6 pb-32">
        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <div className="w-8 h-8 border-2 border-white/30 border-t-white rounded-full animate-spin" />
          </div>
        ) : personas.length === 0 ? (
          <div className="text-center py-20">
            <p className="text-white/50">아직 캐릭터가 준비되지 않았어요</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            {personas.map((persona, index) => (
              <PersonaCard
                key={persona.id}
                persona={persona}
                isSelected={selectedPersonas.has(persona.id)}
                onToggle={() => onToggle(persona.id)}
                index={index}
              />
            ))}
          </div>
        )}
      </div>

      {/* Submit Button */}
      <div className="fixed bottom-0 left-0 right-0 p-6 bg-gradient-to-t from-black via-black to-transparent">
        <motion.button
          onClick={onSubmit}
          disabled={!canSubmit || isSubmitting}
          whileTap={canSubmit ? { scale: 0.98 } : undefined}
          className={`
            w-full py-4 rounded-xl font-semibold text-lg flex items-center justify-center gap-2 transition-all
            ${canSubmit
              ? 'bg-gradient-to-r from-purple-500 to-pink-500 text-white shadow-lg shadow-purple-500/30'
              : 'bg-white/10 text-white/40 cursor-not-allowed'}
          `}
        >
          {isSubmitting ? (
            <div className="w-5 h-5 border-2 border-white/40 border-t-white rounded-full animate-spin" />
          ) : (
            <>
              <Sparkles className="w-5 h-5" />
              시작하기
            </>
          )}
        </motion.button>
      </div>
    </motion.div>
  );
}

// 페르소나 카드 컴포넌트
function PersonaCard({
  persona,
  isSelected,
  onToggle,
  index,
}: {
  persona: Persona;
  isSelected: boolean;
  onToggle: () => void;
  index: number;
}) {
  return (
    <motion.button
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05 }}
      onClick={onToggle}
      className={`
        relative rounded-2xl overflow-hidden border-2 transition-all
        ${isSelected
          ? 'border-purple-500 bg-purple-500/20'
          : 'border-white/10 bg-white/5 hover:border-white/20'}
      `}
    >
      {/* Cover/Avatar */}
      <div className="aspect-[3/4] relative">
        <img
          src={persona.avatarUrl}
          alt={persona.name}
          className="w-full h-full object-cover"
          onError={(e) => {
            (e.target as HTMLImageElement).src = '/default-avatar.png';
          }}
        />

        {/* Gradient overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-black via-black/20 to-transparent" />

        {/* Selected check */}
        <AnimatePresence>
          {isSelected && (
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0 }}
              className="absolute top-2 right-2 w-6 h-6 bg-purple-500 rounded-full flex items-center justify-center"
            >
              <Check className="w-4 h-4 text-white" />
            </motion.div>
          )}
        </AnimatePresence>

        {/* Verified badge */}
        {persona.isVerified && (
          <div className="absolute top-2 left-2 px-2 py-0.5 bg-blue-500/80 rounded-full text-[10px] text-white font-medium">
            인증됨
          </div>
        )}

        {/* Info overlay */}
        <div className="absolute bottom-0 left-0 right-0 p-3">
          <p className="text-white font-semibold text-sm truncate">
            {persona.displayName || persona.name}
          </p>
          <p className="text-white/60 text-xs truncate">
            @{persona.username}
          </p>
          {persona.tags.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-1">
              {persona.tags.slice(0, 2).map(tag => (
                <span
                  key={tag}
                  className="px-1.5 py-0.5 bg-white/10 rounded text-[9px] text-white/60"
                >
                  {tag}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>
    </motion.button>
  );
}
