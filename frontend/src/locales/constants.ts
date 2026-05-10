/** Persisted user language preference */
export const LOCALE_STORAGE_KEY = 'codec-siphon-locale';

export const SUPPORTED_LOCALES = ['zh-CN', 'en-US'] as const;
export type AppLocale = (typeof SUPPORTED_LOCALES)[number];

export function normalizeLocale(raw: string): AppLocale | null {
  const v = raw.trim().toLowerCase();
  if (v === 'zh-cn' || v === 'zh') return 'zh-CN';
  if (v === 'en-us' || v === 'en') return 'en-US';
  return null;
}

/** Browser UI language → app locale; unmatched → zh-CN */
export function resolveBrowserLocale(): AppLocale {
  if (typeof navigator === 'undefined') return 'zh-CN';
  const list = navigator.languages?.length
    ? navigator.languages
    : [navigator.language];
  for (const lang of list) {
    const l = (lang || '').toLowerCase();
    if (l.startsWith('zh')) return 'zh-CN';
    if (l.startsWith('en')) return 'en-US';
  }
  return 'zh-CN';
}

export function getInitialLocale(): AppLocale {
  try {
    const saved = localStorage.getItem(LOCALE_STORAGE_KEY);
    if (saved) {
      const n = normalizeLocale(saved);
      if (n) return n;
    }
  } catch {
    /* ignore */
  }
  return resolveBrowserLocale();
}

export function persistLocale(locale: AppLocale): void {
  try {
    localStorage.setItem(LOCALE_STORAGE_KEY, locale);
  } catch {
    /* ignore */
  }
}
