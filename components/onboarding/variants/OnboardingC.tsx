'use client';

/**
 * 옵션 C: 잠금화면 유지, 메시지 리스트에 감성 추가
 * - 잠금화면은 분위기 조성용으로 유지
 * - 메시지 리스트에서 선택하면 짧은 "읽는 중..." 트랜지션 후 시나리오
 */

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { PERSONAS, PersonaCard } from '@/lib/persona-data';
import OnboardingScenario, { ScenarioResultData } from '../OnboardingScenario';
import OnboardingSignup from '../OnboardingSignup';
import { getPersonaById } from '@/lib/persona-data';

interface OnboardingCProps {
  onComplete: () => void;
  onSkip?: () => void;
}

type Step = 'lockscreen' | 'select' | 'loading' | 'scenario' | 'signup';

export default function OnboardingC({ onComplete, onSkip }: OnboardingCProps) {
  const [step, setStep] = useState<Step>('lockscreen');
  const [selectedPersonaId, setSelectedPersonaId] = useState<string | null>(null);
  const [affectionGained, setAffectionGained] = useState(0);
  const [time, setTime] = useState('');
  const [date, setDate] = useState('');
  const [showSwipeHint, setShowSwipeHint] = useState(false);

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

  useEffect(() => {
    if (step === 'lockscreen') {
      setTimeout(() => setShowSwipeHint(true), 500);
    }
  }, [step]);

  const availablePersonas = PERSONAS.filter(p => p.available);

  const handleUnlock = () => {
    setStep('select');
  };

  const handleSelect = (persona: PersonaCard) => {
    if (!persona.available) return;
    setSelectedPersonaId(persona.id);
    setStep('loading');

    // 짧은 로딩 후 시나리오로
    setTimeout(() => {
      setStep('scenario');
    }, 1500);
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
          {/* Lockscreen */}
          {step === 'lockscreen' && (
            <motion.div
              key="lockscreen"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="h-[100dvh] flex flex-col relative overflow-hidden"
            >
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

              {/* Notifications preview - 시계 아래 */}
              <div className="relative z-10 px-4 space-y-2 flex-1 overflow-y-auto min-h-0">
                {availablePersonas.slice(0, 3).map((persona, idx) => (
                  <motion.div
                    key={persona.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: idx * 0.1, duration: 0.3 }}
                    className="bg-white/10 backdrop-blur-xl rounded-2xl p-3 border border-white/5"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center text-sm font-medium text-white">
                        {persona.name[0]}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between mb-0.5">
                          <span className="font-medium text-sm text-white">{persona.name}</span>
                          <span className="text-xs text-white/40">방금</span>
                        </div>
                        <p className="text-sm text-white/60 truncate">{persona.teaserLine}</p>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>

              {/* 터치 힌트 - 하단 */}
              <div className="relative z-10 px-4 pb-8 shrink-0">
                <AnimatePresence>
                  {showSwipeHint && (
                    <motion.button
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      onClick={handleUnlock}
                      className="w-full py-4"
                    >
                      <motion.div
                        animate={{ opacity: [0.4, 1, 0.4] }}
                        transition={{ repeat: Infinity, duration: 1.5 }}
                        className="text-center"
                      >
                        <div className="w-10 h-1 bg-white/30 rounded-full mx-auto mb-3" />
                        <p className="text-sm text-white/40">탭하여 메시지 확인</p>
                      </motion.div>
                    </motion.button>
                  )}
                </AnimatePresence>
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

          {/* Select */}
          {step === 'select' && (
            <motion.div
              key="select"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="h-[100dvh] flex flex-col overflow-hidden"
            >
              <div className="px-5 pt-12 pb-4 shrink-0">
                <motion.h1
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="text-2xl font-bold text-white mb-1"
                >
                  메시지
                </motion.h1>
                <motion.p
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.1 }}
                  className="text-white/40 text-sm"
                >
                  누구의 메시지를 열어볼까요?
                </motion.p>
              </div>

              <div className="flex-1 px-4 overflow-y-auto min-h-0 pb-16">
                {PERSONAS.map((persona, idx) => (
                  <motion.button
                    key={persona.id}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.05 + idx * 0.05 }}
                    onClick={() => handleSelect(persona)}
                    disabled={!persona.available}
                    className={`w-full flex items-center gap-4 p-4 rounded-2xl mb-2 transition-colors ${
                      persona.available
                        ? 'hover:bg-white/5 active:bg-white/10'
                        : 'opacity-40'
                    }`}
                  >
                    <div className="relative">
                      <div
                        className="w-14 h-14 rounded-full overflow-hidden"
                        style={{
                          boxShadow: persona.available
                            ? `0 0 0 2px ${persona.color}`
                            : 'none',
                        }}
                      >
                        <img
                          src={persona.image}
                          alt={persona.name}
                          className="w-full h-full object-cover"
                        />
                      </div>
                      {persona.available && (
                        <div
                          className="absolute -bottom-0.5 -right-0.5 w-4 h-4 rounded-full border-2 border-black"
                          style={{ backgroundColor: persona.color }}
                        />
                      )}
                    </div>

                    <div className="flex-1 min-w-0 text-left">
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-semibold text-white">{persona.name}</span>
                        {persona.available && (
                          <span className="text-xs text-white/40">방금</span>
                        )}
                      </div>
                      <p className="text-sm text-white/50 truncate">
                        {persona.available ? persona.teaserLine : '준비 중...'}
                      </p>
                    </div>

                    {persona.available && (
                      <div
                        className="w-2.5 h-2.5 rounded-full"
                        style={{ backgroundColor: persona.color }}
                      />
                    )}
                  </motion.button>
                ))}
              </div>

              {onSkip && (
                <button
                  onClick={onSkip}
                  className="absolute bottom-8 right-6 text-xs text-white/30 hover:text-white/50 transition"
                >
                  건너뛰기 →
                </button>
              )}
            </motion.div>
          )}

          {/* Loading transition */}
          {step === 'loading' && persona && (
            <motion.div
              key="loading"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="h-[100dvh] flex flex-col items-center justify-center"
            >
              <motion.div
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className="flex flex-col items-center"
              >
                <div
                  className="w-20 h-20 rounded-full overflow-hidden mb-6"
                  style={{ boxShadow: `0 0 0 3px ${persona.color}` }}
                >
                  <img
                    src={persona.image}
                    alt={persona.name}
                    className="w-full h-full object-cover"
                  />
                </div>
                <p className="text-white/60 text-sm mb-2">{persona.name}</p>
                <motion.div
                  animate={{ opacity: [0.4, 1, 0.4] }}
                  transition={{ repeat: Infinity, duration: 1.2 }}
                  className="text-white/40 text-sm"
                >
                  메시지 불러오는 중...
                </motion.div>
              </motion.div>
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
