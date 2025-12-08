'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Crown, Heart, History, X } from 'lucide-react';
import type { ScenarioContent, ScenarioScene, ScenarioChoice } from '@/lib/ai-agent/modules/scenario-service';
import { useTranslations } from '@/lib/i18n';
import { useTutorial } from '@/components/tutorial/useTutorial';

// ============================================
// 타입 정의
// ============================================

export interface ScenarioPlayerProps {
  /** 시나리오 데이터 */
  scenario: ScenarioContent;
  /** 캐릭터 정보 */
  character: {
    id: string;
    name: string;
    image: string;
  };
  /** 선택지 선택 시 콜백 */
  onChoice?: (choice: ScenarioChoice, sceneId: string) => void;
  /** 호감도 변경 콜백 */
  onAffectionChange?: (delta: number, total: number) => void;
  /** 프리미엄 선택지 클릭 시 콜백 */
  onPremiumChoice?: (choice: ScenarioChoice) => void;
  /** 시나리오 완료 시 콜백 */
  onComplete?: (result: ScenarioResult) => void;
  /** 초기 씬 ID (이어하기용) */
  initialSceneId?: string;
  /** 테마 설정 */
  theme?: 'dark' | 'light';
  /** 히스토리 표시 여부 */
  showHistory?: boolean;
}

export interface ScenarioResult {
  affectionGained: number;
  choicesMade: ChoiceRecord[];
  characterId: string;
  characterName: string;
  completedAt: Date;
}

export interface ChoiceRecord {
  sceneId: string;
  choiceId: string;
  choiceText: string;
  affectionChange: number;
  isPremium?: boolean;
}

interface HistoryItem {
  sceneId: string;
  type: 'narration' | 'dialogue' | 'choice';
  speaker?: string;
  text: string;
  emotion?: string;
}

// ============================================
// 메인 컴포넌트
// ============================================

export default function ScenarioPlayer({
  scenario,
  character,
  onChoice,
  onAffectionChange,
  onPremiumChoice,
  onComplete,
  initialSceneId,
  theme = 'dark',
  showHistory = true,
}: ScenarioPlayerProps) {
  const tr = useTranslations();
  const tutorialTriggered = useRef(false);
  const { startScenarioTutorial, isScenarioTutorialCompleted } = useTutorial();

  // 현재 씬 인덱스 찾기
  const findSceneIndex = useCallback((sceneId?: string) => {
    if (!sceneId) return 0;
    const index = scenario.scenes.findIndex(s => s.id === sceneId);
    return index >= 0 ? index : 0;
  }, [scenario.scenes]);

  const [currentSceneIndex, setCurrentSceneIndex] = useState(() =>
    findSceneIndex(initialSceneId)
  );
  const [showContent, setShowContent] = useState(false);
  const [showChoices, setShowChoices] = useState(false);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [showPremiumModal, setShowPremiumModal] = useState(false);
  const [showHeartEffect, setShowHeartEffect] = useState(false);
  const [heartAmount, setHeartAmount] = useState(0);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [showHistoryPanel, setShowHistoryPanel] = useState(false);
  const [choicesMade, setChoicesMade] = useState<ChoiceRecord[]>([]);
  const [totalAffection, setTotalAffection] = useState(0);
  const [pendingPremiumChoice, setPendingPremiumChoice] = useState<ScenarioChoice | null>(null);

  const currentScene = scenario.scenes[currentSceneIndex];
  const isLastScene = currentSceneIndex === scenario.scenes.length - 1;

  // 히스토리에 추가
  const addToHistory = useCallback((scene: ScenarioScene) => {
    const items: HistoryItem[] = [];

    if (scene.type === 'narration' && scene.text) {
      items.push({
        sceneId: scene.id,
        type: 'narration',
        text: scene.text,
      });
    }

    if (scene.type === 'dialogue' && scene.text) {
      items.push({
        sceneId: scene.id,
        type: 'dialogue',
        speaker: scene.character || character.name,
        text: scene.text,
        emotion: scene.expression,
      });
    }

    if (items.length > 0) {
      setHistory(prev => [...prev, ...items]);
    }
  }, [character.name]);

  // 씬 진입 시 콘텐츠 표시
  useEffect(() => {
    if (!currentScene || isTransitioning) return;

    setShowContent(false);
    setShowChoices(false);

    const timer = setTimeout(() => {
      setShowContent(true);
      addToHistory(currentScene);
    }, 300);

    return () => clearTimeout(timer);
  }, [currentSceneIndex, currentScene, isTransitioning, addToHistory]);

  // 선택지 표시 또는 자동 진행
  useEffect(() => {
    if (!currentScene || !showContent || isTransitioning) return;

    if (currentScene.choices && currentScene.choices.length > 0) {
      const timer = setTimeout(() => {
        setShowChoices(true);
      }, 800);
      return () => clearTimeout(timer);
    }

    // 마지막 씬이면 완료 처리
    if (isLastScene && !currentScene.choices) {
      const timer = setTimeout(() => {
        handleComplete();
      }, 2500);
      return () => clearTimeout(timer);
    }
  }, [currentScene, showContent, isTransitioning, isLastScene]);

  // 시나리오 튜토리얼 트리거
  useEffect(() => {
    if (showContent && !tutorialTriggered.current && !isScenarioTutorialCompleted()) {
      tutorialTriggered.current = true;
      const timer = setTimeout(() => {
        startScenarioTutorial();
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [showContent, startScenarioTutorial, isScenarioTutorialCompleted]);

  // 씬 이동
  const goToScene = useCallback((sceneIdOrIndex: string | number) => {
    setIsTransitioning(true);
    setShowChoices(false);
    setShowContent(false);

    setTimeout(() => {
      if (typeof sceneIdOrIndex === 'number') {
        setCurrentSceneIndex(sceneIdOrIndex);
      } else {
        const index = findSceneIndex(sceneIdOrIndex);
        setCurrentSceneIndex(index);
      }
      setIsTransitioning(false);
    }, 400);
  }, [findSceneIndex]);

  // 선택지 처리
  const handleChoice = (choice: ScenarioChoice) => {
    // 프리미엄 선택지
    if (choice.isPremium) {
      setPendingPremiumChoice(choice);
      setShowPremiumModal(true);
      onPremiumChoice?.(choice);
      return;
    }

    processChoice(choice);
  };

  // 선택지 처리 (실제 로직)
  const processChoice = (choice: ScenarioChoice) => {
    // 히스토리에 선택 추가
    setHistory(prev => [...prev, {
      sceneId: currentScene.id,
      type: 'choice',
      speaker: '나',
      text: choice.text,
    }]);

    // 선택 기록
    const record: ChoiceRecord = {
      sceneId: currentScene.id,
      choiceId: choice.id,
      choiceText: choice.text,
      affectionChange: choice.affectionChange || 0,
      isPremium: choice.isPremium,
    };
    setChoicesMade(prev => [...prev, record]);

    // 콜백 호출
    onChoice?.(choice, currentScene.id);

    setShowChoices(false);

    // 호감도 처리
    const affection = choice.affectionChange ?? 0;
    if (affection !== 0) {
      const newTotal = totalAffection + affection;
      setTotalAffection(newTotal);

      if (affection > 0) {
        setHeartAmount(affection);
        setShowHeartEffect(true);
        setTimeout(() => setShowHeartEffect(false), 1200);
      }

      onAffectionChange?.(affection, newTotal);
    }

    // 다음 씬으로 이동
    setTimeout(() => {
      if (choice.nextScene) {
        goToScene(choice.nextScene);
      } else {
        // 다음 씬이 없으면 순차적으로 진행
        if (currentSceneIndex < scenario.scenes.length - 1) {
          goToScene(currentSceneIndex + 1);
        } else {
          handleComplete();
        }
      }
    }, 400);
  };

  // 프리미엄 모달 - 일반 선택지로 계속
  const handleContinueWithFree = () => {
    setShowPremiumModal(false);
    setPendingPremiumChoice(null);

    const freeChoice = currentScene?.choices?.find(c => !c.isPremium);
    if (freeChoice) {
      processChoice(freeChoice);
    }
  };

  // 탭 처리 (선택지가 없을 때)
  const handleTap = () => {
    if (showChoices || isTransitioning || showPremiumModal || showHistoryPanel) return;
    if (currentScene?.choices && currentScene.choices.length > 0) return;

    // 마지막 씬이면 완료
    if (isLastScene) {
      handleComplete();
      return;
    }

    // 다음 씬으로
    if (currentSceneIndex < scenario.scenes.length - 1) {
      goToScene(currentSceneIndex + 1);
    }
  };

  // 시나리오 완료
  const handleComplete = () => {
    onComplete?.({
      affectionGained: totalAffection,
      choicesMade,
      characterId: character.id,
      characterName: character.name,
      completedAt: new Date(),
    });
  };

  if (!currentScene) return null;

  const isDark = theme === 'dark';

  return (
    <div
      className={`h-[100dvh] flex flex-col relative overflow-hidden ${isDark ? 'bg-zinc-950' : 'bg-white'}`}
      onClick={handleTap}
    >
      {/* 상단 UI - 히스토리 버튼 */}
      {showHistory && (
        <div className="absolute top-4 right-4 z-30">
          <button
            onClick={(e) => {
              e.stopPropagation();
              setShowHistoryPanel(true);
            }}
            className={`p-2.5 backdrop-blur-sm rounded-full border transition ${
              isDark
                ? 'bg-white/5 border-white/10 hover:bg-white/10'
                : 'bg-black/5 border-black/10 hover:bg-black/10'
            }`}
          >
            <History className={`w-5 h-5 ${isDark ? 'text-white/60' : 'text-black/60'}`} />
          </button>
        </div>
      )}

      {/* 메인 콘텐츠 영역 */}
      <div className="flex-1 flex flex-col items-center justify-center px-8 py-8 min-h-0 overflow-y-auto">
        {/* 호감도 이펙트 */}
        <AnimatePresence>
          {showHeartEffect && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: -20 }}
              exit={{ opacity: 0, y: -40 }}
              transition={{ duration: 0.8 }}
              className="absolute top-1/3 flex items-center gap-2"
            >
              <Heart className="w-6 h-6 text-rose-400 fill-rose-400" />
              <span className="text-lg font-medium text-rose-300">+{heartAmount}</span>
            </motion.div>
          )}
        </AnimatePresence>

        {/* 텍스트 */}
        <AnimatePresence mode="wait">
          {showContent && (
            <motion.div
              key={currentScene.id}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.5 }}
              className="max-w-md w-full text-center"
              data-tutorial="scenario-text"
            >
              {/* 나레이션 */}
              {currentScene.type === 'narration' && currentScene.text && (
                <p className={`text-base leading-loose mb-12 ${isDark ? 'text-white/50' : 'text-black/50'}`}>
                  {currentScene.text}
                </p>
              )}

              {/* 캐릭터 이미지 (character_appear 타입) */}
              {currentScene.type === 'character_appear' && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ duration: 0.4, ease: 'easeOut' }}
                  className="mb-8 flex justify-center"
                >
                  <div className="relative">
                    <div className="w-20 h-20 rounded-full overflow-hidden ring-2 ring-white/20 shadow-xl">
                      <img
                        src={character.image}
                        alt={character.name}
                        className="w-full h-full object-cover"
                      />
                    </div>
                    <div className="absolute inset-0 rounded-full bg-gradient-to-b from-white/10 to-transparent pointer-events-none" />
                  </div>
                </motion.div>
              )}

              {/* 대화 */}
              {currentScene.type === 'dialogue' && currentScene.text && (
                <div className="space-y-4">
                  <div className="flex items-center justify-center gap-2">
                    <SoundWave />
                    <p className={`text-sm tracking-wider ${isDark ? 'text-white/40' : 'text-black/40'}`}>
                      {currentScene.character || character.name}
                    </p>
                  </div>
                  <DialogueText
                    text={currentScene.text}
                    emotion={currentScene.expression || 'default'}
                    theme={theme}
                  />
                </div>
              )}

              {/* 전환 */}
              {currentScene.type === 'transition' && currentScene.transition && (
                <p className={`text-sm italic ${isDark ? 'text-white/30' : 'text-black/30'}`}>
                  {currentScene.transition}
                </p>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* 탭 힌트 */}
      {showContent && !showChoices && !isLastScene && (
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 0.3 }}
          transition={{ delay: 1 }}
          className={`py-4 text-center text-xs shrink-0 ${
            isDark ? 'text-white/30' : 'text-black/30'
          }`}
        >
          {tr.scenario.tapToContinue}
        </motion.p>
      )}

      {/* 선택지 */}
      <AnimatePresence>
        {showChoices && currentScene.choices && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="px-6 pb-8 space-y-3 shrink-0"
            data-tutorial="scenario-choices"
          >
            {currentScene.choices.map((choice, idx) => (
              <motion.button
                key={choice.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.1 }}
                onClick={(e) => {
                  e.stopPropagation();
                  handleChoice(choice);
                }}
                className={`w-full py-4 px-5 rounded-lg text-left transition-colors ${
                  choice.isPremium
                    ? 'bg-amber-900/20 border border-amber-700/30'
                    : isDark
                      ? 'bg-white/5 border border-white/10'
                      : 'bg-black/5 border border-black/10'
                }`}
              >
                <div className="flex items-center justify-between gap-4">
                  <span className={`text-sm ${
                    choice.isPremium
                      ? 'text-amber-200'
                      : isDark ? 'text-white/80' : 'text-black/80'
                  }`}>
                    {choice.text}
                  </span>

                  <div className="flex items-center gap-2 shrink-0">
                    {choice.affectionChange && choice.affectionChange > 0 && (
                      <span className="text-xs text-rose-400">+{choice.affectionChange}</span>
                    )}
                    {choice.isPremium && (
                      <Crown className="w-4 h-4 text-amber-500" />
                    )}
                  </div>
                </div>
              </motion.button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>

      {/* 히스토리 팝업 */}
      <AnimatePresence>
        {showHistoryPanel && (
          <HistoryPanel
            history={history}
            characterName={character.name}
            onClose={() => setShowHistoryPanel(false)}
            theme={theme}
            tr={tr}
          />
        )}
      </AnimatePresence>

      {/* 프리미엄 모달 */}
      <AnimatePresence>
        {showPremiumModal && (
          <PremiumModal
            onContinue={handleContinueWithFree}
            theme={theme}
            tr={tr}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

// ============================================
// 서브 컴포넌트
// ============================================

function SoundWave({ size = 'md' }: { size?: 'sm' | 'md' }) {
  const barCount = size === 'sm' ? 3 : 4;
  const heights = size === 'sm' ? [3, 6, 4] : [4, 8, 5, 7];
  const barWidth = size === 'sm' ? 1.5 : 2;
  const gap = size === 'sm' ? 1 : 1.5;

  return (
    <div className="flex items-center" style={{ gap: `${gap}px` }}>
      {heights.slice(0, barCount).map((h, i) => (
        <motion.div
          key={i}
          className="bg-purple-400 rounded-full"
          style={{ width: `${barWidth}px` }}
          animate={{
            height: [h, h * 0.4, h, h * 0.6, h],
          }}
          transition={{
            duration: 1.2,
            repeat: Infinity,
            delay: i * 0.15,
            ease: 'easeInOut',
          }}
        />
      ))}
    </div>
  );
}

function DialogueText({
  text,
  emotion,
  theme = 'dark',
}: {
  text: string;
  emotion: string;
  theme?: 'dark' | 'light';
}) {
  const isDark = theme === 'dark';

  const getEmotionStyle = () => {
    const baseColor = isDark ? 'text-white' : 'text-black';
    switch (emotion) {
      case 'surprised':
        return `${isDark ? 'text-amber-100' : 'text-amber-800'} text-2xl`;
      case 'soft':
        return `${isDark ? 'text-pink-100' : 'text-pink-800'} text-xl`;
      case 'vulnerable':
        return `${isDark ? 'text-blue-100' : 'text-blue-800'} text-xl italic`;
      case 'touched':
        return `${isDark ? 'text-rose-100' : 'text-rose-800'} text-xl`;
      case 'shy':
        return `${isDark ? 'text-pink-200' : 'text-pink-700'} text-lg`;
      case 'flustered':
        return `${isDark ? 'text-red-200' : 'text-red-700'} text-xl`;
      default:
        return `${baseColor} text-xl`;
    }
  };

  return (
    <motion.p
      className={`leading-relaxed whitespace-pre-line ${getEmotionStyle()}`}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
    >
      "{text}"
    </motion.p>
  );
}

function HistoryPanel({
  history,
  characterName,
  onClose,
  theme = 'dark',
  tr,
}: {
  history: HistoryItem[];
  characterName: string;
  onClose: () => void;
  theme?: 'dark' | 'light';
  tr: ReturnType<typeof useTranslations>;
}) {
  const isDark = theme === 'dark';

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={(e) => e.stopPropagation()}
      className={`fixed inset-0 z-50 flex flex-col ${isDark ? 'bg-black/95' : 'bg-white/95'}`}
    >
      <div className={`flex items-center justify-between px-4 py-4 border-b ${
        isDark ? 'border-white/10' : 'border-black/10'
      }`}>
        <h3 className={`font-medium ${isDark ? 'text-white' : 'text-black'}`}>{tr.scenario.previousChat}</h3>
        <button
          onClick={onClose}
          className={`p-2 rounded-full transition ${isDark ? 'hover:bg-white/10' : 'hover:bg-black/10'}`}
        >
          <X className={`w-5 h-5 ${isDark ? 'text-white/60' : 'text-black/60'}`} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
        {history.length === 0 ? (
          <p className={`text-center py-8 ${isDark ? 'text-white/30' : 'text-black/30'}`}>
            {tr.scenario.noHistoryYet}
          </p>
        ) : (
          history.map((item, idx) => (
            <div key={idx} className="space-y-1">
              {item.type === 'narration' ? (
                <p className={`text-sm italic leading-relaxed ${isDark ? 'text-white/40' : 'text-black/40'}`}>
                  {item.text}
                </p>
              ) : (
                <div className="space-y-1">
                  <span className={`text-xs ${isDark ? 'text-white/50' : 'text-black/50'}`}>
                    {item.speaker === '나' ? tr.scenario.me : item.speaker}
                  </span>
                  <p className={`text-sm leading-relaxed ${
                    item.speaker === '나'
                      ? 'text-blue-400'
                      : isDark ? 'text-white/80' : 'text-black/80'
                  }`}>
                    "{item.text}"
                  </p>
                </div>
              )}
            </div>
          ))
        )}
      </div>

      <div className={`px-4 py-4 border-t ${isDark ? 'border-white/10' : 'border-black/10'}`}>
        <button
          onClick={onClose}
          className={`w-full py-3 rounded-lg text-sm ${
            isDark ? 'bg-white/10 text-white/70' : 'bg-black/10 text-black/70'
          }`}
        >
          {tr.scenario.close}
        </button>
      </div>
    </motion.div>
  );
}

function PremiumModal({
  onContinue,
  theme = 'dark',
  tr,
}: {
  onContinue: () => void;
  theme?: 'dark' | 'light';
  tr: ReturnType<typeof useTranslations>;
}) {
  const isDark = theme === 'dark';

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={(e) => e.stopPropagation()}
      className={`fixed inset-0 z-50 flex items-center justify-center px-8 ${
        isDark ? 'bg-black/90' : 'bg-white/90'
      }`}
    >
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.95, opacity: 0 }}
        className="w-full max-w-xs text-center space-y-6"
      >
        <div className="w-16 h-16 mx-auto bg-amber-600 rounded-xl flex items-center justify-center">
          <Crown className="w-8 h-8 text-white" />
        </div>

        <div className="space-y-2">
          <h3 className={`text-xl font-semibold ${isDark ? 'text-white' : 'text-black'}`}>
            {tr.scenario.premiumChoice}
          </h3>
          <p className={`text-sm ${isDark ? 'text-white/50' : 'text-black/50'}`}>
            {tr.scenario.premiumHint}
          </p>
        </div>

        <button
          onClick={onContinue}
          className={`w-full py-3 rounded-lg text-sm ${
            isDark ? 'bg-white/10 text-white/70' : 'bg-black/10 text-black/70'
          }`}
        >
          {tr.scenario.continueWithFree}
        </button>
      </motion.div>
    </motion.div>
  );
}
