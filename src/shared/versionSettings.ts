/** Per-version display settings (icons) persisted in localStorage. */

export interface VersionSettings {
  /** Icon shown on the launch screen while starting. 'default' = auto (loader/grass). */
  iconLaunch: string;
  /** Icon shown in the installed-version list. 'default' = auto. */
  iconList: string;
  /** Icon shown in the version selector dropdown. 'default' = auto. */
  iconSelector: string;
}

export const DEFAULT_VERSION_SETTINGS: VersionSettings = {
  iconLaunch: 'default',
  iconList: 'default',
  iconSelector: 'default',
};

const KEY_PREFIX = 'rlv_version_settings_';

export function loadVersionSettings(versionId: string): VersionSettings {
  try {
    const raw = localStorage.getItem(KEY_PREFIX + versionId);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<VersionSettings>;
      return { ...DEFAULT_VERSION_SETTINGS, ...parsed };
    }
  } catch {}
  return { ...DEFAULT_VERSION_SETTINGS };
}

export function saveVersionSettings(versionId: string, partial: Partial<VersionSettings>): VersionSettings {
  const next = { ...loadVersionSettings(versionId), ...partial };
  try {
    localStorage.setItem(KEY_PREFIX + versionId, JSON.stringify(next));
  } catch {
    // Quota exceeded (multiple large custom-icon data URLs) — keep the
    // in-memory value for this session instead of crashing the app.
  }
  return next;
}

/** Built-in icon presets available in the version settings. */
export const ICON_PRESETS: { key: string; label: string; src: string }[] = [
  { key: 'fabric', label: 'Fabric', src: 'assets/icons/fabric.svg' },
  { key: 'forge', label: 'Forge', src: 'assets/icons/forge.png' },
  { key: 'neoforge', label: 'NeoForge', src: 'assets/icons/neoforge.jpg' },
  { key: 'optifine', label: 'OptiFine', src: 'assets/icons/optifine.png' },
  { key: 'quilt', label: 'Quilt', src: 'assets/icons/quilt.png' },
  { key: 'grass', label: '草方块', src: 'assets/icons/grass.png' },
];

const PRESET_SRCS: Record<string, string> = Object.fromEntries(ICON_PRESETS.map((p) => [p.key, p.src]));

/** Resolve an icon setting to an actual <img> src. */
export function resolveIcon(setting: string | undefined, loader: string | null | undefined): string {
  if (!setting || setting === 'default') {
    if (loader === 'fabric' || loader === 'forge' || loader === 'neoforge' || loader === 'quilt') {
      return `assets/icons/${loader}.${loader === 'fabric' ? 'svg' : 'png'}`;
    }
    if (loader === 'optifine') return 'assets/icons/optifine.png';
    return 'assets/icons/grass.png';
  }
  // Preset key or uploaded data URL.
  return PRESET_SRCS[setting] ?? setting;
}
