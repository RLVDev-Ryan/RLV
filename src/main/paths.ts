import { app } from 'electron';
import path from 'path';
import fs from 'fs';

/**
 * Portable / installed data paths.
 *
 * If a `portable` marker file/folder sits next to RLV.exe, all app data lives
 * next to the executable (`.RLV/` for user data, `.minecraft/` for the game
 * directory). Otherwise the classic AppData layout is used.
 *
 * Note: `applyPortablePaths()` must run before `app.whenReady()` so that
 * `app.getPath('userData')` — used by fonts/logs/machine-id — already points
 * into `.RLV/`.
 */

export function isPortable(): boolean {
  try {
    const exeDir = path.dirname(app.getPath('exe'));
    return fs.existsSync(path.join(exeDir, 'portable'));
  } catch {
    return false;
  }
}

export function portableRoot(): string {
  return path.dirname(app.getPath('exe'));
}

/** Root that behaves as `.RLV` (portable) or `%APPDATA%\rlv` (installed). */
export function dataRoot(): string {
  return isPortable() ? path.join(portableRoot(), '.RLV') : app.getPath('appData') + path.sep + 'rlv';
}

/** Redirect the app's userData into `.RLV` when portable. Call before ready. */
export function applyPortablePaths(): void {
  if (isPortable()) {
    app.setPath('userData', path.join(portableRoot(), '.RLV'));
  }
}

/** The default Minecraft game directory. */
export function getDefaultGameDir(): string {
  return isPortable()
    ? path.join(portableRoot(), '.minecraft')
    : path.join(app.getPath('appData'), 'rlv', '.minecraft');
}

/** Ensure the portable/installed data directory tree exists. */
export function ensureDataDirs(): void {
  const dirs = [
    path.join(app.getPath('userData'), 'config'),
    path.join(app.getPath('userData'), 'config', 'font'),
    path.join(app.getPath('userData'), 'music'),
    path.join(app.getPath('userData'), 'picture'),
    path.join(app.getPath('userData'), 'glass'),
    getDefaultGameDir(),
  ];
  for (const d of dirs) {
    fs.mkdirSync(d, { recursive: true });
  }
}
