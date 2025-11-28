import mixpanel from 'mixpanel-browser';

export const initMixpanel = () => {
  if (typeof window !== 'undefined') {
    mixpanel.init('491f430384a1d50cd196880e5f4f9b6d', {
      debug: process.env.NODE_ENV === 'development',
      track_pageview: true,
      persistence: 'localStorage',
      ignore_dnt: true,
    });
  }
};

export const trackEvent = (name: string, props: Record<string, any> = {}) => {
  if (typeof window !== 'undefined') {
    mixpanel.track(name, props);
  }
};

export const identifyUser = (id: string, props: Record<string, any> = {}) => {
  if (typeof window !== 'undefined') {
    mixpanel.identify(id);
    if (Object.keys(props).length > 0) {
      mixpanel.people.set(props);
    }
  }
};
