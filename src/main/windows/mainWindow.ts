import { app, BrowserWindow } from 'electron';
import path from 'path';
import { WINDOW_SIZE, APP_FULL_NAME } from '../../shared/constants';

export function createMainWindow(): BrowserWindow {
  const isDev = !app.isPackaged;

  const win = new BrowserWindow({
    width: WINDOW_SIZE.WIDTH,
    height: WINDOW_SIZE.HEIGHT,
    minWidth: WINDOW_SIZE.MIN_WIDTH,
    minHeight: WINDOW_SIZE.MIN_HEIGHT,
    resizable: true,
    // No native frame — we draw our own title bar
    frame: false,
    titleBarStyle: 'hidden',
    backgroundColor: '#1a1a2e',
    webPreferences: {
      // Dev: dist/main/src/main/windows/ → ../../preload/ → dist/main/src/preload/
      // Prod (asar): same relative structure preserved by electron-builder
      preload: path.join(__dirname, '../../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });

  win.setTitle(APP_FULL_NAME);

  if (isDev) {
    win.loadURL('http://localhost:5173');
    win.webContents.openDevTools({ mode: 'detach' });
  } else {
    win.loadFile(path.join(app.getAppPath(), 'dist', 'renderer', 'index.html'));
  }

  // Prevent the title from being overridden by <title> tags
  win.on('page-title-updated', (event) => {
    event.preventDefault();
  });

  return win;
}
