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
  // The updater is best-effort: a failed check must never affect app startup
  // (the renderer's main UI loads independently of any update event).
  try {
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
      console.error('[updater] error:', err.message);
      pushStatus('error', { message: err.message });
    });

    // Defer the network call a moment so startup never waits on it.
    setTimeout(checkForUpdatesAndNotify, 1500);
  } catch (err) {
    console.error('[updater] init failed:', err);
  }
}

function checkForUpdatesAndNotify(): void {
  try {
    // checkForUpdatesAndNotify rejects on network / release-not-found errors —
    // surface them as a status instead of an unhandled promise rejection.
    autoUpdater.checkForUpdatesAndNotify().catch((err) => {
      const message = err instanceof Error ? err.message : String(err);
      console.error('[updater] check failed:', message);
      pushStatus('error', { message });
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[updater] check failed (sync):', message);
    pushStatus('error', { message });
  }
}

/** Start downloading the update. */
export async function downloadUpdate(): Promise<{ success: boolean; error?: string }> {
  try {
    await autoUpdater.downloadUpdate();
    return { success: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[updater] download failed:', message);
    return { success: false, error: message };
  }
}

/** Quit and install the downloaded update. */
export function quitAndInstall(): { success: boolean; error?: string } {
  try {
    autoUpdater.quitAndInstall();
    return { success: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[updater] install failed:', message);
    return { success: false, error: message };
  }
}
