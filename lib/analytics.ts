/**
 * 통합 애널리틱스 이벤트 매니저
 *
 * 하나의 함수 호출로 모든 분석 플랫폼에 이벤트 전송:
 * - Mixpanel (프로덕트 분석)
 * - Firebase/GA4 (구글 애널리틱스)
 * - Meta Pixel (메타 광고 최적화)
 * - Airbridge (MMP, 앱 어트리뷰션)
 */

import mixpanel from 'mixpanel-browser';
import { logEvent, Analytics } from 'firebase/analytics';
import { initAnalytics as initFirebaseAnalytics } from './firebase';
import airbridge from 'airbridge-web-sdk-loader';

// ============ 타입 정의 ============

export interface AnalyticsConfig {
  mixpanel: boolean;
  firebase: boolean;
  metaPixel: boolean;
  airbridge: boolean;
}

export interface UserProperties {
  userId?: string;
  email?: string;
  name?: string;
  [key: string]: unknown;
}

export interface EventParams {
  [key: string]: unknown;
}

// ============ 이벤트 이름 매핑 ============
// 각 플랫폼별 표준 이벤트 이름이 다르므로 매핑 테이블 사용

type StandardEvent =
  | 'SignUp'
  | 'Login'
  | 'Purchase'
  | 'Subscribe'
  | 'InitiateCheckout'
  | 'ViewContent'
  | 'AddToCart'
  | 'Search'
  | 'Lead'
  | 'PageView';

interface EventMapping {
  mixpanel: string;
  firebase: string;
  metaPixel: string;
  airbridge: string;
}

const EVENT_MAP: Record<StandardEvent, EventMapping> = {
  SignUp: {
    mixpanel: 'Sign Up',
    firebase: 'sign_up',
    metaPixel: 'CompleteRegistration',
    airbridge: 'airbridge.user.signup',
  },
  Login: {
    mixpanel: 'Login',
    firebase: 'login',
    metaPixel: 'Lead', // Meta에는 Login 없음, Lead로 대체
    airbridge: 'airbridge.user.signin',
  },
  Purchase: {
    mixpanel: 'Purchase',
    firebase: 'purchase',
    metaPixel: 'Purchase',
    airbridge: 'airbridge.ecommerce.order.completed',
  },
  Subscribe: {
    mixpanel: 'Subscribe',
    firebase: 'subscribe', // GA4 커스텀
    metaPixel: 'Subscribe',
    airbridge: 'airbridge.subscribe',
  },
  InitiateCheckout: {
    mixpanel: 'Initiate Checkout',
    firebase: 'begin_checkout',
    metaPixel: 'InitiateCheckout',
    airbridge: 'airbridge.initiateCheckout',
  },
  ViewContent: {
    mixpanel: 'View Content',
    firebase: 'view_item',
    metaPixel: 'ViewContent',
    airbridge: 'airbridge.ecommerce.product.viewed',
  },
  AddToCart: {
    mixpanel: 'Add to Cart',
    firebase: 'add_to_cart',
    metaPixel: 'AddToCart',
    airbridge: 'airbridge.ecommerce.product.addedToCart',
  },
  Search: {
    mixpanel: 'Search',
    firebase: 'search',
    metaPixel: 'Search',
    airbridge: 'airbridge.ecommerce.searchResults.viewed',
  },
  Lead: {
    mixpanel: 'Lead',
    firebase: 'generate_lead',
    metaPixel: 'Lead',
    airbridge: 'airbridge.user.signup', // Airbridge에 Lead 없음, signup으로 대체
  },
  PageView: {
    mixpanel: 'Page View',
    firebase: 'page_view',
    metaPixel: 'PageView',
    airbridge: 'airbridge.ecommerce.home.viewed', // Airbridge에 PageView 없음, home.viewed로 대체
  },
};

// Meta Pixel 표준 이벤트 목록 (trackCustom vs track 구분용)
const META_STANDARD_EVENTS = [
  'PageView', 'ViewContent', 'Lead', 'CompleteRegistration',
  'AddToCart', 'InitiateCheckout', 'Purchase', 'Subscribe', 'Search',
  'AddPaymentInfo', 'AddToWishlist', 'Contact', 'CustomizeProduct',
  'Donate', 'FindLocation', 'Schedule', 'StartTrial', 'SubmitApplication',
];

// ============ 전역 상태 ============

let isInitialized = false;
let firebaseAnalytics: Analytics | null = null;

const config: AnalyticsConfig = {
  mixpanel: true,
  firebase: true,
  metaPixel: true,
  airbridge: true,
};

// ============ 초기화 ============

export const initAllAnalytics = async (): Promise<void> => {
  if (isInitialized || typeof window === 'undefined') return;

  try {
    // Mixpanel
    if (config.mixpanel && process.env.NEXT_PUBLIC_MIXPANEL_TOKEN) {
      mixpanel.init(process.env.NEXT_PUBLIC_MIXPANEL_TOKEN, {
        debug: process.env.NODE_ENV === 'development',
        track_pageview: false, // 수동 관리
        persistence: 'localStorage',
        ignore_dnt: true,
      });
    }

    // Firebase Analytics
    if (config.firebase) {
      firebaseAnalytics = await initFirebaseAnalytics();
    }

    // Airbridge
    if (config.airbridge && process.env.NEXT_PUBLIC_AIRBRIDGE_APP && process.env.NEXT_PUBLIC_AIRBRIDGE_WEB_TOKEN) {
      airbridge.init({
        app: process.env.NEXT_PUBLIC_AIRBRIDGE_APP,
        webToken: process.env.NEXT_PUBLIC_AIRBRIDGE_WEB_TOKEN,
        utmParsing: true,
      });
    }

    // Meta Pixel - 별도 Provider에서 초기화됨

    isInitialized = true;
    console.log('[Analytics] Initialized all platforms');
  } catch (error) {
    console.error('[Analytics] Init error:', error);
  }
};

// ============ 유저 식별 ============

export const identifyUser = (userId: string, properties?: UserProperties): void => {
  if (typeof window === 'undefined') return;

  try {
    // Mixpanel
    if (config.mixpanel) {
      mixpanel.identify(userId);
      if (properties) {
        mixpanel.people.set(properties);
      }
    }

    // Firebase - setUserId
    if (config.firebase && firebaseAnalytics) {
      import('firebase/analytics').then(({ setUserId, setUserProperties }) => {
        if (firebaseAnalytics) {
          setUserId(firebaseAnalytics, userId);
          if (properties) {
            setUserProperties(firebaseAnalytics, properties as Record<string, string>);
          }
        }
      });
    }

    // Airbridge
    if (config.airbridge) {
      airbridge.setUserID(userId);
      if (properties?.email) {
        airbridge.setUserEmail(properties.email as string);
      }
    }

    console.log('[Analytics] User identified:', userId);
  } catch (error) {
    console.error('[Analytics] Identify error:', error);
  }
};

// ============ 유저 초기화 (로그아웃) ============

export const resetUser = (): void => {
  if (typeof window === 'undefined') return;

  try {
    if (config.mixpanel) {
      mixpanel.reset();
    }
    if (config.airbridge) {
      airbridge.clearUser();
    }
    console.log('[Analytics] User reset');
  } catch (error) {
    console.error('[Analytics] Reset error:', error);
  }
};

// ============ 핵심: 통합 이벤트 전송 ============

/**
 * 표준 이벤트 전송 (플랫폼별 이벤트 이름 자동 매핑)
 * @param standardEvent - 표준 이벤트 키 (SignUp, Purchase 등)
 * @param params - 이벤트 파라미터
 */
export const trackStandard = (
  standardEvent: StandardEvent,
  params?: EventParams,
  options?: Partial<AnalyticsConfig>
): void => {
  if (typeof window === 'undefined') return;

  const platforms = { ...config, ...options };
  const mapping = EVENT_MAP[standardEvent];

  try {
    // 1. Mixpanel
    if (platforms.mixpanel) {
      mixpanel.track(mapping.mixpanel, params);
    }

    // 2. Firebase/GA4
    if (platforms.firebase && firebaseAnalytics) {
      logEvent(firebaseAnalytics, mapping.firebase, params);
    }

    // 3. Meta Pixel
    if (platforms.metaPixel && window.fbq) {
      if (META_STANDARD_EVENTS.includes(mapping.metaPixel)) {
        window.fbq('track', mapping.metaPixel, params);
      } else {
        window.fbq('trackCustom', mapping.metaPixel, params);
      }
    }

    // 4. Airbridge
    if (platforms.airbridge) {
      airbridge.events.send(mapping.airbridge, {
        customAttributes: params,
      });
    }

    if (process.env.NODE_ENV === 'development') {
      console.log(`[Analytics] Standard Event: ${standardEvent}`, {
        mixpanel: mapping.mixpanel,
        firebase: mapping.firebase,
        metaPixel: mapping.metaPixel,
        airbridge: mapping.airbridge,
        params,
      });
    }
  } catch (error) {
    console.error('[Analytics] Track standard error:', error);
  }
};

/**
 * 커스텀 이벤트 전송 (동일한 이벤트 이름으로 모든 플랫폼에 전송)
 * @param eventName - 커스텀 이벤트 이름
 * @param params - 이벤트 파라미터
 */
export const track = (
  eventName: string,
  params?: EventParams,
  options?: Partial<AnalyticsConfig>
): void => {
  if (typeof window === 'undefined') return;

  const platforms = { ...config, ...options };

  try {
    // 1. Mixpanel
    if (platforms.mixpanel) {
      mixpanel.track(eventName, params);
    }

    // 2. Firebase/GA4
    if (platforms.firebase && firebaseAnalytics) {
      // Firebase는 snake_case 권장
      const firebaseEventName = eventName.replace(/([A-Z])/g, '_$1').toLowerCase().replace(/^_/, '');
      logEvent(firebaseAnalytics, firebaseEventName, params);
    }

    // 3. Meta Pixel (커스텀 이벤트로 전송)
    if (platforms.metaPixel && window.fbq) {
      window.fbq('trackCustom', eventName, params);
    }

    // 4. Airbridge
    if (platforms.airbridge) {
      airbridge.events.send(eventName, {
        customAttributes: params,
      });
    }

    if (process.env.NODE_ENV === 'development') {
      console.log(`[Analytics] Custom Event: ${eventName}`, params);
    }
  } catch (error) {
    console.error('[Analytics] Track error:', error);
  }
};

// ============ 페이지뷰 ============

export const trackPageView = (pageName?: string): void => {
  trackStandard('PageView', { page_name: pageName || window.location.pathname });
};

// ============ 표준 이벤트 헬퍼 ============

// 회원가입
export const trackSignUp = (method: string): void => {
  trackStandard('SignUp', {
    method,
    status: 'success',
  });
};

// 로그인
export const trackLogin = (method: string): void => {
  trackStandard('Login', { method });
};

// 콘텐츠 조회
export const trackViewContent = (params: {
  contentId: string;
  contentName: string;
  contentType?: string;
  value?: number;
  currency?: string;
}): void => {
  trackStandard('ViewContent', {
    content_ids: [params.contentId],
    content_name: params.contentName,
    content_type: params.contentType || 'product',
    value: params.value,
    currency: params.currency || 'KRW',
  });
};

// 결제 시작
export const trackInitiateCheckout = (params: {
  items: Array<{ id: string; name: string; price: number }>;
  totalValue: number;
  currency?: string;
}): void => {
  trackStandard('InitiateCheckout', {
    content_ids: params.items.map(i => i.id),
    content_name: params.items.map(i => i.name).join(', '),
    num_items: params.items.length,
    value: params.totalValue,
    currency: params.currency || 'KRW',
  });
};

// 구매 완료
export const trackPurchase = (params: {
  transactionId?: string;
  items: Array<{ id: string; name: string; price: number }>;
  totalValue: number;
  currency?: string;
}): void => {
  trackStandard('Purchase', {
    transaction_id: params.transactionId,
    content_ids: params.items.map(i => i.id),
    content_name: params.items.map(i => i.name).join(', '),
    num_items: params.items.length,
    value: params.totalValue,
    currency: params.currency || 'KRW',
  });
};

// 구독
export const trackSubscribe = (params: {
  planId: string;
  planName: string;
  value: number;
  currency?: string;
}): void => {
  trackStandard('Subscribe', {
    plan_id: params.planId,
    plan_name: params.planName,
    value: params.value,
    currency: params.currency || 'KRW',
  });
};

// ============ 앱 특화 이벤트 (커스텀) ============

// 온보딩 시작 (A/B 테스트 variant 포함)
export const trackOnboardingStart = (variant?: string): void => {
  trackStandard('Lead', {
    content_name: 'onboarding_start',
    variant: variant,
  });
};

// 온보딩 완료 (A/B 테스트 variant 포함)
export const trackOnboardingComplete = (selectedPersonaId?: string, variant?: string): void => {
  track('OnboardingComplete', {
    persona_id: selectedPersonaId,
    variant: variant,
  });
};

// 스토리/시나리오 시작
export const trackStoryStart = (params: {
  personaId: string;
  personaName: string;
  episodeId?: string;
}): void => {
  track('StoryStart', {
    persona_id: params.personaId,
    persona_name: params.personaName,
    episode_id: params.episodeId,
  });
};

// 스토리/시나리오 완료
export const trackStoryComplete = (params: {
  personaId: string;
  personaName: string;
  episodeId?: string;
  durationSeconds?: number;
}): void => {
  track('StoryComplete', {
    persona_id: params.personaId,
    persona_name: params.personaName,
    episode_id: params.episodeId,
    duration_seconds: params.durationSeconds,
  });
};

// DM 열기
export const trackDMOpen = (personaId: string, personaName: string): void => {
  track('DMOpen', {
    persona_id: personaId,
    persona_name: personaName,
  });
};

// 메시지 전송
export const trackMessageSent = (personaId: string): void => {
  track('MessageSent', { persona_id: personaId });
};

// 캐릭터 언락
export const trackCharacterUnlock = (params: {
  personaId: string;
  personaName: string;
  unlockMethod: string;
}): void => {
  track('CharacterUnlock', {
    persona_id: params.personaId,
    persona_name: params.personaName,
    unlock_method: params.unlockMethod,
  });
};

// ============ 타입 선언 ============

declare global {
  interface Window {
    fbq: (type: string, eventName: string, params?: Record<string, unknown>) => void;
  }
}

// ============ 기본 내보내기 ============

const analytics = {
  init: initAllAnalytics,
  identify: identifyUser,
  reset: resetUser,

  // 이벤트 전송
  track,           // 커스텀 이벤트 (동일 이름으로 전송)
  trackStandard,   // 표준 이벤트 (플랫폼별 매핑)

  // 페이지뷰
  trackPageView,

  // 표준 이벤트 헬퍼
  trackSignUp,
  trackLogin,
  trackViewContent,
  trackInitiateCheckout,
  trackPurchase,
  trackSubscribe,

  // 앱 특화 (커스텀)
  trackOnboardingStart,
  trackOnboardingComplete,
  trackStoryStart,
  trackStoryComplete,
  trackDMOpen,
  trackMessageSent,
  trackCharacterUnlock,
};

export default analytics;
