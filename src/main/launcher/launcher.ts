import path from 'path';
import fs from 'fs';
import os from 'os';
import crypto from 'crypto';
import https from 'https';
import http from 'http';
import { spawn, type ChildProcess } from 'child_process';
import { getDefaultGameDir } from '../gameDirs/gameDirsStore';

export interface LaunchProgress {
  stage: 'java' | 'resolve' | 'libraries' | 'assets' | 'natives' | 'launch' | 'done' | 'error';
  percent: number;
  message?: string;
  error?: string;
}

type ProgressCallback = (progress: LaunchProgress) => void;

/** Generate Minecraft offline-mode UUID from username (Java UUID.nameUUIDFromBytes, no dashes) */
export function offlineUUID(name: string): string {
  const hash = crypto.createHash('md5').update(name, 'utf8').digest();
  hash[6] = (hash[6] & 0x0f) | 0x30; // version 3
  hash[8] = (hash[8] & 0x3f) | 0x80; // variant
  return hash.toString('hex');
}

// ── Java detection ──

export function findJavaPath(): string | null {
  // 1. JAVA_HOME
  if (process.env.JAVA_HOME) {
    const p = path.join(process.env.JAVA_HOME, 'bin', 'java.exe');
    if (fs.existsSync(p)) return p;
  }
  // 2. PATH
  const paths = (process.env.PATH || '').split(path.delimiter);
  for (const dir of paths) {
    const p = path.join(dir, 'java.exe');
    if (fs.existsSync(p)) return p;
  }
  // 3. Common install locations
  const candidates = [
    'C:\\Program Files\\Java',
    'C:\\Program Files (x86)\\Java',
    'C:\\Program Files\\Eclipse Adoptium',
    `${os.homedir()}\\.jdks`,
  ];
  for (const base of candidates) {
    if (fs.existsSync(base)) {
      for (const dir of fs.readdirSync(base)) {
        const p = path.join(base, dir, 'bin', 'java.exe');
        if (fs.existsSync(p)) return p;
      }
    }
  }
  return null;
}

// ── Version resolution ──

interface VersionJson {
  id: string;
  mainClass?: string;
  minecraftArguments?: string;
  arguments?: {
    game?: Array<string | { rules?: unknown[]; value?: string | string[] }>;
    jvm?: Array<string | { rules?: unknown[]; value?: string | string[] }>;
  };
  libraries?: Array<{
    name?: string;
    downloads?: {
      artifact?: { url?: string; path?: string; size?: number };
      classifiers?: Record<string, { url?: string; path?: string; size?: number }>;
    };
    rules?: Array<{ action?: string; os?: { name?: string } }>;
  }>;
  assetIndex?: { id?: string; url?: string };
  assets?: string;
  inheritsFrom?: string;
}

function readVersionJson(versionId: string, gameDir: string): VersionJson | null {
  const jsonPath = path.join(gameDir, 'versions', versionId, `${versionId}.json`);
  if (!fs.existsSync(jsonPath)) return null;
  try {
    return JSON.parse(fs.readFileSync(jsonPath, 'utf-8'));
  } catch {
    return null;
  }
}

// ── Download helpers ──

function downloadFile(url: string, dest: string): Promise<void> {
  return new Promise((resolve, reject) => {
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    const mod = url.startsWith('https:') ? https : http;
    const tmp = dest + '.tmp';
    const file = fs.createWriteStream(tmp);
    mod
      .get(url, (res) => {
        if (res.statusCode === 302 || res.statusCode === 301) {
          downloadFile(res.headers.location!, dest).then(resolve).catch(reject);
          return;
        }
        if (res.statusCode !== 200) {
          file.close();
          try { fs.unlinkSync(tmp); } catch {}
          reject(new Error(`HTTP ${res.statusCode}`));
          return;
        }
        res.pipe(file);
        file.on('finish', () => {
          file.close();
          fs.renameSync(tmp, dest);
          resolve();
        });
      })
      .on('error', (err) => {
        file.close();
        try { fs.unlinkSync(tmp); } catch {}
        reject(err);
      });
  });
}

// ── Libraries download ──

function isLibraryForCurrentOs(lib: { rules?: Array<{ action?: string; os?: { name?: string } }> }): boolean {
  if (!lib.rules) return true;
  let allowed = false;
  for (const rule of lib.rules) {
    const osMatch = !rule.os || rule.os.name === process.platform;
    if (rule.action === 'allow') {
      if (osMatch) allowed = true;
    } else if (rule.action === 'disallow') {
      if (osMatch) allowed = false;
    }
  }
  return allowed;
}

async function downloadLibraries(
  versionJson: VersionJson,
  gameDir: string,
  onProgress: ProgressCallback,
): Promise<string> {
  const libsDir = path.join(gameDir, 'libraries');
  const libsPath: string[] = [];
  const libs = versionJson.libraries || [];

  for (let i = 0; i < libs.length; i++) {
    const lib = libs[i];
    if (!isLibraryForCurrentOs(lib)) continue;
    onProgress({ stage: 'libraries', percent: Math.round((i / libs.length) * 100) });

    const artifact = lib.downloads?.artifact;
    if (artifact?.url && artifact.path) {
      const dest = path.join(libsDir, artifact.path);
      if (!fs.existsSync(dest)) {
        try { await downloadFile(artifact.url, dest); } catch {}
      }
      libsPath.push(dest);
    }

    // Native classifiers
    const natives = lib.downloads?.classifiers;
    if (natives) {
      const nativeKey = Object.keys(natives).find(
        (k) => k.startsWith('natives-windows') && (k.includes('64') || !k.includes('32')),
      );
      if (nativeKey) {
        const native = natives[nativeKey];
        if (native?.url && native.path) {
          const dest = path.join(libsDir, native.path);
          if (!fs.existsSync(dest)) {
            try { await downloadFile(native.url, dest); } catch {}
          }
          libsPath.push(dest);
        }
      }
    }
  }
  return libsPath.join(';');
}

// ── Assets download ──

interface AssetIndexJson {
  objects?: Record<string, { hash?: string; size?: number }>;
}

async function downloadAssets(
  versionJson: VersionJson,
  gameDir: string,
  onProgress: ProgressCallback,
): Promise<string> {
  const assetIndexId = versionJson.assetIndex?.id || versionJson.assets || 'legacy';
  const assetsDir = path.join(gameDir, 'assets');
  const objectsDir = path.join(assetsDir, 'objects');
  const indexDir = path.join(assetsDir, 'indexes');

  // Download asset index
  if (versionJson.assetIndex?.url) {
    const indexPath = path.join(indexDir, `${assetIndexId}.json`);
    if (!fs.existsSync(indexPath)) {
      try { await downloadFile(versionJson.assetIndex.url, indexPath); } catch {}
    }
  }

  // Download objects
  const indexPath = path.join(indexDir, `${assetIndexId}.json`);
  if (fs.existsSync(indexPath)) {
    try {
      const index = JSON.parse(fs.readFileSync(indexPath, 'utf-8')) as AssetIndexJson;
      const objects = Object.values(index.objects || {});
      for (let i = 0; i < objects.length; i++) {
        const obj = objects[i];
        if (!obj?.hash) continue;
        onProgress({ stage: 'assets', percent: Math.round((i / objects.length) * 100) });
        const hash = obj.hash;
        const dest = path.join(objectsDir, hash.slice(0, 2), hash);
        if (!fs.existsSync(dest)) {
          try {
            await downloadFile(
              `https://resources.download.minecraft.net/${hash.slice(0, 2)}/${hash}`,
              dest,
            );
          } catch {}
        }
      }
    } catch {}
  }
  return assetIndexId;
}

// ── Natives unpack ──

function unpackNatives(versionJson: VersionJson, gameDir: string): string {
  const nativesDir = path.join(os.tmpdir(), `rlv-natives-${versionJson.id || 'mc'}`);
  fs.mkdirSync(nativesDir, { recursive: true });
  return nativesDir;
}

// ── Command build & launch ──

function buildArgs(
  versionJson: VersionJson,
  gameDir: string,
  nativesDir: string,
  assetIndexId: string,
  libsPath: string,
  playerName: string,
  uuid: string,
  accessToken: string,
): string[] {
  const versionId = versionJson.id || '';
  const versionJar = path.join(gameDir, 'versions', versionId, `${versionId}.jar`);
  const classpath = `${libsPath};${versionJar}`;
  const gameDirArg = gameDir;
  const assetsDir = path.join(gameDir, 'assets');

  // JVM args
  const jvm: string[] = [
    `-Djava.library.path=${nativesDir}`,
    `-Dminecraft.launcher.brand=rlv`,
    `-Dminecraft.launcher.version=0.1.0`,
    `-cp`,
    classpath,
  ];

  // Legacy (1.12-) vs modern (1.13+) args
  let game: string[] = [];
  if (versionJson.arguments?.game) {
    for (const arg of versionJson.arguments.game) {
      if (typeof arg === 'string') {
        game.push(arg);
      } else if (arg.value) {
        const values = Array.isArray(arg.value) ? arg.value : [arg.value];
        for (const v of values) {
          game = game.concat(interpolate(v, {
            game_dir: gameDirArg,
            assets_index_name: assetIndexId,
            assets_root: assetsDir,
            version_name: versionId,
            auth_player_name: playerName,
            auth_uuid: uuid,
            auth_access_token: accessToken,
          }));
        }
      }
    }
  } else if (versionJson.minecraftArguments) {
    game = versionJson.minecraftArguments.split(' ').map((arg) =>
      interpolate(arg, {
        game_dir: gameDirArg,
        assets_index_name: assetIndexId,
        assets_root: assetsDir,
        version_name: versionId,
        auth_player_name: playerName,
        auth_uuid: uuid,
        auth_access_token: accessToken,
      }),
    );
  }

  return [...jvm, versionJson.mainClass || 'net.minecraft.client.main.Main', ...game];
}

function interpolate(template: string, vars: Record<string, string>): string {
  return template.replace(/\$\{(\w+)\}/g, (_, name) => vars[name] ?? `\${${name}}`);
}

export interface LaunchResult {
  success: boolean;
  error?: string;
}

export interface LaunchAuth {
  playerName: string;
  uuid: string;
  accessToken: string;
}

export async function launchGame(
  versionId: string,
  auth: LaunchAuth,
  onProgress: ProgressCallback,
): Promise<LaunchResult> {
  const gameDir = getDefaultGameDir();

  try {
    // 1. Find Java
    onProgress({ stage: 'java', percent: 5, message: '检测 Java…' });
    const javaPath = findJavaPath();
    if (!javaPath) {
      onProgress({ stage: 'error', percent: 0, error: '未找到 Java，请安装 Java 8+ 或配置 JAVA_HOME' });
      return { success: false, error: 'Java not found' };
    }

    // 2. Resolve version
    onProgress({ stage: 'resolve', percent: 10, message: '读取版本信息…' });
    const versionJson = readVersionJson(versionId, gameDir);
    if (!versionJson) {
      onProgress({ stage: 'error', percent: 0, error: '版本信息缺失，请先下载该版本' });
      return { success: false, error: 'Version JSON not found' };
    }

    // 3. Download libraries
    onProgress({ stage: 'libraries', percent: 15, message: '下载依赖库…' });
    const libsPath = await downloadLibraries(versionJson, gameDir, onProgress);

    // 4. Download assets
    onProgress({ stage: 'assets', percent: 40, message: '下载资源文件…' });
    const assetIndexId = await downloadAssets(versionJson, gameDir, onProgress);

    // 5. Natives
    onProgress({ stage: 'natives', percent: 80, message: '准备 natives…' });
    const nativesDir = unpackNatives(versionJson, gameDir);

    // 6. Build command
    onProgress({ stage: 'launch', percent: 90, message: '启动游戏…' });
    const args = buildArgs(
      versionJson,
      gameDir,
      nativesDir,
      assetIndexId,
      libsPath,
      auth.playerName,
      auth.uuid,
      auth.accessToken,
    );

    // 7. Launch
    const child = spawn(javaPath, args, { stdio: 'inherit' });
    child.on('close', () => {
      onProgress({ stage: 'done', percent: 100 });
    });

    onProgress({ stage: 'done', percent: 100, message: '游戏已启动' });
    return { success: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    onProgress({ stage: 'error', percent: 0, error: message });
    return { success: false, error: message };
  }
}
