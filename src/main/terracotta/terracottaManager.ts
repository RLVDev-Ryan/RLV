import { app, BrowserWindow } from 'electron';
import net from 'net';
import os from 'os';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import dgram from 'dgram';
import {
  IPC_CHANNELS,
  type RoomPlayer,
  type TerracottaStartResult,
  type TerracottaJoinResult,
  type ConnectionDifficulty,
} from '../../shared/constants';
import {
  spawnCore,
  getPeers,
  addPortForward,
  killProcessTree,
  requestPort,
  setPermissionErrorHandler,
  type EasyTierHandle,
} from './easytier';
import { generateRoom, encodeInviteCode, decodeInviteCode, type Room } from './room';
import { scanLanGames, startFakeServer } from './lan';
import { startScaffoldingServer, ScaffoldingClient, FINGERPRINT, type ScaffoldingServer } from './scaffolding';

/**
 * RLV multiplayer orchestration.
 *
 * Mirrors the Terracotta architecture over the bundled easytier binaries:
 *   host   — fixed VPN IP + whitelisted ports, Scaffolding server tracks players
 *   guest  — DHCP node, discovers the host from the peer list, port-forwards the
 *            Scaffolding port and the Minecraft port to the host, advertises the
 *            room via a fake LAN announcement.
 */

const HOST_VPN_IP = '10.144.144.1';
const SCAFFOLDING_PORT = 13448;
// Terracotta-compatible host hostname — other launchers discover the host by
// this prefix in the EasyTier peer list.
const HOST_HOSTNAME_PREFIX = 'scaffolding-mc-server-';
const GUEST_HOSTNAME_PREFIX = 'rlv-guest-';
const HOST_DISCOVER_ATTEMPTS = 5;
const HOST_DISCOVER_INTERVAL_MS = 3000;
/** Public EasyTier nodes used as rendezvous peers (same as Terracotta). */
const PUBLIC_SERVERS = ['tcp://public.easytier.top:11010', 'tcp://public2.easytier.cn:54321'];

let mainWindow: BrowserWindow | null = null;

// Module-level room state (single room at a time).
let easyTier: EasyTierHandle | null = null;
let scaffoldingServer: ScaffoldingServer | null = null;
let stopFakeServerFn: (() => void) | null = null;
let guestClient: ScaffoldingClient | null = null;
let mode: 'host' | 'guest' | null = null;
let difficulty: ConnectionDifficulty = 'UNKNOWN';
let guestHostname = '';
let cachedPlayers: RoomPlayer[] = [];
let watchdogTimer: NodeJS.Timeout | null = null;
let guestPlayerName = '';

export function setMainWindow(win: BrowserWindow | null): void {
  mainWindow = win;
  setPermissionErrorHandler(() => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send(IPC_CHANNELS.TERRACOTTA_PERMISSION_ERROR);
    }
  });
}

// ── Helpers ──

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

function getMachineId(): string {
  const dir = app.getPath('userData');
  const file = path.join(dir, 'machine-id');
  try {
    if (fs.existsSync(file)) {
      const existing = fs.readFileSync(file, 'utf8').trim();
      if (/^[0-9a-f]{32}$/.test(existing)) return existing;
    }
    const id = crypto.randomBytes(16).toString('hex');
    fs.writeFileSync(file, id, 'utf8');
    return id;
  } catch {
    // Fall back to a random id per session if the store is unwritable.
    return crypto.randomBytes(16).toString('hex');
  }
}

const machineId = getMachineId();

function vendor(): string {
  return `RLV ${app.getVersion()}`;
}

/** Adapter-name fragments that identify virtual/VPN adapters we must skip. */
const VIRTUAL_ADAPTER_MARKS = [
  'radmin',
  'easytier',
  'easy-tier',
  'virtual',
  'vmware',
  'vbox',
  'hyper-v',
  'vethernet',
  'zerotier',
  'tailscale',
  'hamachi',
  'wintun',
  'npcap',
  'tap-',
  'loopback',
  'isatap',
  'teredo',
  '6to4',
  'bluetooth',
  'wsl',
  'utun',
];

function isPrivateIPv4(ip: string): boolean {
  const [a, b] = ip.split('.').map(Number);
  return a === 10 || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168);
}

/**
 * Best local IPv4 for the invite code. Prefers a UDP egress probe (the OS picks
 * the interface the peer can actually reach), falling back to the adapter
 * heuristics when the probe fails or times out.
 */
export async function getLocalIP(): Promise<string | null> {
  const probed = await probeEgressIP();
  if (probed) return probed;
  return heuristicLocalIP();
}

/**
 * UDP egress probe: `dgram.connect()` to a public server makes the OS select
 * the egress interface WITHOUT sending any packet; `socket.address()` then
 * reports the local IP the peer would see. Short timeout + fallback so it can
 * never hang startup (the reason the trick was abandoned before).
 */
function probeEgressIP(timeoutMs = 800): Promise<string | null> {
  return new Promise((resolve) => {
    try {
      const sock = dgram.createSocket('udp4');
      let done = false;
      const finish = (ip: string | null) => {
        if (done) return;
        done = true;
        try {
          sock.close();
        } catch {}
        resolve(ip);
      };
      sock.once('error', () => finish(null));
      sock.connect(9, '1.1.1.1', () => {
        const addr = sock.address().address;
        finish(typeof addr === 'string' && addr && !addr.startsWith('127.') ? addr : null);
      });
      setTimeout(() => finish(null), timeoutMs);
    } catch {
      resolve(null);
    }
  });
}

/**
 * Fallback heuristic: enumerate os.networkInterfaces(), skip virtual/VPN
 * adapters by name and the EasyTier subnet, prefer private LAN ranges.
 */
function heuristicLocalIP(): string | null {
  const ifaces = os.networkInterfaces();
  const candidates: { ip: string; name: string }[] = [];

  for (const name of Object.keys(ifaces)) {
    const lower = name.toLowerCase();
    if (VIRTUAL_ADAPTER_MARKS.some((mark) => lower.includes(mark))) continue;
    for (const iface of ifaces[name] ?? []) {
      if (iface.family === 'IPv4' && !iface.internal) {
        const ip = iface.address;
        if (ip.startsWith('10.144.144.')) continue; // our own virtual subnet
        candidates.push({ ip, name });
      }
    }
  }

  if (candidates.length === 0) return null;
  // Prefer private LAN ranges (192.168/10/172.16-31) over public/VPN addresses.
  const preferred = candidates.find((c) => isPrivateIPv4(c.ip)) ?? candidates[0];
  return preferred.ip;
}

/**
 * Reserve a free TCP port, preferring the given one, excluding `exclude` ports.
 * The availability probe binds 0.0.0.0 (not 127.0.0.1): the easytier port-forward
 * binds all interfaces, so a loopback-only bind would return ports that the
 * forward cannot actually use (Windows SO_REUSEADDR lets 127.0.0.1 overlap an
 * already-taken 0.0.0.0 binding, which then fails later in easytier with 10048).
 */
function reserveLocalPort(preferred?: number, exclude: number[] = []): Promise<number> {
  const tryBind = (port: number) =>
    new Promise<number>((resolve) => {
      const srv = net.createServer();
      srv.once('error', () => resolve(0));
      srv.listen(port, '0.0.0.0', () => {
        const actual = (srv.address() as net.AddressInfo).port;
        srv.close(() => resolve(actual));
      });
    });

  const pick = async (): Promise<number> => {
    if (preferred && !exclude.includes(preferred)) {
      const p = await tryBind(preferred);
      if (p) return p;
    }
    for (let i = 0; i < 20; i++) {
      const p = await tryBind(0);
      if (p && !exclude.includes(p)) return p;
    }
    return 0;
  };
  return pick();
}

function calcDifficulty(localNat?: string, hostNat?: string): ConnectionDifficulty {
  const is = (t: string) => localNat === t || hostNat === t;
  if (is('OpenInternet')) return 'EASIEST';
  if (is('NoPat') || is('FullCone')) return 'SIMPLE';
  if (is('Restricted') || is('PortRestricted')) return 'MEDIUM';
  return 'TOUGH';
}

function notifyPlayersChanged(): void {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send(IPC_CHANNELS.TERRACOTTA_PLAYERS, getRoomPlayers());
  }
}

function stopWatchdog(): void {
  if (watchdogTimer) {
    clearInterval(watchdogTimer);
    watchdogTimer = null;
  }
}

function clearState(): void {
  easyTier = null;
  scaffoldingServer = null;
  stopFakeServerFn = null;
  guestClient = null;
  mode = null;
  difficulty = 'UNKNOWN';
  guestHostname = '';
  cachedPlayers = [];
  guestPlayerName = '';
}

// ── Public API ──

export function getRoomPlayers(): RoomPlayer[] {
  if (mode === 'host' && scaffoldingServer) {
    return scaffoldingServer.getPlayers();
  }
  if (mode === 'guest') return cachedPlayers;
  return [];
}

/** Whether a room is currently up (mode set AND the easytier node alive). */
export function isRoomConnected(): boolean {
  return mode !== null && easyTier !== null && easyTier.isAlive();
}

export async function startEasyTierHost(port?: number, playerName?: string): Promise<TerracottaStartResult> {
  if (easyTier && easyTier.isAlive()) {
    return { success: false, inviteCode: null, error: '房间已存在' };
  }

  // 1. The host must specify the Minecraft LAN world port (shown in-game when
  //    "Open to LAN" is used). Verify a world is actually listening on it.
  const serverPort = port && port > 0 && port < 65536 ? port : null;
  if (!serverPort) {
    return { success: false, inviteCode: null, error: '请输入游戏端口号' };
  }
  const games = (await scanLanGames(3000)).filter((g) => g.port === serverPort);
  if (games.length === 0) {
    return {
      success: false,
      inviteCode: null,
      error: `未检测到端口 ${serverPort} 的局域网游戏，请先在游戏内开放局域网（端口号可在游戏聊天栏查看）`,
    };
  }

  // 2. Room identity + Scaffolding server.
  const room: Room = generateRoom();
  let scaffolding: ScaffoldingServer;
  const opts = {
    hostProfile: {
      machineId,
      name: playerName || 'RLV 主机',
      vendor: vendor(),
    },
    getServerPort: () => serverPort,
    onPlayersChange: () => notifyPlayersChanged(),
  };
  try {
    // Prefer the fixed port, but fall back to a random one if 13448 is taken
    // (e.g. another Terracotta instance is running on this machine).
    scaffolding = await startScaffoldingServer({ ...opts, port: SCAFFOLDING_PORT });
  } catch {
    try {
      scaffolding = await startScaffoldingServer({ ...opts, port: 0 });
    } catch {
      return { success: false, inviteCode: null, error: '无法启动房间服务' };
    }
  }

  // 3. easytier host node — join the mesh via public rendezvous nodes; guests
  //    discover us from the peer list by hostname, so no address is embedded
  //    in the invite code (same scheme as Terracotta).
  const rpc = await requestPort(true);
  if (rpc === 0) {
    scaffolding.stop();
    return { success: false, inviteCode: null, error: '无法分配端口' };
  }
  const hostname = `${HOST_HOSTNAME_PREFIX}${scaffolding.port}`;
  const handle = spawnCore(
    [
      '--network-name',
      room.networkName,
      '--network-secret',
      room.networkSecret,
      ...PUBLIC_SERVERS.flatMap((s) => ['-p', s]),
      '--no-tun',
      '--ipv4',
      HOST_VPN_IP,
      '-l',
      'tcp://0.0.0.0:0',
      '-l',
      'udp://0.0.0.0:0',
      '--hostname',
      hostname,
      '--tcp-whitelist',
      String(scaffolding.port),
      '--tcp-whitelist',
      String(serverPort),
      '--udp-whitelist',
      String(serverPort),
      '--compression',
      'zstd',
      '--multi-thread',
      '--latency-first',
      '--enable-kcp-proxy',
      '--p2p-only',
    ],
    rpc,
  );

  // Give the node a moment to come up before declaring success.
  await sleep(1500);
  if (!handle.isAlive()) {
    killProcessTree(handle.pid);
    scaffolding.stop();
    return { success: false, inviteCode: null, error: 'EasyTier 启动失败' };
  }

  easyTier = handle;
  scaffoldingServer = scaffolding;
  mode = 'host';

  const inviteCode = encodeInviteCode(room);

  // Watchdog: surface a dead easytier to the UI.
  startWatchdog('host');

  return { success: true, inviteCode, mcPort: serverPort };
}

export async function startEasyTierGuest(code: string, playerName?: string): Promise<TerracottaJoinResult> {
  if (easyTier && easyTier.isAlive()) {
    return { success: false, error: '已连接房间' };
  }

  const room = decodeInviteCode(code);
  if (!room) {
    return { success: false, error: '邀请码无效，请检查后重试' };
  }
  guestPlayerName = playerName || 'RLV 玩家';

  // 1. Guest easytier node — join the mesh via public rendezvous nodes, then
  //    discover the host from the peer list (invite carries no address).
  const rpc = await requestPort(true);
  if (rpc === 0) return { success: false, error: '无法分配端口' };
  guestHostname = `${GUEST_HOSTNAME_PREFIX}${crypto.randomBytes(3).toString('hex')}`;
  const handle = spawnCore(
    [
      '--network-name',
      room.networkName,
      '--network-secret',
      room.networkSecret,
      ...PUBLIC_SERVERS.flatMap((s) => ['-p', s]),
      '--no-tun',
      '-d',
      '-l',
      'tcp://0.0.0.0:0',
      '-l',
      'udp://0.0.0.0:0',
      '--hostname',
      guestHostname,
      '--compression',
      'zstd',
      '--multi-thread',
      '--latency-first',
      '--enable-kcp-proxy',
      '--p2p-only',
    ],
    rpc,
  );
  easyTier = handle;
  mode = 'guest';

  const fail = async (error: string): Promise<TerracottaJoinResult> => {
    await stopEasyTier();
    return { success: false, error };
  };

  // 2. Discover the host node from the peer list.
  let hostVPNIP: string | null = null;
  let scaffoldingPort: number | null = null;
  let hostNat: string | undefined;
  let localNat: string | undefined;

  for (let attempt = 0; attempt < HOST_DISCOVER_ATTEMPTS; attempt++) {
    await sleep(HOST_DISCOVER_INTERVAL_MS);
    if (!handle.isAlive()) return fail('EasyTier 连接中断');
    const peers = await getPeers(rpc);
    if (!peers) continue;
    const local = peers.find((p) => p.hostname === guestHostname);
    localNat = local?.nat_type;
    const server = peers.find((p) => p.hostname.startsWith(HOST_HOSTNAME_PREFIX));
    if (server && server.ipv4) {
      hostVPNIP = server.ipv4;
      const parsedPort = parseInt(server.hostname.slice(HOST_HOSTNAME_PREFIX.length), 10);
      if (Number.isInteger(parsedPort) && parsedPort > 0 && parsedPort < 65536) {
        scaffoldingPort = parsedPort;
      }
      hostNat = server.nat_type;
      break;
    }
  }

  if (!hostVPNIP || !scaffoldingPort) {
    return fail('未找到房间主机，请确认邀请码正确且主机仍在线');
  }
  difficulty = calcDifficulty(localNat, hostNat);

  // 3. Port-forward the Scaffolding port and handshake. This forward and the
  //    client are kept alive for the whole session (player_ping / profile list).
  const scaffoldingLocal = await reserveLocalPort();
  if (scaffoldingLocal === 0) return fail('无法分配本地端口');
  const fwdOk = await addPortForward(rpc, 'tcp', `0.0.0.0:${scaffoldingLocal}`, `${hostVPNIP}:${scaffoldingPort}`);
  if (!fwdOk) return fail('创建虚拟网络转发失败');

  let client: ScaffoldingClient | null = null;
  try {
    client = await ScaffoldingClient.open(scaffoldingLocal, 5000);
  } catch {
    return fail('无法连接房间服务器');
  }

  // Fingerprint verification.
  const ping = await client.sendSync('c:ping', FINGERPRINT);
  if (!ping || ping.status !== 0 || !ping.data.equals(FINGERPRINT)) {
    return fail('房间服务器校验失败');
  }

  // 4. Learn the real Minecraft port, then add a second forward for it.
  const sp = await client.sendSync('c:server_port');
  if (!sp || sp.status !== 0 || sp.data.length !== 2) {
    return fail('无法获取游戏端口');
  }
  const realMcPort = sp.data.readUInt16BE(0);

  const localMcPort = await reserveLocalPort(realMcPort, [scaffoldingLocal]);
  if (localMcPort === 0) {
    return fail('无法分配本地游戏端口');
  }
  const tcpOk = await addPortForward(rpc, 'tcp', `0.0.0.0:${localMcPort}`, `${hostVPNIP}:${realMcPort}`);
  if (!tcpOk) {
    return fail('创建游戏转发失败');
  }
  // Best-effort UDP forward for mods that rely on it (Simple Voice Chat, etc.).
  await addPortForward(rpc, 'udp', `0.0.0.0:${localMcPort}`, `${hostVPNIP}:${realMcPort}`);

  // 5. Advertise the room on the local LAN list.
  stopFakeServerFn = startFakeServer(localMcPort);

  // 6. Keep the client alive: ping the profile + refresh the player list.
  guestClient = client;
  await pingGuestProfile();
  await refreshGuestPlayers();

  startWatchdog('guest');

  return {
    success: true,
    connectAddr: `127.0.0.1:${localMcPort}`,
    difficulty,
  };
}

async function pingGuestProfile(): Promise<void> {
  if (!guestClient || !guestClient.isAlive()) return;
  await guestClient.sendSync(
    'c:player_ping',
    Buffer.from(JSON.stringify({ machine_id: machineId, name: guestPlayerName, vendor: vendor() }), 'utf8'),
  );
}

async function refreshGuestPlayers(): Promise<void> {
  if (!guestClient || !guestClient.isAlive()) return;
  const res = await guestClient.sendSync('c:player_profiles_list');
  if (res && res.status === 0) {
    try {
      const parsed = JSON.parse(res.data.toString('utf8'));
      if (Array.isArray(parsed)) {
        cachedPlayers = parsed.map((p: { machine_id?: unknown; name?: unknown; vendor?: unknown; kind?: unknown }) => ({
          machineId: String(p.machine_id ?? ''),
          name: String(p.name ?? ''),
          vendor: String(p.vendor ?? ''),
          kind: p.kind === 'GUEST' ? 'GUEST' : 'HOST',
        }));
      }
    } catch {}
  }
}

function startWatchdog(kind: 'host' | 'guest'): void {
  stopWatchdog();
  watchdogTimer = setInterval(async () => {
    if (easyTier && !easyTier.isAlive()) {
      // easytier died — tear everything down.
      await stopEasyTier();
      return;
    }
    if (kind === 'guest' && guestClient) {
      if (!guestClient.isAlive()) {
        await stopEasyTier();
        return;
      }
      await pingGuestProfile();
      await refreshGuestPlayers();
    }
  }, 5000);
}

export async function stopEasyTier(): Promise<void> {
  stopWatchdog();
  if (stopFakeServerFn) {
    stopFakeServerFn();
    stopFakeServerFn = null;
  }
  if (guestClient) {
    guestClient.close();
    guestClient = null;
  }
  if (scaffoldingServer) {
    scaffoldingServer.stop();
    scaffoldingServer = null;
  }
  if (easyTier) {
    killProcessTree(easyTier.pid);
    easyTier = null;
  }
  clearState();
}

export { scanLanGames };
