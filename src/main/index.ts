import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { app, BrowserWindow, ipcMain, dialog, clipboard } from 'electron';
import { createMainWindow } from './windows/mainWindow';
import { IPC_CHANNELS } from '../shared/constants';
import type { Account } from '../shared/constants';
import { listAccounts, getCurrentAccount, setCurrentAccount, addAccount, removeAccount } from './accounts/accountStore';
import { authenticateMicrosoft } from './accounts/microsoftAuth';
import { authenticateYggdrasil } from './accounts/yggdrasilAuth';
import { getDefaultGameDir, getAllGameDirs, addGameDir, removeGameDir, getVersionDir } from './gameDirs/gameDirsStore';
import { downloadVersion, fetchVersionManifest } from './downloader/downloaderManager';
import { initAutoUpdater, downloadUpdate, quitAndInstall, setUpdaterWindow } from './updater/updater';
import { launchGame, offlineUUID } from './launcher/launcher';
import {
  getEasyTierPath,
  getLocalIP,
  generateRoomCode,
  encodeInviteCode,
  decodeInviteCode,
  startEasyTierHost,
  startEasyTierGuest,
  stopEasyTier,
  scanLanGames,
  setMainWindow,
} from './terracotta/terracottaManager';

let mainWindow: BrowserWindow | null = null;

// Disable hardware acceleration — fixes Win+Shift+S screenshot not working
// (Electron GPU process can interfere with Windows screenshot compositor)
app.disableHardwareAcceleration();

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
      const buffer = fs.readFileSync(filePath);
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
  ipcMain.handle(IPC_CHANNELS.UPDATE_DOWNLOAD, () => {
    downloadUpdate();
    return { success: true };
  });
  ipcMain.handle(IPC_CHANNELS.UPDATE_INSTALL, () => {
    quitAndInstall();
    return { success: true };
  });

  // ── Game launch ──
  ipcMain.handle(IPC_CHANNELS.LAUNCH_GAME, async (_event, versionId: string, playerName: string) => {
    const account = getCurrentAccount();
    const auth = account
      ? {
          playerName: account.name || playerName,
          uuid: account.uuid,
          accessToken:
            account.type === 'microsoft'
              ? account.minecraftToken || '0'
              : account.yggdrasilToken || '0',
        }
      : {
          playerName: playerName || 'Player',
          uuid: offlineUUID(playerName || 'Player'),
          accessToken: '0',
        };
    return launchGame(versionId, auth, (progress) => {
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send(IPC_CHANNELS.LAUNCH_PROGRESS, progress);
      }
    });
  });

  // ── EasyTier P2P + LAN scan ──
  ipcMain.handle(IPC_CHANNELS.TERRACOTTA_START, async (_event, port?: number) => {
    // Step 1: scan specific port for Minecraft room
    const games = await scanLanGames(port);
    if (games.length === 0) {
      return { success: true, inviteCode: null, noGames: true };
    }

    // Step 2: found game, start P2P room
    const roomCode = generateRoomCode();
    const ok = await startEasyTierHost(roomCode);
    if (!ok) return { success: false, inviteCode: null, noGames: false };

    const localIP = getLocalIP();
    if (!localIP) {
      stopEasyTier();
      return { success: false, inviteCode: null, noGames: false };
    }

    const inviteCode = encodeInviteCode(roomCode, localIP);
    return { success: true, inviteCode, noGames: false, gameCount: games.length };
  });

  ipcMain.handle(IPC_CHANNELS.TERRACOTTA_JOIN, async (_event, code: string) => {
    const decoded = decodeInviteCode(code.trim().toUpperCase());
    if (!decoded) return { success: false };
    const ok = await startEasyTierGuest(decoded.roomCode, decoded.ip);
    return { success: ok };
  });

  ipcMain.handle(IPC_CHANNELS.TERRACOTTA_STOP, () => {
    stopEasyTier();
    return { success: true };
  });

  ipcMain.handle(IPC_CHANNELS.TERRACOTTA_GET_ROOM, () => {
    return null;
  });

  ipcMain.handle(IPC_CHANNELS.TERRACOTTA_SCAN, async () => {
    const games = await scanLanGames();
    return { games };
  });
}

app.whenReady().then(() => {
  registerIpcHandlers();
  mainWindow = createMainWindow();
  setMainWindow(mainWindow);
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
