import { createI18n } from 'vue-i18n';
import type { Composer } from 'vue-i18n';
import {
  getInitialLocale,
  persistLocale,
  type AppLocale,
} from './constants';
import enUS from './en-US';
import zhCN from './zh-CN';

export const i18n = createI18n({
  legacy: false,
  locale: getInitialLocale(),
  fallbackLocale: 'zh-CN',
  messages: {
    'zh-CN': zhCN,
    'en-US': enUS,
  },
});

export function setAppLocale(locale: AppLocale): void {
  (i18n.global as Composer).locale.value = locale;
  persistLocale(locale);
}

export { getInitialLocale, persistLocale };
export type { AppLocale } from './constants';
