'use client';

import { useRouter } from 'next/navigation';
import OnboardingC from '@/components/onboarding/variants/OnboardingC';

export default function TestOnboardingCPage() {
  const router = useRouter();

  return (
    <OnboardingC
      onComplete={() => router.push('/')}
      onSkip={() => router.push('/login')}
    />
  );
}
