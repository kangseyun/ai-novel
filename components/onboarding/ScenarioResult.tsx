'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Heart,
  Sparkles,
  RotateCcw,
  Check,
  Crown,
  Star,
  Lock,
  ChevronRight,
  AlertCircle,
} from 'lucide-react';

interface ScenarioResultProps {
  affectionGained: number;
  selectedChoices: SelectedChoice[];
  characterName: string;
  characterImage: string;
  onRestart: () => void;  // 다시하기 (유료)
  onConfirm: () => void;  // 확정하기
  restartCost?: number;   // 다시하기 비용 (코인)
}

interface SelectedChoice {
  sceneId: string;
  choiceText: string;
  affectionChange: number;
  isPremium?: boolean;
}

// 호감도에 따른 관계 등급
function getRelationshipGrade(affection: number): { grade: string; color: string; description: string } {
  if (affection >= 50) {
    return { grade: 'S', color: 'text-amber-400', description: '특별한 인연' };
  } else if (affection >= 35) {
    return { grade: 'A', color: 'text-purple-400', description: '깊은 호감' };
  } else if (affection >= 20) {
    return { grade: 'B', color: 'text-blue-400', description: '좋은 첫인상' };
  } else if (affection >= 10) {
    return { grade: 'C', color: 'text-green-400', description: '관심 시작' };
  } else {
    return { grade: 'D', color: 'text-gray-400', description: '무난한 시작' };
  }
}

export default function ScenarioResult({
  affectionGained,
  selectedChoices,
  characterName,
  characterImage,
  onRestart,
  onConfirm,
  restartCost = 50,
}: ScenarioResultProps) {
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [isConfirming, setIsConfirming] = useState(false);

  const relationshipGrade = getRelationshipGrade(affectionGained);

  const handleConfirm = () => {
    setIsConfirming(true);
    // 약간의 딜레이 후 확정
    setTimeout(() => {
      onConfirm();
    }, 1500);
  };

  return (
    <div className="min-h-screen bg-zinc-950 flex flex-col relative">
      {/* 헤더 */}
      <div className="px-6 pt-12 pb-6 text-center">
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-2"
        >
          <p className="text-white/40 text-sm">시나리오 완료</p>
          <h1 className="text-2xl font-bold text-white">첫 만남의 결과</h1>
        </motion.div>
      </div>

      {/* 메인 콘텐츠 */}
      <div className="flex-1 px-6 space-y-8 overflow-y-auto pb-32">
        {/* 캐릭터 & 등급 */}
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.2 }}
          className="flex flex-col items-center space-y-4"
        >
          {/* 캐릭터 이미지 */}
          <div className="relative">
            <div className="w-24 h-24 rounded-full overflow-hidden ring-4 ring-white/10">
              <img
                src={characterImage}
                alt={characterName}
                className="w-full h-full object-cover"
              />
            </div>
            {/* 등급 뱃지 */}
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: 0.5, type: 'spring', stiffness: 300 }}
              className={`absolute -bottom-2 -right-2 w-10 h-10 rounded-full bg-zinc-900 border-2 ${
                relationshipGrade.grade === 'S' ? 'border-amber-400' :
                relationshipGrade.grade === 'A' ? 'border-purple-400' :
                relationshipGrade.grade === 'B' ? 'border-blue-400' :
                'border-white/20'
              } flex items-center justify-center`}
            >
              <span className={`text-lg font-bold ${relationshipGrade.color}`}>
                {relationshipGrade.grade}
              </span>
            </motion.div>
          </div>

          {/* 캐릭터 이름 & 관계 */}
          <div className="text-center space-y-1">
            <h2 className="text-xl font-semibold text-white">{characterName}</h2>
            <p className={`text-sm ${relationshipGrade.color}`}>
              {relationshipGrade.description}
            </p>
          </div>

          {/* 호감도 */}
          <div className="flex items-center gap-2 px-4 py-2 bg-rose-500/10 border border-rose-500/20 rounded-full">
            <Heart className="w-4 h-4 text-rose-400 fill-rose-400" />
            <span className="text-rose-300 font-medium">+{affectionGained}</span>
          </div>
        </motion.div>

        {/* 선택 요약 */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="space-y-3"
        >
          <h3 className="text-white/60 text-sm font-medium px-1">당신의 선택</h3>

          <div className="space-y-2">
            {selectedChoices.map((choice, idx) => (
              <motion.div
                key={choice.sceneId}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.5 + idx * 0.1 }}
                className={`p-4 rounded-xl border ${
                  choice.isPremium
                    ? 'bg-amber-900/10 border-amber-700/30'
                    : 'bg-white/5 border-white/10'
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3">
                    <div className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 ${
                      choice.isPremium ? 'bg-amber-500/20' : 'bg-white/10'
                    }`}>
                      {choice.isPremium ? (
                        <Crown className="w-3.5 h-3.5 text-amber-400" />
                      ) : (
                        <span className="text-xs text-white/50">{idx + 1}</span>
                      )}
                    </div>
                    <p className={`text-sm leading-relaxed ${
                      choice.isPremium ? 'text-amber-200' : 'text-white/80'
                    }`}>
                      "{choice.choiceText}"
                    </p>
                  </div>
                  {choice.affectionChange > 0 && (
                    <span className="text-xs text-rose-400 shrink-0">
                      +{choice.affectionChange}
                    </span>
                  )}
                </div>
              </motion.div>
            ))}
          </div>
        </motion.div>

        {/* 영향 안내 */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.8 }}
          className="p-4 bg-purple-500/10 border border-purple-500/20 rounded-xl space-y-2"
        >
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-purple-400" />
            <span className="text-sm font-medium text-purple-300">스토리 영향</span>
          </div>
          <p className="text-xs text-white/50 leading-relaxed">
            이 선택은 {characterName}과의 관계와 앞으로의 스토리에 영향을 미칩니다.
            확정하면 되돌릴 수 없습니다.
          </p>
        </motion.div>
      </div>

      {/* 하단 버튼 */}
      <div className="absolute bottom-0 left-0 right-0 p-6 bg-gradient-to-t from-zinc-950 via-zinc-950 to-transparent">
        <div className="space-y-3 max-w-md mx-auto">
          {/* 확정하기 */}
          <motion.button
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 1 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => setShowConfirmModal(true)}
            className="w-full py-4 bg-gradient-to-r from-purple-500 to-pink-500 rounded-xl text-white font-medium flex items-center justify-center gap-2"
          >
            <Check className="w-5 h-5" />
            이 결과로 확정하기
          </motion.button>

          {/* 다시하기 */}
          <motion.button
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 1.1 }}
            whileTap={{ scale: 0.98 }}
            onClick={onRestart}
            className="w-full py-4 bg-white/5 border border-white/10 rounded-xl text-white/70 font-medium flex items-center justify-center gap-2"
          >
            <RotateCcw className="w-4 h-4" />
            처음부터 다시하기
            <span className="flex items-center gap-1 text-amber-400 text-sm">
              <Crown className="w-3.5 h-3.5" />
              {restartCost}
            </span>
          </motion.button>
        </div>
      </div>

      {/* 확정 확인 모달 */}
      <AnimatePresence>
        {showConfirmModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center px-6"
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="w-full max-w-sm bg-zinc-900 rounded-2xl p-6 space-y-6"
            >
              {!isConfirming ? (
                <>
                  {/* 경고 아이콘 */}
                  <div className="flex justify-center">
                    <div className="w-16 h-16 rounded-full bg-amber-500/10 flex items-center justify-center">
                      <AlertCircle className="w-8 h-8 text-amber-400" />
                    </div>
                  </div>

                  {/* 내용 */}
                  <div className="text-center space-y-2">
                    <h3 className="text-xl font-semibold text-white">정말 확정할까요?</h3>
                    <p className="text-sm text-white/50 leading-relaxed">
                      확정하면 이 선택은 영구적으로 저장됩니다.
                      <br />
                      {characterName}과의 관계가 이 결과를 바탕으로 시작됩니다.
                    </p>
                  </div>

                  {/* 요약 */}
                  <div className="p-3 bg-white/5 rounded-lg flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full overflow-hidden">
                        <img
                          src={characterImage}
                          alt={characterName}
                          className="w-full h-full object-cover"
                        />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-white">{characterName}</p>
                        <p className={`text-xs ${relationshipGrade.color}`}>
                          {relationshipGrade.description}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-1 text-rose-400">
                      <Heart className="w-4 h-4 fill-rose-400" />
                      <span className="text-sm font-medium">+{affectionGained}</span>
                    </div>
                  </div>

                  {/* 버튼 */}
                  <div className="space-y-2">
                    <button
                      onClick={handleConfirm}
                      className="w-full py-3 bg-gradient-to-r from-purple-500 to-pink-500 rounded-xl text-white font-medium"
                    >
                      확정하기
                    </button>
                    <button
                      onClick={() => setShowConfirmModal(false)}
                      className="w-full py-3 bg-white/5 rounded-xl text-white/60 text-sm"
                    >
                      취소
                    </button>
                  </div>
                </>
              ) : (
                /* 확정 중 애니메이션 */
                <div className="py-8 text-center space-y-4">
                  <motion.div
                    animate={{ rotate: 360 }}
                    transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                    className="w-12 h-12 mx-auto border-2 border-purple-500 border-t-transparent rounded-full"
                  />
                  <p className="text-white/60">스토리에 기록하는 중...</p>
                </div>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
