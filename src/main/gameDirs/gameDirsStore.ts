import { app } from 'electron';
import path from 'path';
import fs from 'fs';

const DIRS_FILE = path.join(app.getPath('appData'), 'rlv', 'game-dirs.json');

interface GameDirsStore {
  dirs: string[];
}

function ensureDir(): void {
  const dir = path.dirname(DIRS_FILE);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function load(): GameDirsStore {
  try {
    ensureDir();
    if (fs.existsSync(DIRS_FILE)) {
      return JSON.parse(fs.readFileSync(DIRS_FILE, 'utf-8'));
    }
  } catch {
    console.error('Failed to load game dirs');
  }
  const defaultDir = getDefaultDir();
  return { dirs: [defaultDir] };
}

function save(store: GameDirsStore): void {
  ensureDir();
  fs.writeFileSync(DIRS_FILE, JSON.stringify(store, null, 2), 'utf-8');
}

function getDefaultDir(): string {
  return path.join(app.getPath('appData'), 'rlv', '.minecraft');
}

export function getDefaultGameDir(): string {
  return getDefaultDir();
}

export function getAllGameDirs(): string[] {
  return load().dirs;
}

export function addGameDir(dir: string): string[] {
  const store = load();
  const normalized = path.resolve(dir);
  if (!store.dirs.includes(normalized)) {
    store.dirs.push(normalized);
  }
  save(store);
  return store.dirs;
}

export function removeGameDir(dir: string): string[] {
  const store = load();
  store.dirs = store.dirs.filter((d) => path.resolve(d) !== path.resolve(dir));
  if (store.dirs.length === 0) {
    store.dirs.push(getDefaultDir());
  }
  save(store);
  return store.dirs;
}

export function getVersionDir(versionId: string): string {
  const dirs = getAllGameDirs();
  // First check if any dir has this version
  for (const gameDir of dirs) {
    const versionPath = path.join(gameDir, 'versions', versionId);
    if (fs.existsSync(versionPath)) {
      return versionPath;
    }
  }
  // Fall back to default dir
  return path.join(getDefaultDir(), 'versions', versionId);
}
