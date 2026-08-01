import fs from 'fs';
import path from 'path';
import http from 'http';
import https from 'https';

export type DownloadProgressCallback = (percent: number) => void;

/**
 * Download a file to disk (via a temp file, atomically renamed on success).
 * Follows redirects, rejects on non-2xx responses, and reports progress when
 * the server provides a Content-Length header.
 */
export function downloadFile(url: string, dest: string, onProgress?: DownloadProgressCallback): Promise<void> {
  const tmp = dest + '.tmp';
  const cleanup = (): void => {
    try {
      fs.unlinkSync(tmp);
    } catch {}
  };
  fs.mkdirSync(path.dirname(dest), { recursive: true });

  return new Promise((resolve, reject) => {
    const attempt = (u: string): void => {
      const mod = u.startsWith('https:') ? https : http;
      const req = mod.get(u, (res) => {
        const status = res.statusCode ?? 0;

        // Follow redirects (Mojang resources occasionally redirect)
        if (status === 301 || status === 302 || status === 307 || status === 308) {
          res.resume();
          const loc = res.headers.location;
          if (!loc) {
            cleanup();
            reject(new Error('HTTP redirect without Location header'));
            return;
          }
          attempt(loc);
          return;
        }

        if (status < 200 || status >= 300) {
          res.resume();
          cleanup();
          reject(new Error(`HTTP ${status}`));
          return;
        }

        const total = parseInt(res.headers['content-length'] || '0', 10);
        let downloaded = 0;
        const file = fs.createWriteStream(tmp);

        res.on('data', (chunk: Buffer) => {
          downloaded += chunk.length;
          file.write(chunk);
          if (total > 0) onProgress?.(Math.round((downloaded / total) * 100));
        });

        res.on('end', () => {
          file.end(() => {
            fs.renameSync(tmp, dest);
            resolve();
          });
        });

        res.on('error', (err) => {
          cleanup();
          file.destroy();
          reject(err);
        });
      });

      req.on('error', (err) => {
        cleanup();
        reject(err);
      });
    };

    attempt(url);
  });
}
