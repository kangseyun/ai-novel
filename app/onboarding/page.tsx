'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import OnboardingA from '@/components/onboarding/variants/OnboardingA';
import OnboardingB from '@/components/onboarding/variants/OnboardingB';
import OnboardingC from '@/components/onboarding/variants/OnboardingC';

type Variant = 'a' | 'b' | 'c';

function getRandomVariant(): Variant {
  const variants: Variant[] = ['a', 'b', 'c'];
  return variants[Math.floor(Math.random() * variants.length)];
}

export default function OnboardingPage() {
  const router = useRouter();
  const [variant, setVariant] = useState<Variant | null>(null);

  useEffect(() => {
    setVariant(getRandomVariant());
  }, []);

  const handleComplete = () => {
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
