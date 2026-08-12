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

/**
 * Launch settings are now owned by the .js config (launcher.js → launch).
 * This module keeps a synchronous cache; the renderer's configStore seeds it
 * at startup and persists changes (via the `rlv:launch-settings-changed`
 * event → configStore.update('launcher', …)).
 */
let launchSettingsCache: LaunchSettings = { ...DEFAULT_LAUNCH_SETTINGS };

/**
 * Coerce an unknown jvmArgs/gameArgs value into a string array.
 * Hand-edited .js configs may store `{}`, a string, or null — all of which
 * would crash renderers that call `.join()` (e.g. the version settings tab).
 */
function asStringArray(value: unknown): string[] {
  if (Array.isArray(value)) return value.filter((v): v is string => typeof v === 'string');
  if (typeof value === 'string' && value.trim()) return value.trim().split(/\s+/);
  return [];
}

function normalizeSettings(settings: LaunchSettings): LaunchSettings {
  return {
    ...settings,
    jvmArgs: asStringArray(settings.jvmArgs),
    gameArgs: asStringArray(settings.gameArgs),
  };
}

export function initLaunchSettings(settings: LaunchSettings): void {
  launchSettingsCache = normalizeSettings({ ...DEFAULT_LAUNCH_SETTINGS, ...settings });
}

export function loadLaunchSettings(): LaunchSettings {
  return normalizeSettings({ ...launchSettingsCache });
}

export function saveLaunchSettings(settings: LaunchSettings): void {
  launchSettingsCache = normalizeSettings({ ...settings });
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('rlv:launch-settings-changed', { detail: launchSettingsCache }));
  }
}
