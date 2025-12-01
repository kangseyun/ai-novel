'use client';

import { useEffect } from 'react';
import { initAnalytics } from '@/lib/firebase';

export function FirebaseProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    initAnalytics();
  }, []);

  return <>{children}</>;
}
