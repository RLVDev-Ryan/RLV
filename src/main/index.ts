import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { app, BrowserWindow, ipcMain, dialog, clipboard, shell, protocol } from 'electron';
import { createMainWindow } from './windows/mainWindow';
import { IPC_CHANNELS } from '../shared/constants';
import type { Account, ModrinthDownloadRequest, ModrinthProgress } from '../shared/constants';
import { listAccounts, getCurrentAccount, setCurrentAccount, addAccount, removeAccount } from './accounts/accountStore';
import { authenticateMicrosoft } from './accounts/microsoftAuth';
import { authenticateYggdrasil } from './accounts/yggdrasilAuth';
import {
  getDefaultGameDir,
  getAllGameDirs,
  addGameDir,
  removeGameDir,
  getVersionDir,
  scanInstalledVersions,
  deleteVersion,
} from './gameDirs/gameDirsStore';
import { downloadVersion, fetchVersionManifest } from './downloader/downloaderManager';
import { downloadFile } from './downloader/downloadFile';
import { installLogger, getLogs, clearLogs, setLoggerWindow } from './logger';
import { installLoader } from './installer/loaderInstaller';
import { exportModpack, listModpackMods } from './modpack/modpackExporter';
import { isFontCached, downloadFont, cancelFontDownload, registerFontProtocol } from './fonts/fontManager';
import { applyPortablePaths, ensureDataDirs } from './paths';
import { getAllConfigs, loadConfig, saveConfig, configDir } from './config/configManager';
import { getPlaylistInfo, playlistRoot, registerAudioProtocol } from './music/musicManager';
import type { ConfigName } from '../shared/config';
import type { LoaderKey, LoaderInstallProgress, ModpackExportOptions } from '../shared/constants';
import { initAutoUpdater, downloadUpdate, quitAndInstall, setUpdaterWindow } from './updater/updater';
import {
  launchGame,
  stopGame,
  offlineUUID,
  exportLaunchScript,
  completeVersionFiles,
  type LaunchOptions,
} from './launcher/launcher';
import {
  startEasyTierHost,
  startEasyTierGuest,
  stopEasyTier,
  getRoomPlayers,
  isRoomConnected,
  setMainWindow,
} from './terracotta/terracottaManager';

let mainWindow: BrowserWindow | null = null;

// Disable hardware acceleration — fixes Win+Shift+S screenshot not working
// (Electron GPU process can interfere with Windows screenshot compositor)
app.disableHardwareAcceleration();

// Custom schemes for serving downloaded fonts / background music to the renderer.
protocol.registerSchemesAsPrivileged([
  { scheme: 'rlv-font', privileges: { secure: true, standard: true, supportFetchAPI: true, stream: true } },
  {
    scheme: 'rlv-audio',
    privileges: { secure: true, standard: true, supportFetchAPI: true, stream: true, bypassCSP: true },
  },
]);

// Portable mode: redirect userData into .RLV next to the exe before anything
// else touches `app.getPath('userData')` (fonts/logs/machine-id).
applyPortablePaths();

// Capture main-process console output for the Logs page.
installLogger();

function registerIpcHandlers(): void {
  // ── App lifecycle ──
  ipcMain.handle(IPC_CHANNELS.GET_APP_VERSION, () => app.getVersion());
  ipcMain.handle(IPC_CHANNELS.GET_PLATFORM, () => process.platform);
  ipcMain.handle(IPC_CHANNELS.SHOW_ALERT, (_event, message: string) => {
    dialog.showMessageBox({ type: 'info', title: 'RLV', message });
  });

  // ── File dialog ──
  ipcMain.handle(IPC_CHANNELS.OPEN_DIRECTORY, async () => {
    const result = await dialog.showOpenDialog({
      properties: ['openDirectory'],
      title: '选择 Minecraft 游戏目录',
    });
    return result.canceled ? null : result.filePaths[0];
  });

  // ── Clipboard ──
  ipcMain.on(IPC_CHANNELS.CLIPBOARD_WRITE, (_event, text: string) => {
    clipboard.writeText(text);
  });

  // ── Background image ──
  ipcMain.handle(IPC_CHANNELS.BG_IMAGE_OPEN, async () => {
    const result = await dialog.showOpenDialog({
      properties: ['openFile'],
      title: '选择背景图片',
      filters: [{ name: '图片文件', extensions: ['png', 'jpg', 'jpeg', 'svg', 'webp', 'bmp', 'gif', 'avif'] }],
    });
    return result.canceled || result.filePaths.length === 0 ? null : result.filePaths[0];
  });

  ipcMain.handle(IPC_CHANNELS.BG_IMAGE_READ, async (_event, filePath: string) => {
    try {
      const ALLOWED_EXT = ['.png', '.jpg', '.jpeg', '.svg', '.webp', '.bmp', '.gif', '.avif', '.tiff', '.tif'];
      // Whitelist extensions and cap the file size to avoid blocking the main
      // process with huge synchronous reads / massive base64 strings.
      if (typeof filePath !== 'string' || !ALLOWED_EXT.includes(path.extname(filePath).toLowerCase())) {
        return null;
      }
      const stat = await fs.promises.stat(filePath);
      if (stat.size > 20 * 1024 * 1024) return null; // 20 MB cap

      const buffer = await fs.promises.readFile(filePath);
      const ext = path.extname(filePath).slice(1).toLowerCase();
      const mime: Record<string, string> = {
        png: 'image/png',
        jpg: 'image/jpeg',
        jpeg: 'image/jpeg',
        svg: 'image/svg+xml',
        webp: 'image/webp',
        bmp: 'image/bmp',
        gif: 'image/gif',
        avif: 'image/avif',
        tiff: 'image/tiff',
        tif: 'image/tiff',
      };
      return `data:${mime[ext] || 'image/png'};base64,${buffer.toString('base64')}`;
    } catch {
      return null;
    }
  });

  // ── Downloader ──
  ipcMain.handle(IPC_CHANNELS.DOWNLOAD_LIST_VERSIONS, async () => {
    try {
      const versions = await fetchVersionManifest();
      return { success: true, versions };
    } catch {
      return { success: false, versions: [] };
    }
  });

  ipcMain.handle(IPC_CHANNELS.DOWNLOAD_START, async (_event, versionId: string) => {
    try {
      const gameDir = getDefaultGameDir();
      await downloadVersion(versionId, gameDir, (progress) => {
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.send(IPC_CHANNELS.DOWNLOAD_PROGRESS, progress);
        }
      });
      return { success: true };
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : String(err) };
    }
  });

  // ── Game directories ──
  ipcMain.handle(IPC_CHANNELS.GAME_DIR_GET_DEFAULT, () => getDefaultGameDir());
  ipcMain.handle(IPC_CHANNELS.GAME_DIR_GET_ALL, () => getAllGameDirs());
  ipcMain.handle(IPC_CHANNELS.GAME_DIR_ADD, async () => {
    const result = await dialog.showOpenDialog({
      properties: ['openDirectory'],
      title: '选择 Minecraft 游戏目录',
    });
    if (result.canceled || result.filePaths.length === 0) return null;
    return addGameDir(result.filePaths[0]);
  });
  ipcMain.handle(IPC_CHANNELS.GAME_DIR_REMOVE, (_event, dir: string) => {
    return removeGameDir(dir);
  });
  ipcMain.handle(IPC_CHANNELS.GAME_DIR_GET_VERSION_PATH, (_event, versionId: string) => {
    return getVersionDir(versionId);
  });
  ipcMain.handle(IPC_CHANNELS.GAME_DIR_SCAN_VERSIONS, () => scanInstalledVersions());
  ipcMain.handle(IPC_CHANNELS.GAME_DIR_DELETE_VERSION, (_event, versionId: string) => {
    return deleteVersion(versionId);
  });
  ipcMain.handle(IPC_CHANNELS.GAME_DIR_COMPLETE_FILES, async (_event, versionId: string) => {
    const hit = scanInstalledVersions().find((v) => v.id === versionId);
    const gameDir = hit ? hit.gameDir : getDefaultGameDir();
    return completeVersionFiles(versionId, gameDir);
  });

  // ── Window controls ──
  ipcMain.on(IPC_CHANNELS.WINDOW_MINIMIZE, () => mainWindow?.minimize());
  ipcMain.on(IPC_CHANNELS.WINDOW_MAXIMIZE, () => {
    if (mainWindow?.isMaximized()) {
      mainWindow.unmaximize();
    } else {
      mainWindow?.maximize();
    }
  });
  ipcMain.on(IPC_CHANNELS.WINDOW_CLOSE, () => mainWindow?.close());

  // ── Accounts ──
  ipcMain.handle(IPC_CHANNELS.ACCOUNTS_LIST, () => listAccounts());

  ipcMain.handle(IPC_CHANNELS.ACCOUNTS_GET_CURRENT, () => getCurrentAccount());

  ipcMain.handle(IPC_CHANNELS.ACCOUNTS_SET_CURRENT, (_event, id: string) => {
    return setCurrentAccount(id);
  });

  ipcMain.handle(IPC_CHANNELS.ACCOUNTS_ADD_MICROSOFT, async () => {
    const account = await authenticateMicrosoft();
    if (account) {
      addAccount(account, true);
    }
    return account;
  });

  ipcMain.handle(
    IPC_CHANNELS.ACCOUNTS_ADD_YGGDRASIL,
    async (_event, params: { serverUrl: string; username: string; password: string }) => {
      const account = await authenticateYggdrasil(params.serverUrl, params.username, params.password);
      if (account) {
        addAccount(account, true);
      }
      return account;
    },
  );

  ipcMain.handle(IPC_CHANNELS.ACCOUNTS_ADD_OFFLINE, (_event, username: string) => {
    const account: Account = {
      id: crypto.randomUUID(),
      type: 'offline',
      name: username,
      uuid: offlineUUID(username),
      createdAt: Date.now(),
    };
    addAccount(account, true);
    return account;
  });

  ipcMain.handle(IPC_CHANNELS.ACCOUNTS_REMOVE, (_event, id: string) => {
    return removeAccount(id);
  });

  // ── Auto updater ──
  ipcMain.handle(IPC_CHANNELS.UPDATE_DOWNLOAD, () => downloadUpdate());
  ipcMain.handle(IPC_CHANNELS.UPDATE_INSTALL, () => quitAndInstall());

  // ── Shell ──
  ipcMain.handle(IPC_CHANNELS.SHELL_OPEN_PATH, async (_event, targetPath: string) => {
    try {
      // Only allow opening paths inside the game directory
      if (typeof targetPath !== 'string' || !targetPath) {
        return { success: false, error: 'invalid path' };
      }
      const gameDir = getDefaultGameDir();
      const resolved = path.resolve(targetPath);
      const inside =
        resolved.toLowerCase() === gameDir.toLowerCase() ||
        resolved.toLowerCase().startsWith(gameDir.toLowerCase() + path.sep);
      if (!inside) return { success: false, error: '路径不在游戏目录内' };

      const openError = await shell.openPath(resolved);
      return openError ? { success: false, error: openError } : { success: true };
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : String(err) };
    }
  });

  // Open an external URL in the default browser (https only).
  ipcMain.handle(IPC_CHANNELS.SHELL_OPEN_EXTERNAL, async (_event, url: string) => {
    try {
      if (typeof url !== 'string' || !/^https?:\/\//i.test(url)) {
        return { success: false, error: 'invalid url' };
      }
      await shell.openExternal(url);
      return { success: true };
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : String(err) };
    }
  });

  // Open a single file picker (used for the custom Java path).
  ipcMain.handle(IPC_CHANNELS.OPEN_FILE, async () => {
    try {
      const options: Electron.OpenDialogOptions = {
        title: '选择文件',
        properties: ['openFile'],
        filters: [
          { name: 'Executable', extensions: ['exe'] },
          { name: 'All files', extensions: ['*'] },
        ],
      };
      const result =
        mainWindow && !mainWindow.isDestroyed()
          ? await dialog.showOpenDialog(mainWindow, options)
          : await dialog.showOpenDialog(options);
      return result.canceled || result.filePaths.length === 0 ? null : result.filePaths[0];
    } catch {
      return null;
    }
  });

  // ── Logs ──
  ipcMain.handle(IPC_CHANNELS.LOGS_GET, () => getLogs());
  ipcMain.handle(IPC_CHANNELS.LOGS_CLEAR, () => {
    clearLogs();
    return { success: true };
  });
  ipcMain.handle(IPC_CHANNELS.LOGS_OPEN_FOLDER, async () => {
    try {
      const dir = path.join(app.getPath('userData'), 'logs');
      fs.mkdirSync(dir, { recursive: true });
      const err = await shell.openPath(dir);
      return { success: !err, error: err || undefined };
    } catch (e) {
      return { success: false, error: e instanceof Error ? e.message : String(e) };
    }
  });

  // ── .js config system ──
  ipcMain.handle(IPC_CHANNELS.CONFIG_GET_ALL, () => getAllConfigs());
  ipcMain.handle(IPC_CHANNELS.CONFIG_GET, (_event, name: ConfigName) => loadConfig(name));
  ipcMain.handle(IPC_CHANNELS.CONFIG_SET, (_event, name: ConfigName, data: unknown) => {
    try {
      saveConfig(name, data as never);
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send(IPC_CHANNELS.CONFIG_CHANGED, { name, data: loadConfig(name) });
      }
      return { success: true };
    } catch (e) {
      return { success: false, error: e instanceof Error ? e.message : String(e) };
    }
  });
  ipcMain.handle(IPC_CHANNELS.CONFIG_OPEN_DIR, async () => {
    try {
      fs.mkdirSync(configDir(), { recursive: true });
      const err = await shell.openPath(configDir());
      return { success: !err, error: err || undefined };
    } catch (e) {
      return { success: false, error: e instanceof Error ? e.message : String(e) };
    }
  });
  ipcMain.handle(IPC_CHANNELS.CONFIG_OPEN_DATA_DIR, async () => {
    try {
      fs.mkdirSync(app.getPath('userData'), { recursive: true });
      const err = await shell.openPath(app.getPath('userData'));
      return { success: !err, error: err || undefined };
    } catch (e) {
      return { success: false, error: e instanceof Error ? e.message : String(e) };
    }
  });

  // ── Background music ──
  ipcMain.handle(IPC_CHANNELS.MUSIC_GET_PLAYLIST, () => getPlaylistInfo());
  ipcMain.handle(IPC_CHANNELS.MUSIC_OPEN_DIR, async () => {
    try {
      fs.mkdirSync(playlistRoot(), { recursive: true });
      const err = await shell.openPath(playlistRoot());
      return { success: !err, error: err || undefined };
    } catch (e) {
      return { success: false, error: e instanceof Error ? e.message : String(e) };
    }
  });

  // ── On-demand fonts ──
  ipcMain.handle(IPC_CHANNELS.FONT_IS_CACHED, (_event, family: string) => ({
    cached: isFontCached(family),
  }));
  ipcMain.handle(IPC_CHANNELS.FONT_DOWNLOAD, async (_event, family: string) => {
    try {
      await downloadFont(family, (percent) => {
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.send(IPC_CHANNELS.FONT_PROGRESS, { family, percent });
        }
      });
      return { success: true };
    } catch (err) {
      return {
        success: false,
        error: err instanceof Error ? err.message : String(err),
        cancelled: (err as Error).message.includes('取消'),
      };
    }
  });
  ipcMain.handle(IPC_CHANNELS.FONT_CANCEL, () => {
    cancelFontDownload();
    return { success: true };
  });

  // ── Modpack export ──
  ipcMain.handle(IPC_CHANNELS.MODPACK_EXPORT, async (_event, versionId: string, options: ModpackExportOptions) => {
    const hit = scanInstalledVersions().find((v) => v.id === versionId);
    const gameDir = hit ? hit.gameDir : getDefaultGameDir();
    const dialogOpts = {
      title: '导出整合包',
      defaultPath: `${versionId}.zip`,
      filters: [{ name: 'ZIP', extensions: ['zip'] }],
    };
    const result =
      mainWindow && !mainWindow.isDestroyed()
        ? await dialog.showSaveDialog(mainWindow, dialogOpts)
        : await dialog.showSaveDialog(dialogOpts);
    if (result.canceled || !result.filePath) return { success: false, error: '已取消' };
    return exportModpack(gameDir, options, result.filePath);
  });

  // List the mod files inside a version's mods/ folder (for selective export).
  ipcMain.handle(IPC_CHANNELS.MODPACK_LIST_MODS, (_event, versionId: string) => {
    const hit = scanInstalledVersions().find((v) => v.id === versionId);
    const gameDir = hit ? hit.gameDir : getDefaultGameDir();
    return { success: true, mods: listModpackMods(gameDir) };
  });

  // ── Mod loader install ──
  ipcMain.handle(IPC_CHANNELS.LOADER_INSTALL, async (_event, loader: LoaderKey, gameVersion: string) => {
    const gameDir = getDefaultGameDir();
    const send = (stage: string, percent: number, message?: string) => {
      const payload: LoaderInstallProgress = { loader, gameVersion, stage, percent, message };
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send(IPC_CHANNELS.LOADER_PROGRESS, payload);
      }
    };
    return installLoader(loader, gameVersion, gameDir, send);
  });

  // ── Modrinth mod download ──
  ipcMain.handle(IPC_CHANNELS.MODRINTH_DOWNLOAD, async (_event, req: ModrinthDownloadRequest) => {
    try {
      if (!req || typeof req.url !== 'string' || typeof req.filename !== 'string' || typeof req.gameDir !== 'string') {
        return { success: false, error: 'invalid request' };
      }
      // Only allow downloads from the Modrinth CDN.
      const parsed = new URL(req.url);
      if (!/^(cdn\.)?modrinth\.com$/.test(parsed.hostname)) {
        return { success: false, error: 'download source not allowed' };
      }
      const filename = path.basename(req.filename); // strip any path traversal
      const dest = path.join(req.gameDir, 'mods', filename);
      const sendProgress = (stage: ModrinthProgress['stage'], percent: number, error?: string) => {
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.send(IPC_CHANNELS.MODRINTH_PROGRESS, {
            projectId: req.projectId,
            filename,
            percent,
            stage,
            error,
          });
        }
      };

      await downloadFile(req.url, dest, (percent) => sendProgress('downloading', percent));
      sendProgress('done', 100);
      return { success: true, path: dest };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send(IPC_CHANNELS.MODRINTH_PROGRESS, {
          projectId: req?.projectId,
          filename: req?.filename ?? '',
          percent: 0,
          stage: 'error',
          error: msg,
        });
      }
      return { success: false, error: msg };
    }
  });

  // ── Game launch ──
  ipcMain.handle(IPC_CHANNELS.LAUNCH_STOP, () => {
    stopGame();
    return { success: true };
  });

  ipcMain.handle(IPC_CHANNELS.EXPORT_LAUNCH_SCRIPT, async (_event, versionId: string, options?: LaunchOptions) => {
    const account = getCurrentAccount();
    const auth = account
      ? {
          playerName: account.name,
          uuid: account.uuid,
          accessToken: account.type === 'microsoft' ? account.minecraftToken || '0' : account.yggdrasilToken || '0',
        }
      : { playerName: 'Player', uuid: offlineUUID('Player'), accessToken: '0' };
    return exportLaunchScript(versionId, auth, options);
  });

  ipcMain.handle(
    IPC_CHANNELS.LAUNCH_GAME,
    async (_event, versionId: string, playerName: string, options?: LaunchOptions) => {
      const account = getCurrentAccount();
      const auth = account
        ? {
            playerName: account.name || playerName,
            uuid: account.uuid,
            accessToken: account.type === 'microsoft' ? account.minecraftToken || '0' : account.yggdrasilToken || '0',
          }
        : {
            playerName: playerName || 'Player',
            uuid: offlineUUID(playerName || 'Player'),
            accessToken: '0',
          };
      // Launch from the game directory that actually contains this version
      const hit = scanInstalledVersions().find((v) => v.id === versionId);
      const gameDir = hit ? hit.gameDir : getDefaultGameDir();
      return launchGame(
        versionId,
        auth,
        (progress) => {
          if (mainWindow && !mainWindow.isDestroyed()) {
            mainWindow.webContents.send(IPC_CHANNELS.LAUNCH_PROGRESS, progress);
          }
        },
        gameDir,
        options,
      );
    },
  );

  // ── EasyTier P2P + LAN scan ──
  ipcMain.handle(IPC_CHANNELS.TERRACOTTA_START, async (_event, port?: number) => {
    const playerName = getCurrentAccount()?.name ?? 'RLV 主机';
    return startEasyTierHost(port, playerName);
  });

  ipcMain.handle(IPC_CHANNELS.TERRACOTTA_JOIN, async (_event, code: string) => {
    const playerName = getCurrentAccount()?.name ?? 'RLV 玩家';
    return startEasyTierGuest(code, playerName);
  });

  ipcMain.handle(IPC_CHANNELS.TERRACOTTA_STOP, async () => {
    await stopEasyTier();
    return { success: true };
  });

  ipcMain.handle(IPC_CHANNELS.TERRACOTTA_PLAYERS, () => {
    return { players: getRoomPlayers(), connected: isRoomConnected() };
  });
}

app.whenReady().then(() => {
  registerIpcHandlers();
  ensureDataDirs();
  registerFontProtocol();
  registerAudioProtocol();
  mainWindow = createMainWindow();
  setMainWindow(mainWindow);
  setLoggerWindow(mainWindow);
  setUpdaterWindow(mainWindow);
  initAutoUpdater();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      mainWindow = createMainWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// Cleanup EasyTier on exit
app.on('before-quit', () => {
  stopEasyTier();
});
