import dgram from 'dgram';
import os from 'os';
import type { LanGame } from '../../shared/constants';

/**
 * Real Minecraft LAN discovery via the vanilla multicast protocol.
 *
 * Minecraft broadcasts an "Open to LAN" announcement to 224.0.2.60:4445
 * (IPv4) / FF75:230::60:4445 (IPv6). The payload is
 *   [MOTD]<motd>[/MOTD][AD]<port>[/AD]
 * (with a leading 0x02 byte in modern versions — we search for the markers).
 * This replaces the old TCP port-probe "scan" that returned fake MOTDs.
 */

const MC_MULTICAST_V4 = '224.0.2.60';
// IPv6 LAN discovery group (FF75:230::60:4445) — currently IPv4-only scanning.
const MC_PORT = 4445;

/** MOTD of our own fake lobby server — filtered out of scans. */
export const FAKE_LOBBY_MOTD = '§6§lRLV 联机房间（请保持启动器运行）';

/** Strip Minecraft section-sign color codes for display. */
function cleanMotd(raw: string): string {
  return raw.replace(/§./g, '').trim();
}

interface SeenGame {
  motd: string;
  host: string;
  port: number;
  lastSeen: number;
}

function parseAnnouncement(buf: Buffer): { motd: string; port: number } | null {
  const data = buf.toString('utf8');
  const motdB = data.indexOf('[MOTD]');
  const motdE = data.indexOf('[/MOTD]');
  if (motdB < 0 || motdE <= motdB + 6) return null;
  const adB = data.indexOf('[AD]');
  const adE = data.indexOf('[/AD]');
  if (adB < 0 || adE <= adB + 4) return null;

  const motd = data.slice(motdB + 6, motdE);
  const port = parseInt(data.slice(adB + 4, adE), 10);
  if (Number.isNaN(port) || port <= 0 || port > 65535) return null;
  return { motd, port };
}

function v4Interfaces(): { address: string; name: string }[] {
  const out: { address: string; name: string }[] = [];
  const ifaces = os.networkInterfaces();
  for (const name of Object.keys(ifaces)) {
    for (const iface of ifaces[name] ?? []) {
      if (iface.family === 'IPv4' && !iface.internal) {
        out.push({ address: iface.address, name });
      }
    }
  }
  return out;
}

/**
 * Listen for Minecraft LAN announcements for `timeoutMs` and return the
 * discovered servers. Results self-expire after 5s without a re-announcement.
 */
export function scanLanGames(timeoutMs = 2500): Promise<LanGame[]> {
  return new Promise((resolve) => {
    const games = new Map<string, SeenGame>();
    const ifaces = v4Interfaces();
    if (ifaces.length === 0) {
      resolve([]);
      return;
    }

    const socket = dgram.createSocket({ type: 'udp4', reuseAddr: true });
    let finished = false;

    const finish = (result: LanGame[]) => {
      if (finished) return;
      finished = true;
      clearInterval(pruneTimer);
      try {
        socket.close();
      } catch {}
      resolve(result);
    };

    socket.on('message', (msg, rinfo) => {
      const parsed = parseAnnouncement(msg);
      if (!parsed) return;
      if (parsed.motd === FAKE_LOBBY_MOTD) return;

      const key = `${rinfo.address}:${parsed.port}`;
      games.set(key, {
        motd: parsed.motd,
        host: rinfo.address,
        port: parsed.port,
        lastSeen: Date.now(),
      });
    });

    socket.on('error', () => finish([]));

    // Prune games not re-announced within 5s.
    const pruneTimer = setInterval(() => {
      const now = Date.now();
      for (const [k, g] of games) {
        if (now - g.lastSeen > 5000) games.delete(k);
      }
    }, 1000);

    const bindAddr = '0.0.0.0';
    socket.bind(MC_PORT, bindAddr, () => {
      for (const iface of ifaces) {
        try {
          socket.addMembership(MC_MULTICAST_V4, iface.address);
        } catch {}
      }
      // IPv6 is a bonus — best-effort.
      try {
        socket.setMulticastInterface(ifaces[0].address);
      } catch {}
    });

    setTimeout(() => {
      const result: LanGame[] = [];
      for (const g of games.values()) {
        result.push({ motd: g.motd, host: g.host, port: g.port, worldName: cleanMotd(g.motd) });
      }
      // Sort by port for stable display.
      result.sort((a, b) => a.port - b.port);
      finish(result);
    }, timeoutMs);
  });
}

/**
 * Broadcast a fake Minecraft LAN announcement so the shared room appears in
 * the game's "LAN world" list on this machine. Returns a stop function.
 */
export function startFakeServer(port: number, motd: string = FAKE_LOBBY_MOTD): () => void {
  const ifaces = v4Interfaces();
  if (ifaces.length === 0) return () => {};

  const socket = dgram.createSocket({ type: 'udp4', reuseAddr: false });
  let closed = false;
  let timer: NodeJS.Timeout | null = null;

  // Async send failures (adapter flap, EACCES…) arrive as an 'error' event —
  // without a listener they would surface as an uncaught exception and kill
  // the whole main process.
  socket.on('error', () => {
    closed = true;
    if (timer) clearInterval(timer);
    timer = null;
    try {
      socket.close();
    } catch {}
  });

  const message = Buffer.from(`[MOTD]${motd}[/MOTD][AD]${port}[/AD]`, 'utf8');

  try {
    socket.bind(0, '0.0.0.0', () => {
      // stop() may have been called before bind completed — then don't start
      // the interval (it would leak, firing every 1.5s forever).
      if (closed) {
        try {
          socket.close();
        } catch {}
        return;
      }
      try {
        socket.setBroadcast(true);
        socket.setMulticastTTL(4);
        socket.setMulticastLoopback(true);
        for (const iface of ifaces) {
          try {
            socket.setMulticastInterface(iface.address);
          } catch {}
        }
      } catch {}
      const send = () => {
        if (closed) return;
        for (const iface of ifaces) {
          try {
            socket.setMulticastInterface(iface.address);
            socket.send(message, 0, message.length, MC_PORT, MC_MULTICAST_V4);
          } catch {}
        }
      };
      send();
      timer = setInterval(send, 1500);
    });
  } catch {
    return () => {};
  }

  return () => {
    closed = true;
    if (timer) clearInterval(timer);
    timer = null;
    try {
      socket.close();
    } catch {}
  };
}
