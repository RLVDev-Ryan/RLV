import type {
  Account,
  DownloadProgress,
  InstalledVersionInfo,
  LaunchProgress,
  LoaderInstallProgress,
  LoaderKey,
  ModpackExportOptions,
  ModrinthDownloadRequest,
  ModrinthDownloadResult,
  ModrinthProgress,
  TerracottaJoinResult,
  TerracottaPlayersResult,
  TerracottaStartResult,
  UpdateStatus,
  VersionManifestEntry,
} from '../../shared/constants';

export interface AccountAPI {
  list: () => Promise<Account[]>;
  getCurrent: () => Promise<Account | null>;
  setCurrent: (id: string) => Promise<Account | null>;
  addMicrosoft: () => Promise<Account | null>;
  addYggdrasil: (params: { serverUrl: string; username: string; password: string }) => Promise<Account | null>;
  addOffline: (username: string) => Promise<Account | null>;
  remove: (id: string) => Promise<boolean>;
  onDeviceCode: (callback: (code: string) => void) => () => void;
}

export interface TerracottaAPI {
  start: (port?: number) => Promise<TerracottaStartResult>;
  join: (inviteCode: string) => Promise<TerracottaJoinResult>;
  stop: () => Promise<{ success: boolean }>;
  players: () => Promise<TerracottaPlayersResult>;
}

export interface GameDirsAPI {
  getDefault: () => Promise<string>;
  getAll: () => Promise<string[]>;
  add: () => Promise<string[] | null>;
  remove: (dir: string) => Promise<string[]>;
  getVersionPath: (versionId: string) => Promise<string>;
  scanVersions: () => Promise<InstalledVersionInfo[]>;
  deleteVersion: (versionId: string) => Promise<{ success: boolean; error?: string }>;
  completeFiles: (versionId: string) => Promise<{ success: boolean; error?: string }>;
}

export interface LaunchAPI {
  game: (
    versionId: string,
    playerName: string,
    options?: { memoryMB?: number; jvmArgs?: string[]; gameArgs?: string[]; isolation?: boolean; javaPath?: string },
  ) => Promise<{ success: boolean; error?: string }>;
  stop: () => Promise<{ success: boolean }>;
  exportScript: (
    versionId: string,
    options?: { memoryMB?: number; jvmArgs?: string[]; gameArgs?: string[]; isolation?: boolean; javaPath?: string },
  ) => Promise<{ success: boolean; path?: string; error?: string }>;
  onProgress: (callback: (progress: LaunchProgress) => void) => () => void;
}

export interface UpdateAPI {
  onStatus: (callback: (status: UpdateStatus) => void) => () => void;
  download: () => Promise<{ success: boolean }>;
  install: () => Promise<{ success: boolean }>;
}

export interface DownloadAPI {
  listVersions: () => Promise<{ success: boolean; versions: VersionManifestEntry[] }>;
  start: (versionId: string) => Promise<{ success: boolean; error?: string }>;
  onProgress: (callback: (progress: DownloadProgress) => void) => () => void;
}

export interface ModrinthAPI {
  download: (req: ModrinthDownloadRequest) => Promise<ModrinthDownloadResult>;
  onProgress: (callback: (progress: ModrinthProgress) => void) => () => void;
}

export interface LogsAPI {
  get: () => Promise<string[]>;
  clear: () => Promise<{ success: boolean }>;
  openFolder: () => Promise<{ success: boolean; error?: string }>;
  onAppend: (callback: (line: string) => void) => () => void;
}

export interface LoaderAPI {
  install: (loader: LoaderKey, gameVersion: string) => Promise<{ success: boolean; versionId?: string; error?: string }>;
  onProgress: (callback: (p: LoaderInstallProgress) => void) => () => void;
}

export interface ModpackAPI {
  export: (versionId: string, options: ModpackExportOptions) => Promise<{ success: boolean; path?: string; error?: string }>;
}

export interface FontsAPI {
  isCached: (family: string) => Promise<{ cached: boolean }>;
  download: (family: string) => Promise<{ success: boolean; error?: string; cancelled?: boolean }>;
  cancel: () => Promise<{ success: boolean }>;
  onProgress: (callback: (p: { family: string; percent: number }) => void) => () => void;
}

export interface ConfigAPI {
  getAll: () => Promise<Record<string, unknown>>;
  get: (name: string) => Promise<unknown>;
  set: (name: string, data: unknown) => Promise<{ success: boolean; error?: string }>;
  openDir: () => Promise<{ success: boolean; error?: string }>;
  openDataDir: () => Promise<{ success: boolean; error?: string }>;
  onChanged: (callback: (e: { name: string; data: unknown }) => void) => () => void;
}

export interface MusicAPI {
  getPlaylist: () => Promise<{ tracks: { name: string; url: string }[] }>;
  openDir: () => Promise<{ success: boolean; error?: string }>;
}

export interface ElectronAPI {
  getAppVersion: () => Promise<string>;
  getPlatform: () => Promise<NodeJS.Platform>;
  showAlert: (message: string) => Promise<void>;
  openDirectory: () => Promise<string | null>;
  openFile: () => Promise<string | null>;
  openPath: (targetPath: string) => Promise<{ success: boolean; error?: string }>;
  openExternal: (url: string) => Promise<{ success: boolean; error?: string }>;
  openBgImage: () => Promise<string | null>;
  readBgImage: (filePath: string) => Promise<string | null>;
  copyToClipboard: (text: string) => void;
  windowMinimize: () => void;
  windowMaximize: () => void;
  windowClose: () => void;
  accounts: AccountAPI;
  terracotta: TerracottaAPI;
  gameDirs: GameDirsAPI;
  download: DownloadAPI;
  updater: UpdateAPI;
  launch: LaunchAPI;
  modrinth: ModrinthAPI;
  logs: LogsAPI;
  loader: LoaderAPI;
  modpack: ModpackAPI;
  fonts: FontsAPI;
  config: ConfigAPI;
  music: MusicAPI;
}

declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}
