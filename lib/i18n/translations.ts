import * as ko from './locales/ko';
import * as en from './locales/en';

export type Locale = 'ko' | 'en';

export const translations = {
  ko: {
    common: ko.common,
    nav: ko.nav,
    feed: ko.feed,
    dm: ko.dm,
    notifications: ko.notifications,
    memory: ko.memory,
    profile: ko.profile,
    settings: ko.settings,
    auth: ko.auth,
    createPost: ko.createPost,
    profileEdit: ko.profileEdit,
    skeleton: ko.skeleton,
    scenario: ko.scenario,
    story: ko.story,
    onboarding: ko.onboarding,
    shop: ko.shop,
    hackedProfile: ko.hackedProfile,
  },
  en: {
    common: en.common,
    nav: en.nav,
    feed: en.feed,
    dm: en.dm,
    notifications: en.notifications,
    memory: en.memory,
    profile: en.profile,
    settings: en.settings,
    auth: en.auth,
    createPost: en.createPost,
    profileEdit: en.profileEdit,
    skeleton: en.skeleton,
    scenario: en.scenario,
    story: en.story,
    onboarding: en.onboarding,
    shop: en.shop,
    hackedProfile: en.hackedProfile,
  },
} as const;

export type TranslationKeys = typeof translations.ko;
