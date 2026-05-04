export interface PlanPricing {
  name: string;
  tier: 'standard' | 'lumin_pass';
  interval: 'month' | 'year';
  monthly_usd: number;
}

export const SUBSCRIPTION_PRICING: Record<string, PlanPricing> = {
  lumin_pass_monthly: { name: 'LUMIN PASS (Monthly)', tier: 'lumin_pass', interval: 'month', monthly_usd: 99 },
  lumin_pass_yearly:  { name: 'LUMIN PASS (Yearly)',  tier: 'lumin_pass', interval: 'year',  monthly_usd: 82.5 },
  standard_monthly:   { name: 'Standard (Monthly)',   tier: 'standard',   interval: 'month', monthly_usd: 19 },
  standard_yearly:    { name: 'Standard (Yearly)',    tier: 'standard',   interval: 'year',  monthly_usd: 15.83 },

  monthly: { name: 'Pro Membership (Monthly, legacy)', tier: 'standard', interval: 'month', monthly_usd: 9.99 },
  yearly:  { name: 'Pro Membership (Yearly, legacy)',  tier: 'standard', interval: 'year',  monthly_usd: 8.33 },
  pro_monthly: { name: 'Pro Membership (Monthly, legacy)', tier: 'standard', interval: 'month', monthly_usd: 9.99 },
  pro_yearly:  { name: 'Pro Membership (Yearly, legacy)',  tier: 'standard', interval: 'year',  monthly_usd: 8.33 },
  vip_monthly: { name: 'VIP Membership (Monthly, legacy)', tier: 'lumin_pass', interval: 'month', monthly_usd: 19.99 },
  vip_yearly:  { name: 'VIP Membership (Yearly, legacy)',  tier: 'lumin_pass', interval: 'year',  monthly_usd: 16.66 },
};

export const PASS_MILESTONE_TARGET = 10;

export function lookupPlan(planId: string | null | undefined): PlanPricing | null {
  if (!planId) return null;
  return SUBSCRIPTION_PRICING[planId] ?? null;
}

export function planMonthlyUsd(planId: string | null | undefined): number {
  return lookupPlan(planId)?.monthly_usd ?? 0;
}
