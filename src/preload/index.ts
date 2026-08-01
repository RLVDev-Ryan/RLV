import { contextBridge, ipcRenderer } from 'electron';
import {
  IPC_CHANNELS,
  type Account,
  type DownloadProgress,
  type InstalledVersionInfo,
  type LanGame,
  type LaunchProgress,
  type UpdateStatus,
  type VersionManifestEntry,
} from '../shared/constants';

/**
 * Expose a safe, typed API to the renderer process via contextBridge.
 * The renderer accesses it via `window.electronAPI`.
 */
// Allow file drops at the preload level (Electron/Windows fix)
document.addEventListener(
  'dragover',
  (e) => {
    e.preventDefault();
  },
  false,
);
document.addEventListener(
  'drop',
  (e) => {
    e.preventDefault();
  },
  false,
);

contextBridge.exposeInMainWorld('electronAPI', {
  // App lifecycle
  getAppVersion: () => ipcRenderer.invoke(IPC_CHANNELS.GET_APP_VERSION),
  getPlatform: (): Promise<NodeJS.Platform> => ipcRenderer.invoke(IPC_CHANNELS.GET_PLATFORM),

  // Dialogs / shell
  showAlert: (message: string) => ipcRenderer.invoke(IPC_CHANNELS.SHOW_ALERT, message),
  openDirectory: (): Promise<string | null> => ipcRenderer.invoke(IPC_CHANNELS.OPEN_DIRECTORY),
  openPath: (targetPath: string): Promise<{ success: boolean; error?: string }> =>
    ipcRenderer.invoke(IPC_CHANNELS.SHELL_OPEN_PATH, targetPath),

  // Window controls
  windowMinimize: () => ipcRenderer.send(IPC_CHANNELS.WINDOW_MINIMIZE),
  windowMaximize: () => ipcRenderer.send(IPC_CHANNELS.WINDOW_MAXIMIZE),
  windowClose: () => ipcRenderer.send(IPC_CHANNELS.WINDOW_CLOSE),

  // ── Game directories ──
  gameDirs: {
    getDefault: (): Promise<string> => ipcRenderer.invoke(IPC_CHANNELS.GAME_DIR_GET_DEFAULT),
    getAll: (): Promise<string[]> => ipcRenderer.invoke(IPC_CHANNELS.GAME_DIR_GET_ALL),
    add: (): Promise<string[] | null> => ipcRenderer.invoke(IPC_CHANNELS.GAME_DIR_ADD),
    remove: (dir: string): Promise<string[]> => ipcRenderer.invoke(IPC_CHANNELS.GAME_DIR_REMOVE, dir),
    getVersionPath: (versionId: string): Promise<string> =>
      ipcRenderer.invoke(IPC_CHANNELS.GAME_DIR_GET_VERSION_PATH, versionId),
    scanVersions: (): Promise<InstalledVersionInfo[]> => ipcRenderer.invoke(IPC_CHANNELS.GAME_DIR_SCAN_VERSIONS),
  },

  // ── Downloader ──
  download: {
    listVersions: (): Promise<{ success: boolean; versions: VersionManifestEntry[] }> =>
      ipcRenderer.invoke(IPC_CHANNELS.DOWNLOAD_LIST_VERSIONS),
    start: (versionId: string): Promise<{ success: boolean; error?: string }> =>
      ipcRenderer.invoke(IPC_CHANNELS.DOWNLOAD_START, versionId),
    onProgress: (callback: (progress: DownloadProgress) => void) => {
      const handler = (_event: Electron.IpcRendererEvent, progress: DownloadProgress) => callback(progress);
      ipcRenderer.on(IPC_CHANNELS.DOWNLOAD_PROGRESS, handler);
      return () => ipcRenderer.removeListener(IPC_CHANNELS.DOWNLOAD_PROGRESS, handler);
    },
  },

  // ── Background image ──
  openBgImage: (): Promise<string | null> => ipcRenderer.invoke(IPC_CHANNELS.BG_IMAGE_OPEN),
  readBgImage: (filePath: string): Promise<string | null> => ipcRenderer.invoke(IPC_CHANNELS.BG_IMAGE_READ, filePath),

  // ── Clipboard ──
  copyToClipboard: (text: string) => ipcRenderer.send(IPC_CHANNELS.CLIPBOARD_WRITE, text),

  // ── Game launch ──
  launch: {
    game: (
      versionId: string,
      playerName: string,
      options?: { memoryMB?: number; jvmArgs?: string[]; gameArgs?: string[] },
    ): Promise<{ success: boolean; error?: string }> =>
      ipcRenderer.invoke(IPC_CHANNELS.LAUNCH_GAME, versionId, playerName, options),
    stop: (): Promise<{ success: boolean }> => ipcRenderer.invoke(IPC_CHANNELS.LAUNCH_STOP),
    exportScript: (
      versionId: string,
      options?: { memoryMB?: number; jvmArgs?: string[]; gameArgs?: string[] },
    ): Promise<{ success: boolean; path?: string; error?: string }> =>
      ipcRenderer.invoke(IPC_CHANNELS.EXPORT_LAUNCH_SCRIPT, versionId, options),
    onProgress: (callback: (progress: LaunchProgress) => void) => {
      const handler = (_event: Electron.IpcRendererEvent, progress: LaunchProgress) => callback(progress);
      ipcRenderer.on(IPC_CHANNELS.LAUNCH_PROGRESS, handler);
      return () => ipcRenderer.removeListener(IPC_CHANNELS.LAUNCH_PROGRESS, handler);
    },
  },

  // ── Auto updater ──
  updater: {
    onStatus: (callback: (status: UpdateStatus) => void) => {
      const handler = (_event: Electron.IpcRendererEvent, status: UpdateStatus) => callback(status);
      ipcRenderer.on(IPC_CHANNELS.UPDATE_STATUS, handler);
      return () => ipcRenderer.removeListener(IPC_CHANNELS.UPDATE_STATUS, handler);
    },
    download: (): Promise<{ success: boolean }> => ipcRenderer.invoke(IPC_CHANNELS.UPDATE_DOWNLOAD),
    install: (): Promise<{ success: boolean }> => ipcRenderer.invoke(IPC_CHANNELS.UPDATE_INSTALL),
  },

  // ── Terracotta multiplayer ──
  terracotta: {
    start: (
      port?: number,
    ): Promise<{ success: boolean; inviteCode: string | null; noGames?: boolean; gameCount?: number }> =>
      ipcRenderer.invoke(IPC_CHANNELS.TERRACOTTA_START, port),
    join: (inviteCode: string): Promise<{ success: boolean }> =>
      ipcRenderer.invoke(IPC_CHANNELS.TERRACOTTA_JOIN, inviteCode),
    stop: (): Promise<{ success: boolean }> => ipcRenderer.invoke(IPC_CHANNELS.TERRACOTTA_STOP),
    scan: (): Promise<{ games: LanGame[] }> => ipcRenderer.invoke(IPC_CHANNELS.TERRACOTTA_SCAN),
  },

  // ── Account management ──
  accounts: {
    list: (): Promise<Account[]> => ipcRenderer.invoke(IPC_CHANNELS.ACCOUNTS_LIST),
    getCurrent: (): Promise<Account | null> => ipcRenderer.invoke(IPC_CHANNELS.ACCOUNTS_GET_CURRENT),
    setCurrent: (id: string): Promise<Account | null> => ipcRenderer.invoke(IPC_CHANNELS.ACCOUNTS_SET_CURRENT, id),
    addMicrosoft: (): Promise<Account | null> => ipcRenderer.invoke(IPC_CHANNELS.ACCOUNTS_ADD_MICROSOFT),
    addYggdrasil: (params: { serverUrl: string; username: string; password: string }): Promise<Account | null> =>
      ipcRenderer.invoke(IPC_CHANNELS.ACCOUNTS_ADD_YGGDRASIL, params),
    addOffline: (username: string): Promise<Account | null> =>
      ipcRenderer.invoke(IPC_CHANNELS.ACCOUNTS_ADD_OFFLINE, username),
    remove: (id: string): Promise<boolean> => ipcRenderer.invoke(IPC_CHANNELS.ACCOUNTS_REMOVE, id),
    onDeviceCode: (callback: (code: string) => void) => {
      const handler = (_event: Electron.IpcRendererEvent, code: string) => callback(code);
      ipcRenderer.on(IPC_CHANNELS.MS_DEVICE_CODE, handler);
      return () => ipcRenderer.removeListener(IPC_CHANNELS.MS_DEVICE_CODE, handler);
    },
  },
});
