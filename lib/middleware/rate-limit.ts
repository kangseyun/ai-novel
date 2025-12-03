/**
 * Rate Limiting 미들웨어
 * 메모리 기반 구현 (프로덕션에서는 Redis 권장)
 */

import { NextResponse } from 'next/server';

// ============================================
// 타입 정의
// ============================================

interface RateLimitRecord {
  count: number;
  resetAt: number;
}

type RateLimitType = 'chat' | 'eventCheck' | 'memory' | 'default';

// ============================================
// Rate Limit 설정
// ============================================

const RATE_LIMITS: Record<RateLimitType, { limit: number; windowMs: number }> = {
  chat: { limit: 20, windowMs: 60000 },        // 분당 20회
  eventCheck: { limit: 60, windowMs: 60000 },  // 분당 60회
  memory: { limit: 30, windowMs: 60000 },      // 분당 30회
  default: { limit: 100, windowMs: 60000 },    // 분당 100회
};

// ============================================
// 메모리 기반 Rate Limiter
// ============================================

const requestCounts = new Map<string, RateLimitRecord>();

// 주기적 클린업 (5분마다 만료된 레코드 제거)
setInterval(() => {
  const now = Date.now();
  for (const [key, record] of requestCounts.entries()) {
    if (record.resetAt < now) {
      requestCounts.delete(key);
    }
  }
}, 300000);

/**
 * Rate Limit 체크
 */
export async function checkRateLimit(
  userId: string,
  type: RateLimitType = 'default'
): Promise<{ success: boolean; remaining: number; reset: number }> {
  const config = RATE_LIMITS[type] || RATE_LIMITS.default;
  const key = `${userId}:${type}`;
  const now = Date.now();

  let record = requestCounts.get(key);

  // 새 윈도우 시작
  if (!record || record.resetAt < now) {
    record = { count: 0, resetAt: now + config.windowMs };
    requestCounts.set(key, record);
  }

  record.count++;

  return {
    success: record.count <= config.limit,
    remaining: Math.max(0, config.limit - record.count),
    reset: record.resetAt,
  };
}

/**
 * Rate Limit 초과 응답
 */
export function rateLimitResponse(reset: number): NextResponse {
  const retryAfter = Math.ceil((reset - Date.now()) / 1000);

  return NextResponse.json(
    {
      error: 'Rate limit exceeded',
      message: '요청이 너무 많습니다. 잠시 후 다시 시도해주세요.',
      retryAfter,
    },
    {
      status: 429,
      headers: {
        'Retry-After': retryAfter.toString(),
        'X-RateLimit-Reset': reset.toString(),
      },
    }
  );
}

/**
 * Rate Limit 미들웨어 래퍼
 */
export async function withRateLimit(
  userId: string,
  type: RateLimitType = 'default'
): Promise<NextResponse | null> {
  const result = await checkRateLimit(userId, type);

  if (!result.success) {
    return rateLimitResponse(result.reset);
  }

  return null; // 통과
}

// ============================================
// Upstash Redis 버전 (프로덕션용, 환경변수 있을 때만)
// ============================================

let upstashLimiters: Map<RateLimitType, unknown> | null = null;

async function initUpstashLimiters(): Promise<boolean> {
  if (!process.env.UPSTASH_REDIS_REST_URL || !process.env.UPSTASH_REDIS_REST_TOKEN) {
    return false;
  }

  try {
    // Dynamic import로 @upstash/ratelimit 사용
    const { Ratelimit } = await import('@upstash/ratelimit');
    const { Redis } = await import('@upstash/redis');

    const redis = new Redis({
      url: process.env.UPSTASH_REDIS_REST_URL,
      token: process.env.UPSTASH_REDIS_REST_TOKEN,
    });

    upstashLimiters = new Map([
      ['chat', new Ratelimit({
        redis,
        limiter: Ratelimit.slidingWindow(20, '1 m'),
        prefix: 'ratelimit:chat',
      })],
      ['eventCheck', new Ratelimit({
        redis,
        limiter: Ratelimit.slidingWindow(60, '1 m'),
        prefix: 'ratelimit:event',
      })],
      ['memory', new Ratelimit({
        redis,
        limiter: Ratelimit.slidingWindow(30, '1 m'),
        prefix: 'ratelimit:memory',
      })],
      ['default', new Ratelimit({
        redis,
        limiter: Ratelimit.slidingWindow(100, '1 m'),
        prefix: 'ratelimit:default',
      })],
    ]);

    console.log('[RateLimit] Upstash Redis initialized');
    return true;
  } catch {
    console.log('[RateLimit] Upstash not available, using memory-based limiter');
    return false;
  }
}

// 초기화 시도 (비동기)
initUpstashLimiters();
