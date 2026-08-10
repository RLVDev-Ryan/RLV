/**
 * RLV — Application configuration.
 * Sensitive values like CLIENT_ID should be set via environment variables
 * or overridden in a local config file (not committed).
 */

export const CONFIG = {
  /** Microsoft Azure AD app client ID for OAuth login */
  MICROSOFT_CLIENT_ID: process.env.RLV_MICROSOFT_CLIENT_ID || '00000000-0000-0000-0000-000000000000',
} as const;

/* ── User-editable .js config (portable data dir) ── */

export type ConfigName = 'color' | 'ui' | 'music' | 'picture' | 'launcher';

export type ThemeMode = 'dark' | 'light';
export type FontZoneMode = 'global' | 'zone';
export type ButtonMode = 'white' | 'transparent';

export interface RlvConfigs {
  color: { accent: string };
  ui: {
    radius: number;
    blur: number;
    opacity: number;
    mode: ThemeMode;
    buttonMode: ButtonMode;
    fontFamily: string | null;
    fontMode: FontZoneMode;
    fontContent: string | null;
    fontButtons: string | null;
    fontLogs: string | null;
  };
  music: { enabled: boolean; volume: number; playlistPath: string };
  picture: { path: string; blur: number; scaleMode: 'cover' | 'contain' | 'fill' };
  launcher: {
    language: string;
    updateCheck: 'startup' | 'manual';
    launch: {
      memoryMB: number;
      jvmArgs: string[];
      gameArgs: string[];
      isolation: boolean;
      javaPath: string | null;
    };
  };
}

export const DEFAULT_CONFIGS: RlvConfigs = {
  color: { accent: '#6b9bc0' },
  ui: {
    radius: 8,
    blur: 12,
    opacity: 1,
    mode: 'light',
    buttonMode: 'transparent',
    fontFamily: null,
    fontMode: 'global',
    fontContent: null,
    fontButtons: null,
    fontLogs: null,
  },
  music: { enabled: false, volume: 70, playlistPath: '' },
  picture: { path: '', blur: 0, scaleMode: 'cover' },
  launcher: {
    language: 'zh-CN',
    updateCheck: 'startup',
    launch: { memoryMB: 2048, jvmArgs: [], gameArgs: [], isolation: true, javaPath: null },
  },
};
