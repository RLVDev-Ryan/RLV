import path from 'path';
import fs from 'fs';
import os from 'os';
import { spawn } from 'child_process';
import { downloadFile } from '../downloader/downloadFile';
import { downloadVersion } from '../downloader/downloaderManager';
import { findJavaPath } from '../launcher/launcher';

export type LoaderKey = 'fabric' | 'forge' | 'neoforge' | 'quilt' | 'optifine';

export interface LoaderInstallResult {
  success: boolean;
  versionId?: string;
  error?: string;
}

type InstallProgress = (stage: string, percent: number, message?: string) => void;

/**
 * Install a mod loader for a game version. Fabric/Quilt write a version profile
 * from their meta API (inheriting the vanilla version); Forge/NeoForge run
 * their official installer jar headlessly.
 */
export async function installLoader(
  loader: LoaderKey,
  gameVersion: string,
  gameDir: string,
  onProgress: InstallProgress = () => {},
): Promise<LoaderInstallResult> {
  try {
    switch (loader) {
      case 'fabric':
        return await installFabric(gameVersion, gameDir, onProgress);
      case 'quilt':
        return await installQuilt(gameVersion, gameDir, onProgress);
      case 'forge':
        return await installForge(gameVersion, gameDir, onProgress);
      case 'neoforge':
        return await installNeoForge(gameVersion, gameDir, onProgress);
      case 'optifine':
        return await installOptiFine(gameVersion, gameDir, onProgress);
    }
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : String(err) };
  }
}

/** Make sure the vanilla game version (jar + json) is present. */
async function ensureVanilla(gameVersion: string, gameDir: string, onProgress: InstallProgress): Promise<void> {
  const jsonPath = path.join(gameDir, 'versions', gameVersion, `${gameVersion}.json`);
  const jarPath = path.join(gameDir, 'versions', gameVersion, `${gameVersion}.jar`);
  if (fs.existsSync(jsonPath) && fs.existsSync(jarPath)) return;
  onProgress('manifest', 15, '准备原版版本…');
  await downloadVersion(gameVersion, gameDir, () => {});
}

/** Write a version JSON from a loader profile into the versions dir. */
function writeVersionJson(gameDir: string, profile: { id: string } & Record<string, unknown>): void {
  const dir = path.join(gameDir, 'versions', profile.id);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, `${profile.id}.json`), JSON.stringify(profile, null, 2), 'utf-8');
}

/** Build a version profile JSON from a Fabric/Quilt launcherMeta payload. */
function buildLoaderProfile(
  gameVersion: string,
  loaderLabel: string,
  loaderVersion: string,
  placeholders: Record<string, string>,
  launcherMeta: {
    mainClass?: { client?: string };
    arguments?: unknown;
    libraries?: { common?: unknown[]; client?: unknown[] };
  },
): { id: string } & Record<string, unknown> {
  const sub = (s: string) => Object.entries(placeholders).reduce((acc, [k, v]) => acc.split(`{${k}}`).join(v), s);
  const libs = [...(launcherMeta.libraries?.common ?? []), ...(launcherMeta.libraries?.client ?? [])].map((lib) =>
    JSON.parse(sub(JSON.stringify(lib))),
  );
  const now = new Date().toISOString();
  return {
    id: `${gameVersion}-${loaderLabel}-${loaderVersion}`,
    inheritsFrom: gameVersion,
    releaseTime: now,
    time: now,
    type: 'release',
    mainClass: launcherMeta.mainClass?.client,
    arguments: launcherMeta.arguments,
    libraries: libs,
  };
}

async function installFabric(
  gameVersion: string,
  gameDir: string,
  onProgress: InstallProgress,
): Promise<LoaderInstallResult> {
  await ensureVanilla(gameVersion, gameDir, onProgress);
  onProgress('loader', 20, '获取 Fabric 版本…');
  const res = await fetch(`https://meta.fabricmc.net/v2/versions/loader/${gameVersion}`);
  if (!res.ok) return { success: false, error: `Fabric 暂不支持 ${gameVersion}` };
  const loaders = (await res.json()) as Array<{ loader: { version: string }; intermediary: { version: string } }>;
  if (!loaders.length) return { success: false, error: `Fabric 暂不支持 ${gameVersion}` };
  const { loader, intermediary } = loaders[0];
  onProgress('loader', 40, '下载 Fabric 配置…');
  const metaRes = await fetch(`https://meta.fabricmc.net/v2/versions/loader/${gameVersion}/${loader.version}`);
  if (!metaRes.ok) return { success: false, error: 'Fabric 配置下载失败' };
  const meta = (await metaRes.json()) as { launcherMeta: Parameters<typeof buildLoaderProfile>[4] };
  const profile = buildLoaderProfile(
    gameVersion,
    'fabric',
    loader.version,
    { loader: loader.version, intermediary: intermediary.version },
    meta.launcherMeta,
  );
  writeVersionJson(gameDir, profile);
  onProgress('done', 100, 'Fabric 安装完成');
  return { success: true, versionId: profile.id };
}

async function installQuilt(
  gameVersion: string,
  gameDir: string,
  onProgress: InstallProgress,
): Promise<LoaderInstallResult> {
  await ensureVanilla(gameVersion, gameDir, onProgress);
  onProgress('loader', 20, '获取 Quilt 版本…');
  const res = await fetch(`https://meta.quiltmc.org/v3/versions/loader/${gameVersion}`);
  if (!res.ok) return { success: false, error: `Quilt 暂不支持 ${gameVersion}` };
  const loaders = (await res.json()) as Array<{
    loader: { version: string };
    intermediary: { version: string };
    mappings: { version: string };
  }>;
  if (!loaders.length) return { success: false, error: `Quilt 暂不支持 ${gameVersion}` };
  const { loader, intermediary, mappings } = loaders[0];
  onProgress('loader', 40, '下载 Quilt 配置…');
  const metaRes = await fetch(`https://meta.quiltmc.org/v3/versions/loader/${gameVersion}/${loader.version}`);
  if (!metaRes.ok) return { success: false, error: 'Quilt 配置下载失败' };
  const meta = (await metaRes.json()) as { launcherMeta: Parameters<typeof buildLoaderProfile>[4] };
  const profile = buildLoaderProfile(
    gameVersion,
    'quilt',
    loader.version,
    { loader: loader.version, intermediary: intermediary.version, mappings: mappings.version },
    meta.launcherMeta,
  );
  writeVersionJson(gameDir, profile);
  onProgress('done', 100, 'Quilt 安装完成');
  return { success: true, versionId: profile.id };
}

async function runInstallerJar(installerPath: string, args: string[], onProgress: InstallProgress): Promise<void> {
  const javaPath = findJavaPath();
  if (!javaPath) throw new Error('未找到 Java，无法运行安装器');
  onProgress('installer', 70, '运行安装器…');
  await new Promise<void>((resolve, reject) => {
    const child = spawn(javaPath, ['-jar', installerPath, ...args], { stdio: 'pipe' });
    let out = '';
    child.stdout?.on('data', (d: Buffer) => (out += d.toString()));
    child.stderr?.on('data', (d: Buffer) => (out += d.toString()));
    child.on('error', reject);
    child.on('close', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`安装器退出码 ${code}: ${out.slice(-500)}`));
    });
  });
}

async function installForge(
  gameVersion: string,
  gameDir: string,
  onProgress: InstallProgress,
): Promise<LoaderInstallResult> {
  await ensureVanilla(gameVersion, gameDir, onProgress);
  onProgress('loader', 25, '获取 Forge 版本…');
  const meta = await (
    await fetch('https://maven.minecraftforge.net/net/minecraftforge/forge/maven-metadata.xml')
  ).text();
  const versions = [...meta.matchAll(/<version>([^<]+)<\/version>/g)].map((m) => m[1]);
  const matches = versions.filter((v) => v.startsWith(`${gameVersion}-`));
  if (!matches.length) return { success: false, error: `Forge 暂不支持 ${gameVersion}` };
  const forgeVersion = matches[matches.length - 1];
  const shortVersion = forgeVersion.slice(gameVersion.length + 1);

  onProgress('installer', 45, '下载 Forge 安装器…');
  const installerUrl = `https://maven.minecraftforge.net/net/minecraftforge/forge/${forgeVersion}/forge-${forgeVersion}-installer.jar`;
  const installerPath = path.join(os.tmpdir(), `forge-${forgeVersion}-installer.jar`);
  await downloadFile(installerUrl, installerPath);

  await runInstallerJar(installerPath, ['--installClient', gameDir], onProgress);
  onProgress('done', 100, 'Forge 安装完成');
  return { success: true, versionId: `${gameVersion}-forge-${shortVersion}` };
}

async function installNeoForge(
  gameVersion: string,
  gameDir: string,
  onProgress: InstallProgress,
): Promise<LoaderInstallResult> {
  await ensureVanilla(gameVersion, gameDir, onProgress);
  onProgress('loader', 25, '获取 NeoForge 版本…');
  const res = await fetch('https://maven.neoforged.net/releases/net/neoforged/neoforge/promotions_slim.json');
  if (!res.ok) return { success: false, error: 'NeoForge 版本信息获取失败' };
  const promos = ((await res.json()) as { promos?: Record<string, string> }).promos ?? {};
  const neoforgeVersion = promos[`${gameVersion}-latest`] || promos[gameVersion];
  if (!neoforgeVersion) return { success: false, error: `NeoForge 暂不支持 ${gameVersion}` };

  onProgress('installer', 45, '下载 NeoForge 安装器…');
  const installerUrl = `https://maven.neoforged.net/releases/net/neoforged/neoforge/${neoforgeVersion}/neoforge-${neoforgeVersion}-installer.jar`;
  const installerPath = path.join(os.tmpdir(), `neoforge-${neoforgeVersion}-installer.jar`);
  await downloadFile(installerUrl, installerPath);

  await runInstallerJar(installerPath, ['--installClient', gameDir], onProgress);
  onProgress('done', 100, 'NeoForge 安装完成');
  return { success: true, versionId: `${gameVersion}-neoforge-${neoforgeVersion}` };
}

/**
 * OptiFine auto-install. OptiFine's jar is an installer that patches the
 * vanilla client via xdelta. We download it, then run its `optifine.Installer`
 * class headlessly with %APPDATA% redirected so it installs into OUR game dir
 * (it derives the minecraft dir from %APPDATA%\.minecraft on Windows).
 */
async function installOptiFine(
  gameVersion: string,
  gameDir: string,
  onProgress: InstallProgress,
): Promise<LoaderInstallResult> {
  await ensureVanilla(gameVersion, gameDir, onProgress);
  onProgress('loader', 20, '获取 OptiFine 版本…');
  const res = await fetch(`https://bmclapi2.bangbang93.com/optifine/${gameVersion}`);
  if (!res.ok) return { success: false, error: `OptiFine 暂不支持 ${gameVersion}` };
  const list = (await res.json()) as Array<{ patch: string; type: string; filename: string }>;
  if (!list.length) return { success: false, error: `OptiFine 暂不支持 ${gameVersion}` };
  const chosen = list.find((v) => !String(v.patch).startsWith('pre')) || list[0];

  onProgress('installer', 40, '下载 OptiFine…');
  const downloadUrl = `https://bmclapi2.bangbang93.com/optifine/${gameVersion}/${chosen.type}/${chosen.patch}`;
  const jarPath = path.join(os.tmpdir(), chosen.filename);
  await downloadFile(downloadUrl, jarPath);

  onProgress('installer', 70, '运行 OptiFine 安装器…');
  const javaPath = findJavaPath();
  if (!javaPath) throw new Error('未找到 Java，无法运行 OptiFine 安装器');
  const appdataParent = path.dirname(gameDir); // Installer uses %APPDATA%\.minecraft
  await new Promise<void>((resolve, reject) => {
    const child = spawn(javaPath, ['-cp', jarPath, 'optifine.Installer'], {
      stdio: 'pipe',
      env: { ...process.env, APPDATA: appdataParent },
    });
    let out = '';
    child.stdout?.on('data', (d: Buffer) => (out += d.toString()));
    child.stderr?.on('data', (d: Buffer) => (out += d.toString()));
    child.on('error', reject);
    child.on('close', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`OptiFine 安装器失败 (${code}): ${out.slice(-300)}`));
    });
  });

  onProgress('done', 100, 'OptiFine 安装完成');
  return { success: true };
}
