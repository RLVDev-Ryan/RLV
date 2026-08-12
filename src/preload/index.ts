import { contextBridge, ipcRenderer } from 'electron';
import {
  IPC_CHANNELS,
  type Account,
  type DownloadProgress,
  type InstalledVersionInfo,
  type LaunchProgress,
  type LoaderKey,
  type LoaderInstallProgress,
  type ModpackExportOptions,
  type ModrinthDownloadRequest,
  type ModrinthDownloadResult,
  type ModrinthProgress,
  type TerracottaJoinResult,
  type TerracottaPlayersResult,
  type TerracottaStartResult,
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
  openFile: (): Promise<string | null> => ipcRenderer.invoke(IPC_CHANNELS.OPEN_FILE),
  openPath: (targetPath: string): Promise<{ success: boolean; error?: string }> =>
    ipcRenderer.invoke(IPC_CHANNELS.SHELL_OPEN_PATH, targetPath),
  openExternal: (url: string): Promise<{ success: boolean; error?: string }> =>
    ipcRenderer.invoke(IPC_CHANNELS.SHELL_OPEN_EXTERNAL, url),

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
    deleteVersion: (versionId: string): Promise<{ success: boolean; error?: string }> =>
      ipcRenderer.invoke(IPC_CHANNELS.GAME_DIR_DELETE_VERSION, versionId),
    completeFiles: (versionId: string): Promise<{ success: boolean; error?: string }> =>
      ipcRenderer.invoke(IPC_CHANNELS.GAME_DIR_COMPLETE_FILES, versionId),
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

  // ── Modrinth mod browser ──
  modrinth: {
    download: (req: ModrinthDownloadRequest): Promise<ModrinthDownloadResult> =>
      ipcRenderer.invoke(IPC_CHANNELS.MODRINTH_DOWNLOAD, req),
    onProgress: (callback: (progress: ModrinthProgress) => void) => {
      const handler = (_event: Electron.IpcRendererEvent, progress: ModrinthProgress) => callback(progress);
      ipcRenderer.on(IPC_CHANNELS.MODRINTH_PROGRESS, handler);
      return () => ipcRenderer.removeListener(IPC_CHANNELS.MODRINTH_PROGRESS, handler);
    },
  },

  // ── Mod loader install ──
  loader: {
    install: (
      loader: LoaderKey,
      gameVersion: string,
    ): Promise<{ success: boolean; versionId?: string; error?: string }> =>
      ipcRenderer.invoke(IPC_CHANNELS.LOADER_INSTALL, loader, gameVersion),
    onProgress: (callback: (p: LoaderInstallProgress) => void) => {
      const handler = (_event: Electron.IpcRendererEvent, p: LoaderInstallProgress) => callback(p);
      ipcRenderer.on(IPC_CHANNELS.LOADER_PROGRESS, handler);
      return () => ipcRenderer.removeListener(IPC_CHANNELS.LOADER_PROGRESS, handler);
    },
  },

  // ── Logs ──
  logs: {
    get: (): Promise<string[]> => ipcRenderer.invoke(IPC_CHANNELS.LOGS_GET),
    clear: (): Promise<{ success: boolean }> => ipcRenderer.invoke(IPC_CHANNELS.LOGS_CLEAR),
    openFolder: (): Promise<{ success: boolean; error?: string }> => ipcRenderer.invoke(IPC_CHANNELS.LOGS_OPEN_FOLDER),
    onAppend: (callback: (line: string) => void) => {
      const handler = (_event: Electron.IpcRendererEvent, line: string) => callback(line);
      ipcRenderer.on(IPC_CHANNELS.LOGS_APPEND, handler);
      return () => ipcRenderer.removeListener(IPC_CHANNELS.LOGS_APPEND, handler);
    },
  },

  // ── Modpack export ──
  modpack: {
    export: (
      versionId: string,
      options: ModpackExportOptions,
    ): Promise<{ success: boolean; path?: string; error?: string }> =>
      ipcRenderer.invoke(IPC_CHANNELS.MODPACK_EXPORT, versionId, options),
    listMods: (versionId: string): Promise<{ success: boolean; mods: string[]; error?: string }> =>
      ipcRenderer.invoke(IPC_CHANNELS.MODPACK_LIST_MODS, versionId),
  },

  // ── On-demand fonts ──
  fonts: {
    isCached: (family: string): Promise<{ cached: boolean }> => ipcRenderer.invoke(IPC_CHANNELS.FONT_IS_CACHED, family),
    download: (family: string): Promise<{ success: boolean; error?: string; cancelled?: boolean }> =>
      ipcRenderer.invoke(IPC_CHANNELS.FONT_DOWNLOAD, family),
    cancel: (): Promise<{ success: boolean }> => ipcRenderer.invoke(IPC_CHANNELS.FONT_CANCEL),
    onProgress: (callback: (p: { family: string; percent: number }) => void) => {
      const handler = (_event: Electron.IpcRendererEvent, p: { family: string; percent: number }) => callback(p);
      ipcRenderer.on(IPC_CHANNELS.FONT_PROGRESS, handler);
      return () => ipcRenderer.removeListener(IPC_CHANNELS.FONT_PROGRESS, handler);
    },
  },

  // ── Background music ──
  music: {
    getPlaylist: (): Promise<{ tracks: { name: string; url: string }[]; root: string }> =>
      ipcRenderer.invoke(IPC_CHANNELS.MUSIC_GET_PLAYLIST),
    openDir: (): Promise<{ success: boolean; error?: string }> => ipcRenderer.invoke(IPC_CHANNELS.MUSIC_OPEN_DIR),
  },

  // ── .js config system ──
  config: {
    getAll: (): Promise<Record<string, unknown>> => ipcRenderer.invoke(IPC_CHANNELS.CONFIG_GET_ALL),
    get: (name: string): Promise<unknown> => ipcRenderer.invoke(IPC_CHANNELS.CONFIG_GET, name),
    set: (name: string, data: unknown): Promise<{ success: boolean; error?: string }> =>
      ipcRenderer.invoke(IPC_CHANNELS.CONFIG_SET, name, data),
    openDir: (): Promise<{ success: boolean; error?: string }> => ipcRenderer.invoke(IPC_CHANNELS.CONFIG_OPEN_DIR),
    openDataDir: (): Promise<{ success: boolean; error?: string }> =>
      ipcRenderer.invoke(IPC_CHANNELS.CONFIG_OPEN_DATA_DIR),
    onChanged: (callback: (e: { name: string; data: unknown }) => void) => {
      const handler = (_event: Electron.IpcRendererEvent, e: { name: string; data: unknown }) => callback(e);
      ipcRenderer.on(IPC_CHANNELS.CONFIG_CHANGED, handler);
      return () => ipcRenderer.removeListener(IPC_CHANNELS.CONFIG_CHANGED, handler);
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
      options?: { memoryMB?: number; jvmArgs?: string[]; gameArgs?: string[]; isolation?: boolean; javaPath?: string },
    ): Promise<{ success: boolean; error?: string }> =>
      ipcRenderer.invoke(IPC_CHANNELS.LAUNCH_GAME, versionId, playerName, options),
    stop: (): Promise<{ success: boolean }> => ipcRenderer.invoke(IPC_CHANNELS.LAUNCH_STOP),
    exportScript: (
      versionId: string,
      options?: { memoryMB?: number; jvmArgs?: string[]; gameArgs?: string[]; isolation?: boolean; javaPath?: string },
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
    start: (port?: number): Promise<TerracottaStartResult> => ipcRenderer.invoke(IPC_CHANNELS.TERRACOTTA_START, port),
    join: (inviteCode: string): Promise<TerracottaJoinResult> =>
      ipcRenderer.invoke(IPC_CHANNELS.TERRACOTTA_JOIN, inviteCode),
    stop: (): Promise<{ success: boolean }> => ipcRenderer.invoke(IPC_CHANNELS.TERRACOTTA_STOP),
    players: (): Promise<TerracottaPlayersResult> => ipcRenderer.invoke(IPC_CHANNELS.TERRACOTTA_PLAYERS),
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
