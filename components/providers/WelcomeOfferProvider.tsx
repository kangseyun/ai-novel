'use client';

import { createContext, useContext, useEffect, useState, ReactNode, useRef } from 'react';
import dynamic from 'next/dynamic';
import { useWelcomeOffer } from '@/hooks/useWelcomeOffer';
import { supabase } from '@/lib/supabase';
import { useTutorialStore } from '@/lib/stores/tutorial-store';

// localStorage 키
const WELCOME_MODAL_SHOWN_KEY = 'welcome-offer-modal-shown';

// 모달은 동적 로드 (번들 최적화)
const WelcomeOfferModal = dynamic(
  () => import('@/components/modals/WelcomeOfferModal'),
  { ssr: false }
);

const WelcomeOfferFloatingCTA = dynamic(
  () => import('@/components/modals/WelcomeOfferFloatingCTA'),
  { ssr: false }
);

interface WelcomeOfferContextValue {
  isEligible: boolean;
  isLoading: boolean;
  remainingSeconds: number;
  openModal: () => void;
  closeModal: () => void;
}

const WelcomeOfferContext = createContext<WelcomeOfferContextValue | null>(null);

export function useWelcomeOfferContext() {
  const context = useContext(WelcomeOfferContext);
  if (!context) {
    throw new Error('useWelcomeOfferContext must be used within WelcomeOfferProvider');
  }
  return context;
}

interface WelcomeOfferProviderProps {
  children: ReactNode;
}

export function WelcomeOfferProvider({ children }: WelcomeOfferProviderProps) {
  const {
    isEligible,
    isLoading,
    remainingSeconds,
    showModal,
    openModal,
    closeModal,
    shouldAutoOpen,
  } = useWelcomeOffer();

  const [userCreatedAt, setUserCreatedAt] = useState<string | undefined>();
  const [hasShownOnce, setHasShownOnce] = useState(() => {
    // localStorage에서 모달 표시 여부 확인
    if (typeof window !== 'undefined') {
      return localStorage.getItem(WELCOME_MODAL_SHOWN_KEY) === 'true';
    }
    return false;
  });
  const [showFloatingCTA, setShowFloatingCTA] = useState(() => {
    // 이미 모달을 본 적 있으면 플로팅 CTA 바로 표시
    if (typeof window !== 'undefined') {
      return localStorage.getItem(WELCOME_MODAL_SHOWN_KEY) === 'true';
    }
    return false;
  });
  const [isFromOnboarding, setIsFromOnboarding] = useState(false);
  const prevTutorialCompletedRef = useRef<boolean | null>(null);

  // 튜토리얼 상태 구독
  const isTutorialCompleted = useTutorialStore((state) =>
    state.completedTutorials.includes('initial-tutorial')
  );
  const isTutorialActive = useTutorialStore((state) => state.activeTutorialId !== null);

  // 유저 생성 시간 가져오기
  useEffect(() => {
    async function fetchUserCreatedAt() {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data } = await supabase
          .from('users')
          .select('created_at')
          .eq('id', user.id)
          .single();

        if (data?.created_at) {
          setUserCreatedAt(data.created_at);
        }
      }
    }

    fetchUserCreatedAt();
  }, []);

  // URL 파라미터 확인 (온보딩에서 넘어온 경우)
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const fromOnboarding = urlParams.get('from_onboarding') === 'true';
    if (fromOnboarding) {
      setIsFromOnboarding(true);
    }
  }, []);

  // 모달 표시 후 localStorage에 저장하는 헬퍼
  const markModalAsShown = () => {
    setHasShownOnce(true);
    localStorage.setItem(WELCOME_MODAL_SHOWN_KEY, 'true');
  };

  // 튜토리얼 완료 감지하여 모달 열기
  useEffect(() => {
    // 튜토리얼 완료 상태가 false → true로 변경되었을 때만 감지
    if (
      prevTutorialCompletedRef.current === false &&
      isTutorialCompleted &&
      isFromOnboarding &&
      !hasShownOnce &&
      isEligible &&
      !isLoading
    ) {
      // 튜토리얼 완료 직후 모달 표시
      const timer = setTimeout(() => {
        openModal();
        markModalAsShown();
      }, 500);
      return () => clearTimeout(timer);
    }

    prevTutorialCompletedRef.current = isTutorialCompleted;
  }, [isTutorialCompleted, isFromOnboarding, hasShownOnce, isEligible, isLoading, openModal]);

  // 온보딩 완료 후 또는 메인 페이지 진입 시 자동으로 모달 표시 (한 번만)
  useEffect(() => {
    // 이미 모달을 본 적 있으면 자동 표시하지 않음
    if (hasShownOnce) return;
    if (isLoading || !isEligible) return;

    // URL 파라미터 확인
    const urlParams = new URLSearchParams(window.location.search);
    const welcomeSuccess = urlParams.get('welcome_offer') === 'success';

    // 결제 성공 후에는 모달 표시하지 않음
    if (welcomeSuccess) return;

    // 온보딩에서 넘어온 경우: 튜토리얼 완료를 기다림
    if (isFromOnboarding) {
      // 튜토리얼이 이미 완료된 상태면 바로 표시
      if (isTutorialCompleted && !isTutorialActive) {
        const timer = setTimeout(() => {
          openModal();
          markModalAsShown();
        }, 500);
        return () => clearTimeout(timer);
      }
      // 튜토리얼 진행 중이면 완료를 기다림
      return;
    }

    // 기존 유저 (튜토리얼 이미 완료): 자동 표시
    if (shouldAutoOpen()) {
      const timer = setTimeout(() => {
        openModal();
        markModalAsShown();
      }, 1500);

      return () => clearTimeout(timer);
    }
  }, [isLoading, isEligible, hasShownOnce, openModal, shouldAutoOpen, isFromOnboarding, isTutorialCompleted, isTutorialActive]);

  // 모달 닫힐 때 플로팅 CTA 표시
  const handleCloseModal = () => {
    closeModal();
    // 모달을 닫으면 플로팅 CTA 표시
    setShowFloatingCTA(true);
  };

  // 플로팅 CTA 클릭 시 모달 다시 열기
  const handleFloatingCTAClick = () => {
    setShowFloatingCTA(false);
    openModal();
  };

  // 플로팅 CTA 완전히 닫기
  const handleFloatingCTADismiss = () => {
    setShowFloatingCTA(false);
  };

  return (
    <WelcomeOfferContext.Provider
      value={{
        isEligible,
        isLoading,
        remainingSeconds,
        openModal,
        closeModal: handleCloseModal,
      }}
    >
      {children}

      {/* 웰컴 오퍼 모달 */}
      <WelcomeOfferModal
        isOpen={showModal}
        onClose={handleCloseModal}
        userCreatedAt={userCreatedAt}
      />

      {/* 플로팅 CTA (모달 닫은 후 표시) */}
      <WelcomeOfferFloatingCTA
        isVisible={showFloatingCTA && isEligible && !showModal}
        remainingSeconds={remainingSeconds}
        onClick={handleFloatingCTAClick}
        onDismiss={handleFloatingCTADismiss}
      />
    </WelcomeOfferContext.Provider>
  );
}
