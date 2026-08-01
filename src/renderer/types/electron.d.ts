import type {
  Account,
  DownloadProgress,
  InstalledVersionInfo,
  LanGame,
  LaunchProgress,
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
  start: (
    port?: number,
  ) => Promise<{ success: boolean; inviteCode: string | null; noGames?: boolean; gameCount?: number }>;
  join: (inviteCode: string) => Promise<{ success: boolean }>;
  stop: () => Promise<{ success: boolean }>;
  scan: () => Promise<{ games: LanGame[] }>;
}

export interface GameDirsAPI {
  getDefault: () => Promise<string>;
  getAll: () => Promise<string[]>;
  add: () => Promise<string[] | null>;
  remove: (dir: string) => Promise<string[]>;
  getVersionPath: (versionId: string) => Promise<string>;
  scanVersions: () => Promise<InstalledVersionInfo[]>;
}

export interface LaunchAPI {
  game: (
    versionId: string,
    playerName: string,
    options?: { memoryMB?: number; jvmArgs?: string[]; gameArgs?: string[] },
  ) => Promise<{ success: boolean; error?: string }>;
  stop: () => Promise<{ success: boolean }>;
  exportScript: (
    versionId: string,
    options?: { memoryMB?: number; jvmArgs?: string[]; gameArgs?: string[] },
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

export interface ElectronAPI {
  getAppVersion: () => Promise<string>;
  getPlatform: () => Promise<NodeJS.Platform>;
  showAlert: (message: string) => Promise<void>;
  openDirectory: () => Promise<string | null>;
  openPath: (targetPath: string) => Promise<{ success: boolean; error?: string }>;
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
}

declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}
