import { app, protocol, net } from 'electron';
import path from 'path';
import fs from 'fs';
import { pathToFileURL } from 'url';
import { FONT_MANIFEST, fontDownloadUrl, fontSlug } from '../../shared/fonts';
import { downloadFile } from '../downloader/downloadFile';

const cancelSignal: { aborted: boolean } = { aborted: false };

export function cancelFontDownload(): void {
  cancelSignal.aborted = true;
}

function cacheDir(): string {
  return path.join(app.getPath('userData'), 'fonts');
}

function familyDir(family: string): string {
  return path.join(cacheDir(), fontSlug(family));
}

export function isFontCached(family: string): boolean {
  const spec = FONT_MANIFEST[family];
  if (!spec || spec.bundled) return true; // bundled = always available
  return spec.files.every((f) => fs.existsSync(path.join(familyDir(family), f.file)));
}

/**
 * Download a font family (all its files) into the cache. Reports overall
 * percent across files; throws on failure; respects cancelFontDownload().
 */
export async function downloadFont(
  family: string,
  onProgress: (percent: number) => void,
): Promise<void> {
  const spec = FONT_MANIFEST[family];
  if (!spec) throw new Error(`未知字体: ${family}`);
  if (spec.bundled) return;

  cancelSignal.aborted = false;
  const dir = familyDir(family);
  fs.mkdirSync(dir, { recursive: true });
  const total = spec.files.length;

  for (let i = 0; i < total; i++) {
    const f = spec.files[i];
    const dest = path.join(dir, f.file);
    if (fs.existsSync(dest)) {
      onProgress(Math.round(((i + 1) / total) * 100));
      continue;
    }
    const base = (i / total) * 100;
    await downloadFile(
      fontDownloadUrl(family, f.file),
      dest,
      (pct) => onProgress(Math.round(base + (pct / total))),
      cancelSignal,
    );
  }
}

/** Serve cached fonts to the renderer via the `rlv-font:` protocol. */
export function registerFontProtocol(): void {
  protocol.handle('rlv-font', (request) => {
    try {
      const url = new URL(request.url);
      // rlv-font://fonts/<slug>/<file>
      const rel = decodeURIComponent(url.pathname.replace(/^\//, ''));
      const filePath = path.join(cacheDir(), rel);
      // Prevent path traversal outside the cache.
      if (!filePath.startsWith(cacheDir())) {
        return new Response('forbidden', { status: 403 });
      }
      return net.fetch(pathToFileURL(filePath).toString());
    } catch {
      return new Response('not found', { status: 404 });
    }
  });
}
