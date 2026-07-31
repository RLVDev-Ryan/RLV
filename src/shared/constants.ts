/** Application metadata */
export const APP_NAME = 'RLV';
export const APP_FULL_NAME = "Ryan's Launcher Vibe";

/** IPC channel names — single source of truth */
export const IPC_CHANNELS = {
  // App lifecycle
  GET_APP_VERSION: 'app:get-version',

  // Auto updater
  UPDATE_STATUS: 'update:status',
  UPDATE_DOWNLOAD: 'update:download',
  UPDATE_INSTALL: 'update:install',


  // Platform info
  GET_PLATFORM: 'app:get-platform',

  // Dialog
  SHOW_ALERT: 'dialog:show-alert',
  OPEN_DIRECTORY: 'dialog:open-directory',

  // Window controls
  WINDOW_MINIMIZE: 'window:minimize',
  WINDOW_MAXIMIZE: 'window:maximize',
  WINDOW_CLOSE: 'window:close',

  // Clipboard
  CLIPBOARD_WRITE: 'clipboard:write',

  // Terracotta multiplayer
  TERRACOTTA_START: 'terracotta:start',
  TERRACOTTA_JOIN: 'terracotta:join',
  TERRACOTTA_STOP: 'terracotta:stop',
  TERRACOTTA_GET_PATH: 'terracotta:get-path',
  TERRACOTTA_GET_ROOM: 'terracotta:get-room',
  TERRACOTTA_SCAN: 'terracotta:scan',
  TERRACOTTA_PERMISSION_ERROR: 'terracotta:permission-error',

  // Downloader
  DOWNLOAD_LIST_VERSIONS: 'download:list-versions',
  DOWNLOAD_START: 'download:start',
  DOWNLOAD_PROGRESS: 'download:progress',

  // Background image
  BG_IMAGE_OPEN: 'bg:open-file',
  BG_IMAGE_READ: 'bg:read-file',

  // Game directories
  GAME_DIR_GET_DEFAULT: 'game-dir:get-default',
  GAME_DIR_GET_ALL: 'game-dir:get-all',
  GAME_DIR_ADD: 'game-dir:add',
  GAME_DIR_REMOVE: 'game-dir:remove',
  GAME_DIR_GET_VERSION_PATH: 'game-dir:get-version-path',

  // Accounts
  ACCOUNTS_LIST: 'accounts:list',
  ACCOUNTS_GET_CURRENT: 'accounts:get-current',
  ACCOUNTS_SET_CURRENT: 'accounts:set-current',
  ACCOUNTS_ADD_MICROSOFT: 'accounts:add-microsoft',
  ACCOUNTS_ADD_YGGDRASIL: 'accounts:add-yggdrasil',
  ACCOUNTS_REMOVE: 'accounts:remove',
} as const;

/** Default window dimensions */
export const WINDOW_SIZE = {
  WIDTH: 1000,
  HEIGHT: 700,
  MIN_WIDTH: 800,
  MIN_HEIGHT: 600,
} as const;

/** Navigation pages */
export const NAV_ITEMS = [
  { key: 'launch', label: '启动', icon: '🚀' },
  { key: 'download', label: '下载', icon: '📥' },
  { key: 'multiplayer', label: '联机', icon: '🌐' },
  { key: 'settings', label: '设置', icon: '⚙️' },
] as const;

export type NavKey = (typeof NAV_ITEMS)[number]['key'];

/** Account types */
export type AccountType = 'microsoft' | 'yggdrasil';

export interface Account {
  id: string;
  type: AccountType;
  name: string;
  uuid: string;
  avatarUrl?: string;
  // Microsoft-specific
  msAccessToken?: string;
  msRefreshToken?: string;
  minecraftToken?: string;
  xboxGamertag?: string;
  // Yggdrasil-specific
  yggdrasilServer?: string;
  yggdrasilToken?: string;
  clientToken?: string;
  // Metadata
  lastUsed?: number;
  createdAt: number;
}

export interface AccountStore {
  currentId?: string;
  accounts: Account[];
}

/** Minecraft version entry (hardcoded for now) */
export interface MinecraftVersion {
  id: string;
  releaseDate: string;
  type: 'release' | 'snapshot' | 'beta' | 'alpha';
  loader?: ModLoader | null;
}

export type ModLoader = 'fabric' | 'forge' | 'neoforge' | 'quilt';

/** Strip loader suffix from version ID for display */
export function getBaseVersion(id: string): string {
  return id.replace(/(-fabric|-forge|-neoforge|-quilt)-.+$/, '');
}

/** Extract loader version string (e.g. "0.15.11") or null for vanilla */
export function getLoaderVersion(id: string): string | null {
  const match = id.match(/(?:-fabric|-forge|-neoforge|-quilt)-(.+)$/);
  return match ? match[1] : null;
}

/** Hardcoded version list */
export const INSTALLED_VERSIONS: MinecraftVersion[] = [
  { id: '1.20.1', releaseDate: '2023-09-12', type: 'release', loader: null },
  { id: '1.20.1-fabric-0.15.11', releaseDate: '2023-09-12', type: 'release', loader: 'fabric' },
  { id: '1.20.1-forge-47.2.0', releaseDate: '2023-09-12', type: 'release', loader: 'forge' },
  { id: '1.21', releaseDate: '2024-06-13', type: 'release', loader: null },
  { id: '1.21-fabric-0.16.0', releaseDate: '2024-06-13', type: 'release', loader: 'fabric' },
  { id: '1.21-neoforge-21.0.0', releaseDate: '2024-06-13', type: 'release', loader: 'neoforge' },
  { id: '1.21.1', releaseDate: '2024-08-07', type: 'release', loader: null },
  { id: '1.21.1-fabric-0.16.0', releaseDate: '2024-08-07', type: 'release', loader: 'fabric' },
  { id: '1.21.1-forge-52.0.0', releaseDate: '2024-08-07', type: 'release', loader: 'forge' },
];

/** Path to vanilla grass block icon */
export const VANILLA_ICON = 'assets/icons/grass.png';
export const VANILLA_CARD_BG = 'rgba(124, 184, 124, 0.08)';

export const LOADER_META: Record<ModLoader, { label: string; iconPath: string; color: string; cardBg: string }> = {
  fabric: {
    label: 'Fabric',
    iconPath: 'assets/icons/fabric.svg',
    color: '#dbb774',
    cardBg: 'rgba(232, 208, 138, 0.08)',
  },
  forge: {
    label: 'Forge',
    iconPath: 'assets/icons/forge.png',
    color: '#e8904a',
    cardBg: 'rgba(232, 170, 176, 0.08)',
  },
  neoforge: {
    label: 'NeoForge',
    iconPath: 'assets/icons/neoforge.jpg',
    color: '#4a9ee8',
    cardBg: 'rgba(140, 184, 160, 0.08)',
  },
  quilt: {
    label: 'Quilt',
    iconPath: 'assets/icons/quilt.png',
    color: '#a855f7',
    cardBg: 'rgba(138, 184, 212, 0.08)',
  },
};
