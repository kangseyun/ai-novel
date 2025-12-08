'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Crown, Heart, History, X, Loader2 } from 'lucide-react';
import {
  ScenarioScene,
  ONBOARDING_SPECIAL_SCENARIO,
} from '@/lib/onboarding-data';
import ScenarioResult from './ScenarioResult';
import { useTranslations } from '@/lib/i18n';
import { useScenarioData, ScenarioScene as DBScenarioScene } from '@/hooks/useOnboardingData';

interface OnboardingScenarioProps {
  scenarioId?: string | null;  // DB 시나리오 ID (옵션)
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

// 기본 캐릭터 정보 (폴백용)
const DEFAULT_CHARACTER_INFO = {
  id: 'jun',
  name: 'Jun',
  image: 'https://i.pravatar.cc/400?img=68',
};

// DB 시나리오 씬을 기존 형식으로 변환하는 함수
// API에서 이미 camelCase로 정규화되어 오므로 변환만 수행
function convertDBSceneToLocal(dbScene: DBScenarioScene, allScenes: DBScenarioScene[]): ScenarioScene {
  // character_appear 타입도 text가 있으면 dialogue처럼 취급
  const isDialogue = dbScene.type === 'dialogue' ||
    (dbScene.type === 'character_appear' && dbScene.text);

  // choice 타입이면 prompt를 narration처럼 표시
  const narrationText = dbScene.type === 'narration' ? dbScene.text :
    dbScene.type === 'choice' ? dbScene.prompt : undefined;

  // 다음 씬 ID 찾기 (choices가 없는 경우 순서대로)
  const currentIndex = allScenes.findIndex(s => s.id === dbScene.id);
  const nextScene = currentIndex >= 0 && currentIndex < allScenes.length - 1
    ? allScenes[currentIndex + 1] : null;

  // 마지막 씬이거나 choice 다음 씬들은 cliffhanger로 처리할지 결정
  const isLastScene = currentIndex === allScenes.length - 1;

  return {
    id: dbScene.id,
    background: dbScene.background || '',
    narration: narrationText,
    dialogue: isDialogue && dbScene.text ? {
      speaker: dbScene.character || 'Unknown',
      text: dbScene.text,
      emotion: dbScene.expression || 'default',
    } : undefined,
    choices: dbScene.choices?.map(c => ({
      id: c.id,
      text: c.text,
      nextSceneId: c.nextScene,
      affectionChange: c.affectionChange,
      isPremium: c.isPremium,
    })),
    // choices가 없고 다음 씬이 있으면 자동 진행
    nextSceneId: !dbScene.choices?.length && nextScene ? nextScene.id : undefined,
    // 마지막 씬이고 choices도 없으면 cliffhanger
    isCliffhanger: isLastScene && !dbScene.choices?.length,
    showCharacterImage: dbScene.type === 'character_appear',
    character: dbScene.character ? {
      image: '',
      position: 'center',
      expression: dbScene.expression || 'default',
    } : undefined,
  };
}

export default function OnboardingScenario({
  scenarioId,
  onProgress,
  onCliffhanger,
  onRestart,
  onConfirm,
}: OnboardingScenarioProps) {
  const tr = useTranslations();

  // DB에서 시나리오 가져오기
  const { scenario: dbScenario, isLoading: isLoadingScenario } = useScenarioData(scenarioId || null);

  // DB 시나리오를 로컬 형식으로 변환 (useMemo로 최적화)
  const scenarioScenes = useMemo(() => {
    const dbScenes = dbScenario?.content?.scenes || [];
    console.log('[OnboardingScenario] dbScenario:', dbScenario?.id, 'scenes count:', dbScenes.length);

    if (dbScenes.length > 0) {
      console.log('[OnboardingScenario] Converting DB scenes:', dbScenes.length, 'first scene:', dbScenes[0]);
      const converted = dbScenes.map((scene) => convertDBSceneToLocal(scene, dbScenes));
      console.log('[OnboardingScenario] Converted scenes:', converted.length, 'first converted:', converted[0]);
      return converted;
    }
    console.log('[OnboardingScenario] Using fallback ONBOARDING_SPECIAL_SCENARIO');
    return ONBOARDING_SPECIAL_SCENARIO;
  }, [dbScenario]);

  // 캐릭터 정보 (profileImageUrl을 우선 사용, 없으면 appearance.profile_image, 그것도 없으면 기본값)
  const characterInfo = dbScenario?.character
    ? {
        id: dbScenario.character.id,
        name: dbScenario.character.name,
        image: dbScenario.character.profileImageUrl
          || (dbScenario.character.appearance?.profile_image as string)
          || DEFAULT_CHARACTER_INFO.image,
      }
    : DEFAULT_CHARACTER_INFO;

  const [currentSceneId, setCurrentSceneId] = useState('');
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

  // 시나리오가 변경될 때 첫 번째 씬으로 시작
  useEffect(() => {
    if (scenarioScenes.length > 0) {
      const firstSceneId = scenarioScenes[0].id;
      console.log('[OnboardingScenario] Setting first scene:', firstSceneId, 'current:', currentSceneId);
      // 시나리오가 변경되었거나 아직 설정되지 않은 경우
      if (!currentSceneId || !scenarioScenes.find(s => s.id === currentSceneId)) {
        setCurrentSceneId(firstSceneId);
        setShowContent(false);
        setShowChoices(false);
        setHistory([]);
      }
    }
  }, [scenarioScenes]); // currentSceneId를 의존성에서 제외하여 무한 루프 방지

  const currentScene = scenarioScenes.find(s => s.id === currentSceneId);
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
        characterId: characterInfo.id,
        characterName: characterInfo.name,
        characterImage: characterInfo.image,
      });
    }
  };

  // 시나리오 로딩 중일 때
  if (isLoadingScenario) {
    return (
      <div className="h-[100dvh] bg-zinc-950 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-white/50" />
      </div>
    );
  }

  if (!currentScene) return null;

  // 결과 화면 표시
  if (showResult) {
    return (
      <ScenarioResult
        affectionGained={totalAffection}
        selectedChoices={selectedChoices}
        characterName={characterInfo.name}
        characterImage={characterInfo.image}
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

      {/* 메인 콘텐츠 영역 - 고정 위치 레이아웃 */}
      <div className="flex-1 flex flex-col px-8 min-h-0 overflow-hidden">
        {/* 상단 여백 - 화면의 약 30% */}
        <div className="h-[28%] shrink-0" />

        {/* 호감도 이펙트 */}
        <AnimatePresence>
          {showHeartEffect && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: -20 }}
              exit={{ opacity: 0, y: -40 }}
              transition={{ duration: 0.8 }}
              className="absolute top-[25%] left-1/2 -translate-x-1/2 flex items-center gap-2 z-20"
            >
              <Heart className="w-6 h-6 text-rose-400 fill-rose-400" />
              <span className="text-lg font-medium text-rose-300">+{heartAmount}</span>
            </motion.div>
          )}
        </AnimatePresence>

        {/* 텍스트 - 고정 시작 위치에서 아래로 확장 */}
        <div className="flex-1 flex flex-col items-center overflow-y-auto">
          <AnimatePresence mode="wait">
            {showContent && (
              <motion.div
                key={currentScene.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.4 }}
                className="max-w-md w-full text-center"
              >
                {/* 나레이션 */}
                {currentScene.narration && (
                  <p className="text-white/70 text-base leading-loose mb-10">
                    {currentScene.narration}
                  </p>
                )}

                {/* 캐릭터 프로필 이미지 (가끔만 표시) */}
                {currentScene.showCharacterImage && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ duration: 0.3, ease: 'easeOut' }}
                    className="mb-6 flex justify-center"
                  >
                    <div className="relative">
                      <div className="w-20 h-20 rounded-full overflow-hidden ring-2 ring-white/20 shadow-xl">
                        <img
                          src={characterInfo.image}
                          alt={currentScene.dialogue?.speaker || characterInfo.name}
                          className="w-full h-full object-cover"
                        />
                      </div>
                      <div className="absolute inset-0 rounded-full bg-gradient-to-b from-white/10 to-transparent pointer-events-none" />
                    </div>
                  </motion.div>
                )}

                {/* 대화 */}
                {currentScene.dialogue && (
                  <div className="space-y-3">
                    {/* 화자 + 사운드 웨이브 */}
                    <div className="flex items-center justify-center gap-2">
                      <SoundWave />
                      <p className="text-white/60 text-sm tracking-wider">
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
      </div>

      {/* 하단 영역 - 절대 위치로 고정하여 메인 콘텐츠에 영향 없음 */}
      <div className="absolute bottom-0 left-0 right-0 px-6 pb-8 pointer-events-none">
        {/* 탭 힌트 */}
        <AnimatePresence>
          {showContent && !showChoices && !currentScene.isCliffhanger && (
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.3 }}
              exit={{ opacity: 0 }}
              transition={{ delay: 1 }}
              className="py-6 text-center text-xs text-white/30"
            >
              {tr.scenario.tapToContinue}
            </motion.p>
          )}
        </AnimatePresence>

        {/* 선택지 */}
        <AnimatePresence>
          {showChoices && currentScene.choices && (
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 8 }}
              transition={{ duration: 0.25 }}
              className="pb-6 space-y-2.5 pointer-events-auto"
            >
              {currentScene.choices.map((choice, idx) => (
                <motion.button
                  key={choice.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: idx * 0.08 }}
                  onClick={(e) => {
                    e.stopPropagation();
                    handleChoice(choice);
                  }}
                  className={`w-full py-3.5 px-4 rounded-xl text-left transition-all active:scale-[0.98] ${
                    choice.isPremium
                      ? 'bg-amber-900/20 border border-amber-600/30'
                      : 'bg-white/5 border border-white/10 hover:bg-white/8'
                  }`}
                >
                  <div className="flex items-center justify-between gap-3">
                    <span className={`text-[15px] leading-snug ${
                      choice.isPremium ? 'text-amber-100' : 'text-white/90'
                    }`}>
                      {choice.text}
                    </span>

                    <div className="flex items-center gap-1.5 shrink-0">
                      {choice.affectionChange && choice.affectionChange > 0 && (
                        <span className="text-xs text-rose-400 font-medium">+{choice.affectionChange}</span>
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
      </div>

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
              <h3 className="text-white font-medium">{tr.scenario.previousChat}</h3>
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
                <p className="text-white/30 text-center py-8">{tr.scenario.noHistoryYet}</p>
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
                            {item.speaker === '나' ? tr.scenario.me : item.speaker}
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
                {tr.scenario.close}
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
                <h3 className="text-xl font-semibold text-white">{tr.scenario.premiumChoice}</h3>
                <p className="text-sm text-white/50">
                  {tr.scenario.premiumHint}
                </p>
              </div>

              <button
                onClick={handleContinueWithFree}
                className="w-full py-3 bg-white/10 rounded-lg text-white/70 text-sm"
              >
                {tr.scenario.continueWithFree}
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
  // 감정별 스타일 매핑 (더 밝은 색상)
  const getEmotionStyle = () => {
    switch (emotion) {
      case 'surprised':
        return 'text-amber-50 text-2xl';
      case 'soft':
        return 'text-pink-50 text-xl';
      case 'vulnerable':
        return 'text-blue-50 text-xl italic';
      case 'touched':
        return 'text-rose-50 text-xl';
      case 'shy':
        return 'text-pink-100 text-lg';
      case 'flustered':
        return 'text-red-100 text-xl';
      case 'curious':
        return 'text-purple-50 text-xl';
      case 'serious':
        return 'text-slate-50 text-2xl font-semibold';
      case 'hesitant':
        return 'text-gray-200 text-lg tracking-wider';
      case 'melancholy':
        return 'text-blue-100 text-xl';
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
