'use client';

import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import dynamic from 'next/dynamic';
import { useWelcomeOffer } from '@/hooks/useWelcomeOffer';
import { supabase } from '@/lib/supabase';

// dev 환경 체크
const isDev = process.env.NODE_ENV === 'development';

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
  const [hasShownOnce, setHasShownOnce] = useState(false);
  const [showFloatingCTA, setShowFloatingCTA] = useState(false);

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

  // 온보딩 완료 후 또는 메인 페이지 진입 시 자동으로 모달 표시
  useEffect(() => {
    // dev 환경에서는 항상 즉시 열기
    if (isDev) {
      if (!hasShownOnce) {
        const timer = setTimeout(() => {
          openModal();
          setHasShownOnce(true);
        }, 500); // dev에서는 0.5초 딜레이
        return () => clearTimeout(timer);
      }
      return;
    }

    if (isLoading || !isEligible || hasShownOnce) return;

    // URL 파라미터 확인 (온보딩에서 넘어온 경우)
    const urlParams = new URLSearchParams(window.location.search);
    const fromOnboarding = urlParams.get('from_onboarding') === 'true';
    const welcomeSuccess = urlParams.get('welcome_offer') === 'success';

    // 결제 성공 후에는 모달 표시하지 않음
    if (welcomeSuccess) return;

    // 온보딩에서 넘어왔거나, 자동 표시 조건 충족 시
    if (fromOnboarding || shouldAutoOpen()) {
      // 약간의 딜레이 후 모달 표시 (UX 향상)
      const timer = setTimeout(() => {
        openModal();
        setHasShownOnce(true);
      }, 1500);

      return () => clearTimeout(timer);
    }
  }, [isLoading, isEligible, hasShownOnce, openModal, shouldAutoOpen]);

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
