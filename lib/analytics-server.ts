/**
 * 서버사이드 애널리틱스
 *
 * Stripe Webhook 등 서버에서 직접 전환 이벤트 전송
 * - Meta Conversions API (CAPI)
 * - Mixpanel Server-side
 */

import crypto from 'crypto';

// ============ 타입 정의 ============

interface PurchaseEventData {
  userId: string;
  email?: string;
  value: number;
  currency: string;
  transactionId: string;
  items: Array<{
    id: string;
    name: string;
    price: number;
    quantity?: number;
  }>;
  eventSourceUrl?: string;
}

interface SubscribeEventData {
  userId: string;
  email?: string;
  planId: string;
  planName: string;
  value: number;
  currency: string;
  transactionId: string;
}

// ============ Meta Conversions API ============

const META_PIXEL_ID = process.env.NEXT_PUBLIC_META_PIXEL_ID;
const META_ACCESS_TOKEN = process.env.META_CONVERSIONS_API_TOKEN;
const META_API_VERSION = 'v18.0';

// SHA256 해시 함수 (Meta CAPI 요구사항)
function hashData(data: string): string {
  return crypto.createHash('sha256').update(data.toLowerCase().trim()).digest('hex');
}

async function sendMetaConversionEvent(
  eventName: string,
  eventData: {
    user_data: {
      em?: string; // hashed email
      external_id?: string; // hashed user id
      client_ip_address?: string;
      client_user_agent?: string;
    };
    custom_data?: Record<string, unknown>;
    event_source_url?: string;
    event_id?: string;
  }
) {
  if (!META_PIXEL_ID || !META_ACCESS_TOKEN) {
    console.log('[Analytics Server] Meta CAPI not configured');
    return;
  }

  const eventTime = Math.floor(Date.now() / 1000);
  const eventId = eventData.event_id || `${eventName}_${eventTime}_${Math.random().toString(36).substr(2, 9)}`;

  const payload = {
    data: [{
      event_name: eventName,
      event_time: eventTime,
      event_id: eventId,
      event_source_url: eventData.event_source_url || process.env.NEXT_PUBLIC_APP_URL,
      action_source: 'website',
      user_data: eventData.user_data,
      custom_data: eventData.custom_data,
    }],
  };

  try {
    const response = await fetch(
      `https://graph.facebook.com/${META_API_VERSION}/${META_PIXEL_ID}/events?access_token=${META_ACCESS_TOKEN}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      }
    );

    const result = await response.json();

    if (!response.ok) {
      console.error('[Analytics Server] Meta CAPI error:', result);
    } else {
      console.log(`[Analytics Server] Meta CAPI ${eventName} sent:`, result);
    }
  } catch (error) {
    console.error('[Analytics Server] Meta CAPI request failed:', error);
  }
}

// ============ Mixpanel Server-side ============

const MIXPANEL_TOKEN = process.env.NEXT_PUBLIC_MIXPANEL_TOKEN;

async function sendMixpanelEvent(
  eventName: string,
  distinctId: string,
  properties: Record<string, unknown>
) {
  if (!MIXPANEL_TOKEN) {
    console.log('[Analytics Server] Mixpanel not configured');
    return;
  }

  const payload = {
    event: eventName,
    properties: {
      token: MIXPANEL_TOKEN,
      distinct_id: distinctId,
      time: Date.now(),
      $insert_id: `${eventName}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      ...properties,
    },
  };

  try {
    const response = await fetch('https://api.mixpanel.com/track', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify([payload]),
    });

    if (!response.ok) {
      console.error('[Analytics Server] Mixpanel error:', await response.text());
    } else {
      console.log(`[Analytics Server] Mixpanel ${eventName} sent`);
    }
  } catch (error) {
    console.error('[Analytics Server] Mixpanel request failed:', error);
  }
}

// ============ 이벤트 헬퍼 함수 ============

/**
 * 구매 완료 이벤트 (서버사이드)
 */
export async function trackPurchaseServer(data: PurchaseEventData): Promise<void> {
  const eventId = `purchase_${data.transactionId}`;

  // Meta CAPI
  await sendMetaConversionEvent('Purchase', {
    event_id: eventId,
    user_data: {
      external_id: hashData(data.userId),
      em: data.email ? hashData(data.email) : undefined,
    },
    custom_data: {
      currency: data.currency,
      value: data.value,
      content_ids: data.items.map(i => i.id),
      content_name: data.items.map(i => i.name).join(', '),
      num_items: data.items.length,
      order_id: data.transactionId,
    },
    event_source_url: data.eventSourceUrl,
  });

  // Mixpanel
  await sendMixpanelEvent('Purchase', data.userId, {
    transaction_id: data.transactionId,
    value: data.value,
    currency: data.currency,
    items: data.items,
    source: 'server',
  });
}

/**
 * 구독 완료 이벤트 (서버사이드)
 */
export async function trackSubscribeServer(data: SubscribeEventData): Promise<void> {
  const eventId = `subscribe_${data.transactionId}`;

  // Meta CAPI
  await sendMetaConversionEvent('Subscribe', {
    event_id: eventId,
    user_data: {
      external_id: hashData(data.userId),
      em: data.email ? hashData(data.email) : undefined,
    },
    custom_data: {
      currency: data.currency,
      value: data.value,
      predicted_ltv: data.value * 12, // 예상 연간 가치
      content_name: data.planName,
      content_ids: [data.planId],
    },
  });

  // Mixpanel
  await sendMixpanelEvent('Subscribe', data.userId, {
    plan_id: data.planId,
    plan_name: data.planName,
    value: data.value,
    currency: data.currency,
    transaction_id: data.transactionId,
    source: 'server',
  });
}

/**
 * 회원가입 완료 이벤트 (서버사이드) - 필요시 사용
 */
export async function trackSignUpServer(userId: string, email?: string): Promise<void> {
  const eventId = `signup_${userId}`;

  // Meta CAPI
  await sendMetaConversionEvent('CompleteRegistration', {
    event_id: eventId,
    user_data: {
      external_id: hashData(userId),
      em: email ? hashData(email) : undefined,
    },
    custom_data: {
      status: 'success',
    },
  });

  // Mixpanel
  await sendMixpanelEvent('Sign Up', userId, {
    method: 'server',
    source: 'server',
  });
}

export default {
  trackPurchase: trackPurchaseServer,
  trackSubscribe: trackSubscribeServer,
  trackSignUp: trackSignUpServer,
};
