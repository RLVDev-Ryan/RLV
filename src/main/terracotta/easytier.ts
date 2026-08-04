import { app } from 'electron';
import path from 'path';
import fs from 'fs';
import net from 'net';
import { spawn, exec } from 'child_process';

/**
 * EasyTier process + RPC management.
 *
 * easytier-core exposes a management endpoint called the "RPC portal" (--rpc-portal,
 * a TCP service on 127.0.0.1). easytier-cli talks to it to query peers and to
 * add/remove port-forwards — the two mechanisms the room protocol relies on.
 * (There is no HTTP API in easytier-core 2.6.4; the "--http-bind" idea in earlier
 * notes was wrong. This is the real interface, matching what HMCL/Terracotta use.)
 */

export interface EasyTierPeer {
  hostname: string;
  ipv4: string;
  cost: string;
  lat_ms: string;
  loss_rate: string;
  tunnel_proto: string;
  nat_type: string;
  id: string;
  version: string;
  cidr?: string;
  [key: string]: unknown;
}

export interface EasyTierHandle {
  pid: number;
  rpcPort: number;
  isAlive: () => boolean;
}

let corePathCache: string | null = null;
let cliPathCache: string | null = null;

/** Set by terracottaManager to surface Windows permission errors to the UI. */
let onPermissionError: (() => void) | null = null;
export function setPermissionErrorHandler(fn: (() => void) | null): void {
  onPermissionError = fn;
}

function detectPermissionIssue(text: string): void {
  const lower = text.toLowerCase();
  if (lower.includes('permission') || lower.includes('access denied') || lower.includes('拒绝访问')) {
    onPermissionError?.();
  }
}

function resolveBin(name: 'easytier-core.exe' | 'easytier-cli.exe'): string {
  if (name === 'easytier-core.exe') {
    if (corePathCache) return corePathCache;
  } else if (cliPathCache) {
    return cliPathCache;
  }

  let resolved: string;
  if (!app.isPackaged) {
    // Try process.cwd() first (most reliable in dev), fall back to __dirname
    const byCwd = path.resolve(process.cwd(), 'resources/bin/easytier', name);
    if (fs.existsSync(byCwd)) {
      resolved = byCwd;
    } else {
      resolved = path.resolve(__dirname, '../../../../../resources/bin/easytier', name);
    }
  } else {
    resolved = path.join(process.resourcesPath, 'bin', 'easytier', name);
  }

  if (name === 'easytier-core.exe') corePathCache = resolved;
  else cliPathCache = resolved;
  return resolved;
}

export function getCorePath(): string {
  return resolveBin('easytier-core.exe');
}

export function getCliPath(): string {
  return resolveBin('easytier-cli.exe');
}

/** Pick a free TCP port (binds 0.0.0.0:0, reads it, closes). */
export function requestPort(bindLoopback = false): Promise<number> {
  return new Promise((resolve) => {
    const srv = net.createServer();
    srv.once('error', () => resolve(0));
    srv.listen(0, bindLoopback ? '127.0.0.1' : '0.0.0.0', () => {
      const addr = srv.address() as net.AddressInfo;
      srv.close(() => resolve(addr.port));
    });
  });
}

/**
 * Spawn easytier-core with the given args plus `-r <rpcPort>`.
 * Captures stdout/stderr to the console and returns a handle.
 */
export function spawnCore(args: string[], rpcPort: number): EasyTierHandle {
  const exe = getCorePath();
  const proc = spawn(exe, [...args, '-r', String(rpcPort)], {
    stdio: 'pipe',
    windowsHide: true,
  });

  proc.stdout?.on('data', (d: Buffer) => {
    const text = d.toString().trim();
    if (text) console.log('[EasyTier]', text);
  });
  proc.stderr?.on('data', (d: Buffer) => {
    const text = d.toString().trim();
    if (text) console.log('[EasyTier]', text);
    detectPermissionIssue(text);
  });
  proc.on('error', (err) => {
    console.error('[EasyTier] spawn error:', err.message);
  });
  proc.on('close', (code) => {
    console.log(`[EasyTier] core exited code=${code}`);
  });

  return {
    pid: proc.pid ?? 0,
    rpcPort,
    isAlive: () => proc.exitCode === null && proc.signalCode === null,
  };
}

export interface CliResult {
  ok: boolean;
  stdout: string;
  stderr: string;
}

/** Run one easytier-cli command against the given RPC portal. */
export function runCli(rpcPort: number, args: string[], timeoutMs = 10000): Promise<CliResult> {
  return new Promise((resolve) => {
    const cli = getCliPath();
    const proc = spawn(cli, ['-p', `127.0.0.1:${rpcPort}`, ...args], {
      stdio: ['ignore', 'pipe', 'pipe'],
      windowsHide: true,
    });
    let stdout = '';
    let stderr = '';
    let done = false;
    const timer = setTimeout(() => {
      if (!done) {
        done = true;
        try {
          proc.kill();
        } catch {}
        resolve({ ok: false, stdout, stderr: stderr || `easytier-cli timed out after ${timeoutMs}ms` });
      }
    }, timeoutMs);

    proc.stdout?.on('data', (d: Buffer) => (stdout += d.toString()));
    proc.stderr?.on('data', (d: Buffer) => (stderr += d.toString()));
    proc.on('error', (err) => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      resolve({ ok: false, stdout, stderr: err.message });
    });
    proc.on('close', (code) => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      resolve({ ok: code === 0, stdout, stderr });
    });
  });
}

/** Query the connected peers as parsed JSON. Returns null on failure. */
export async function getPeers(rpcPort: number): Promise<EasyTierPeer[] | null> {
  const res = await runCli(rpcPort, ['-o', 'json', 'peer']);
  if (!res.ok) return null;
  try {
    const parsed = JSON.parse(res.stdout);
    if (Array.isArray(parsed)) return parsed as EasyTierPeer[];
    return null;
  } catch {
    return null;
  }
}

/**
 * Add a port-forward rule: local <localAddr:port> -> <remoteAddr:port> in the VPN.
 * Retries a few times — a just-released port can briefly report EADDRINUSE.
 */
export async function addPortForward(
  rpcPort: number,
  proto: 'tcp' | 'udp',
  local: string,
  remote: string,
): Promise<boolean> {
  // Remove a stale identical rule first — easytier fails to reload forwards if a
  // previously-added local bind is still held (os error 10048).
  await removePortForward(rpcPort, proto, local, remote);
  for (let attempt = 0; attempt < 3; attempt++) {
    const res = await runCli(rpcPort, ['port-forward', 'add', proto, local, remote]);
    if (res.ok) return true;
    await new Promise((r) => setTimeout(r, 500 + attempt * 500));
  }
  console.error('[EasyTier] port-forward add failed:', local, '->', remote);
  return false;
}

/** Remove a port-forward rule (ignored silently if it doesn't exist). */
export async function removePortForward(
  rpcPort: number,
  proto: 'tcp' | 'udp',
  local: string,
  remote: string,
): Promise<void> {
  await runCli(rpcPort, ['port-forward', 'remove', proto, local, remote]);
}

/** Kill the whole easytier-core process tree (it forks subprocesses). */
export function killProcessTree(pid: number): void {
  if (!pid) return;
  if (process.platform === 'win32') {
    try {
      exec(`taskkill /pid ${pid} /T /F`);
    } catch {}
  } else {
    try {
      process.kill(pid);
    } catch {}
  }
}
