import { app } from 'electron';
import path from 'path';
import fs from 'fs';
import type { InstalledVersionInfo, ModLoader } from '../../shared/constants';
import { getDefaultGameDir } from '../paths';

const DIRS_FILE = path.join(app.getPath('userData'), 'game-dirs.json');

interface GameDirsStore {
  dirs: string[];
}

/**
 * Detect which mod loader a version JSON uses by inspecting its libraries.
 * Forge/Fabric installer versions follow the "{base}-{loader}-{ver}" naming,
 * while Fabric's official output uses "fabric-loader-{ver}-{base}" — so the
 * JSON content is the reliable signal.
 */
function detectLoader(versionJson: unknown): ModLoader | null {
  const json = versionJson as { libraries?: Array<{ name?: string }>; mainClass?: string; id?: string };
  const libs = json?.libraries ?? [];
  const has = (fragment: string) => libs.some((l) => (l.name ?? '').includes(fragment));

  if (has('net.fabricmc:fabric-loader') || (json.mainClass ?? '').includes('fabric')) return 'fabric';
  if (has('org.quiltmc:quilt-loader')) return 'quilt';
  if (has('net.neoforged:neoforge') || has('net.neoforged:forge') || (json.id ?? '').includes('-neoforge-')) {
    return 'neoforge';
  }
  if (has('net.minecraftforge:forge') || (json.id ?? '').includes('-forge-')) return 'forge';
  return null;
}

/** Scan every configured game directory for installed versions. */
export function scanInstalledVersions(): InstalledVersionInfo[] {
  const results: InstalledVersionInfo[] = [];
  const seen = new Set<string>();

  for (const gameDir of getAllGameDirs()) {
    const versionsDir = path.join(gameDir, 'versions');
    if (!fs.existsSync(versionsDir)) continue;

    for (const entry of fs.readdirSync(versionsDir, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue;
      const versionId = entry.name;
      const jsonPath = path.join(versionsDir, versionId, `${versionId}.json`);
      if (!fs.existsSync(jsonPath)) continue;

      try {
        const json = JSON.parse(fs.readFileSync(jsonPath, 'utf-8'));
        const id = typeof json.id === 'string' && json.id ? json.id : versionId;
        // Deduplicate by version id across dirs (first configured dir wins)
        if (seen.has(id)) continue;
        seen.add(id);
        results.push({
          id,
          releaseTime:
            typeof json.releaseTime === 'string'
              ? json.releaseTime
              : fs.statSync(jsonPath).mtime.toISOString(),
          gameDir,
          loader: detectLoader(json),
        });
      } catch {
        // skip unparseable version folders
      }
    }
  }

  return results;
}

/** In-memory cache to avoid re-reading the JSON on every IPC call. */
let cache: GameDirsStore | null = null;

function ensureDir(): void {
  const dir = path.dirname(DIRS_FILE);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function load(): GameDirsStore {
  if (cache) return cache;
  try {
    ensureDir();
    if (fs.existsSync(DIRS_FILE)) {
      cache = JSON.parse(fs.readFileSync(DIRS_FILE, 'utf-8')) as GameDirsStore;
      return cache;
    }
  } catch {
    console.error('Failed to load game dirs');
  }
  cache = { dirs: [getDefaultDir()] };
  return cache;
}

function save(store: GameDirsStore): void {
  cache = store;
  ensureDir();
  // Atomic write to avoid a torn file if the app is killed mid-save
  const tmp = DIRS_FILE + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(store, null, 2), 'utf-8');
  fs.renameSync(tmp, DIRS_FILE);
}

function getDefaultDir(): string {
  return getDefaultGameDir();
}

export { getDefaultGameDir } from '../paths';

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

/** Delete a version's folder from whichever game dir contains it. */
export function deleteVersion(versionId: string): { success: boolean; error?: string } {
  const versionDir = getVersionDir(versionId);
  if (!fs.existsSync(versionDir)) {
    return { success: false, error: '版本文件夹不存在' };
  }
  try {
    fs.rmSync(versionDir, { recursive: true, force: true });
    return { success: true };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : String(err) };
  }
}
