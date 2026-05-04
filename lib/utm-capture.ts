const STORAGE_KEY = 'lumin_utm_v1';
const UTM_KEYS = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term'] as const;

export interface CapturedAttribution {
  utm_source: string | null;
  utm_medium: string | null;
  utm_campaign: string | null;
  utm_content: string | null;
  utm_term: string | null;
  landing_path: string | null;
  first_referrer: string | null;
  captured_at: string;
}

export function captureFromUrlIfNew(): CapturedAttribution | null {
  if (typeof window === 'undefined') return null;

  const existing = readStored();
  if (existing) return existing;

  const params = new URLSearchParams(window.location.search);
  const utmFound = UTM_KEYS.some((k) => params.has(k));
  const referrer = document.referrer || null;
  if (!utmFound && !referrer) return null;

  const payload: CapturedAttribution = {
    utm_source: params.get('utm_source'),
    utm_medium: params.get('utm_medium'),
    utm_campaign: params.get('utm_campaign'),
    utm_content: params.get('utm_content'),
    utm_term: params.get('utm_term'),
    landing_path: window.location.pathname || null,
    first_referrer: referrer,
    captured_at: new Date().toISOString(),
  };

  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  } catch {
    /* storage unavailable; nothing to do */
  }
  return payload;
}

export function readStored(): CapturedAttribution | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as CapturedAttribution;
  } catch {
    return null;
  }
}

export function clearStored() {
  if (typeof window === 'undefined') return;
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* noop */
  }
}
