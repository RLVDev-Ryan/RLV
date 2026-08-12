import path from 'path';
import fs from 'fs';
import { downloadFile } from './downloadFile';
import { versionManifestUrl, versionJsonUrl, versionClientUrl } from '../mirrors';
import type { DownloadProgress, VersionManifestEntry } from '../../shared/constants';

type ProgressCallback = (progress: DownloadProgress) => void;

/**
 * Fetch the version manifest (via the configured mirror).
 */
export async function fetchVersionManifest(): Promise<VersionManifestEntry[]> {
  const response = await fetch(versionManifestUrl());
  if (!response.ok) {
    throw new Error(`Failed to fetch version manifest: HTTP ${response.status}`);
  }
  const data = (await response.json()) as { versions: VersionManifestEntry[] };
  return data.versions;
}

/**
 * Download and install a Minecraft version.
 */
export async function downloadVersion(versionId: string, gameDir: string, onProgress: ProgressCallback): Promise<void> {
  const versionDir = path.join(gameDir, 'versions', versionId);
  fs.mkdirSync(versionDir, { recursive: true });

  const clientPath = path.join(versionDir, `${versionId}.jar`);
  const jsonPath = path.join(versionDir, `${versionId}.json`);

  try {
    // Step 1: get version manifest
    onProgress({ versionId, stage: 'manifest', percent: 0 });
    const manifest = await fetchVersionManifest();
    const entry = manifest.find((v) => v.id === versionId);
    if (!entry) throw new Error(`Version ${versionId} not found`);

    // Step 2: fetch version JSON (via mirror)
    onProgress({ versionId, stage: 'manifest', percent: 20 });
    const versionResp = await fetch(versionJsonUrl(versionId, entry.url));
    if (!versionResp.ok) {
      throw new Error(`Failed to fetch version JSON: HTTP ${versionResp.status}`);
    }
    const versionData = await versionResp.json();
    const versionJson = versionData as {
      downloads?: { client?: { url?: string; size?: number } };
      assetIndex?: { url?: string };
      libraries?: Array<{ downloads?: { artifact?: { url?: string; path?: string } } }>;
      minecraftArguments?: string;
      arguments?: Record<string, unknown>;
      mainClass?: string;
    };

    // Save the version JSON
    fs.writeFileSync(jsonPath, JSON.stringify(versionData, null, 2));
    onProgress({ versionId, stage: 'manifest', percent: 40 });

    // Step 3: download client JAR (via mirror)
    const officialClient = versionJson.downloads?.client?.url;
    if (!officialClient) throw new Error('No client download URL');
    const clientUrl = versionClientUrl(versionId, officialClient);
    onProgress({ versionId, stage: 'client', percent: 0 });
    await downloadFile(clientUrl, clientPath, (pct) => {
      onProgress({ versionId, stage: 'client', percent: pct });
    });

    onProgress({ versionId, stage: 'done', percent: 100 });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    onProgress({ versionId, stage: 'error', percent: 0, error: message });
    throw err;
  }
}

