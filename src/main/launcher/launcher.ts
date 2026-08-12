import path from 'path';
import fs from 'fs';
import os from 'os';
import crypto from 'crypto';
import { spawn, type ChildProcess } from 'child_process';
import yauzl from 'yauzl';
import { getDefaultGameDir } from '../gameDirs/gameDirsStore';
import { downloadFile } from '../downloader/downloadFile';
import { libraryUrl, assetUrl } from '../mirrors';
import type { LaunchProgress } from '../../shared/constants';

type ProgressCallback = (progress: LaunchProgress) => void;

/** Currently running Minecraft process (if any). */
let runningProcess: ChildProcess | null = null;

/**
 * Set while a launch is being cancelled — checked between setup stages so a
 * cancel during library/asset download actually stops the launch (not just a
 * running game process).
 */
let launchAborted = false;

/** Cancel the current launch or terminate the running Minecraft process. */
export function stopGame(): void {
  launchAborted = true;
  if (runningProcess && !runningProcess.killed) {
    runningProcess.kill();
    runningProcess = null;
  }
}

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
  type?: string;
  mainClass?: string;
  minecraftArguments?: string;
  arguments?: {
    game?: Array<string | { rules?: OsRule[]; value?: string | string[] }>;
    jvm?: Array<string | { rules?: OsRule[]; value?: string | string[] }>;
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

/**
 * Resolve a version's full profile, following `inheritsFrom` (Fabric/Forge/…
 * profiles inherit the vanilla version). Merges libraries/args/mainClass and
 * returns which base version provides the client jar.
 */
function resolveVersionJson(
  versionId: string,
  gameDir: string,
): { json: VersionJson; clientVersionId: string } | null {
  const json = readVersionJson(versionId, gameDir);
  if (!json) return null;
  if (json.inheritsFrom) {
    const parent = resolveVersionJson(json.inheritsFrom, gameDir);
    if (parent) {
      return { json: mergeVersionJson(json, parent.json), clientVersionId: parent.clientVersionId };
    }
  }
  return { json, clientVersionId: versionId };
}

function mergeVersionJson(child: VersionJson, parent: VersionJson): VersionJson {
  return {
    ...parent,
    ...child,
    id: child.id,
    libraries: [...(parent.libraries ?? []), ...(child.libraries ?? [])],
    arguments: {
      game: [...(parent.arguments?.game ?? []), ...(child.arguments?.game ?? [])],
      jvm: [...(parent.arguments?.jvm ?? []), ...(child.arguments?.jvm ?? [])],
    },
    minecraftArguments: child.minecraftArguments || parent.minecraftArguments,
    mainClass: child.mainClass || parent.mainClass,
    assetIndex: child.assetIndex || parent.assetIndex,
    assets: child.assets || parent.assets,
  };
}

// ── Libraries download ──

/** Node's process.platform/arch -> version JSON rule naming. */
const VERSION_JSON_OS: Record<string, string> = {
  win32: 'windows',
  darwin: 'osx',
  linux: 'linux',
};
const VERSION_JSON_ARCH: Record<string, string> = {
  x64: 'x86_64',
  ia32: 'x86',
  arm64: 'arm64',
};

interface OsRule {
  action?: string;
  os?: { name?: string; arch?: string };
  features?: Record<string, boolean>;
}

/** Default feature context for a plain launch (no demo, no quick-play). */
const DEFAULT_FEATURES: Record<string, boolean> = {
  is_demo_user: false,
  has_custom_resolution: false,
  is_quick_play_singleplayer: false,
  is_quick_play_multiplayer: false,
  is_quick_play_realms: false,
};

function matchesRules(rules: OsRule[] | undefined, osName: string, arch: string): boolean {
  if (!rules) return true;
  let allowed = false;
  for (const rule of rules) {
    const osMatch = !rule.os?.name || rule.os.name === osName;
    const archMatch = !rule.os?.arch || rule.os.arch === arch;
    const featMatch = !rule.features || Object.entries(rule.features).every(
      ([k, v]) => (DEFAULT_FEATURES[k] ?? false) === v,
    );
    const match = osMatch && archMatch && featMatch;
    if (rule.action === 'allow') {
      if (match) allowed = true;
    } else if (rule.action === 'disallow') {
      if (match) allowed = false;
    }
  }
  return allowed;
}

function isLibraryForCurrentOs(lib: { rules?: OsRule[] }): boolean {
  // CRITICAL: version JSON uses 'windows'/'osx', Node uses 'win32'/'darwin' —
  // without the mapping every os-rule library is skipped and natives never download.
  return matchesRules(lib.rules, VERSION_JSON_OS[process.platform] ?? process.platform, VERSION_JSON_ARCH[process.arch] ?? process.arch);
}

/** Convert a Maven coordinate ("g:a:v[:classifier]") to a jar path. */
function nameToMavenPath(name: string): string {
  const parts = name.split(':');
  const group = parts[0].split('.').join('/');
  const artifact = parts[1];
  const version = parts[2];
  const classifier = parts[3];
  const fileBase = `${artifact}-${version}${classifier ? `-${classifier}` : ''}`;
  return `${group}/${artifact}/${version}/${fileBase}.jar`;
}

/**
 * Resolve a library's downloadable artifact. Standard Mojang JSON provides
 * `downloads.artifact`; Fabric/Quilt launcherMeta provide just a Maven
 * `name` + base `url`, so derive the path and URL from the coordinates.
 */
function getArtifact(lib: { name?: string; url?: string; downloads?: { artifact?: { url?: string; path?: string; size?: number } } }): { url: string; path: string; size: number } | null {
  if (lib.downloads?.artifact?.path) {
    return {
      url: lib.downloads.artifact.url || '',
      path: lib.downloads.artifact.path,
      size: lib.downloads.artifact.size ?? 0,
    };
  }
  if (lib.name && !lib.name.includes(':natives-')) {
    const path = nameToMavenPath(lib.name);
    return { url: (lib.url || 'https://libraries.minecraft.net/') + path, path, size: 0 };
  }
  return null;
}

/**
 * Modern versions declare natives as separate library entries whose *name*
 * carries the target platform, e.g. `org.lwjgl:lwjgl-glfw:3.4.1:natives-windows`
 * or `...:natives-windows-arm64`. Rules don't include arch, so filter by name.
 */
function isNativeForCurrentPlatform(lib: { name?: string }): boolean {
  const m = (lib.name || '').match(/:natives-(windows|osx|linux)(?:-(arm64|x86|x86_64))?$/);
  if (!m) return false;
  const [, os, arch] = m;
  const currentOs = VERSION_JSON_OS[process.platform] ?? process.platform;
  const currentArch = VERSION_JSON_ARCH[process.arch] ?? process.arch;
  if (os !== currentOs) return false;
  if (arch && arch !== currentArch) return false;
  return true;
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
    if (launchAborted) break;
    const lib = libs[i];
    if (!isLibraryForCurrentOs(lib)) continue;
    // Skip natives for other OS/arch (declared as separate library entries).
    if (lib.name?.includes(':natives-') && !isNativeForCurrentPlatform(lib)) continue;
    onProgress({ stage: 'libraries', percent: Math.round((i / libs.length) * 100) });

    const artifact = getArtifact(lib);
    if (artifact?.url && artifact.path) {
      const dest = path.join(libsDir, artifact.path);
      if (!fs.existsSync(dest)) {
        try {
          await downloadFile(libraryUrl(artifact.url), dest);
        } catch (err) {
          console.error(`[Launcher] Failed to download library ${artifact.path}:`, err);
        }
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
            try {
              await downloadFile(native.url, dest);
            } catch (err) {
              console.error(`[Launcher] Failed to download natives ${native.path}:`, err);
            }
          }
          libsPath.push(dest);
        }
      }
    }
  }
  return libsPath.join(';');
}

/**
 * Collect the classpath for a version without downloading anything —
 * used by the "export launch script" feature (assets/libraries must already
 * be present, as they are after a successful launch).
 */
function collectLibrariesPath(versionJson: VersionJson, gameDir: string): string {
  const libsDir = path.join(gameDir, 'libraries');
  const libsPath: string[] = [];
  for (const lib of versionJson.libraries || []) {
    if (!isLibraryForCurrentOs(lib)) continue;
    if (lib.name?.includes(':natives-') && !isNativeForCurrentPlatform(lib)) continue;
    const artifact = getArtifact(lib);
    if (artifact?.path) libsPath.push(path.join(libsDir, artifact.path));
    const natives = lib.downloads?.classifiers;
    if (natives) {
      const nativeKey = Object.keys(natives).find(
        (k) => k.startsWith('natives-windows') && (k.includes('64') || !k.includes('32')),
      );
      if (nativeKey && natives[nativeKey]?.path) libsPath.push(path.join(libsDir, natives[nativeKey].path));
    }
  }
  return libsPath.join(';');
}

/**
 * Generate a standalone `launch.bat` for a version and write it into the
 * version folder. Reuses the same argument builder as a real launch.
 */
export async function exportLaunchScript(
  versionId: string,
  auth: LaunchAuth,
  options?: LaunchOptions,
): Promise<{ success: boolean; path?: string; error?: string }> {
  try {
    const gameDir = getDefaultGameDir();
    const resolved = resolveVersionJson(versionId, gameDir);
    if (!resolved) return { success: false, error: '版本信息缺失' };
    const { json: versionJson, clientVersionId } = resolved;

    const javaPath = options?.javaPath || findJavaPath();
    if (!javaPath) return { success: false, error: '未找到 Java' };

    const libsPath = collectLibrariesPath(versionJson, gameDir);
    const nativesDir = await unpackNatives(versionJson, gameDir);
    const assetIndexId = versionJson.assetIndex?.id || versionJson.assets || 'legacy';

    const args = buildArgs(
      versionJson,
      gameDir,
      nativesDir,
      assetIndexId,
      libsPath,
      auth.playerName,
      auth.uuid,
      auth.accessToken,
      options,
      clientVersionId,
    );

    const quoted = args.map((a) => (/[\s"]/.test(a) ? `"${a.replace(/"/g, '\\"')}"` : a)).join(' ');
    const bat = ['@echo off', `"${javaPath}" ${quoted}`, 'pause'].join('\r\n');

    const scriptPath = path.join(gameDir, 'versions', versionId, 'launch.bat');
    fs.writeFileSync(scriptPath, bat, 'utf-8');
    return { success: true, path: scriptPath };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : String(err) };
  }
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
      try {
        await downloadFile(versionJson.assetIndex.url, indexPath);
      } catch (err) {
        console.error(`[Launcher] Failed to download asset index ${assetIndexId}:`, err);
      }
    }
  }

  // Download objects
  const indexPath = path.join(indexDir, `${assetIndexId}.json`);
  if (fs.existsSync(indexPath)) {
    try {
      const index = JSON.parse(fs.readFileSync(indexPath, 'utf-8')) as AssetIndexJson;
      const objects = Object.values(index.objects || {});
      for (let i = 0; i < objects.length; i++) {
        if (launchAborted) break;
        const obj = objects[i];
        if (!obj?.hash) continue;
        onProgress({ stage: 'assets', percent: Math.round((i / objects.length) * 100) });
        const hash = obj.hash;
        const dest = path.join(objectsDir, hash.slice(0, 2), hash);
        if (!fs.existsSync(dest)) {
          try {
            await downloadFile(assetUrl(hash), dest);
          } catch (err) {
            console.error(`[Launcher] Failed to download asset ${hash}:`, err);
          }
        }
      }
    } catch (err) {
      console.error('[Launcher] Failed to parse asset index:', err);
    }
  }
  return assetIndexId;
}

// ── Natives unpack ──

/**
 * Extract a zip/jar into `outDir`. Only files matching `filter` (when given)
 * are extracted; paths are flattened to basenames to avoid zip-slip.
 */
function extractZip(zipPath: string, outDir: string, filter?: (name: string) => boolean): Promise<void> {
  return new Promise((resolve) => {
    fs.mkdirSync(outDir, { recursive: true });
    yauzl.open(zipPath, { lazyEntries: true }, (err, zipfile) => {
      if (err || !zipfile) {
        console.error(`[Launcher] Failed to open zip ${zipPath}:`, err);
        resolve();
        return;
      }
      zipfile.readEntry();
      zipfile.on('entry', (entry) => {
        const name = entry.fileName;
        if (entry.fileName.endsWith('/') || (filter && !filter(name))) {
          zipfile.readEntry();
          return;
        }
        zipfile.openReadStream(entry, (streamErr, stream) => {
          if (streamErr || !stream) {
            console.error(`[Launcher] Failed to read entry ${name}:`, streamErr);
            zipfile.readEntry();
            return;
          }
          const dest = path.join(outDir, path.basename(name));
          const out = fs.createWriteStream(dest);
          stream.pipe(out);
          out.on('finish', () => {
            out.close();
            zipfile.readEntry();
          });
          out.on('error', () => zipfile.readEntry());
        });
      });
      zipfile.on('end', () => {
        zipfile.close();
        resolve();
      });
      zipfile.on('error', () => resolve());
    });
  });
}

/**
 * Unpack native libraries (.dll) into the natives root, which the version's
 * JVM args expect to be laid out as `<root>/java` (with jna/lwjgl/netty
 * subdirs used by those libraries at runtime). Handles both the legacy
 * classifier structure and the modern "natives as separate library entries".
 */
async function unpackNatives(versionJson: VersionJson, gameDir: string): Promise<string> {
  const nativesRoot = path.join(os.tmpdir(), `rlv-natives-${versionJson.id || 'mc'}`);
  for (const sub of ['java', 'jna', 'lwjgl', 'netty']) {
    fs.mkdirSync(path.join(nativesRoot, sub), { recursive: true });
  }
  const nativesJavaDir = path.join(nativesRoot, 'java');

  const libs = versionJson.libraries || [];
  for (const lib of libs) {
    if (!isLibraryForCurrentOs(lib)) continue;
    if (lib.name?.includes(':natives-') && !isNativeForCurrentPlatform(lib)) continue;

    // Legacy structure: natives live in a classifier jar of the main library.
    let nativeJarPath: string | null = null;
    const classifiers = lib.downloads?.classifiers;
    if (classifiers) {
      const key =
        Object.keys(classifiers).find(
          (k) => k.startsWith('natives-windows') && (k.includes('64') || !k.includes('32')),
        ) ?? '';
      const native = classifiers[key];
      if (native?.path) nativeJarPath = path.join(gameDir, 'libraries', native.path);
    }
    // Modern structure: the library entry itself is the natives jar.
    if (!nativeJarPath && lib.name?.includes(':natives-')) {
      const art = lib.downloads?.artifact;
      if (art?.path) nativeJarPath = path.join(gameDir, 'libraries', art.path);
    }
    if (!nativeJarPath || !fs.existsSync(nativeJarPath)) continue;
    await extractZip(nativeJarPath, nativesJavaDir, (name) => name.endsWith('.dll'));
  }

  return nativesRoot;
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
  options?: LaunchOptions,
  clientVersionId?: string,
): string[] {
  const versionId = versionJson.id || '';
  // Some loader profiles (e.g. OptiFine) ship their OWN patched client jar;
  // otherwise the client jar lives in the base (inherited) version.
  const ownJar = path.join(gameDir, 'versions', versionId, `${versionId}.jar`);
  const jarOwner = clientVersionId || versionId;
  const versionJar = fs.existsSync(ownJar)
    ? ownJar
    : path.join(gameDir, 'versions', jarOwner, `${jarOwner}.jar`);
  const classpath = `${libsPath};${versionJar}`;
  // Isolated versions run inside their own folder (saves/mods are per-version).
  const gameDirArg = options?.isolation ? path.join(gameDir, 'versions', versionId) : gameDir;
  const assetsDir = path.join(gameDir, 'assets');
  const osName = VERSION_JSON_OS[process.platform] ?? process.platform;
  const arch = VERSION_JSON_ARCH[process.arch] ?? process.arch;

  // ── JVM args: use the version's arguments.jvm (rules + interpolation) so
  //    version-specific flags (e.g. --sun-misc-unsafe-memory-access on 25) apply.
  const jvmVars: Record<string, string> = {
    natives_directory: nativesDir,
    launcher_name: 'rlv',
    launcher_version: '0.1.0',
    classpath,
  };
  const jvm: string[] = [];
  const versionJvm = versionJson.arguments?.jvm;
  if (Array.isArray(versionJvm)) {
    for (const arg of versionJvm) {
      if (typeof arg === 'string') {
        jvm.push(interpolate(arg, jvmVars));
      } else if (arg.value) {
        if (!matchesRules(arg.rules, osName, arch)) continue;
        const values = Array.isArray(arg.value) ? arg.value : [arg.value];
        for (const v of values) jvm.push(interpolate(v, jvmVars));
      }
    }
  } else {
    // Fallback for versions without structured JVM args.
    jvm.push(
      `-Djava.library.path=${path.join(nativesDir, 'java')}`,
      `-Dminecraft.launcher.brand=rlv`,
      `-Dminecraft.launcher.version=0.1.0`,
      '-cp',
      classpath,
    );
  }

  // Memory limit + extra JVM args (inserted before -cp).
  if (options?.memoryMB) {
    jvm.unshift(`-Xmx${options.memoryMB}m`);
  }
  if (options?.jvmArgs?.length) {
    const cpIdx = jvm.lastIndexOf('-cp');
    if (cpIdx >= 0) jvm.splice(cpIdx, 0, ...options.jvmArgs);
    else jvm.push(...options.jvmArgs);
  }

  // ── Game args ──
  const gameVars: Record<string, string> = {
    game_directory: gameDirArg,
    assets_index_name: assetIndexId,
    assets_root: assetsDir,
    version_name: versionId,
    auth_player_name: playerName,
    auth_uuid: uuid,
    auth_access_token: accessToken,
    clientid: '0',
    auth_xuid: '',
    version_type: versionJson.type || 'release',
  };
  let game: string[] = [];
  if (versionJson.arguments?.game) {
    for (const arg of versionJson.arguments.game) {
      if (typeof arg === 'string') {
        game.push(interpolate(arg, gameVars));
      } else if (arg.value) {
        if (!matchesRules(arg.rules, osName, arch)) continue;
        const values = Array.isArray(arg.value) ? arg.value : [arg.value];
        for (const v of values) game.push(interpolate(v, gameVars));
      }
    }
  } else if (versionJson.minecraftArguments) {
    game = versionJson.minecraftArguments.split(' ').map((arg) => interpolate(arg, gameVars));
  }

  return [...jvm, versionJson.mainClass || 'net.minecraft.client.main.Main', ...game, ...(options?.gameArgs ?? [])];
}

function interpolate(template: string, vars: Record<string, string>): string {
  return template.replace(/\$\{(\w+)\}/g, (_, name) => vars[name] ?? `\${${name}}`);
}

export interface LaunchResult {
  success: boolean;
  error?: string;
}

/**
 * Re-download any missing libraries/assets/natives for a version. Used by the
 * "补全文件" button to repair an incomplete install.
 */
export async function completeVersionFiles(
  versionId: string,
  gameDir: string,
): Promise<{ success: boolean; error?: string }> {
  try {
    const resolved = resolveVersionJson(versionId, gameDir);
    if (!resolved) return { success: false, error: '版本信息缺失' };
    const { json: versionJson } = resolved;
    const noop = () => {};
    await downloadLibraries(versionJson, gameDir, noop);
    await downloadAssets(versionJson, gameDir, noop);
    await unpackNatives(versionJson, gameDir);
    return { success: true };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : String(err) };
  }
}

/** Optional per-launch overrides (memory / extra JVM args / extra game args). */
export interface LaunchOptions {
  memoryMB?: number;
  jvmArgs?: string[];
  gameArgs?: string[];
  /** Version isolation: run each version in its own folder for saves/mods/… */
  isolation?: boolean;
  /** Custom Java executable path (empty = auto-detect). */
  javaPath?: string;
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
  gameDir?: string,
  options?: LaunchOptions,
): Promise<LaunchResult> {
  const dir = gameDir ?? getDefaultGameDir();
  launchAborted = false;

  const checkAborted = () => {
    if (launchAborted) {
      onProgress({ stage: 'error', percent: 0, error: '已取消启动' });
      return true;
    }
    return false;
  };

  try {
    // 1. Find Java
    onProgress({ stage: 'java', percent: 5, message: '检测 Java…' });
    const javaPath = options?.javaPath || findJavaPath();
    if (!javaPath) {
      onProgress({ stage: 'error', percent: 0, error: '未找到 Java，请安装 Java 8+ 或配置 JAVA_HOME' });
      return { success: false, error: 'Java not found' };
    }

    // 2. Resolve version (follows inheritsFrom for Fabric/Forge profiles)
    onProgress({ stage: 'resolve', percent: 10, message: '读取版本信息…' });
    const resolved = resolveVersionJson(versionId, dir);
    if (!resolved) {
      onProgress({ stage: 'error', percent: 0, error: '版本信息缺失，请先下载该版本' });
      return { success: false, error: 'Version JSON not found' };
    }
    const { json: versionJson, clientVersionId } = resolved;

    // 3. Download libraries
    onProgress({ stage: 'libraries', percent: 15, message: '下载依赖库…' });
    const libsPath = await downloadLibraries(versionJson, dir, onProgress);
    if (checkAborted()) return { success: false, error: 'cancelled' };

    // 4. Download assets
    onProgress({ stage: 'assets', percent: 40, message: '下载资源文件…' });
    const assetIndexId = await downloadAssets(versionJson, dir, onProgress);
    if (checkAborted()) return { success: false, error: 'cancelled' };

    // 5. Natives
    onProgress({ stage: 'natives', percent: 80, message: '准备 natives…' });
    const nativesDir = await unpackNatives(versionJson, dir);
    if (checkAborted()) return { success: false, error: 'cancelled' };

    // 6. Build command
    onProgress({ stage: 'launch', percent: 90, message: '启动游戏…' });
    const args = buildArgs(
      versionJson,
      dir,
      nativesDir,
      assetIndexId,
      libsPath,
      auth.playerName,
      auth.uuid,
      auth.accessToken,
      options,
      clientVersionId,
    );

    // 7. Launch
    if (checkAborted()) return { success: false, error: 'cancelled' };

    // Log the exact command (access token redacted) for debugging.
    const redacted = args.map((a) => (a.includes(auth.accessToken) && auth.accessToken !== '0' ? '***' : a));
    console.log(`[Launcher] Java: ${javaPath}`);
    console.log(`[Launcher] Command: ${['java', ...redacted].join(' ')}`);

    const workDir = options?.isolation ? path.join(dir, 'versions', versionJson.id || '') : dir;
    fs.mkdirSync(workDir, { recursive: true });
    const child = spawn(javaPath, args, { stdio: ['ignore', 'pipe', 'pipe'], cwd: workDir });
    runningProcess = child;

    // Forward Minecraft output to the launcher console + a per-launch log file.
    // (Logging is best-effort — a failed log file must not fail the launch.)
    let logPath = '';
    let logStream: fs.WriteStream | null = null;
    try {
      logPath = path.join(dir, 'logs', `rlv-launch-${versionId}-${Date.now()}.log`);
      fs.mkdirSync(path.dirname(logPath), { recursive: true });
      logStream = fs.createWriteStream(logPath, { flags: 'a' });
    } catch {}
    const forward = (chunk: Buffer) => {
      const text = chunk.toString();
      try {
        logStream?.write(text);
      } catch {}
      for (const line of text.split(/\r?\n/)) {
        if (line.trim()) console.log(`[Minecraft] ${line}`);
      }
    };
    child.stdout?.on('data', forward);
    child.stderr?.on('data', forward);

    child.on('error', (err) => {
      console.error('[Launcher] Failed to spawn Java:', err);
      runningProcess = null;
      onProgress({ stage: 'error', percent: 0, error: `无法启动 Java: ${err.message}` });
    });
    child.on('close', (code) => {
      runningProcess = null;
      try {
        logStream?.end();
      } catch {}
      console.log(`[Launcher] Minecraft exited with code ${code}`);
      if (logPath) console.log(`[Launcher] Game log: ${logPath}`);
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
