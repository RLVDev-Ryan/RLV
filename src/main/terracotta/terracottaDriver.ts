import { app } from 'electron';
import { spawn, type ChildProcess } from 'child_process';
import path from 'path';
import fs from 'fs';
import os from 'os';

/**
 * Terracotta (陶瓦联机) 0.4.2 daemon driver.
 *
 * Terracotta is a singleton daemon (global mutex). Launchers spawn it with
 * `terracotta --hmcl <file>`; once ready it writes `{"port": N}` to that file,
 * giving the HTTP control port (127.0.0.1:N). We then drive it over HTTP:
 *   GET /state                  -> current state JSON
 *   GET /state/scanning?player= -> host a room (auto-scans the MC LAN port)
 *   GET /state/guesting?room=&player= -> join a room
 *   GET /state/ide              -> back to waiting (end the room)
 *   GET /log?fetch=true         -> logs
 *
 * The binary is bundled unmodified (AGPL-3.0 bundling exception); easytier is
 * embedded inside it, so no separate easytier install is needed for this path.
 */

const BIN_NAME = 'terracotta-0.4.2-windows-x86_64.exe';
const DAEMON_START_TIMEOUT_MS = 10000;

export interface TerracottaProfile {
  machine_id?: string;
  name?: string;
  vendor?: string;
  kind?: string;
}

export interface TerracottaState {
  state: string;
  index?: number;
  room?: string;
  profiles?: TerracottaProfile[];
  difficulty?: string;
  url?: string;
  kind?: string;
  error?: string;
}

export interface DaemonHandle {
  /** The `--hmcl` holder process (kill on stop to release the mutex). */
  proc: ChildProcess | null;
  /** HTTP control port of the Terracotta daemon. */
  port: number;
}

function resolveBinary(): string {
  if (!app.isPackaged) {
    const byCwd = path.resolve(process.cwd(), 'resources/bin/terracotta', BIN_NAME);
    if (fs.existsSync(byCwd)) return byCwd;
    return path.resolve(__dirname, '../../../../resources/bin/terracotta', BIN_NAME);
  }
  return path.join(process.resourcesPath, 'bin', 'terracotta', BIN_NAME);
}

async function httpGet(port: number, route: string, timeoutMs = 8000): Promise<TerracottaState | string> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(`http://127.0.0.1:${port}${route}`, { signal: ctrl.signal });
    const text = await res.text();
    clearTimeout(timer); // only after the full body arrived
    try {
      return JSON.parse(text) as TerracottaState;
    } catch {
      return text;
    }
  } catch {
    clearTimeout(timer);
    throw new Error('无法连接陶瓦联机进程');
  }
}

function isState(v: unknown): v is TerracottaState {
  return typeof v === 'object' && v !== null && typeof (v as TerracottaState).state === 'string';
}

/**
 * Start the Terracotta daemon (or attach to an already-running one). Returns the
 * holder process + HTTP control port.
 */
export async function startDaemon(): Promise<DaemonHandle> {
  const bin = resolveBinary();
  if (!fs.existsSync(bin)) {
    throw new Error(`未找到陶瓦联机程序: ${bin}`);
  }
  const tmpFile = path.join(os.tmpdir(), `rlv-terracotta-${process.pid}-${Date.now()}.json`);
  const proc = spawn(bin, ['--hmcl', tmpFile], {
    stdio: ['ignore', 'pipe', 'pipe'],
    windowsHide: true,
  });
  let stderrTail = '';
  let spawnFailed = false;
  proc.stderr?.on('data', (d: Buffer) => {
    stderrTail = (stderrTail + d.toString()).slice(-2000);
  });
  proc.on('error', (err) => {
    // ENOENT/EACCES… must not surface as an uncaught 'error' crash.
    spawnFailed = true;
    console.error('[Terracotta] daemon spawn error:', err.message);
  });

  const deadline = Date.now() + DAEMON_START_TIMEOUT_MS;
  while (Date.now() < deadline) {
    if (spawnFailed) break;
    try {
      const parsed = JSON.parse(fs.readFileSync(tmpFile, 'utf8'));
      if (parsed && typeof parsed.port === 'number') {
        return { proc, port: parsed.port };
      }
    } catch {}
    if (proc.exitCode !== null) break;
    await new Promise((r) => setTimeout(r, 200));
  }
  try {
    proc.kill();
  } catch {}
  // Report the real reason instead of always claiming a timeout.
  if (spawnFailed) throw new Error('陶瓦联机程序启动失败');
  if (proc.exitCode !== null) {
    const tail = stderrTail.trim();
    throw new Error(`陶瓦联机程序异常退出 (${proc.exitCode})${tail ? `: ${tail.slice(-300)}` : ''}`);
  }
  throw new Error('陶瓦联机进程启动超时');
}

export async function getState(port: number): Promise<TerracottaState | null> {
  try {
    const v = await httpGet(port, '/state');
    return isState(v) ? v : null;
  } catch {
    return null;
  }
}

export async function setWaiting(port: number): Promise<void> {
  try {
    await httpGet(port, '/state/ide');
  } catch {}
}

export async function scanning(port: number, player?: string): Promise<void> {
  const q = new URLSearchParams();
  if (player) q.set('player', player);
  await httpGet(port, `/state/scanning?${q.toString()}`);
}

export async function guesting(port: number, room: string, player?: string): Promise<void> {
  const q = new URLSearchParams();
  q.set('room', room);
  if (player) q.set('player', player);
  await httpGet(port, `/state/guesting?${q.toString()}`);
}

export async function getLogs(port: number): Promise<string> {
  try {
    const v = await httpGet(port, '/log?fetch=true');
    return typeof v === 'string' ? v : JSON.stringify(v);
  } catch {
    return '';
  }
}

export function killDaemon(handle: DaemonHandle): void {
  try {
    handle.proc?.kill();
  } catch {}
}
