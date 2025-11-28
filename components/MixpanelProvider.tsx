'use client';

import { useEffect } from 'react';
import { initMixpanel } from '@/lib/mixpanel';

export default function MixpanelProvider() {
  useEffect(() => {
    initMixpanel();
  }, []);

  return null;
}
