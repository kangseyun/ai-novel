export type SubscriptionTier = 'free' | 'standard' | 'lumin_pass' | 'founders_edition';

export interface PlanPricing {
  id: string;
  name: string;
  tier: Exclude<SubscriptionTier, 'free'>;
  interval: 'month' | 'year';
  /** Monthly USD value used for MRR calculations (yearly plans = price/12). */
  monthly_usd: number;
  /** Total Stripe charge in cents for a single billing cycle. */
  unit_amount_cents: number;
  /** Tagline shown in checkout / shop. */
  tagline: string;
  features: string[];
  popular?: boolean;
  /** Stripe price.lookup_key. Defaults to id, but kept explicit so legacy keys
   *  can be aliased without changing the plan identifier. */
  lookup_key: string;
  /** Marks legacy products kept only for grandfathered subscribers. New checkout
   *  flows must use the v2 lookup_keys ($49 PASS) per docs/STRATEGY.md. */
  legacy?: boolean;
}

/** One-time digital products (Founders Edition + future card packs / voice letters / etc).
 *  Distinct from PlanPricing because they don't recur. */
export interface OneTimeProductPricing {
  id: string;
  name: string;
  unit_amount_cents: number;
  tagline: string;
  features: string[];
  lookup_key: string;
  /** Tier to set on the user after purchase. Founders Edition only. */
  grants_tier?: Exclude<SubscriptionTier, 'free'>;
  /** Days of premium access granted (e.g. 365 for Founders). */
  grants_premium_days?: number;
  /** Soft-cap on inventory (e.g. 100 Founders slots). null = unlimited. */
  total_supply?: number | null;
}

export const SUBSCRIPTION_PRICING: Record<string, PlanPricing> = {
  // ─── New v2 catalog (3rd Pivot, 2026-05-06) — $49 PASS ───
  lumin_pass_monthly_v2: {
    id: 'lumin_pass_monthly_v2',
    name: 'LUMIN PASS',
    tier: 'lumin_pass',
    interval: 'month',
    monthly_usd: 49,
    unit_amount_cents: 4900,
    tagline: '7명 멤버 전체 + 단톡방 + 컴백 이벤트 풀 액세스',
    features: [
      '7명 멤버 전체 잠금 해제',
      '그룹 단톡방 (멤버끼리 케미)',
      '컴백 시즌 D-day 알림 + 단독 메시지',
      '음성 호명 + AI 셀카 무제한',
      '신규 시나리오 우선 공개',
      '광고 없음',
    ],
    popular: true,
    lookup_key: 'lumin_pass_monthly_v2',
  },
  lumin_pass_yearly_v2: {
    id: 'lumin_pass_yearly_v2',
    name: 'LUMIN PASS (연간)',
    tier: 'lumin_pass',
    interval: 'year',
    monthly_usd: 40.83, // 490 / 12
    unit_amount_cents: 49000, // $490/년
    tagline: '연간 결제 시 약 17% 할인',
    features: [
      'LUMIN PASS 모든 혜택',
      '연 결제 시 약 17% 할인 ($490/년)',
      '연 한정 시즌 카드 1장 보장',
    ],
    lookup_key: 'lumin_pass_yearly_v2',
  },
  standard_monthly: {
    id: 'standard_monthly',
    name: 'Standard',
    tier: 'standard',
    interval: 'month',
    monthly_usd: 19,
    unit_amount_cents: 1900,
    tagline: '멤버 전원 무제한 채팅 + 기본 음성',
    features: [
      '멤버 7명 전원 무제한 대화',
      '기본 음성 메시지',
      '일반 시나리오 (정기 업데이트)',
      '광고 없음',
    ],
    lookup_key: 'standard_monthly',
  },
  standard_yearly: {
    id: 'standard_yearly',
    name: 'Standard (연간)',
    tier: 'standard',
    interval: 'year',
    monthly_usd: 15.83, // 190 / 12
    unit_amount_cents: 19000, // $190/년
    tagline: '연간 결제 시 약 17% 할인',
    features: [
      'Standard 모든 혜택',
      '연 결제 시 약 17% 할인 ($190/년)',
    ],
    lookup_key: 'standard_yearly',
  },

  // ─── Legacy v1 catalog ($99 PASS) — kept for grandfathered subscribers only.
  // New checkout flows MUST use v2 keys above. ───
  lumin_pass_monthly: {
    id: 'lumin_pass_monthly',
    name: 'LUMIN PASS (legacy)',
    tier: 'lumin_pass',
    interval: 'month',
    monthly_usd: 99,
    unit_amount_cents: 9900,
    tagline: '구버전 가격 — 신규 가입 ❌',
    features: ['LUMIN PASS 모든 혜택 (구버전)'],
    lookup_key: 'lumin_pass_monthly',
    legacy: true,
  },
  lumin_pass_yearly: {
    id: 'lumin_pass_yearly',
    name: 'LUMIN PASS 연간 (legacy)',
    tier: 'lumin_pass',
    interval: 'year',
    monthly_usd: 82.5,
    unit_amount_cents: 99000, // $990/년
    tagline: '구버전 가격 — 신규 가입 ❌',
    features: ['LUMIN PASS 연간 (구버전)'],
    lookup_key: 'lumin_pass_yearly',
    legacy: true,
  },
};

/** One-time digital products. Founders Edition is the only one wired through Stripe
 *  initially; card packs / voice letters / custom scenarios land in later migrations
 *  alongside their UI/API. */
export const ONE_TIME_PRODUCTS: Record<string, OneTimeProductPricing> = {
  founders_edition: {
    id: 'founders_edition',
    name: 'LUMIN Founders Edition',
    unit_amount_cents: 49900, // $499
    tagline: '100석 한정 — Founders #001–100 + 1년 PASS + 시즌 1 풀세트',
    features: [
      'Founders #001–100 영구 번호',
      '1년 LUMIN PASS Annual 포함 ($490 가치)',
      '시즌 1 7명 Epic Card 풀세트',
      '음성 편지 4회 번들',
      '이름 크레딧 (앱 + 컴백 영상)',
      '얼리 액세스 (신규 멤버·시나리오·시즌 카드 4주 먼저)',
      'Founders 전용 프로필 프레임 + 채팅 폰트 색',
      '분기 1회 운영자 메시지 (Founders 단톡)',
    ],
    lookup_key: 'founders_edition',
    grants_tier: 'founders_edition',
    grants_premium_days: 365,
    total_supply: 100,
  },
};

/** @deprecated Welcome Offer ($49.50 PASS 50% off) is replaced by the new $49 PASS price.
 *  The offer is no longer eligible for new users; existing claimed records are kept for billing.
 *  See docs/STRATEGY.md (3rd Pivot — All-Digital Hybrid) §7. */
export const WELCOME_OFFER_DEPRECATED = true;
export const WELCOME_OFFER_PRICING: Record<string, PlanPricing & { original_unit_amount_cents: number; discount_percent: number }> = {
  welcome_lumin_pass_monthly: {
    id: 'welcome_lumin_pass_monthly',
    name: 'Welcome — LUMIN PASS Monthly (deprecated)',
    tier: 'lumin_pass',
    interval: 'month',
    monthly_usd: 49.5,
    unit_amount_cents: 4950,
    original_unit_amount_cents: 9900,
    discount_percent: 50,
    tagline: '신규 PASS $49 가격 도입으로 종료된 오퍼',
    features: [
      'LUMIN PASS 모든 혜택 (구버전)',
    ],
    popular: false,
    lookup_key: 'welcome_lumin_pass_monthly',
    legacy: true,
  },
};

/** Strategy target: docs/STRATEGY.md §6 — 60 active users (10 헤비 + 20 미들 + 30 캐주얼)
 *  for $20K+ ARR. Founders Edition target is 10/100 in the same period. */
export const PASS_MILESTONE_TARGET = 60;
export const FOUNDERS_MILESTONE_TARGET = 10;
export const FOUNDERS_TOTAL_SUPPLY = 100;

const LEGACY_PLAN_ALIAS: Record<string, string> = {
  // Old internal names → current default (v2)
  monthly: 'lumin_pass_monthly_v2',
  yearly: 'lumin_pass_yearly_v2',
  pro_monthly: 'lumin_pass_monthly_v2',
  pro_yearly: 'lumin_pass_yearly_v2',
  vip_monthly: 'lumin_pass_monthly_v2',
  vip_yearly: 'lumin_pass_yearly_v2',
};

export function lookupPlan(planIdOrLookupKey: string | null | undefined): PlanPricing | null {
  if (!planIdOrLookupKey) return null;
  if (SUBSCRIPTION_PRICING[planIdOrLookupKey]) return SUBSCRIPTION_PRICING[planIdOrLookupKey];
  if (WELCOME_OFFER_PRICING[planIdOrLookupKey]) return WELCOME_OFFER_PRICING[planIdOrLookupKey];
  const alias = LEGACY_PLAN_ALIAS[planIdOrLookupKey];
  if (alias && SUBSCRIPTION_PRICING[alias]) return SUBSCRIPTION_PRICING[alias];
  return null;
}

export function lookupOneTimeProduct(idOrLookupKey: string | null | undefined): OneTimeProductPricing | null {
  if (!idOrLookupKey) return null;
  return ONE_TIME_PRODUCTS[idOrLookupKey] ?? null;
}

export function planMonthlyUsd(planIdOrLookupKey: string | null | undefined): number {
  return lookupPlan(planIdOrLookupKey)?.monthly_usd ?? 0;
}

export function tierFromPlanId(planIdOrLookupKey: string | null | undefined): SubscriptionTier {
  if (!planIdOrLookupKey) return 'free';
  const oneTime = ONE_TIME_PRODUCTS[planIdOrLookupKey];
  if (oneTime?.grants_tier) return oneTime.grants_tier;
  return lookupPlan(planIdOrLookupKey)?.tier ?? 'free';
}

/** Public-facing catalog (excludes legacy products from new checkout flows). */
export function publicSubscriptionCatalog(): PlanPricing[] {
  return Object.values(SUBSCRIPTION_PRICING).filter(plan => !plan.legacy);
}
