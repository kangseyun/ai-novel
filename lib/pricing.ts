export type SubscriptionTier = 'free' | 'standard' | 'lumin_pass';

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
}

export const SUBSCRIPTION_PRICING: Record<string, PlanPricing> = {
  lumin_pass_monthly: {
    id: 'lumin_pass_monthly',
    name: 'LUMIN PASS',
    tier: 'lumin_pass',
    interval: 'month',
    monthly_usd: 99,
    unit_amount_cents: 9900,
    tagline: '7명 멤버 전체 + 단톡방 + 컴백 이벤트 풀 액세스',
    features: [
      '7명 멤버 전체 잠금 해제',
      '그룹 단톡방 (멤버끼리 케미)',
      '컴백 시즌 D-day 알림 + 단독 메시지',
      '멤버 생일 합창 음성 편지',
      '신규 시나리오 우선 공개',
      '광고 없음',
    ],
    popular: true,
    lookup_key: 'lumin_pass_monthly',
  },
  lumin_pass_yearly: {
    id: 'lumin_pass_yearly',
    name: 'LUMIN PASS (연간)',
    tier: 'lumin_pass',
    interval: 'year',
    monthly_usd: 82.5,
    unit_amount_cents: 99000, // $990/년
    tagline: '연간 결제 시 2개월 무료',
    features: [
      'LUMIN PASS 모든 혜택',
      '연 결제 시 약 17% 할인 ($990/년)',
      '연 한정 멤버 굿즈 디지털 카드',
    ],
    lookup_key: 'lumin_pass_yearly',
  },
  standard_monthly: {
    id: 'standard_monthly',
    name: 'Standard',
    tier: 'standard',
    interval: 'month',
    monthly_usd: 19,
    unit_amount_cents: 1900,
    tagline: '멤버 1명 선택 + 일반 시나리오',
    features: [
      '선택한 멤버 1명과 무제한 대화',
      '일반 시나리오 (정기 업데이트)',
      '광고 없음',
    ],
    lookup_key: 'standard_monthly',
  },
};

/** Welcome Offer: STRATEGY.md §5 "첫 7일 무조건 환불" + "Welcome Offer 50% off PASS". */
export const WELCOME_OFFER_PRICING: Record<string, PlanPricing & { original_unit_amount_cents: number; discount_percent: number }> = {
  welcome_lumin_pass_monthly: {
    id: 'welcome_lumin_pass_monthly',
    name: 'Welcome — LUMIN PASS Monthly',
    tier: 'lumin_pass',
    interval: 'month',
    monthly_usd: 49.5,
    unit_amount_cents: 4950,           // $49.50 (50% off)
    original_unit_amount_cents: 9900,  // $99.00
    discount_percent: 50,
    tagline: '가입 후 24시간 한정 — LUMIN PASS 50% 할인',
    features: [
      'LUMIN PASS 모든 혜택',
      '첫 달 50% 할인 ($49.50)',
      '7일 무조건 환불 보장',
    ],
    popular: true,
    lookup_key: 'welcome_lumin_pass_monthly',
  },
};

export const PASS_MILESTONE_TARGET = 10;

const LEGACY_PLAN_ALIAS: Record<string, string> = {
  monthly: 'lumin_pass_monthly',
  yearly: 'lumin_pass_yearly',
  pro_monthly: 'lumin_pass_monthly',
  pro_yearly: 'lumin_pass_yearly',
  vip_monthly: 'lumin_pass_monthly',
  vip_yearly: 'lumin_pass_yearly',
  standard_yearly: 'standard_monthly',
};

export function lookupPlan(planIdOrLookupKey: string | null | undefined): PlanPricing | null {
  if (!planIdOrLookupKey) return null;
  if (SUBSCRIPTION_PRICING[planIdOrLookupKey]) return SUBSCRIPTION_PRICING[planIdOrLookupKey];
  if (WELCOME_OFFER_PRICING[planIdOrLookupKey]) return WELCOME_OFFER_PRICING[planIdOrLookupKey];
  const alias = LEGACY_PLAN_ALIAS[planIdOrLookupKey];
  if (alias && SUBSCRIPTION_PRICING[alias]) return SUBSCRIPTION_PRICING[alias];
  return null;
}

export function planMonthlyUsd(planIdOrLookupKey: string | null | undefined): number {
  return lookupPlan(planIdOrLookupKey)?.monthly_usd ?? 0;
}

export function tierFromPlanId(planIdOrLookupKey: string | null | undefined): SubscriptionTier {
  return lookupPlan(planIdOrLookupKey)?.tier ?? 'free';
}
