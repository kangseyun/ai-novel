'use client';

import { useRouter } from 'next/navigation';
import OnboardingB from '@/components/onboarding/variants/OnboardingB';

export default function TestOnboardingBPage() {
  const router = useRouter();

  return (
    <OnboardingB
      onComplete={() => router.push('/login')}
      onSkip={() => router.push('/login')}
    />
  );
}
