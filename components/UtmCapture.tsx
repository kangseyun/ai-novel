'use client';

import { useEffect } from 'react';
import { captureFromUrlIfNew } from '@/lib/utm-capture';

export function UtmCapture() {
  useEffect(() => {
    captureFromUrlIfNew();
  }, []);
  return null;
}
