import Stripe from 'stripe';

// Initialize Stripe only if the secret key is available
export const stripe = process.env.STRIPE_SECRET_KEY
  ? new Stripe(process.env.STRIPE_SECRET_KEY)
  : null;

// 클라이언트사이드 publishable key
export const getStripePublishableKey = () => {
  return process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!;
};

// 현재 모드 확인 (키 prefix로 판단)
export const isStripeTestMode = () => {
  const key = process.env.STRIPE_SECRET_KEY || '';
  return key.startsWith('sk_test_');
};
