import Stripe from 'stripe';

// Initialize Stripe only if the secret key is available to avoid build-time/module-load errors.
// The API route will check for the instance and return a proper error if it's missing.
export const stripe = process.env.STRIPE_SECRET_KEY
  ? new Stripe(process.env.STRIPE_SECRET_KEY, {
      apiVersion: '2025-11-17.clover', // Use the latest stable version or match your dashboard
      typescript: true,
    })
  : null;
