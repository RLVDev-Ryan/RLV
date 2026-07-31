import { app, BrowserWindow } from 'electron';
import { autoUpdater } from 'electron-updater';
import { IPC_CHANNELS } from '../../shared/constants';

let mainWindow: BrowserWindow | null = null;

export function setUpdaterWindow(win: BrowserWindow | null): void {
  mainWindow = win;
}

function pushStatus(status: string, data?: Record<string, unknown>): void {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send(IPC_CHANNELS.UPDATE_STATUS, { status, ...data });
  }
}

export function initAutoUpdater(): void {
  // Don't auto-check in dev (not packaged)
  if (!app.isPackaged) return;

  autoUpdater.autoDownload = false;
  autoUpdater.autoInstallOnAppQuit = true;

  autoUpdater.on('checking-for-update', () => pushStatus('checking'));
  autoUpdater.on('update-available', (info) => {
    pushStatus('available', { version: info.version });
  });
  autoUpdater.on('update-not-available', () => pushStatus('not-available'));
  autoUpdater.on('download-progress', (progressObj) => {
    pushStatus('downloading', {
      percent: Math.round(progressObj.percent),
      transferred: progressObj.transferred,
      total: progressObj.total,
    });
  });
  autoUpdater.on('update-downloaded', (info) => {
    pushStatus('downloaded', { version: info.version });
  });
  autoUpdater.on('error', (err) => {
    pushStatus('error', { message: err.message });
  });

  // Check for updates after app ready
  autoUpdater.checkForUpdatesAndNotify();
}

/** Start downloading the update. */
export function downloadUpdate(): void {
  autoUpdater.downloadUpdate();
}

/** Quit and install the downloaded update. */
export function quitAndInstall(): void {
  autoUpdater.quitAndInstall();
}
