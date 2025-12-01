'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Heart, RotateCcw, Check, Crown } from 'lucide-react';

interface ScenarioResultProps {
  affectionGained: number;
  selectedChoices: SelectedChoice[];
  characterName: string;
  characterImage: string;
  onRestart: () => void;
  onConfirm: () => void;
  restartCost?: number;
}

interface SelectedChoice {
  sceneId: string;
  choiceText: string;
  affectionChange: number;
  isPremium?: boolean;
}

export default function ScenarioResult({
  affectionGained,
  characterName,
  characterImage,
  onRestart,
  onConfirm,
  restartCost = 50,
}: ScenarioResultProps) {
  const [isConfirming, setIsConfirming] = useState(false);

  const handleConfirm = () => {
    setIsConfirming(true);
    setTimeout(() => {
      onConfirm();
    }, 1200);
  };

  return (
    <div className="min-h-screen bg-black flex flex-col items-center justify-center px-6">
      <AnimatePresence mode="wait">
        {!isConfirming ? (
          <motion.div
            key="result"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="w-full max-w-sm flex flex-col items-center"
          >
            {/* 캐릭터 이미지 */}
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: 0.1 }}
              className="relative mb-6"
            >
              <div className="w-28 h-28 rounded-full overflow-hidden ring-2 ring-white/10">
                <img
                  src={characterImage}
                  alt={characterName}
                  className="w-full h-full object-cover"
                />
              </div>
            </motion.div>

            {/* 캐릭터 이름 */}
            <motion.h2
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="text-xl font-medium text-white mb-2"
            >
              {characterName}
            </motion.h2>

            {/* 첫 만남 완료 텍스트 */}
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.3 }}
              className="text-white/40 text-sm mb-8"
            >
              첫 만남 완료
            </motion.p>

            {/* 호감도 */}
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: 0.4 }}
              className="flex items-center gap-2 px-5 py-2.5 bg-rose-500/10 border border-rose-500/20 rounded-full mb-12"
            >
              <Heart className="w-4 h-4 text-rose-400 fill-rose-400" />
              <span className="text-rose-300 font-medium">+{affectionGained}</span>
            </motion.div>

            {/* 버튼들 */}
            <div className="w-full space-y-3">
              <motion.button
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.5 }}
                whileTap={{ scale: 0.98 }}
                onClick={handleConfirm}
                className="w-full py-4 bg-white text-black rounded-xl font-medium flex items-center justify-center gap-2"
              >
                <Check className="w-5 h-5" />
                확정하기
              </motion.button>

              <motion.button
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.6 }}
                whileTap={{ scale: 0.98 }}
                onClick={onRestart}
                className="w-full py-4 bg-white/5 border border-white/10 rounded-xl text-white/60 font-medium flex items-center justify-center gap-2"
              >
                <RotateCcw className="w-4 h-4" />
                다시하기
                <span className="flex items-center gap-1 text-amber-400 text-sm ml-1">
                  <Crown className="w-3.5 h-3.5" />
                  {restartCost}
                </span>
              </motion.button>
            </div>
          </motion.div>
        ) : (
          <motion.div
            key="confirming"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="flex flex-col items-center"
          >
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
              className="w-10 h-10 border-2 border-white/30 border-t-white rounded-full mb-4"
            />
            <p className="text-white/50 text-sm">저장 중...</p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
