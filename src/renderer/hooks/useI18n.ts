import { useState, useEffect, useCallback } from 'react';
import type { AppLocale } from '../stores/themeStore';
import { onLocaleChange } from '../stores/localeBridge';
import zhCN from '../locales/zh-CN.json';
import zhTW from '../locales/zh-TW.json';
import ja from '../locales/ja.json';
import ko from '../locales/ko.json';
import en from '../locales/en.json';

type LocaleDict = Record<string, string>;
type Key = keyof typeof zhCN;

const LOCALE_MAP: Record<AppLocale, LocaleDict> = {
  'zh-CN': zhCN as LocaleDict,
  'zh-TW': zhTW as LocaleDict,
  'ja': ja as LocaleDict,
  'ko': ko as LocaleDict,
  'en': en as LocaleDict,
};

let currentDict: LocaleDict = LOCALE_MAP['zh-CN'];
let listeners: Array<() => void> = [];

function notify() {
  listeners.forEach((l) => l());
}

export function setLocale(locale: AppLocale) {
  currentDict = LOCALE_MAP[locale] || LOCALE_MAP['zh-CN'];
  notify();
}

export function t(key: Key, params?: Record<string, string | number>): string {
  const template = currentDict[key] ?? key;
  if (!params) return template;
  return template.replace(/\{(\w+)\}/g, (_, name) => String(params[name] ?? `{${name}}`));
}

export function useI18n() {
  const [, setTick] = useState(0);

  useEffect(() => {
    const handler = () => setTick((n) => n + 1);
    listeners.push(handler);
    return () => {
      listeners = listeners.filter((l) => l !== handler);
    };
  }, []);

  const _t = useCallback((key: Key, params?: Record<string, string | number>) => t(key, params), []);

  return { t: _t };
}

// Listen for locale changes from themeStore (via localeBridge)
onLocaleChange((locale) => setLocale(locale as AppLocale));

// Detect initial locale from localStorage
try {
  const raw = localStorage.getItem('rlv_theme');
  if (raw) {
    const parsed = JSON.parse(raw);
    if (parsed.locale) setLocale(parsed.locale as AppLocale);
  }
} catch {}
