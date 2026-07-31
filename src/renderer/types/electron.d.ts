import type { Account } from '../../shared/constants';

export interface AccountAPI {
  list: () => Promise<Account[]>;
  getCurrent: () => Promise<Account | null>;
  setCurrent: (id: string) => Promise<Account | null>;
  addMicrosoft: () => Promise<Account | null>;
  addYggdrasil: (params: { serverUrl: string; username: string; password: string }) => Promise<Account | null>;
  addOffline: (username: string) => Promise<Account | null>;
  remove: (id: string) => Promise<boolean>;
}

export interface TerracottaAPI {
  start: (
    port?: number,
  ) => Promise<{ success: boolean; inviteCode: string | null; noGames?: boolean; gameCount?: number }>;
  join: (inviteCode: string) => Promise<{ success: boolean }>;
  stop: () => Promise<{ success: boolean }>;
  getRoom: () => Promise<{ inviteCode: string } | null>;
  scan: () => Promise<{ games: any[] }>;
}

export interface GameDirsAPI {
  getDefault: () => Promise<string>;
  getAll: () => Promise<string[]>;
  add: () => Promise<string[] | null>;
  remove: (dir: string) => Promise<string[]>;
  getVersionPath: (versionId: string) => Promise<string>;
}

export interface LaunchAPI {
  game: (versionId: string, playerName: string) => Promise<{ success: boolean; error?: string }>;
  onProgress: (callback: (progress: any) => void) => () => void;
}

export interface UpdateAPI {
  onStatus: (callback: (status: any) => void) => () => void;
  download: () => Promise<{ success: boolean }>;
  install: () => Promise<{ success: boolean }>;
}

export interface DownloadAPI {
  listVersions: () => Promise<{ success: boolean; versions: any[] }>;
  start: (versionId: string) => Promise<{ success: boolean; error?: string }>;
  onProgress: (callback: (progress: any) => void) => () => void;
}

export interface ElectronAPI {
  getAppVersion: () => Promise<string>;
  getPlatform: () => Promise<NodeJS.Platform>;
  showAlert: (message: string) => Promise<void>;
  openDirectory: () => Promise<string | null>;
  openBgImage: () => Promise<string | null>;
  readBgImage: (filePath: string) => Promise<string | null>;
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
