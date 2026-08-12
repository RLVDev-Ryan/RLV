export type AppLocale = 'zh-CN' | 'zh-TW' | 'ja' | 'ko' | 'en';

import { emitLocaleChange } from './localeBridge';
import { configStore } from './configStore';

// Default font is 黑体 (sans-serif); serif/Maple are downloaded on demand.
const LOCALE_FONT: Record<AppLocale, string> = {
  'zh-CN': 'Noto Sans CJK SC',
  'zh-TW': 'Noto Sans CJK TC',
  ja: 'Noto Sans CJK JP',
  ko: 'Noto Sans CJK KR',
  en: 'Noto Sans CJK SC',
};

export type FontZoneMode = 'global' | 'zone';

export interface ThemeSettings {
  mode: 'dark' | 'light';
  accentColor: string;
  bgImagePath: string | null;
  buttonMode: 'white' | 'transparent';
  fontFamily: string | null;
  fontMode: FontZoneMode;
  fontContent: string | null;
  fontButtons: string | null;
  fontLogs: string | null;
  locale: AppLocale;
}

const defaultTheme: ThemeSettings = {
  mode: 'light',
  accentColor: '#6b9bc0',
  bgImagePath: null,
  buttonMode: 'transparent',
  fontFamily: null,
  fontMode: 'global',
  fontContent: null,
  fontButtons: null,
  fontLogs: null,
  locale: 'zh-CN',
};

let current: ThemeSettings = { ...defaultTheme };
let lightAccent = defaultTheme.accentColor;
let _bgDataUrl: string | null = null; // cached data URL for the current bg image

export function getTheme(): ThemeSettings {
  return { ...current };
}

/** Seed theme state from the .js config files (after configStore.loadAll). */
export function hydrateFromConfig(): void {
  const color = configStore.get('color');
  const ui = configStore.get('ui');
  const picture = configStore.get('picture');
  const launcher = configStore.get('launcher');
  current = {
    ...defaultTheme,
    accentColor: color.accent,
    bgImagePath: picture.path || null,
    mode: ui.mode,
    buttonMode: ui.buttonMode,
    fontFamily: ui.fontFamily,
    fontMode: ui.fontMode,
    fontContent: ui.fontContent,
    fontButtons: ui.fontButtons,
    fontLogs: ui.fontLogs,
    locale: (launcher.language as AppLocale) || 'zh-CN',
  };
  if (current.mode !== 'dark') lightAccent = current.accentColor;
  applyTheme(current);
  loadBgImage().then(() => applyTheme(current));
}

export function setTheme(settings: Partial<ThemeSettings>): ThemeSettings {
  if (settings.mode === 'dark' && current.mode !== 'dark') {
    lightAccent = current.accentColor;
    settings.accentColor = '#242424';
  }

  if (settings.mode === 'light' && current.mode === 'dark') {
    settings.accentColor = lightAccent;
  }

  if (settings.accentColor && current.mode === 'dark' && !settings.mode) {
    lightAccent = settings.accentColor;
  }

  current = { ...current, ...settings };

  // Persist to .js config files (color.js / ui.js / picture.js / launcher.js).
  configStore.update('color', { accent: lightAccent });
  configStore.update('picture', { ...configStore.get('picture'), path: current.bgImagePath ?? '' });
  configStore.update('ui', {
    mode: current.mode,
    buttonMode: current.buttonMode,
    fontFamily: current.fontFamily,
    fontMode: current.fontMode,
    fontContent: current.fontContent,
    fontButtons: current.fontButtons,
    fontLogs: current.fontLogs,
  });
  configStore.update('launcher', { ...configStore.get('launcher'), language: current.locale });

  // Sync locale to i18n system
  if (settings.locale && typeof window !== 'undefined') {
    emitLocaleChange(current.locale);
  }

  // If bgImagePath changed, load the image async; then apply
  if ('bgImagePath' in settings) {
    loadBgImage().then(() => applyTheme(current));
  } else {
    applyTheme(current);
  }

  return { ...current };
}

export function applyTheme(settings: ThemeSettings): void {
  const root = document.documentElement;

  if (settings.mode === 'dark') {
    root.setAttribute('data-theme', 'dark');
  } else {
    root.setAttribute('data-theme', 'light');
  }

  const accent = settings.mode === 'dark' ? '#242424' : settings.accentColor;

  root.style.setProperty('--accent', accent);

  const r = parseInt(accent.slice(1, 3), 16);
  const g = parseInt(accent.slice(3, 5), 16);
  const b = parseInt(accent.slice(5, 7), 16);

  const hover = lighten(accent, 20);
  root.style.setProperty('--accent-hover', hover);
  root.style.setProperty('--accent-glow', `rgba(${r}, ${g}, ${b}, 0.25)`);
  root.style.setProperty('--accent-bg', `rgba(${r}, ${g}, ${b}, 0.10)`);

  // Background — use cached data URL if available
  if (_bgDataUrl) {
    const picture = configStore.get('picture');
    const size = picture.scaleMode === 'contain' ? 'contain' : picture.scaleMode === 'fill' ? '100% 100%' : 'cover';
    const bg = `url("${_bgDataUrl}") center/${size} fixed no-repeat`;
    root.style.background = bg;
    document.body.style.background = 'transparent';
    const rootDiv = document.getElementById('root');
    if (rootDiv) rootDiv.style.background = 'transparent';
  } else {
    root.style.background = '';
    document.body.style.background = '';
    const rootDiv = document.getElementById('root');
    if (rootDiv) rootDiv.style.background = '';
  }

  // UI config (radius / blur / opacity) — apply radius vars now; blur & opacity
  // are exposed as --ui-* vars for the (later) glassmorphism pass.
  const ui = configStore.get('ui');
  root.style.setProperty('--ui-radius', `${ui.radius}px`);
  root.style.setProperty('--ui-blur', `${ui.blur}px`);
  root.style.setProperty('--ui-opacity', String(ui.opacity));
  root.style.setProperty('--radius-sm', `${Math.max(2, ui.radius - 2)}px`);
  root.style.setProperty('--radius-md', `${ui.radius}px`);
  root.style.setProperty('--radius-lg', `${ui.radius + 4}px`);

  // Button mode
  if (settings.buttonMode === 'white') {
    root.setAttribute('data-btn-mode', 'white');
  } else {
    root.removeAttribute('data-btn-mode');
  }

  // Font — auto-select locale variant when using Noto Serif CJK
  const localeFont = LOCALE_FONT[settings.locale] || 'Noto Serif CJK SC';

  if (settings.fontMode === 'zone') {
    const content = settings.fontContent || localeFont;
    const buttons = settings.fontButtons || localeFont;
    const logs = settings.fontLogs || localeFont;
    root.style.setProperty('--font-content', `'${content}', 'Segoe UI', sans-serif`);
    root.style.setProperty('--font-buttons', `'${buttons}', 'Segoe UI', sans-serif`);
    root.style.setProperty('--font-logs', `'${logs}', 'SF Mono', 'Fira Code', monospace`);
    root.style.removeProperty('--app-font');
  } else {
    const preferedFont = settings.fontFamily || localeFont;
    root.style.setProperty('--app-font', `'${preferedFont}', 'Segoe UI', sans-serif`);
    root.style.removeProperty('--font-content');
    root.style.removeProperty('--font-buttons');
    root.style.removeProperty('--font-logs');
  }
  root.setAttribute('lang', settings.locale.replace('-', '-'));
}

/** Read the background image file via IPC → cache data URL → re-apply. */
export async function loadBgImage(): Promise<void> {
  const path = current.bgImagePath;
  if (!path || !window.electronAPI) {
    _bgDataUrl = null;
    return;
  }
  try {
    const dataUrl = await window.electronAPI.readBgImage(path);
    _bgDataUrl = dataUrl;
  } catch {
    _bgDataUrl = null;
  }
}

function lighten(hex: string, amount: number): string {
  const r = Math.min(255, parseInt(hex.slice(1, 3), 16) + amount);
  const g = Math.min(255, parseInt(hex.slice(3, 5), 16) + amount);
  const b = Math.min(255, parseInt(hex.slice(5, 7), 16) + amount);
  return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
}

// Initialize with defaults; hydrateFromConfig() is called by the app boot
// once configStore.loadAll() has fetched the .js configs.
applyTheme(defaultTheme);

export const themeStore = {
  get current(): ThemeSettings {
    return getTheme();
  },
  set: setTheme,
};
