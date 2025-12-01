'use client';

import { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import LockScreen from './LockScreen';
import PersonaSelect from './PersonaSelect';
import OnboardingScenario, { ScenarioResultData } from './OnboardingScenario';
import OnboardingSignup from './OnboardingSignup';
import { getPersonaById } from '@/lib/persona-data';
// 새로운 재사용 가능한 시나리오 시스템
import OnboardingScenarioWrapper from '@/components/scenario/OnboardingScenarioWrapper';
import { ScenarioResult } from '@/components/scenario/ScenarioPlayer';
import { JUN_FIRST_MEETING_SCENARIO, SCENARIO_CHARACTERS } from '@/lib/scenario-fallback';

interface OnboardingFlowProps {
  onComplete: () => void;
  onSkip?: () => void;
  /** 새로운 재사용 가능한 시나리오 시스템 사용 여부 */
  useNewScenarioSystem?: boolean;
}

type OnboardingStep = 'lockscreen' | 'persona_select' | 'scenario' | 'signup';

export default function OnboardingFlow({
  onComplete,
  onSkip,
  useNewScenarioSystem = true,  // 기본값으로 새 시스템 사용
}: OnboardingFlowProps) {
  const [step, setStep] = useState<OnboardingStep>('lockscreen');
  const [selectedPersonaId, setSelectedPersonaId] = useState<string | null>(null);
  const [affectionGained, setAffectionGained] = useState(0);

  // 잠금화면 해제 → 메시지 선택
  const handleUnlock = useCallback(() => {
    setStep('persona_select');
  }, []);

  // 페르소나 선택 완료 → 시나리오로
  const handlePersonaSelect = useCallback((personaId: string) => {
    setSelectedPersonaId(personaId);
    setStep('scenario');
  }, []);

  // 시나리오 진행 중 호감도 업데이트
  const handleScenarioProgress = useCallback((affection: number, isPremiumTease: boolean) => {
    setAffectionGained(prev => prev + affection);
  }, []);

  // 시나리오 클리프행어 도달 → 가입 유도
  const handleCliffhanger = useCallback(() => {
    setStep('signup');
  }, []);

  // 시나리오 확정 완료 → 가입 유도 (기존 시스템)
  const handleScenarioConfirm = useCallback((result: ScenarioResultData) => {
    setAffectionGained(result.affectionGained);
    setStep('signup');
  }, []);

  // 새 시나리오 시스템 완료 핸들러
  const handleNewScenarioComplete = useCallback((result: ScenarioResult) => {
    setAffectionGained(result.affectionGained);
    setStep('signup');
  }, []);

  // 새 시나리오 시스템 호감도 변경 핸들러
  const handleNewScenarioAffectionChange = useCallback((delta: number, total: number) => {
    setAffectionGained(total);
  }, []);

  // 가입 완료
  const handleSignup = useCallback(() => {
    onComplete();
  }, [onComplete]);

  const persona = selectedPersonaId ? getPersonaById(selectedPersonaId) : null;

  return (
    <div className="fixed inset-0 z-[100] bg-black flex justify-center">
      <div className="w-full max-w-[430px] h-[100dvh] relative bg-black overflow-hidden">
        <AnimatePresence mode="wait">
          {/* Step 1: 잠금화면 */}
          {step === 'lockscreen' && (
            <motion.div
              key="lockscreen"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <LockScreen onUnlock={handleUnlock} />

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

          {/* Step 2: 메시지 선택 */}
          {step === 'persona_select' && (
            <motion.div
              key="persona"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <PersonaSelect onSelect={handlePersonaSelect} />

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

          {/* Step 3: 시나리오 */}
          {step === 'scenario' && (
            <motion.div
              key="scenario"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="h-full"
            >
              {useNewScenarioSystem ? (
                // 새로운 재사용 가능한 시나리오 시스템
                <OnboardingScenarioWrapper
                  personaId={selectedPersonaId || 'jun'}
                  character={SCENARIO_CHARACTERS.jun}
                  onAffectionChange={handleNewScenarioAffectionChange}
                  onPremiumChoice={() => {
                    // 프리미엄 선택지 클릭 시 처리 (업셀 등)
                    console.log('[Onboarding] Premium choice clicked');
                  }}
                  onComplete={handleNewScenarioComplete}
                  fallbackScenario={JUN_FIRST_MEETING_SCENARIO}
                />
              ) : (
                // 기존 하드코딩된 시나리오 시스템
                <OnboardingScenario
                  onProgress={handleScenarioProgress}
                  onCliffhanger={handleCliffhanger}
                  onConfirm={handleScenarioConfirm}
                />
              )}
            </motion.div>
          )}

          {/* Step 4: 가입 유도 */}
          {step === 'signup' && (
            <motion.div
              key="signup"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <OnboardingSignup
                affectionGained={affectionGained}
                onSignup={handleSignup}
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
