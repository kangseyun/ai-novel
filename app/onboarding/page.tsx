'use client';

import { Suspense, useEffect, useState, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import OnboardingA from '@/components/onboarding/variants/OnboardingA';
import OnboardingB from '@/components/onboarding/variants/OnboardingB';
import OnboardingC from '@/components/onboarding/variants/OnboardingC';
import { apiClient } from '@/lib/api-client';
import { useAuthStore } from '@/lib/stores/auth-store';
import analytics from '@/lib/analytics';

type Variant = 'a' | 'b' | 'c';

function getRandomVariant(): Variant {
  const variants: Variant[] = ['a', 'b', 'c'];
  return variants[Math.floor(Math.random() * variants.length)];
}

function OnboardingContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { setOnboardingCompleted } = useAuthStore();
  const [variant, setVariant] = useState<Variant | null>(null);
  const [affectionGained, setAffectionGained] = useState(0);
  const [choicesMade, setChoicesMade] = useState<Array<{ scene_id: string; choice_id: string }>>([]);
  const eventTrackedRef = useRef(false);

  useEffect(() => {
    // OAuth 콜백에서 토큰 처리
    const accessToken = searchParams.get('access_token');
    const refreshToken = searchParams.get('refresh_token');

    if (accessToken && refreshToken) {
      apiClient.setAccessToken(accessToken);
      localStorage.setItem('refresh_token', refreshToken);
    }

    const selectedVariant = getRandomVariant();
    setVariant(selectedVariant);

    // 온보딩 시작 이벤트 (중복 방지)
    if (!eventTrackedRef.current) {
      eventTrackedRef.current = true;
      analytics.trackOnboardingStart(selectedVariant);
    }
  }, [searchParams]);

  const handleComplete = async () => {
    // API가 있으면 온보딩 완료 처리
    const token = apiClient.getAccessToken();
    if (token) {
      try {
        await apiClient.completeOnboarding({
          variant: variant!,
          persona_id: 'jun',
          affection_gained: affectionGained,
          choices_made: choicesMade,
        });
        setOnboardingCompleted();

        // 온보딩 완료 이벤트 (variant 포함)
        analytics.trackOnboardingComplete('jun', variant || undefined);
      } catch (error) {
        console.error('Failed to complete onboarding:', error);
      }
    }
    router.push('/');
  };

  const handleSkip = () => {
    router.push('/login');
  };

  if (!variant) {
    return <div className="min-h-screen bg-black" />;
  }

  switch (variant) {
    case 'a':
      return <OnboardingA onComplete={handleComplete} onSkip={handleSkip} />;
    case 'b':
      return <OnboardingB onComplete={handleComplete} onSkip={handleSkip} />;
    case 'c':
      return <OnboardingC onComplete={handleComplete} onSkip={handleSkip} />;
  }
}

export default function OnboardingPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-black" />}>
      <OnboardingContent />
    </Suspense>
  );
}
