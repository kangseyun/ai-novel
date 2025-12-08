'use client';

import { useState, useEffect, useCallback } from 'react';
import { apiClient } from '@/lib/api-client';

// dev 환경 체크
const isDev = process.env.NODE_ENV === 'development';

interface WelcomeOfferState {
  isEligible: boolean;
  isLoading: boolean;
  expiresAt: string | null;
  remainingSeconds: number;
  alreadyPurchased: boolean;
  showModal: boolean;
}

export function useWelcomeOffer() {
  const [state, setState] = useState<WelcomeOfferState>({
    isEligible: isDev, // dev에서는 기본적으로 eligible
    isLoading: !isDev, // dev에서는 로딩 스킵
    expiresAt: null,
    remainingSeconds: isDev ? 24 * 60 * 60 : 0, // dev에서는 24시간 기본값
    alreadyPurchased: false,
    showModal: false,
  });

  const checkEligibility = useCallback(async () => {
    // dev 환경에서는 항상 eligible
    if (isDev) {
      setState(prev => ({
        ...prev,
        isEligible: true,
        isLoading: false,
        remainingSeconds: 24 * 60 * 60, // 24시간
        alreadyPurchased: false,
      }));
      return;
    }

    try {
      setState(prev => ({ ...prev, isLoading: true }));
      const data = await apiClient.checkWelcomeOfferEligibility();

      setState({
        isEligible: data.eligible,
        isLoading: false,
        expiresAt: data.expiresAt,
        remainingSeconds: data.remainingSeconds,
        alreadyPurchased: data.alreadyPurchased,
        showModal: false, // 체크만 하고 모달은 따로 열기
      });
    } catch (error) {
      console.error('Failed to check welcome offer eligibility:', error);
      setState(prev => ({ ...prev, isLoading: false }));
    }
  }, []);

  const openModal = useCallback(() => {
    // dev에서는 항상 열림, prod에서는 eligible 체크
    if (isDev || state.isEligible) {
      setState(prev => ({ ...prev, showModal: true }));
    }
  }, [state.isEligible]);

  const closeModal = useCallback(() => {
    setState(prev => ({ ...prev, showModal: false }));
    // 모달을 닫을 때 로컬 스토리지에 기록 (나중에 다시 보여주지 않기 위해)
    if (typeof window !== 'undefined') {
      const dismissCount = parseInt(localStorage.getItem('welcome_offer_dismiss_count') || '0');
      localStorage.setItem('welcome_offer_dismiss_count', (dismissCount + 1).toString());
      localStorage.setItem('welcome_offer_dismissed_at', new Date().toISOString());
    }
  }, []);

  // 자동으로 모달을 열지 여부 판단
  const shouldAutoOpen = useCallback(() => {
    // dev 환경에서는 항상 자동으로 열기
    if (isDev) return true;

    if (typeof window === 'undefined') return false;

    const dismissCount = parseInt(localStorage.getItem('welcome_offer_dismiss_count') || '0');
    const dismissedAt = localStorage.getItem('welcome_offer_dismissed_at');

    // 3번 이상 닫았으면 더 이상 자동으로 보여주지 않음
    if (dismissCount >= 3) return false;

    // 마지막으로 닫은 지 1시간 이상 지나야 다시 보여줌
    if (dismissedAt) {
      const timeSinceDismiss = Date.now() - new Date(dismissedAt).getTime();
      if (timeSinceDismiss < 60 * 60 * 1000) return false; // 1시간 미만이면 보여주지 않음
    }

    return true;
  }, []);

  // 초기 로드 시 자격 확인
  useEffect(() => {
    checkEligibility();
  }, [checkEligibility]);

  // 남은 시간 업데이트
  useEffect(() => {
    if (!state.expiresAt || state.remainingSeconds <= 0) return;

    const timer = setInterval(() => {
      setState(prev => {
        if (prev.remainingSeconds <= 0) {
          clearInterval(timer);
          return { ...prev, isEligible: false };
        }
        return { ...prev, remainingSeconds: prev.remainingSeconds - 1 };
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [state.expiresAt]);

  return {
    ...state,
    checkEligibility,
    openModal,
    closeModal,
    shouldAutoOpen,
  };
}
