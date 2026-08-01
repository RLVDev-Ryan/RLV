import { app, BrowserWindow } from 'electron';
import path from 'path';
import fs from 'fs';
import { exec, spawn, type ChildProcess } from 'child_process';
import net from 'net';
import os from 'os';
import crypto from 'crypto';
import { IPC_CHANNELS, type LanGame } from '../../shared/constants';

const DEFAULT_PORT = 11010;

let easyTierProcess: ChildProcess | null = null;
let mainWindow: BrowserWindow | null = null;

export function setMainWindow(win: BrowserWindow | null): void {
  mainWindow = win;
}

// ── EasyTier P2P ──

export function getEasyTierPath(): string {
  if (!app.isPackaged) {
    // Try process.cwd() first (most reliable in dev)
    const byCwd = path.resolve(process.cwd(), 'resources/bin/easytier/easytier-core.exe');
    if (fs.existsSync(byCwd)) return byCwd;
    // Fallback to __dirname
    const byDirname = path.resolve(__dirname, '../../../../../resources/bin/easytier/easytier-core.exe');
    if (fs.existsSync(byDirname)) return byDirname;
    console.error('[EasyTier] Not found at:', byCwd, 'or', byDirname);
    return byCwd;
  }
  return path.join(process.resourcesPath, 'bin', 'easytier', 'easytier-core.exe');
}

export function getLocalIP(): string | null {
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name] ?? []) {
      if (iface.family === 'IPv4' && !iface.internal) return iface.address;
    }
  }
  return null;
}

/** Notify renderer of permission errors */
function notifyPermissionError(): void {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send(IPC_CHANNELS.TERRACOTTA_PERMISSION_ERROR);
  }
}

export function generateRoomCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  let code = 'RLV';
  for (let i = 0; i < 8; i++) code += chars[crypto.randomInt(chars.length)];
  return code;
}

export function encodeIP(ip: string): string {
  const map = 'ABCDEFGHIJ';
  return ip
    .split('.')
    .map((o) => o.padStart(3, '0'))
    .join('')
    .split('')
    .map((d) => map[parseInt(d)])
    .join('');
}

export function decodeIP(encoded: string): string | null {
  if (encoded.length !== 12) return null;
  const map: Record<string, string> = {};
  'ABCDEFGHIJ'.split('').forEach((l, i) => {
    map[l] = String(i);
  });
  const digits = encoded
    .split('')
    .map((c) => map[c])
    .join('');
  if (digits.includes('undefined')) return null;
  const octets = [];
  for (let i = 0; i < 4; i++) octets.push(parseInt(digits.slice(i * 3, i * 3 + 3), 10));
  return octets.join('.');
}

export function encodeInviteCode(roomCode: string, ip: string): string {
  return `${roomCode}-${encodeIP(ip)}`;
}

export function decodeInviteCode(inviteCode: string): { roomCode: string; ip: string } | null {
  const parts = inviteCode.split('-');
  if (parts.length < 2) return null;
  const encodedIP = parts.pop()!;
  const roomCode = parts.join('-');
  const ip = decodeIP(encodedIP);
  if (!ip) return null;
  return { roomCode, ip };
}

/**
 * Shared stderr handler for permission detection.
 */
function onStderr(text: string): void {
  const lower = text.toLowerCase();
  if (lower.includes('permission') || lower.includes('access denied') || lower.includes('拒绝访问')) {
    console.error('[EasyTier] Permission error — try running as admin');
    notifyPermissionError();
  }
}

export function startEasyTierHost(roomCode: string): Promise<boolean> {
  if (easyTierProcess) return Promise.resolve(false);
  return new Promise((resolve) => {
    const exePath = getEasyTierPath();
    console.log('[EasyTier] Starting:', exePath);
    easyTierProcess = spawn(
      exePath,
      [
        '--network-name',
        roomCode,
        '--listeners',
        `tcp://0.0.0.0:${DEFAULT_PORT}`,
        '--use-smoltcp',
        '--no-tun',
        '--dhcp',
        '--ipv4',
        '10.144.0.1',
      ],
      { stdio: 'pipe' },
    );

    let started = false;

    easyTierProcess.stdout?.on('data', (d: Buffer) => {
      const text = d.toString();
      console.log('[EasyTier]', text.trim());
      if (!started && text.includes('listener added')) {
        started = true;
        resolve(true);
      }
    });

    easyTierProcess.stderr?.on('data', (d: Buffer) => {
      const text = d.toString();
      console.log('[EasyTier]', text.trim());
      onStderr(text);
    });

    easyTierProcess.on('error', (err) => {
      console.error('[EasyTier]', err.message);
      easyTierProcess = null;
      if (!started) resolve(false);
    });
    easyTierProcess.on('close', (code) => {
      console.log(`[EasyTier] exited ${code}`);
      easyTierProcess = null;
      if (!started) resolve(false);
    });

    setTimeout(() => {
      // Timeout without "listener added" — stdout keywords are unreliable across
      // versions, so treat a still-running process as started.
      if (easyTierProcess && easyTierProcess.exitCode === null && !started) {
        started = true;
        resolve(true);
      }
    }, 5000);
  });
}

export function startEasyTierGuest(roomCode: string, hostIP: string): Promise<boolean> {
  if (easyTierProcess) return Promise.resolve(false);
  return new Promise((resolve) => {
    const exePath = getEasyTierPath();
    console.log('[EasyTier] Connecting:', exePath);
    easyTierProcess = spawn(
      exePath,
      [
        '--network-name',
        roomCode,
        '--peers',
        `tcp://${hostIP}:${DEFAULT_PORT}`,
        '--use-smoltcp',
        '--no-tun',
        '--dhcp',
        // No --ipv4 — let DHCP assign automatically
      ],
      { stdio: 'pipe' },
    );

    // Guest: no stdout keyword detection — rely on fallback
    easyTierProcess.stdout?.on('data', (d: Buffer) => console.log('[EasyTier]', d.toString().trim()));
    easyTierProcess.stderr?.on('data', (d: Buffer) => {
      const text = d.toString();
      console.log('[EasyTier]', text.trim());
      onStderr(text);
    });

    easyTierProcess.on('error', (err) => {
      console.error('[EasyTier]', err.message);
      easyTierProcess = null;
      resolve(false);
    });
    easyTierProcess.on('close', (code) => {
      console.log(`[EasyTier] exited ${code}`);
      easyTierProcess = null;
      resolve(false);
    });

    // Fallback only: resolve after 5s if the process is still alive
    setTimeout(() => {
      if (easyTierProcess && easyTierProcess.exitCode === null) resolve(true);
    }, 5000);
  });
}

export function stopEasyTier(): void {
  const proc = easyTierProcess;
  if (proc) {
    easyTierProcess = null;
    if (process.platform === 'win32') {
      // taskkill /T /F kills the whole child process tree (easytier forks subprocesses)
      try {
        exec(`taskkill /pid ${proc.pid} /T /F`);
      } catch {}
    } else {
      proc.kill();
    }
  }
}

// ── LAN game scanner ──

/**
 * Scan for Minecraft LAN room on localhost + EasyTier virtual subnet.
 * Scans aggressively but with short timeouts and batch concurrency control.
 */
export async function scanLanGames(port?: number): Promise<LanGame[]> {
  const results: LanGame[] = [];

  // Localhost is always checked first
  const targets = ['127.0.0.1', 'localhost'];

  // Add a few common EasyTier virtual IPs (not all 254 — too expensive)
  for (let i = 1; i <= 10; i++) targets.push(`10.144.0.${i}`);

  const ports = port ? [port] : [25565, 25566, 25567, 25568, 25569, 25570, 25575];

  // Batch in groups of 10 to avoid flooding
  const CONCURRENCY = 10;
  for (let i = 0; i < targets.length; i += CONCURRENCY) {
    const batch = targets.slice(i, i + CONCURRENCY);
    await Promise.all(batch.flatMap((t) => ports.map((p) => probePort(t, p, results))));
  }

  return results;
}

/**
 * Quick TCP port probe — 150ms timeout per host:port.
 * Note: this only detects that a port is open (i.e. a server is listening);
 * it does not read the real MOTD. worldName/motd are placeholder values.
 */
async function probePort(host: string, port: number, results: LanGame[]): Promise<void> {
  try {
    const ok = await new Promise<boolean>((resolve) => {
      const socket = new net.Socket();
      socket.setTimeout(150);
      let done = false;
      const finish = (r: boolean) => {
        if (!done) {
          done = true;
          socket.destroy();
          resolve(r);
        }
      };
      socket.once('connect', () => finish(true));
      socket.once('error', () => finish(false));
      socket.once('timeout', () => finish(false));
      socket.connect(port, host);
    });
    if (ok) {
      results.push({ motd: 'Minecraft Server', host, port, worldName: 'Minecraft Server' });
    }
  } catch {}
}
