'use client';

/**
 * 옵션 A: 잠금화면 제거, 심플한 메시지 리스트
 * - DB 기반 페르소나 목록 사용
 */

import { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Loader2 } from 'lucide-react';
import { PERSONAS } from '@/lib/persona-data';
import OnboardingScenario, { ScenarioResultData } from '../OnboardingScenario';
import OnboardingSignup from '../OnboardingSignup';
import { getPersonaById } from '@/lib/persona-data';
import { useTranslations, useLocale } from '@/lib/i18n';
import { useOnboardingData, OnboardingPersona } from '@/hooks/useOnboardingData';

interface OnboardingAProps {
  onComplete: () => void;
  onSkip?: () => void;
}

type Step = 'select' | 'scenario' | 'signup';

// 변환된 페르소나 타입
interface TransformedPersona {
  id: string;
  name: string;
  teaserLine: string;
  image: string;
  color: string;
  available: boolean;
  archetype?: string;
  scenarioId?: string | null;
}

// DB 페르소나를 기존 형식으로 변환
function transformPersona(dbPersona: OnboardingPersona, locale: string): TransformedPersona {
  return {
    id: dbPersona.id,
    name: dbPersona.name[locale as 'ko' | 'en'] || dbPersona.name.ko || dbPersona.id,
    teaserLine: dbPersona.teaserLine[locale as 'ko' | 'en'] || dbPersona.teaserLine.ko || '',
    image: dbPersona.image || '',
    color: dbPersona.color,
    available: dbPersona.available,
    scenarioId: dbPersona.scenarioId,
  };
}

export default function OnboardingA({ onComplete, onSkip }: OnboardingAProps) {
  const [step, setStep] = useState<Step>('select');
  const [selectedPersonaId, setSelectedPersonaId] = useState<string | null>(null);
  const [selectedScenarioId, setSelectedScenarioId] = useState<string | null>(null);
  const [affectionGained, setAffectionGained] = useState(0);
  const tr = useTranslations();
  const locale = useLocale();

  // DB에서 온보딩 데이터 가져오기
  const { personas: dbPersonas, settings, isLoading } = useOnboardingData();

  // DB 페르소나가 있으면 사용, 없으면 하드코딩된 데이터 사용 (폴백)
  const personas: TransformedPersona[] = dbPersonas.length > 0
    ? dbPersonas.map(p => transformPersona(p, locale))
    : PERSONAS.map(p => ({ ...p, scenarioId: null }));

  const handleSelect = (persona: TransformedPersona) => {
    if (!persona.available) return;
    setSelectedPersonaId(persona.id);
    setSelectedScenarioId(persona.scenarioId || null);
    setStep('scenario');
  };

  const handleScenarioProgress = useCallback((affection: number) => {
    setAffectionGained(prev => prev + affection);
  }, []);

  const handleCliffhanger = useCallback(() => {
    setStep('signup');
  }, []);

  const handleScenarioConfirm = useCallback((result: ScenarioResultData) => {
    // 확정하기를 누르면 대화 이어하기 화면으로 이동
    setAffectionGained(result.affectionGained);
    setStep('signup');
  }, []);

  // 선택된 페르소나 정보 가져오기
  const selectedPersona = selectedPersonaId
    ? personas.find(p => p.id === selectedPersonaId) || getPersonaById(selectedPersonaId)
    : null;

  // 로딩 중일 때
  if (isLoading) {
    return (
      <div className="fixed inset-0 z-[100] bg-black flex justify-center items-center">
        <Loader2 className="w-8 h-8 animate-spin text-white/50" />
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-[100] bg-black flex justify-center">
      <div className="w-full max-w-[430px] h-[100dvh] relative bg-black overflow-hidden">
        <AnimatePresence mode="wait">
          {step === 'select' && (
            <motion.div
              key="select"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="h-[100dvh] flex flex-col overflow-hidden"
            >
              {/* 테스트용 변형 표시 */}
              <div className="absolute top-4 left-4 px-2 py-1 bg-white/10 rounded text-xs text-white/50 z-20">
                Variant A
              </div>

              {/* Header */}
              <div className="px-5 pt-12 pb-4 shrink-0">
                <motion.p
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="text-white/40 text-xs mb-3"
                >
                  {tr.onboarding.aiInteractiveStory}
                </motion.p>
                <motion.h1
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="text-2xl font-bold text-white mb-2"
                >
                  {tr.onboarding.someoneMessaged}
                </motion.h1>
                <motion.p
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.1 }}
                  className="text-white/50 text-sm"
                >
                  {tr.onboarding.enterTheirStory}
                </motion.p>
              </div>

              {/* Simple DM List */}
              <div className="flex-1 px-4 overflow-y-auto min-h-0 pb-16">
                {personas.slice(0, settings.maxPersonasDisplay).map((persona, idx) => (
                  <motion.button
                    key={persona.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: idx * 0.05 }}
                    onClick={() => handleSelect(persona)}
                    disabled={!persona.available}
                    className={`w-full flex items-center gap-4 py-4 border-b border-white/5 transition-colors ${
                      persona.available
                        ? 'active:bg-white/5'
                        : 'opacity-30'
                    }`}
                  >
                    {/* Avatar */}
                    <div className="w-12 h-12 rounded-full overflow-hidden bg-white/10">
                      {persona.image ? (
                        <img
                          src={persona.image}
                          alt={persona.name}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div
                          className="w-full h-full flex items-center justify-center text-white font-bold"
                          style={{ backgroundColor: persona.color }}
                        >
                          {persona.name[0]}
                        </div>
                      )}
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0 text-left">
                      <div className="flex items-center justify-between mb-0.5">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-white">{persona.name}</span>
                          {persona.archetype && (
                            <span className="text-xs text-white/30">{persona.archetype}</span>
                          )}
                        </div>
                        {persona.available && (
                          <span className="text-xs text-white/30">{tr.onboarding.justNow}</span>
                        )}
                      </div>
                      <p className="text-sm text-white/40 truncate">
                        {persona.available ? persona.teaserLine : tr.onboarding.preparing}
                      </p>
                    </div>

                    {/* Unread dot */}
                    {persona.available && (
                      <div className="w-2 h-2 rounded-full bg-white" />
                    )}
                  </motion.button>
                ))}
              </div>

              {settings.showSkipButton && onSkip && (
                <button
                  onClick={onSkip}
                  className="absolute bottom-8 right-6 text-xs text-white/30 hover:text-white/50 transition"
                >
                  {tr.onboarding.skip}
                </button>
              )}
            </motion.div>
          )}

          {step === 'scenario' && (
            <motion.div
              key="scenario"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <OnboardingScenario
                scenarioId={selectedScenarioId}
                onProgress={handleScenarioProgress}
                onCliffhanger={handleCliffhanger}
                onConfirm={handleScenarioConfirm}
              />
            </motion.div>
          )}

          {step === 'signup' && (
            <motion.div
              key="signup"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <OnboardingSignup
                affectionGained={affectionGained}
                onSignup={onComplete}
                personaName={selectedPersona?.name}
                personaImage={selectedPersona?.image}
                personaColor={selectedPersona?.color}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
