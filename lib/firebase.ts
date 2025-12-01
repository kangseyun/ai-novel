import { initializeApp, getApps } from 'firebase/app';
import { getAnalytics, isSupported, Analytics, logEvent } from 'firebase/analytics';

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID,
};

// Initialize Firebase (singleton pattern)
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];

// Analytics (client-side only)
let analytics: Analytics | null = null;

export const initAnalytics = async (): Promise<Analytics | null> => {
  if (typeof window !== 'undefined' && !analytics) {
    const supported = await isSupported();
    if (supported) {
      analytics = getAnalytics(app);
    }
  }
  return analytics;
};

// Track custom events
export const trackEvent = async (
  eventName: string,
  eventParams?: Record<string, unknown>
): Promise<void> => {
  const analyticsInstance = await initAnalytics();
  if (analyticsInstance) {
    logEvent(analyticsInstance, eventName, eventParams);
  }
};

// Common event helpers
export const trackPageView = (pageName: string) =>
  trackEvent('page_view', { page_name: pageName });

export const trackLogin = (method: string) =>
  trackEvent('login', { method });

export const trackSignUp = (method: string) =>
  trackEvent('sign_up', { method });

export const trackScenarioStart = (personaId: string, scenarioType: string) =>
  trackEvent('scenario_start', { persona_id: personaId, scenario_type: scenarioType });

export const trackScenarioComplete = (personaId: string, scenarioType: string) =>
  trackEvent('scenario_complete', { persona_id: personaId, scenario_type: scenarioType });

export const trackDMOpen = (personaId: string) =>
  trackEvent('dm_open', { persona_id: personaId });

export const trackMessageSent = (personaId: string) =>
  trackEvent('message_sent', { persona_id: personaId });

export const trackPurchase = (itemId: string, price: number, currency: string = 'KRW') =>
  trackEvent('purchase', { item_id: itemId, value: price, currency });

export { app, analytics };
