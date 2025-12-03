'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTutorialStore, TutorialStep } from '@/lib/stores/tutorial-store';

interface TargetRect {
  top: number;
  left: number;
  width: number;
  height: number;
}

interface TooltipPosition {
  top?: number;
  bottom?: number;
  left?: number;
  right?: number;
  transform?: string;
}

export default function SpotlightTutorial() {
  const { getCurrentStep, nextStep, skipTutorial, isActive, activeTutorialId, currentStepIndex, tutorials } =
    useTutorialStore();

  const [targetRect, setTargetRect] = useState<TargetRect | null>(null);
  const [isVisible, setIsVisible] = useState(false);
  const observerRef = useRef<MutationObserver | null>(null);
  const resizeObserverRef = useRef<ResizeObserver | null>(null);

  const currentStep = getCurrentStep();
  const tutorial = activeTutorialId ? tutorials[activeTutorialId] : null;
  const totalSteps = tutorial?.steps.length || 0;

  // 타겟 요소 위치 계산
  const updateTargetPosition = useCallback((step: TutorialStep | null) => {
    if (!step) {
      setTargetRect(null);
      return;
    }

    const target = document.querySelector(step.targetSelector);
    if (!target) {
      console.warn(`Tutorial target not found: ${step.targetSelector}`);
      setTargetRect(null);
      return;
    }

    const rect = target.getBoundingClientRect();
    const padding = step.padding ?? 8;

    setTargetRect({
      top: rect.top - padding,
      left: rect.left - padding,
      width: rect.width + padding * 2,
      height: rect.height + padding * 2,
    });
  }, []);

  // 스텝 변경 시 위치 업데이트
  useEffect(() => {
    if (!isActive()) {
      setIsVisible(false);
      return;
    }

    // 약간의 딜레이 후 표시 (DOM이 렌더링될 시간)
    const showTimer = setTimeout(() => {
      updateTargetPosition(currentStep);
      setIsVisible(true);
    }, 100);

    return () => clearTimeout(showTimer);
  }, [currentStep, isActive, updateTargetPosition]);

  // 윈도우 리사이즈/스크롤 시 위치 업데이트
  useEffect(() => {
    if (!isActive() || !currentStep) return;

    const handleUpdate = () => updateTargetPosition(currentStep);

    window.addEventListener('resize', handleUpdate);
    window.addEventListener('scroll', handleUpdate, true);

    // ResizeObserver로 타겟 요소 크기 변화 감지
    const target = document.querySelector(currentStep.targetSelector);
    if (target) {
      resizeObserverRef.current = new ResizeObserver(handleUpdate);
      resizeObserverRef.current.observe(target);
    }

    // MutationObserver로 DOM 변화 감지
    observerRef.current = new MutationObserver(handleUpdate);
    observerRef.current.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
    });

    return () => {
      window.removeEventListener('resize', handleUpdate);
      window.removeEventListener('scroll', handleUpdate, true);
      resizeObserverRef.current?.disconnect();
      observerRef.current?.disconnect();
    };
  }, [currentStep, isActive, updateTargetPosition]);

  // Auto-advance 처리
  useEffect(() => {
    if (!currentStep || currentStep.advanceOn !== 'auto') return;

    const delay = currentStep.autoDelay ?? 3000;
    const timer = setTimeout(() => {
      nextStep();
    }, delay);

    return () => clearTimeout(timer);
  }, [currentStep, nextStep]);

  // 타겟 요소 클릭 감지
  useEffect(() => {
    if (!currentStep || currentStep.advanceOn !== 'click') return;

    const target = document.querySelector(currentStep.targetSelector);
    if (!target) return;

    const handleClick = (e: Event) => {
      // 이벤트 버블링 허용
      setTimeout(() => {
        nextStep();
      }, 300);
    };

    target.addEventListener('click', handleClick);
    return () => target.removeEventListener('click', handleClick);
  }, [currentStep, nextStep]);

  // 툴팁 위치 계산
  const getTooltipPosition = (): TooltipPosition => {
    if (!targetRect || !currentStep) return {};

    const margin = 16;
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;

    switch (currentStep.position) {
      case 'top':
        return {
          bottom: viewportHeight - targetRect.top + margin,
          left: targetRect.left + targetRect.width / 2,
          transform: 'translateX(-50%)',
        };
      case 'bottom':
        return {
          top: targetRect.top + targetRect.height + margin,
          left: targetRect.left + targetRect.width / 2,
          transform: 'translateX(-50%)',
        };
      case 'left':
        return {
          top: targetRect.top + targetRect.height / 2,
          right: viewportWidth - targetRect.left + margin,
          transform: 'translateY(-50%)',
        };
      case 'right':
        return {
          top: targetRect.top + targetRect.height / 2,
          left: targetRect.left + targetRect.width + margin,
          transform: 'translateY(-50%)',
        };
      default:
        return {
          top: targetRect.top + targetRect.height + margin,
          left: targetRect.left + targetRect.width / 2,
          transform: 'translateX(-50%)',
        };
    }
  };

  // 화살표 방향
  const getArrowClass = () => {
    switch (currentStep?.position) {
      case 'top':
        return 'bottom-0 left-1/2 -translate-x-1/2 translate-y-full border-l-8 border-r-8 border-t-8 border-l-transparent border-r-transparent border-t-white/90';
      case 'bottom':
        return 'top-0 left-1/2 -translate-x-1/2 -translate-y-full border-l-8 border-r-8 border-b-8 border-l-transparent border-r-transparent border-b-white/90';
      case 'left':
        return 'right-0 top-1/2 translate-x-full -translate-y-1/2 border-t-8 border-b-8 border-l-8 border-t-transparent border-b-transparent border-l-white/90';
      case 'right':
        return 'left-0 top-1/2 -translate-x-full -translate-y-1/2 border-t-8 border-b-8 border-r-8 border-t-transparent border-b-transparent border-r-white/90';
      default:
        return '';
    }
  };

  if (!isActive() || !isVisible || !targetRect) return null;

  const tooltipPosition = getTooltipPosition();

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[9999] pointer-events-auto">
        {/* 어두운 오버레이 with spotlight hole */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.3 }}
          className="absolute inset-0"
          style={{
            background: `radial-gradient(
              ellipse ${targetRect.width + 40}px ${targetRect.height + 40}px
              at ${targetRect.left + targetRect.width / 2}px ${targetRect.top + targetRect.height / 2}px,
              transparent 0%,
              transparent 70%,
              rgba(0, 0, 0, 0.85) 100%
            )`,
          }}
          onClick={(e) => {
            // 빈 영역 클릭 시 아무 동작 안함 (스킵 방지)
            e.stopPropagation();
          }}
        />

        {/* Spotlight 테두리 강조 */}
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.9 }}
          transition={{ duration: 0.3, delay: 0.1 }}
          className="absolute pointer-events-none"
          style={{
            top: targetRect.top,
            left: targetRect.left,
            width: targetRect.width,
            height: targetRect.height,
            borderRadius: 12,
            border: '2px solid rgba(255, 255, 255, 0.5)',
            boxShadow: '0 0 20px rgba(255, 255, 255, 0.3), 0 0 40px rgba(255, 255, 255, 0.1)',
          }}
        />

        {/* Pulsing 애니메이션 */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: [0.3, 0.6, 0.3] }}
          transition={{ duration: 2, repeat: Infinity }}
          className="absolute pointer-events-none"
          style={{
            top: targetRect.top - 4,
            left: targetRect.left - 4,
            width: targetRect.width + 8,
            height: targetRect.height + 8,
            borderRadius: 16,
            border: '2px solid rgba(255, 255, 255, 0.3)',
          }}
        />

        {/* 툴팁 */}
        <motion.div
          initial={{ opacity: 0, y: currentStep?.position === 'top' ? 10 : -10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.3, delay: 0.2 }}
          className="absolute max-w-[280px] pointer-events-auto"
          style={{
            ...tooltipPosition,
          }}
        >
          <div className="relative bg-white/95 backdrop-blur-sm text-gray-900 rounded-2xl px-5 py-4 shadow-2xl">
            {/* 화살표 */}
            <div className={`absolute w-0 h-0 ${getArrowClass()}`} />

            {/* 스텝 인디케이터 */}
            <div className="flex items-center gap-1.5 mb-2">
              {Array.from({ length: totalSteps }).map((_, i) => (
                <div
                  key={i}
                  className={`h-1.5 rounded-full transition-all ${
                    i === currentStepIndex ? 'w-4 bg-blue-500' : 'w-1.5 bg-gray-300'
                  }`}
                />
              ))}
            </div>

            {/* 메시지 */}
            <p className="text-sm font-medium leading-relaxed">{currentStep?.message}</p>
            {currentStep?.subMessage && (
              <p className="text-xs text-gray-500 mt-1">{currentStep.subMessage}</p>
            )}

            {/* 버튼 */}
            <div className="flex items-center justify-between mt-4 gap-3">
              <button
                onClick={skipTutorial}
                className="text-xs text-gray-400 hover:text-gray-600 transition"
              >
                건너뛰기
              </button>

              {currentStep?.advanceOn === 'click' ? (
                <span className="text-xs text-blue-500 font-medium">👆 위를 탭하세요</span>
              ) : (
                <button
                  onClick={nextStep}
                  className="px-4 py-1.5 bg-blue-500 hover:bg-blue-600 text-white text-sm font-medium rounded-full transition"
                >
                  {currentStepIndex === totalSteps - 1 ? '완료' : '다음'}
                </button>
              )}
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
