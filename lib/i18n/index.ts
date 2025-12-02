import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { translations, Locale, TranslationKeys } from './translations';

interface I18nState {
  locale: Locale;
  setLocale: (locale: Locale) => void;
}

export const useI18nStore = create<I18nState>()(
  persist(
    (set) => ({
      locale: 'ko',
      setLocale: (locale) => set({ locale }),
    }),
    {
      name: 'i18n-storage',
    }
  )
);

// Hook to get translations
export function useTranslations() {
  const locale = useI18nStore((state) => state.locale);
  return translations[locale];
}

// Hook to get current locale
export function useLocale() {
  return useI18nStore((state) => state.locale);
}

// Hook to set locale
export function useSetLocale() {
  return useI18nStore((state) => state.setLocale);
}

// Helper function to interpolate variables in translations
export function t(
  template: string,
  variables?: Record<string, string | number>
): string {
  if (!variables) return template;

  return template.replace(/\{(\w+)\}/g, (_, key) => {
    return variables[key]?.toString() ?? `{${key}}`;
  });
}

// Re-export types
export type { Locale, TranslationKeys };
export { translations };
