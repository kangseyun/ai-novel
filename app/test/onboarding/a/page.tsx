'use client';

import { useRouter } from 'next/navigation';
import OnboardingA from '@/components/onboarding/variants/OnboardingA';

export default function TestOnboardingAPage() {
  const router = useRouter();

  return (
    <OnboardingA
      onComplete={() => router.push('/')}
      onSkip={() => router.push('/login')}
    />
  );
}
