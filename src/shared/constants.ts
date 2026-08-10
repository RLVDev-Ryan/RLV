/** Application metadata */
export const APP_NAME = 'RLV';
export const APP_FULL_NAME = "Ryan's Launcher Vibe";

/** IPC channel names — single source of truth */
export const IPC_CHANNELS = {
  // App lifecycle
  GET_APP_VERSION: 'app:get-version',

  // Game launch
  LAUNCH_GAME: 'launch:game',
  LAUNCH_STOP: 'launch:stop',
  LAUNCH_PROGRESS: 'launch:progress',
  EXPORT_LAUNCH_SCRIPT: 'launch:export-script',

  // Auto updater
  UPDATE_STATUS: 'update:status',
  UPDATE_DOWNLOAD: 'update:download',
  UPDATE_INSTALL: 'update:install',


  // Platform info
  GET_PLATFORM: 'app:get-platform',

  // Dialog
  SHOW_ALERT: 'dialog:show-alert',
  OPEN_DIRECTORY: 'dialog:open-directory',
  OPEN_FILE: 'dialog:open-file',

  // Window controls
  WINDOW_MINIMIZE: 'window:minimize',
  WINDOW_MAXIMIZE: 'window:maximize',
  WINDOW_CLOSE: 'window:close',

  // Clipboard
  CLIPBOARD_WRITE: 'clipboard:write',

  // Microsoft device-code login
  MS_DEVICE_CODE: 'ms:device-code',

  // Terracotta multiplayer
  TERRACOTTA_START: 'terracotta:start',
  TERRACOTTA_JOIN: 'terracotta:join',
  TERRACOTTA_STOP: 'terracotta:stop',
  TERRACOTTA_PLAYERS: 'terracotta:players',
  TERRACOTTA_PERMISSION_ERROR: 'terracotta:permission-error',

  // Downloader
  DOWNLOAD_LIST_VERSIONS: 'download:list-versions',
  DOWNLOAD_START: 'download:start',
  DOWNLOAD_PROGRESS: 'download:progress',

  // Shell
  SHELL_OPEN_PATH: 'shell:open-path',
  SHELL_OPEN_EXTERNAL: 'shell:open-external',

  // Modrinth mod browser
  MODRINTH_DOWNLOAD: 'modrinth:download',
  MODRINTH_PROGRESS: 'modrinth:progress',

  // Logs
  LOGS_GET: 'logs:get',
  LOGS_CLEAR: 'logs:clear',
  LOGS_APPEND: 'logs:append',
  LOGS_OPEN_FOLDER: 'logs:open-folder',

  // Mod loader install
  LOADER_INSTALL: 'loader:install',
  LOADER_PROGRESS: 'loader:progress',

  // Modpack export
  MODPACK_EXPORT: 'modpack:export',

  // On-demand fonts
  FONT_IS_CACHED: 'font:is-cached',
  FONT_DOWNLOAD: 'font:download',
  FONT_CANCEL: 'font:cancel',
  FONT_PROGRESS: 'font:progress',

  // .js config system
  CONFIG_GET_ALL: 'config:get-all',
  CONFIG_GET: 'config:get',
  CONFIG_SET: 'config:set',
  CONFIG_CHANGED: 'config:changed',
  CONFIG_OPEN_DIR: 'config:open-dir',
  CONFIG_OPEN_DATA_DIR: 'config:open-data-dir',

  // Background image
  BG_IMAGE_OPEN: 'bg:open-file',
  BG_IMAGE_READ: 'bg:read-file',

  // Game directories
  GAME_DIR_GET_DEFAULT: 'game-dir:get-default',
  GAME_DIR_GET_ALL: 'game-dir:get-all',
  GAME_DIR_ADD: 'game-dir:add',
  GAME_DIR_REMOVE: 'game-dir:remove',
  GAME_DIR_GET_VERSION_PATH: 'game-dir:get-version-path',
  GAME_DIR_SCAN_VERSIONS: 'game-dir:scan-versions',
  GAME_DIR_DELETE_VERSION: 'game-dir:delete-version',
  GAME_DIR_COMPLETE_FILES: 'game-dir:complete-files',

  // Accounts
  ACCOUNTS_LIST: 'accounts:list',
  ACCOUNTS_GET_CURRENT: 'accounts:get-current',
  ACCOUNTS_SET_CURRENT: 'accounts:set-current',
  ACCOUNTS_ADD_MICROSOFT: 'accounts:add-microsoft',
  ACCOUNTS_ADD_YGGDRASIL: 'accounts:add-yggdrasil',
  ACCOUNTS_ADD_OFFLINE: 'accounts:add-offline',
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
  { key: 'launch', label: '启动' },
  { key: 'download', label: '下载' },
  { key: 'multiplayer', label: '联机' },
  { key: 'logs', label: '日志' },
  { key: 'settings', label: '设置' },
] as const;

export type NavKey = (typeof NAV_ITEMS)[number]['key'];

/** Account types */
export type AccountType = 'microsoft' | 'yggdrasil' | 'offline';

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

/* ── Shared IPC payload types (single source of truth for main/preload/renderer) ── */

export type LaunchStage = 'start' | 'java' | 'resolve' | 'libraries' | 'assets' | 'natives' | 'launch' | 'done' | 'error';

export interface LaunchProgress {
  stage: LaunchStage;
  percent: number;
  message?: string;
  error?: string;
}

export type DownloadStage = 'manifest' | 'client' | 'assets' | 'extract' | 'done' | 'error';

export interface DownloadProgress {
  versionId: string;
  stage: DownloadStage;
  percent: number;
  speed?: string;
  error?: string;
}

/** A single entry from the Mojang version manifest. */
export interface VersionManifestEntry {
  id: string;
  type: 'release' | 'snapshot' | 'old_beta' | 'old_alpha';
  url: string;
  time: string;
  releaseTime: string;
}

export interface UpdateStatus {
  status: string;
  version?: string;
  percent?: number;
  message?: string;
}

/** A single result from the Modrinth search API. */
export interface ModrinthHit {
  project_id: string;
  slug: string;
  title: string;
  description: string;
  icon_url?: string;
  downloads: number;
  date_modified?: string;
}

/** A downloadable file for a Modrinth project version. */
export interface ModrinthFile {
  filename: string;
  url: string;
  size: number;
  primary?: boolean;
}

export interface ModrinthDownloadRequest {
  url: string;
  filename: string;
  gameDir: string;
  /** Modrinth project id, echoed back in progress events for UI matching. */
  projectId?: string;
}

export interface ModrinthDownloadResult {
  success: boolean;
  path?: string;
  error?: string;
}

export interface ModrinthProgress {
  projectId?: string;
  filename: string;
  percent: number;
  stage: 'downloading' | 'done' | 'error';
  error?: string;
}

export type LoaderKey = 'fabric' | 'forge' | 'neoforge' | 'quilt' | 'optifine';

export interface LoaderInstallProgress {
  loader: LoaderKey;
  gameVersion: string;
  stage: string;
  percent: number;
  message?: string;
}

export interface ModpackExportOptions {
  includeMods: boolean;
  includeResourcepacks: boolean;
  includeShaders: boolean;
  includeSaves: boolean;
  includeScreenshots: boolean;
  includeOptions: boolean;
}

/** A Minecraft server discovered via the real LAN multicast protocol. */
export interface LanGame {
  motd: string;
  /** Source address the announcement arrived from. */
  host: string;
  port: number;
  worldName: string;
}

/** A player profile tracked by the Scaffolding room protocol. */
export interface RoomPlayer {
  machineId: string;
  name: string;
  vendor: string;
  kind: 'HOST' | 'GUEST';
}

export type ConnectionDifficulty = 'UNKNOWN' | 'EASIEST' | 'SIMPLE' | 'MEDIUM' | 'TOUGH';

export interface TerracottaStartResult {
  success: boolean;
  inviteCode: string | null;
  mcPort?: number;
  error?: string;
}

export interface TerracottaJoinResult {
  success: boolean;
  connectAddr?: string;
  difficulty?: ConnectionDifficulty;
  error?: string;
}

export interface TerracottaPlayersResult {
  players: RoomPlayer[];
  connected: boolean;
}

/** A version found on disk by scanning the configured game directories. */
export interface InstalledVersionInfo {
  id: string;
  releaseTime: string;
  gameDir: string;
  loader: ModLoader | null;
}

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
