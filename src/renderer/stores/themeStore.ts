const STORAGE_KEY = 'rlv_theme';

export interface ThemeSettings {
  mode: 'dark' | 'light';
  accentColor: string;
  bgImagePath: string | null;
}

const defaultTheme: ThemeSettings = {
  mode: 'light',
  accentColor: '#6b9bc0',
  bgImagePath: null,
};

let current: ThemeSettings = { ...defaultTheme };
let lightAccent = defaultTheme.accentColor;
let _bgDataUrl: string | null = null; // cached data URL for the current bg image

function load(): ThemeSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      return { ...defaultTheme, ...parsed };
    }
  } catch {}
  return { ...defaultTheme };
}

function save(settings: ThemeSettings): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
}

export function getTheme(): ThemeSettings {
  return { ...current };
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
  save(current);

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
    const bg = `url("${_bgDataUrl}") center/cover fixed no-repeat`;
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

// Initialize
const saved = load();
current = saved;
if (current.mode !== 'dark') lightAccent = current.accentColor;
applyTheme(saved);
// Load bg image async (don't block init)
loadBgImage().then(() => applyTheme(current));

export const themeStore = {
  get current(): ThemeSettings {
    return getTheme();
  },
  set: setTheme,
};
