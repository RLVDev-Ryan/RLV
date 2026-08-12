import net from 'net';
import { type RoomPlayer } from '../../shared/constants';

/**
 * Terracotta "Scaffolding" room protocol — the layer that tracks player
 * profiles and shares the host's Minecraft server port across the VPN.
 *
 * Wire format (mirrors Terracotta src/scaffolding/server.rs + client.rs):
 *   request:  [1 byte kindLen][kind "ns:path"][4 byte BE bodyLen][body]
 *   response: [1 byte status (0=OK)][4 byte BE bodyLen][body]
 *
 * Endpoints:
 *   c:ping                  — echo the request body (fingerprint verification)
 *   c:protocols             — list all endpoints
 *   c:server_port           — host's real Minecraft server port (2 bytes BE)
 *   c:player_ping           — guest reports its profile (JSON body)
 *   c:player_profiles_list  — host returns all profiles (JSON array)
 */

/** Fixed fingerprint sent in c:ping to verify we reached the right host. */
export const FINGERPRINT = Buffer.from([
  0x41, 0x57, 0x48, 0x44, 0x86, 0x37, 0x40, 0x59, 0x57, 0x44, 0x92, 0x43, 0x96, 0x99, 0x85, 0x01,
]);

/** Guest profiles are evicted after 10s without a player_ping. */
const PROFILE_TIMEOUT_MS = 10_000;

export interface ScaffoldingProfile extends RoomPlayer {
  lastPingAt: number;
}

interface InternalProfile {
  machineId: string;
  name: string;
  vendor: string;
  kind: 'HOST' | 'GUEST';
  lastPingAt: number;
}

// ── Packet codec ──

function encodeRequest(kind: string, body: Buffer | Uint8Array): Buffer {
  const kindBuf = Buffer.from(kind, 'utf8');
  const head = Buffer.alloc(1 + kindBuf.length + 4);
  head[0] = kindBuf.length;
  kindBuf.copy(head, 1);
  head.writeUInt32BE(body.length, 1 + kindBuf.length);
  return Buffer.concat([head, Buffer.from(body)]);
}

interface PacketResponse {
  status: number;
  data: Buffer;
}

function ok(data: Buffer): PacketResponse {
  return { status: 0, data };
}

function fail(status: number, data: Buffer): PacketResponse {
  return { status, data };
}

function encodeResponse(res: PacketResponse): Buffer {
  const out = Buffer.alloc(5 + res.data.length);
  out[0] = res.status;
  out.writeUInt32BE(res.data.length, 1);
  res.data.copy(out, 5);
  return out;
}

// ── Profile store ──

class ProfileStore {
  private profiles = new Map<string, InternalProfile>();
  private onChanged: (() => void) | null = null;
  private pruneTimer: NodeJS.Timeout | null = null;

  constructor(host: { machineId: string; name: string; vendor: string }) {
    this.profiles.set(host.machineId, {
      machineId: host.machineId,
      name: host.name,
      vendor: host.vendor,
      kind: 'HOST',
      lastPingAt: Date.now(),
    });
    this.pruneTimer = setInterval(() => this.prune(), 2000);
    this.pruneTimer.unref?.();
  }

  onChange(fn: () => void) {
    this.onChanged = fn;
  }

  private prune() {
    const now = Date.now();
    let changed = false;
    for (const [id, p] of this.profiles) {
      if (p.kind === 'GUEST' && now - p.lastPingAt > PROFILE_TIMEOUT_MS) {
        this.profiles.delete(id);
        changed = true;
      }
    }
    if (changed) this.onChanged?.();
  }

  /** Handle c:player_ping. Returns false if the payload is invalid. */
  registerGuest(json: { machine_id?: unknown; name?: unknown; vendor?: unknown }): boolean {
    if (typeof json.machine_id !== 'string' || typeof json.name !== 'string' || typeof json.vendor !== 'string') {
      return false;
    }
    const existing = this.profiles.get(json.machine_id);
    if (existing && existing.kind === 'HOST') return false; // cannot override host
    const changed =
      !existing || existing.name !== json.name || existing.vendor !== json.vendor || existing.kind !== 'GUEST';
    this.profiles.set(json.machine_id, {
      machineId: json.machine_id,
      name: json.name,
      vendor: json.vendor,
      kind: 'GUEST',
      lastPingAt: Date.now(),
    });
    if (changed) this.onChanged?.();
    return true;
  }

  list(): RoomPlayer[] {
    const out: RoomPlayer[] = [];
    for (const p of this.profiles.values()) {
      out.push({ machineId: p.machineId, name: p.name, vendor: p.vendor, kind: p.kind });
    }
    return out;
  }

  close() {
    if (this.pruneTimer) clearInterval(this.pruneTimer);
  }
}

// ── Server ──

export interface ScaffoldingServer {
  port: number;
  getPlayers: () => RoomPlayer[];
  stop: () => void;
}

export interface ScaffoldingServerOptions {
  port: number;
  hostProfile: { machineId: string; name: string; vendor: string };
  /** Called whenever the player list changes. */
  onPlayersChange?: () => void;
  /** Lazily resolve the host's Minecraft server port for c:server_port. */
  getServerPort: () => number | null;
}

const PROTOCOL_NAMES = ['c:ping', 'c:protocols', 'c:server_port', 'c:player_ping', 'c:player_profiles_list'];

export function startScaffoldingServer(opts: ScaffoldingServerOptions): Promise<ScaffoldingServer> {
  return new Promise((resolve, reject) => {
    const store = new ProfileStore(opts.hostProfile);
    store.onChange(() => opts.onPlayersChange?.());

    const server = net.createServer((socket) => {
      socket.setNoDelay(true);
      // Stream-buffer parser: requests may arrive split or coalesced across
      // TCP segments, so accumulate bytes and extract complete packets.
      let buffer: Buffer<ArrayBufferLike> = Buffer.alloc(0);
      socket.on('data', (chunk: Buffer) => {
        buffer = buffer.length === 0 ? chunk : Buffer.concat([buffer, chunk]);
        for (;;) {
          if (buffer.length < 5) break; // need at least [kindLen][kind][bodyLen]... but kindLen>=1
          const kindLen = buffer[0];
          if (buffer.length < 1 + kindLen + 4) break;
          const kind = buffer.subarray(1, 1 + kindLen).toString('utf8');
          const bodyLen = buffer.readUInt32BE(1 + kindLen);
          const total = 1 + kindLen + 4 + bodyLen;
          if (buffer.length < total) break;
          const body = buffer.subarray(1 + kindLen + 4, total);
          buffer = buffer.subarray(total);
          try {
            socket.write(encodeResponse(handleRequest(kind, body, opts, store)));
          } catch {
            return;
          }
        }
      });
      socket.on('error', () => {});
      socket.on('close', () => {});
    });

    server.on('error', (err) => {
      if ((err as NodeJS.ErrnoException).code === 'EADDRINUSE' && opts.port !== 0) {
        reject(err);
      } else {
        reject(err);
      }
    });

    server.listen(opts.port, '0.0.0.0', () => {
      const addr = server.address() as net.AddressInfo;
      resolve({
        port: addr.port,
        getPlayers: () => store.list(),
        stop: () => {
          store.close();
          server.close();
        },
      });
    });
  });
}

function handleRequest(
  kind: string,
  body: Buffer,
  opts: ScaffoldingServerOptions,
  store: ProfileStore,
): PacketResponse {
  const [ns, path] = kind.split(':');
  if (ns !== 'c') return fail(255, Buffer.from('Unknown namespace'));
  switch (path) {
    case 'ping':
      return ok(body);
    case 'protocols':
      return ok(Buffer.from(PROTOCOL_NAMES.join('\0'), 'utf8'));
    case 'server_port': {
      const port = opts.getServerPort();
      if (port === null || port <= 0 || port > 65535) return fail(32, Buffer.alloc(0));
      const buf = Buffer.alloc(2);
      buf.writeUInt16BE(port, 0);
      return ok(buf);
    }
    case 'player_ping': {
      let parsed: { machine_id?: unknown; name?: unknown; vendor?: unknown };
      try {
        parsed = JSON.parse(body.toString('utf8'));
      } catch {
        return fail(33, Buffer.from('Invalid JSON'));
      }
      if (!store.registerGuest(parsed)) {
        return fail(34, Buffer.from('Invalid profile payload'));
      }
      return ok(Buffer.alloc(0));
    }
    case 'player_profiles_list': {
      // Wire format uses snake_case keys, matching Terracotta's protocol.
      const wire = store.list().map((p) => ({
        machine_id: p.machineId,
        name: p.name,
        vendor: p.vendor,
        kind: p.kind,
      }));
      return ok(Buffer.from(JSON.stringify(wire), 'utf8'));
    }
    default:
      return fail(255, Buffer.from('Requested protocol has not been implemented.'));
  }
}

// ── Client ──

export class ScaffoldingClient {
  private socket: net.Socket;
  private queue: Promise<unknown> = Promise.resolve();

  private constructor(socket: net.Socket) {
    this.socket = socket;
    this.socket.setNoDelay(true);
  }

  static open(port: number, timeoutMs = 5000): Promise<ScaffoldingClient> {
    return new Promise((resolve, reject) => {
      const socket = net.connect({ port, host: '127.0.0.1' });
      const timer = setTimeout(() => {
        socket.destroy();
        reject(new Error('scaffolding connection timed out'));
      }, timeoutMs);
      socket.once('connect', () => {
        clearTimeout(timer);
        resolve(new ScaffoldingClient(socket));
      });
      socket.once('error', (err) => {
        clearTimeout(timer);
        reject(err);
      });
    });
  }

  isAlive(): boolean {
    return !this.socket.destroyed;
  }

  /**
   * Send a request and await the response. Requests on one socket are
   * serialized (a background responder owns the socket's data stream).
   * Returns null on failure.
   */
  sendSync(kind: string, body: Buffer | Uint8Array = Buffer.alloc(0)): Promise<PacketResponse | null> {
    const task = this.queue.then(() => this.transact(kind, body));
    // Keep the chain alive even when this call fails.
    this.queue = task.catch(() => undefined);
    return task;
  }

  private transact(kind: string, body: Buffer | Uint8Array): Promise<PacketResponse | null> {
    return new Promise((resolve) => {
      if (this.socket.destroyed) {
        resolve(null);
        return;
      }
      const chunks: Buffer[] = [];
      let received = 0;
      let settled = false;
      const settle = (v: PacketResponse | null) => {
        if (settled) return;
        settled = true;
        cleanup();
        resolve(v);
      };
      const onData = (chunk: Buffer) => {
        chunks.push(chunk);
        received += chunk.length;
        if (received < 5) return;
        const all = Buffer.concat(chunks, received);
        const bodyLen = all.readUInt32BE(1);
        if (received < 5 + bodyLen) return;
        settle({ status: all[0], data: all.subarray(5, 5 + bodyLen) });
      };
      const onError = () => settle(null);
      const onEnd = () => settle(null);
      const cleanup = () => {
        this.socket.off('data', onData);
        this.socket.off('error', onError);
        this.socket.off('end', onEnd);
      };
      this.socket.on('data', onData);
      this.socket.on('error', onError);
      this.socket.on('end', onEnd);
      try {
        this.socket.write(encodeRequest(kind, body));
      } catch {
        settle(null);
      }
    });
  }

  close() {
    try {
      this.socket.destroy();
    } catch {}
  }
}
