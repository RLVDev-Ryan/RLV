/** Shared utility helpers used across main/renderer/preload. */

/** Format a date string as YYYY-MM-DD (used by version lists). */
export function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** Global launch settings (memory / extra JVM args / extra game args). */
export interface LaunchSettings {
  memoryMB: number;
  jvmArgs: string[];
  gameArgs: string[];
  /** Version isolation: each version uses its own folder for saves/mods/… */
  isolation: boolean;
  /** Custom Java executable path (empty = auto-detect). */
  javaPath: string | null;
}

export const DEFAULT_LAUNCH_SETTINGS: LaunchSettings = {
  memoryMB: 2048,
  jvmArgs: [],
  gameArgs: [],
  isolation: true,
  javaPath: null,
};

const LAUNCH_SETTINGS_KEY = 'rlv_launch_settings';

export function loadLaunchSettings(): LaunchSettings {
  try {
    const raw = localStorage.getItem(LAUNCH_SETTINGS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<LaunchSettings>;
      return { ...DEFAULT_LAUNCH_SETTINGS, ...parsed };
    }
  } catch {}
  return { ...DEFAULT_LAUNCH_SETTINGS };
}

export function saveLaunchSettings(settings: LaunchSettings): void {
  localStorage.setItem(LAUNCH_SETTINGS_KEY, JSON.stringify(settings));
}
