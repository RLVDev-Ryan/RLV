import fs from 'fs';
import path from 'path';
import http from 'http';
import https from 'https';

export type DownloadProgressCallback = (percent: number) => void;

/**
 * Download a file to disk (via a temp file, atomically renamed on success).
 * Follows redirects (including relative ones), retries transient errors, and
 * reports progress when the server provides a Content-Length header.
 */
export function downloadFile(
  url: string,
  dest: string,
  onProgress?: DownloadProgressCallback,
  signal?: { aborted: boolean },
): Promise<void> {
  const tmp = dest + '.tmp';
  fs.mkdirSync(path.dirname(dest), { recursive: true });

  return new Promise((resolve, reject) => {
    let settled = false;

    const cleanup = (): void => {
      try {
        fs.unlinkSync(tmp);
      } catch {}
    };
    const fail = (err: Error): void => {
      if (settled) return;
      settled = true;
      cleanup();
      reject(err);
    };
    const succeed = (): void => {
      if (settled) return;
      settled = true;
      resolve();
    };

    const attempt = (u: string, times = 0): void => {
      const mod = u.startsWith('https:') ? https : http;
      const req = mod.get(u, (res) => {
        const status = res.statusCode ?? 0;

        // Follow redirects (Mojang/OptiFine mirrors redirect, sometimes to a
        // relative path like "/maven/..." — resolve against the current URL).
        if (status === 301 || status === 302 || status === 307 || status === 308) {
          res.resume();
          const loc = res.headers.location;
          if (!loc) {
            fail(new Error('HTTP redirect without Location header'));
            return;
          }
          attempt(new URL(loc, u).toString(), times);
          return;
        }

        if (status < 200 || status >= 300) {
          res.resume();
          if (times < 3) {
            setTimeout(() => attempt(u, times + 1), 800 * (times + 1));
          } else {
            fail(new Error(`HTTP ${status}`));
          }
          return;
        }

        const total = parseInt(res.headers['content-length'] || '0', 10);
        let downloaded = 0;
        const file = fs.createWriteStream(tmp);

        res.on('data', (chunk: Buffer) => {
          if (settled) return;
          if (signal?.aborted) {
            res.destroy();
            file.destroy();
            fail(new Error('下载已取消'));
            return;
          }
          downloaded += chunk.length;
          file.write(chunk);
          if (total > 0) onProgress?.(Math.round((downloaded / total) * 100));
        });

        res.on('end', () => {
          file.end(() => {
            try {
              fs.renameSync(tmp, dest);
              succeed();
            } catch (err) {
              fail(err instanceof Error ? err : new Error(String(err)));
            }
          });
        });

        res.on('error', (err) => {
          file.destroy();
          fail(err);
        });
      });

      req.on('error', (err) => {
        if (times < 3) {
          setTimeout(() => attempt(u, times + 1), 800 * (times + 1));
        } else {
          fail(err);
        }
      });
    };

    attempt(url);
  });
}
