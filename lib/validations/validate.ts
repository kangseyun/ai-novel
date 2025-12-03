/**
 * API 요청 검증 헬퍼
 */

import { NextResponse } from 'next/server';
import { z } from 'zod';

/**
 * 요청 데이터 검증
 */
export function validateRequest<T>(
  schema: z.ZodSchema<T>,
  data: unknown
): { success: true; data: T } | { success: false; response: NextResponse } {
  const result = schema.safeParse(data);

  if (!result.success) {
    const firstError = result.error.issues[0];
    return {
      success: false,
      response: NextResponse.json(
        {
          error: 'Validation failed',
          message: firstError.message,
          path: firstError.path.join('.'),
          code: firstError.code,
        },
        { status: 400 }
      ),
    };
  }

  return { success: true, data: result.data };
}

/**
 * 쿼리 파라미터 검증 (GET 요청용)
 */
export function validateQueryParams<T>(
  schema: z.ZodSchema<T>,
  searchParams: URLSearchParams
): { success: true; data: T } | { success: false; response: NextResponse } {
  // URLSearchParams를 객체로 변환
  const params: Record<string, string | string[]> = {};

  searchParams.forEach((value, key) => {
    const existing = params[key];
    if (existing) {
      if (Array.isArray(existing)) {
        existing.push(value);
      } else {
        params[key] = [existing, value];
      }
    } else {
      params[key] = value;
    }
  });

  // 숫자 타입 변환 (스키마에서 number로 정의된 필드)
  const processedParams = { ...params };
  for (const [key, value] of Object.entries(processedParams)) {
    if (typeof value === 'string' && !isNaN(Number(value))) {
      // 정수로 변환 가능한 경우
      if (Number.isInteger(Number(value))) {
        (processedParams as Record<string, unknown>)[key] = parseInt(value, 10);
      }
    }
  }

  return validateRequest(schema, processedParams);
}
