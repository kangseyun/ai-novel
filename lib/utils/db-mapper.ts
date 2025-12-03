/**
 * Database Mapper Utilities
 * Supabase DB 레코드를 TypeScript 타입으로 변환하는 공통 유틸리티
 */

// ============================================
// 타입 정의
// ============================================

/**
 * snake_case DB 필드명을 camelCase로 변환
 */
type SnakeToCamel<S extends string> = S extends `${infer T}_${infer U}`
  ? `${T}${Capitalize<SnakeToCamel<U>>}`
  : S;

/**
 * DB 레코드 타입 (snake_case 필드)
 */
export type DBRecord = Record<string, unknown>;

/**
 * 필드 매핑 규칙 정의
 */
export interface FieldMapping<T> {
  /** DB 필드명 (snake_case) */
  dbField: string;
  /** 변환 함수 (선택적) */
  transform?: (value: unknown) => T;
  /** 기본값 (필드가 없거나 null일 때) */
  defaultValue?: T;
  /** 필수 필드 여부 */
  required?: boolean;
}

// ============================================
// 필드 변환 유틸리티
// ============================================

/**
 * 안전하게 문자열로 변환
 */
export function asString(value: unknown, defaultValue = ''): string {
  if (value === null || value === undefined) return defaultValue;
  return String(value);
}

/**
 * 안전하게 숫자로 변환
 */
export function asNumber(value: unknown, defaultValue = 0): number {
  if (value === null || value === undefined) return defaultValue;
  const num = Number(value);
  return isNaN(num) ? defaultValue : num;
}

/**
 * 안전하게 불리언으로 변환
 */
export function asBoolean(value: unknown, defaultValue = false): boolean {
  if (value === null || value === undefined) return defaultValue;
  return Boolean(value);
}

/**
 * 안전하게 Date로 변환
 */
export function asDate(value: unknown): Date {
  if (value instanceof Date) return value;
  if (typeof value === 'string' || typeof value === 'number') {
    return new Date(value);
  }
  return new Date();
}

/**
 * 안전하게 nullable Date로 변환
 */
export function asNullableDate(value: unknown): Date | null {
  if (value === null || value === undefined) return null;
  if (value instanceof Date) return value;
  if (typeof value === 'string' || typeof value === 'number') {
    const date = new Date(value);
    return isNaN(date.getTime()) ? null : date;
  }
  return null;
}

/**
 * 안전하게 배열로 변환
 */
export function asArray<T>(value: unknown, defaultValue: T[] = []): T[] {
  if (Array.isArray(value)) return value as T[];
  return defaultValue;
}

/**
 * 안전하게 객체로 변환
 */
export function asObject<T extends Record<string, unknown>>(
  value: unknown,
  defaultValue: T = {} as T
): T {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value as T;
  }
  return defaultValue;
}

/**
 * Enum 값으로 안전하게 변환
 */
export function asEnum<T extends string>(
  value: unknown,
  validValues: readonly T[],
  defaultValue: T
): T {
  if (typeof value === 'string' && validValues.includes(value as T)) {
    return value as T;
  }
  return defaultValue;
}

// ============================================
// 필드명 변환 유틸리티
// ============================================

/**
 * snake_case를 camelCase로 변환
 */
export function snakeToCamel(str: string): string {
  return str.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
}

/**
 * camelCase를 snake_case로 변환
 */
export function camelToSnake(str: string): string {
  return str.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);
}

// ============================================
// 매퍼 클래스
// ============================================

/**
 * Generic DB Mapper
 * DB 레코드를 타입 안전하게 도메인 객체로 변환
 */
export class DBMapper<T> {
  private mappings: Map<keyof T, FieldMapping<unknown>>;

  constructor(mappings: Partial<Record<keyof T, FieldMapping<unknown>>> = {}) {
    this.mappings = new Map(Object.entries(mappings) as [keyof T, FieldMapping<unknown>][]);
  }

  /**
   * 단일 DB 레코드를 도메인 객체로 변환
   */
  map(dbRecord: DBRecord): T {
    const result: Partial<T> = {};

    for (const [key, mapping] of this.mappings) {
      const dbValue = dbRecord[mapping.dbField];

      if (dbValue === undefined || dbValue === null) {
        if (mapping.required && mapping.defaultValue === undefined) {
          console.warn(`[DBMapper] Required field missing: ${mapping.dbField}`);
        }
        result[key] = mapping.defaultValue as T[keyof T];
      } else if (mapping.transform) {
        result[key] = mapping.transform(dbValue) as T[keyof T];
      } else {
        result[key] = dbValue as T[keyof T];
      }
    }

    return result as T;
  }

  /**
   * DB 레코드 배열을 도메인 객체 배열로 변환
   */
  mapMany(dbRecords: DBRecord[] | null | undefined): T[] {
    if (!dbRecords) return [];
    return dbRecords.map(record => this.map(record));
  }

  /**
   * 자동 snake_case → camelCase 변환 매핑
   */
  static auto<T>(dbRecord: DBRecord): T {
    const result: Record<string, unknown> = {};

    for (const [key, value] of Object.entries(dbRecord)) {
      const camelKey = snakeToCamel(key);

      // Date 변환 (ISO 문자열 감지)
      if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T/.test(value)) {
        result[camelKey] = new Date(value);
      } else {
        result[camelKey] = value;
      }
    }

    return result as T;
  }

  /**
   * 자동 변환으로 배열 매핑
   */
  static autoMany<T>(dbRecords: DBRecord[] | null | undefined): T[] {
    if (!dbRecords) return [];
    return dbRecords.map(record => DBMapper.auto<T>(record));
  }
}

// ============================================
// 미리 정의된 필드 매핑
// ============================================

/** ID 필드 매핑 */
export const idMapping: FieldMapping<string> = {
  dbField: 'id',
  transform: asString,
  required: true,
};

/** user_id 필드 매핑 */
export const userIdMapping: FieldMapping<string> = {
  dbField: 'user_id',
  transform: asString,
  required: true,
};

/** persona_id 필드 매핑 */
export const personaIdMapping: FieldMapping<string> = {
  dbField: 'persona_id',
  transform: asString,
  required: true,
};

/** created_at 필드 매핑 */
export const createdAtMapping: FieldMapping<Date> = {
  dbField: 'created_at',
  transform: asDate,
};

/** updated_at 필드 매핑 */
export const updatedAtMapping: FieldMapping<Date | null> = {
  dbField: 'updated_at',
  transform: asNullableDate,
};

// ============================================
// 헬퍼 함수
// ============================================

/**
 * 간단한 필드 매핑 생성
 */
export function field<T>(
  dbField: string,
  transform?: (value: unknown) => T,
  defaultValue?: T
): FieldMapping<T> {
  return { dbField, transform, defaultValue };
}

/**
 * 필수 필드 매핑 생성
 */
export function requiredField<T>(
  dbField: string,
  transform: (value: unknown) => T
): FieldMapping<T> {
  return { dbField, transform, required: true };
}

/**
 * nullable 필드 매핑 생성
 */
export function nullableField<T>(
  dbField: string,
  transform: (value: unknown) => T | null
): FieldMapping<T | null> {
  return { dbField, transform, defaultValue: null };
}
