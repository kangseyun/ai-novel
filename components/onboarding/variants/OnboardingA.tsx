'use client';

/**
 * 옵션 A: 잠금화면 제거, 심플한 메시지 리스트
 */

import { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { PERSONAS, PersonaCard } from '@/lib/persona-data';
import OnboardingScenario, { ScenarioResultData } from '../OnboardingScenario';
import OnboardingSignup from '../OnboardingSignup';
import { getPersonaById } from '@/lib/persona-data';
import { useTranslations } from '@/lib/i18n';

interface OnboardingAProps {
  onComplete: () => void;
  onSkip?: () => void;
}

type Step = 'select' | 'scenario' | 'signup';

export default function OnboardingA({ onComplete, onSkip }: OnboardingAProps) {
  const [step, setStep] = useState<Step>('select');
  const [selectedPersonaId, setSelectedPersonaId] = useState<string | null>(null);
  const [affectionGained, setAffectionGained] = useState(0);
  const tr = useTranslations();

  const handleSelect = (persona: PersonaCard) => {
    if (!persona.available) return;
    setSelectedPersonaId(persona.id);
    setStep('scenario');
  };

  const handleScenarioProgress = useCallback((affection: number) => {
    setAffectionGained(prev => prev + affection);
  }, []);

  const handleCliffhanger = useCallback(() => {
    setStep('signup');
  }, []);

  const handleScenarioConfirm = useCallback((result: ScenarioResultData) => {
    setAffectionGained(result.affectionGained);
    setStep('signup');
  }, []);

  const persona = selectedPersonaId ? getPersonaById(selectedPersonaId) : null;

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
                {PERSONAS.map((persona, idx) => (
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
                      <img
                        src={persona.image}
                        alt={persona.name}
                        className="w-full h-full object-cover"
                      />
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0 text-left">
                      <div className="flex items-center justify-between mb-0.5">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-white">{persona.name}</span>
                          <span className="text-xs text-white/30">{persona.archetype}</span>
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

              {onSkip && (
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
                personaName={persona?.name}
                personaImage={persona?.image}
                personaColor={persona?.color}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
