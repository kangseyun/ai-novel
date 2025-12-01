'use client';

/**
 * 옵션 B: 잠금화면에서 바로 선택
 * - 잠금화면의 알림을 클릭하면 바로 그 캐릭터 시나리오 시작
 * - 중간 단계 제거로 더 빠른 후킹
 */

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { PERSONAS } from '@/lib/persona-data';
import OnboardingScenario, { ScenarioResultData } from '../OnboardingScenario';
import OnboardingSignup from '../OnboardingSignup';
import { getPersonaById } from '@/lib/persona-data';

interface OnboardingBProps {
  onComplete: () => void;
  onSkip?: () => void;
}

type Step = 'lockscreen' | 'scenario' | 'signup';

export default function OnboardingB({ onComplete, onSkip }: OnboardingBProps) {
  const [step, setStep] = useState<Step>('lockscreen');
  const [selectedPersonaId, setSelectedPersonaId] = useState<string | null>(null);
  const [affectionGained, setAffectionGained] = useState(0);
  const [time, setTime] = useState('');
  const [date, setDate] = useState('');

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setTime(now.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', hour12: false }));
      setDate(now.toLocaleDateString('ko-KR', { month: 'long', day: 'numeric', weekday: 'long' }));
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  const handleNotificationClick = (personaId: string, isAvailable: boolean) => {
    if (!isAvailable) return; // 사용 불가능한 페르소나는 클릭 무시
    setSelectedPersonaId(personaId);
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
          {step === 'lockscreen' && (
            <motion.div
              key="lockscreen"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="h-[100dvh] flex flex-col relative overflow-hidden"
            >
              {/* Background gradient */}
              <div className="absolute inset-0 bg-gradient-to-b from-zinc-900/50 to-black" />

              {/* 시간 표시 - 상단 */}
              <div className="relative z-10 flex flex-col items-center pt-16 pb-6 shrink-0">
                <motion.p
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="text-white/50 text-sm mb-1"
                >
                  {date}
                </motion.p>
                <motion.h1
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="text-7xl font-extralight tracking-tight text-white"
                >
                  {time}
                </motion.h1>
              </div>

              {/* Clickable notifications - 시계 아래 (모든 페르소나 표시) */}
              <div className="relative z-10 px-4 space-y-2 flex-1 overflow-y-auto min-h-0 pb-16">
                {PERSONAS.map((persona, idx) => (
                  <motion.button
                    key={persona.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: idx * 0.1, duration: 0.3 }}
                    onClick={() => handleNotificationClick(persona.id, persona.available)}
                    disabled={!persona.available}
                    className={`w-full bg-white/10 backdrop-blur-xl rounded-2xl p-3 border border-white/5 text-left transition-all ${
                      persona.available
                        ? 'hover:bg-white/15 active:scale-[0.98]'
                        : 'opacity-50'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className="w-10 h-10 rounded-full overflow-hidden"
                        style={{ boxShadow: persona.available ? `0 0 0 2px ${persona.color}` : 'none' }}
                      >
                        <img
                          src={persona.image}
                          alt={persona.name}
                          className="w-full h-full object-cover"
                        />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between mb-0.5">
                          <span className="font-medium text-sm text-white">{persona.name}</span>
                          <span className="text-xs text-white/40">
                            {persona.available ? '방금' : '준비 중'}
                          </span>
                        </div>
                        <p className="text-sm text-white/60 truncate">
                          {persona.available ? persona.teaserLine : '곧 만나요...'}
                        </p>
                      </div>
                    </div>
                  </motion.button>
                ))}

                {/* Hint text */}
                <motion.p
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.5 }}
                  className="text-center text-xs text-white/30 pt-4"
                >
                  알림을 탭하여 대화 시작
                </motion.p>
              </div>

              {onSkip && (
                <button
                  onClick={onSkip}
                  className="absolute bottom-8 right-6 text-xs text-white/30 hover:text-white/50 transition z-20"
                >
                  건너뛰기 →
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
