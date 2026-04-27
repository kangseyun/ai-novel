'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { Check, Heart, Sparkles, Users, ChevronRight } from 'lucide-react';
import { useAuthStore } from '@/lib/stores/auth-store';
import { useTranslations, t } from '@/lib/i18n';

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

const MIN_FOLLOWS = 5;

export default function FollowPersonasPage() {
  const router = useRouter();
  const { isAuthenticated, isLoading: authLoading } = useAuthStore();
  const tr = useTranslations();

  const [step, setStep] = useState<'category' | 'select'>('category');
  const [selectedAudience, setSelectedAudience] = useState<TargetAudience | null>(null);
  const [personas, setPersonas] = useState<Persona[]>([]);
  const [selectedPersonas, setSelectedPersonas] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const AUDIENCE_OPTIONS: { id: TargetAudience; label: string; description: string; icon: string }[] = [
    { id: 'female', label: tr.onboarding.femaleAudience, description: tr.onboarding.femaleAudienceDesc, icon: '💜' },
    { id: 'male', label: tr.onboarding.maleAudience, description: tr.onboarding.maleAudienceDesc, icon: '💖' },
    { id: 'anime', label: tr.onboarding.animeAudience, description: tr.onboarding.animeAudienceDesc, icon: '✨' },
  ];

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
      const response: { personas?: Persona[]; initialFollowsCompleted?: boolean } = await res.json();

      const personas = response.personas || [];
      setPersonas(personas);

      // 이미 팔로우된 페르소나 선택 상태로 설정
      const alreadyFollowed = new Set<string>(
        personas.filter((p: Persona) => p.isFollowed).map((p: Persona) => p.id)
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
      alert(tr.onboarding.followError);
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
            audienceOptions={AUDIENCE_OPTIONS}
            tr={tr}
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
            tr={tr}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

// 카테고리 선택 스텝
function CategoryStep({
  onSelect,
  audienceOptions,
  tr
}: {
  onSelect: (audience: TargetAudience) => void;
  audienceOptions: { id: TargetAudience; label: string; description: string; icon: string }[];
  tr: ReturnType<typeof useTranslations>;
}) {
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
          {tr.onboarding.whichCharacterToChat}
        </h1>
        <p className="text-white/50 text-sm">
          {tr.onboarding.recommendByPreference}
        </p>
      </div>

      {/* Options */}
      <div className="flex-1 flex flex-col justify-center gap-4 max-w-md mx-auto w-full">
        {audienceOptions.map((option, index) => (
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
  tr,
}: {
  personas: Persona[];
  selectedPersonas: Set<string>;
  isLoading: boolean;
  isSubmitting: boolean;
  onToggle: (id: string) => void;
  onSubmit: () => void;
  onBack: () => void;
  audienceLabel: string;
  tr: ReturnType<typeof useTranslations>;
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
          {tr.onboarding.backToSelect}
        </button>
        <h1 className="text-xl font-bold text-white mb-1">
          {tr.onboarding.selectCharactersToFollow}
        </h1>
        <p className="text-white/50 text-sm">
          {t(tr.onboarding.selectMinCharacters, { audience: audienceLabel, n: MIN_FOLLOWS })}
        </p>
      </div>

      {/* Progress */}
      <div className="px-6 pb-4">
        <div className="flex items-center gap-2 mb-2">
          <Heart className="w-4 h-4 text-pink-400" />
          <span className="text-white text-sm font-medium">
            {t(tr.onboarding.selectedCount, { n: selectedPersonas.size })}
          </span>
          {remaining > 0 && (
            <span className="text-white/40 text-sm">
              {t(tr.onboarding.selectMoreCount, { n: remaining })}
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
            <p className="text-white/50">{tr.onboarding.noCharactersYet}</p>
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
                tr={tr}
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
              {tr.onboarding.startNow}
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
  tr,
}: {
  persona: Persona;
  isSelected: boolean;
  onToggle: () => void;
  index: number;
  tr: ReturnType<typeof useTranslations>;
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
            {tr.onboarding.verified}
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
