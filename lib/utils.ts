import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * 큰 숫자를 간결하게 포맷 (SNS 스타일)
 * 예: 1234 → "1.2K", 1234567 → "1.2M"
 */
export function formatCompactNumber(num: number | string, locale: 'ko' | 'en' = 'ko'): string {
  const n = typeof num === 'string' ? parseInt(num.replace(/,/g, ''), 10) : num;

  if (isNaN(n)) return '0';

  if (locale === 'ko') {
    // 한국어: 만, 억 단위
    if (n >= 100000000) {
      return `${(n / 100000000).toFixed(1).replace(/\.0$/, '')}억`;
    }
    if (n >= 10000) {
      return `${(n / 10000).toFixed(1).replace(/\.0$/, '')}만`;
    }
    if (n >= 1000) {
      return n.toLocaleString('ko-KR');
    }
    return n.toString();
  } else {
    // 영어: K, M 단위
    if (n >= 1000000) {
      return `${(n / 1000000).toFixed(1).replace(/\.0$/, '')}M`;
    }
    if (n >= 1000) {
      return `${(n / 1000).toFixed(1).replace(/\.0$/, '')}K`;
    }
    return n.toString();
  }
}
