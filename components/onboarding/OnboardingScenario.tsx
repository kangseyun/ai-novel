'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Crown, Heart, History, X } from 'lucide-react';
import {
  ScenarioScene,
  ONBOARDING_SPECIAL_SCENARIO,
} from '@/lib/onboarding-data';
import ScenarioResult from './ScenarioResult';

interface OnboardingScenarioProps {
  onProgress: (affection: number, isPremiumTease: boolean) => void;
  onCliffhanger: () => void;
  onRestart?: () => void;  // 다시하기 콜백
  onConfirm?: (result: ScenarioResultData) => void;  // 확정하기 콜백
}

// 결과 데이터 타입
export interface ScenarioResultData {
  affectionGained: number;
  selectedChoices: SelectedChoice[];
  characterId: string;
  characterName: string;
  characterImage: string;
}

// 선택한 선택지 기록
interface SelectedChoice {
  sceneId: string;
  choiceText: string;
  affectionChange: number;
  isPremium?: boolean;
}

// 히스토리 아이템 타입
interface HistoryItem {
  sceneId: string;
  type: 'narration' | 'dialogue';
  speaker?: string;
  text: string;
  emotion?: string;
  isVoiced?: boolean;
}

// 캐릭터 정보 (Jun)
const CHARACTER_INFO = {
  id: 'jun',
  name: 'Jun',
  image: 'https://i.pravatar.cc/400?img=68',
};

export default function OnboardingScenario({
  onProgress,
  onCliffhanger,
  onRestart,
  onConfirm,
}: OnboardingScenarioProps) {
  const [currentSceneId, setCurrentSceneId] = useState('scene_1');
  const [showContent, setShowContent] = useState(false);
  const [showChoices, setShowChoices] = useState(false);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [showPremiumModal, setShowPremiumModal] = useState(false);
  const [showHeartEffect, setShowHeartEffect] = useState(false);
  const [heartAmount, setHeartAmount] = useState(0);

  // 히스토리 관련 상태
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [showHistory, setShowHistory] = useState(false);

  // 선택 기록 & 결과 화면
  const [selectedChoices, setSelectedChoices] = useState<SelectedChoice[]>([]);
  const [totalAffection, setTotalAffection] = useState(0);
  const [showResult, setShowResult] = useState(false);

  const currentScene = ONBOARDING_SPECIAL_SCENARIO.find(s => s.id === currentSceneId);
  const emotion = currentScene?.dialogue?.emotion || 'default';

  // 히스토리에 추가
  const addToHistory = useCallback((scene: ScenarioScene) => {
    const items: HistoryItem[] = [];

    if (scene.narration) {
      items.push({
        sceneId: scene.id,
        type: 'narration',
        text: scene.narration,
      });
    }

    if (scene.dialogue) {
      items.push({
        sceneId: scene.id,
        type: 'dialogue',
        speaker: scene.dialogue.speaker,
        text: scene.dialogue.text,
        emotion: scene.dialogue.emotion,
        isVoiced: true, // 대사는 TTS 대상
      });
    }

    if (items.length > 0) {
      setHistory(prev => [...prev, ...items]);
    }
  }, []);

  // 씬 진입 시 콘텐츠 표시 및 히스토리 기록
  useEffect(() => {
    if (!currentScene || isTransitioning) return;

    setShowContent(false);
    setShowChoices(false);

    const timer = setTimeout(() => {
      setShowContent(true);
      addToHistory(currentScene);
    }, 300);

    return () => clearTimeout(timer);
  }, [currentSceneId, currentScene, isTransitioning, addToHistory]);

  // 선택지 표시 / 자동 진행
  useEffect(() => {
    if (!currentScene || !showContent || isTransitioning) return;

    if (currentScene.choices && currentScene.choices.length > 0) {
      const timer = setTimeout(() => {
        setShowChoices(true);
      }, 800);
      return () => clearTimeout(timer);
    }

    if (currentScene.isCliffhanger) {
      const timer = setTimeout(() => {
        // 결과 화면 표시 (onConfirm이 있으면 결과 화면, 없으면 기존 클리프행어)
        if (onConfirm) {
          setShowResult(true);
        } else {
          onCliffhanger();
        }
      }, currentScene.delay || 2500);
      return () => clearTimeout(timer);
    }
  }, [currentScene, showContent, isTransitioning, onCliffhanger, onConfirm]);

  const goToScene = useCallback((sceneId: string) => {
    setIsTransitioning(true);
    setShowChoices(false);
    setShowContent(false);

    setTimeout(() => {
      setCurrentSceneId(sceneId);
      setIsTransitioning(false);
    }, 400);
  }, []);

  const handleChoice = (choice: NonNullable<ScenarioScene['choices']>[0]) => {
    if (choice.isPremium) {
      setShowPremiumModal(true);
      onProgress(0, true);
      return;
    }

    // 선택지도 히스토리에 추가
    setHistory(prev => [...prev, {
      sceneId: currentSceneId,
      type: 'dialogue',
      speaker: '나',
      text: choice.text,
    }]);

    // 선택 기록 저장
    setSelectedChoices(prev => [...prev, {
      sceneId: currentSceneId,
      choiceText: choice.text,
      affectionChange: choice.affectionChange || 0,
      isPremium: choice.isPremium,
    }]);

    setShowChoices(false);

    const affection = choice.affectionChange ?? 0;
    if (affection > 0) {
      setHeartAmount(affection);
      setShowHeartEffect(true);
      setTotalAffection(prev => prev + affection);
      setTimeout(() => setShowHeartEffect(false), 1200);
      onProgress(affection, false);
    }

    setTimeout(() => {
      goToScene(choice.nextSceneId);
    }, 400);
  };

  const handleContinueWithFree = () => {
    setShowPremiumModal(false);
    const freeChoice = currentScene?.choices?.find(c => !c.isPremium);
    if (freeChoice) {
      handleChoice(freeChoice);
    }
  };

  const handleTap = () => {
    if (showChoices || isTransitioning || showPremiumModal || showHistory || showResult) return;
    if (currentScene?.choices && currentScene.choices.length > 0) return;

    if (currentScene?.isCliffhanger) {
      if (onConfirm) {
        setShowResult(true);
      } else {
        onCliffhanger();
      }
      return;
    }
    if (currentScene?.nextSceneId) {
      goToScene(currentScene.nextSceneId);
    }
  };

  // 결과 화면 핸들러
  const handleResultRestart = () => {
    if (onRestart) {
      onRestart();
    }
  };

  const handleResultConfirm = () => {
    if (onConfirm) {
      onConfirm({
        affectionGained: totalAffection,
        selectedChoices,
        characterId: CHARACTER_INFO.id,
        characterName: CHARACTER_INFO.name,
        characterImage: CHARACTER_INFO.image,
      });
    }
  };

  if (!currentScene) return null;

  // 결과 화면 표시
  if (showResult) {
    return (
      <ScenarioResult
        affectionGained={totalAffection}
        selectedChoices={selectedChoices}
        characterName={CHARACTER_INFO.name}
        characterImage={CHARACTER_INFO.image}
        onRestart={handleResultRestart}
        onConfirm={handleResultConfirm}
        restartCost={50}
      />
    );
  }

  return (
    <div
      className="h-[100dvh] bg-zinc-950 flex flex-col relative overflow-hidden"
      onClick={handleTap}
    >
      {/* 상단 UI - 히스토리 버튼 */}
      <div className="absolute top-4 right-4 z-30">
        <button
          onClick={(e) => {
            e.stopPropagation();
            setShowHistory(true);
          }}
          className="p-2.5 bg-white/5 backdrop-blur-sm rounded-full border border-white/10 hover:bg-white/10 transition"
        >
          <History className="w-5 h-5 text-white/60" />
        </button>
      </div>

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
            >
              {/* 나레이션 */}
              {currentScene.narration && (
                <p className="text-white/50 text-base leading-loose mb-12">
                  {currentScene.narration}
                </p>
              )}

              {/* 캐릭터 프로필 이미지 (가끔만 표시) */}
              {currentScene.showCharacterImage && currentScene.character && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ duration: 0.4, ease: 'easeOut' }}
                  className="mb-8 flex justify-center"
                >
                  <div className="relative">
                    <div className="w-20 h-20 rounded-full overflow-hidden ring-2 ring-white/20 shadow-xl">
                      <img
                        src={currentScene.character.image}
                        alt={currentScene.dialogue?.speaker || 'Character'}
                        className="w-full h-full object-cover"
                      />
                    </div>
                    {/* 미묘한 글로우 효과 */}
                    <div className="absolute inset-0 rounded-full bg-gradient-to-b from-white/10 to-transparent pointer-events-none" />
                  </div>
                </motion.div>
              )}

              {/* 대화 */}
              {currentScene.dialogue && (
                <div className="space-y-4">
                  {/* 화자 + 사운드 웨이브 */}
                  <div className="flex items-center justify-center gap-2">
                    <SoundWave />
                    <p className="text-white/40 text-sm tracking-wider">
                      {currentScene.dialogue.speaker}
                    </p>
                  </div>

                  {/* 대사 - 감정에 따라 다른 스타일 */}
                  <DialogueText
                    text={currentScene.dialogue.text}
                    emotion={emotion}
                    isVoiced={true}
                  />
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* 탭 힌트 */}
      {showContent && !showChoices && !currentScene.isCliffhanger && (
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 0.3 }}
          transition={{ delay: 1 }}
          className="py-4 text-center text-xs text-white/30 shrink-0"
        >
          탭하여 계속
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
                    : 'bg-white/5 border border-white/10'
                }`}
              >
                <div className="flex items-center justify-between gap-4">
                  <span className={`text-sm ${
                    choice.isPremium ? 'text-amber-200' : 'text-white/80'
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
        {showHistory && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={(e) => e.stopPropagation()}
            className="fixed inset-0 z-50 bg-black/95 flex flex-col"
          >
            {/* 헤더 */}
            <div className="flex items-center justify-between px-4 py-4 border-b border-white/10">
              <h3 className="text-white font-medium">이전 대화</h3>
              <button
                onClick={() => setShowHistory(false)}
                className="p-2 hover:bg-white/10 rounded-full transition"
              >
                <X className="w-5 h-5 text-white/60" />
              </button>
            </div>

            {/* 히스토리 목록 */}
            <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
              {history.length === 0 ? (
                <p className="text-white/30 text-center py-8">아직 대화 기록이 없습니다</p>
              ) : (
                history.map((item, idx) => (
                  <div key={idx} className="space-y-1">
                    {item.type === 'narration' ? (
                      <p className="text-white/40 text-sm italic leading-relaxed">
                        {item.text}
                      </p>
                    ) : (
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          {item.isVoiced && (
                            <SoundWave size="sm" />
                          )}
                          <span className="text-xs text-white/50">
                            {item.speaker}
                          </span>
                        </div>
                        <p className={`text-sm leading-relaxed ${
                          item.speaker === '나'
                            ? 'text-blue-300'
                            : 'text-white/80'
                        }`}>
                          "{item.text}"
                        </p>
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>

            {/* 닫기 버튼 */}
            <div className="px-4 py-4 border-t border-white/10">
              <button
                onClick={() => setShowHistory(false)}
                className="w-full py-3 bg-white/10 rounded-lg text-white/70 text-sm"
              >
                닫기
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 프리미엄 모달 */}
      <AnimatePresence>
        {showPremiumModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={(e) => e.stopPropagation()}
            className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center px-8"
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
                <h3 className="text-xl font-semibold text-white">프리미엄 선택지</h3>
                <p className="text-sm text-white/50">
                  특별한 스토리를 경험할 수 있어요
                </p>
              </div>

              <button
                onClick={handleContinueWithFree}
                className="w-full py-3 bg-white/10 rounded-lg text-white/70 text-sm"
              >
                일반 선택지로 계속
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// 사운드 웨이브 컴포넌트 (미니멀한 노이즈 그래프)
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

// 감정에 따른 대사 컴포넌트
function DialogueText({
  text,
  emotion,
  isVoiced
}: {
  text: string;
  emotion: string;
  isVoiced?: boolean;
}) {
  // 감정별 스타일 매핑
  const getEmotionStyle = () => {
    switch (emotion) {
      case 'surprised':
        return 'text-amber-100 text-2xl';
      case 'soft':
        return 'text-pink-100 text-xl';
      case 'vulnerable':
        return 'text-blue-100 text-xl italic';
      case 'touched':
        return 'text-rose-100 text-xl';
      case 'shy':
        return 'text-pink-200 text-lg';
      case 'flustered':
        return 'text-red-200 text-xl';
      case 'curious':
        return 'text-purple-100 text-xl';
      case 'serious':
        return 'text-slate-100 text-2xl font-semibold';
      case 'hesitant':
        return 'text-gray-300 text-lg tracking-wider';
      case 'melancholy':
        return 'text-blue-200 text-xl';
      default:
        return 'text-white text-xl';
    }
  };

  // 감정별 애니메이션
  const getAnimation = () => {
    switch (emotion) {
      case 'flustered':
        return {
          animate: { x: [0, -2, 2, -1, 1, 0] },
          transition: { duration: 0.4, delay: 0.3 }
        };
      case 'vulnerable':
      case 'hesitant':
        return {
          animate: { opacity: [0.7, 1, 0.7] },
          transition: { duration: 2, repeat: Infinity }
        };
      case 'touched':
        return {
          animate: { scale: [1, 1.02, 1] },
          transition: { duration: 1.5, repeat: Infinity }
        };
      case 'surprised':
        return {
          initial: { scale: 0.9, opacity: 0 },
          animate: { scale: 1, opacity: 1 },
          transition: { type: 'spring' as const, stiffness: 300, damping: 15 }
        };
      default:
        return {};
    }
  };

  return (
    <div className="relative">
      {/* TTS 대상 텍스트는 좌측에 보라색 바 표시 */}
      {isVoiced && (
        <div className="absolute -left-4 top-0 bottom-0 w-0.5 bg-purple-500/50 rounded-full" />
      )}
      <motion.p
        className={`leading-relaxed whitespace-pre-line ${getEmotionStyle()}`}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        {...getAnimation()}
      >
        "{text}"
      </motion.p>
    </div>
  );
}
