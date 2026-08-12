import { loadConfig } from './config/configManager';

/**
 * Download mirror selection (launcher.js → mirror).
 * BMCLAPI mirrors the Mojang CDN for users in China where the official hosts
 * are slow/blocked.
 */

export type MirrorName = 'mojang' | 'bmclapi';

export function currentMirror(): MirrorName {
  const m = loadConfig('launcher').mirror;
  return m === 'bmclapi' ? 'bmclapi' : 'mojang';
}

export const MIRROR_BASE = {
  mojang: {
    manifest: 'https://piston-meta.mojang.com/mc/game/version_manifest_v2.json',
    libraries: 'https://libraries.minecraft.net/',
    assets: 'https://resources.download.minecraft.net/',
  },
  bmclapi: {
    manifest: 'https://bmclapi2.bangbang93.com/mc/game/version_manifest_v2.json',
    libraries: 'https://bmclapi2.bangbang93.com/libraries/',
    assets: 'https://bmclapi2.bangbang93.com/assets/',
  },
} as const;

export function versionManifestUrl(): string {
  return MIRROR_BASE[currentMirror()].manifest;
}

export function versionJsonUrl(versionId: string, officialUrl: string): string {
  return currentMirror() === 'bmclapi' ? `https://bmclapi2.bangbang93.com/version/${versionId}/json` : officialUrl;
}

export function versionClientUrl(versionId: string, officialUrl: string): string {
  return currentMirror() === 'bmclapi' ? `https://bmclapi2.bangbang93.com/version/${versionId}/client` : officialUrl;
}

export function libraryUrl(officialUrl: string): string {
  if (currentMirror() === 'mojang' || !officialUrl.startsWith('https://libraries.minecraft.net/')) return officialUrl;
  return officialUrl.replace('https://libraries.minecraft.net/', MIRROR_BASE.bmclapi.libraries);
}

export function assetUrl(hash: string): string {
  const path = `${hash.slice(0, 2)}/${hash}`;
  return `${MIRROR_BASE[currentMirror()].assets}${path}`;
}
