import fs from 'fs';
import path from 'path';
import http from 'http';
import https from 'https';

export type DownloadProgressCallback = (percent: number) => void;

/** Cap on consecutive redirects — a redirect loop must not hang forever. */
const MAX_REDIRECTS = 10;
/** Socket inactivity timeout per attempt (a stalled peer must not hang us). */
const REQUEST_TIMEOUT_MS = 30_000;

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

    const attempt = (u: string, times = 0, redirects = 0): void => {
      const mod = u.startsWith('https:') ? https : http;
      const req = mod.get(u, (res) => {
        const status = res.statusCode ?? 0;

        // Follow redirects (Mojang/OptiFine mirrors redirect, sometimes to a
        // relative path like "/maven/..." — resolve against the current URL).
        if (status >= 300 && status < 400) {
          res.resume();
          if (redirects >= MAX_REDIRECTS) {
            fail(new Error('HTTP 重定向次数过多'));
            return;
          }
          const loc = res.headers.location;
          if (!loc) {
            fail(new Error('HTTP redirect without Location header'));
            return;
          }
          attempt(new URL(loc, u).toString(), times, redirects + 1);
          return;
        }

        if (status < 200 || status >= 300) {
          res.resume();
          if (times < 3) {
            setTimeout(() => attempt(u, times + 1, redirects), 800 * (times + 1));
          } else {
            fail(new Error(`HTTP ${status}`));
          }
          return;
        }

        const total = parseInt(res.headers['content-length'] || '0', 10);
        let downloaded = 0;
        const file = fs.createWriteStream(tmp);

        // Disk errors (ENOSPC, EACCES…) must fail the download instead of
        // crashing the main process with an unhandled stream 'error'.
        file.on('error', (err) => {
          res.destroy();
          fail(err instanceof Error ? err : new Error(String(err)));
        });

        const onData = (chunk: Buffer): void => {
          if (settled) return;
          if (signal?.aborted) {
            res.destroy();
            file.destroy();
            fail(new Error('下载已取消'));
            return;
          }
          downloaded += chunk.length;
          // Respect backpressure: pause the socket while the file stream is
          // busy, otherwise large jars buffer unboundedly in memory.
          if (!file.write(chunk)) {
            res.pause();
            file.once('drain', () => {
              if (!settled) res.resume();
            });
          }
          if (total > 0) onProgress?.(Math.round((downloaded / total) * 100));
        };
        res.on('data', onData);

        res.on('end', () => {
          // file.end waits for any backpressured writes to flush.
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

      // Stalled connection (no data, no end) must eventually give up.
      req.setTimeout(REQUEST_TIMEOUT_MS, () => {
        req.destroy(new Error('下载超时'));
      });

      req.on('error', (err) => {
        if (times < 3) {
          setTimeout(() => attempt(u, times + 1, redirects), 800 * (times + 1));
        } else {
          fail(err);
        }
      });
    };

    attempt(url);
  });
}
