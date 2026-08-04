import crypto from 'crypto';

/**
 * Room identity + invite code.
 *
 * Mirrors Terracotta's scheme: a 16-character code drawn from a 34-character
 * alphabet (no I/O, which map to 1/0 on lookup) encodes BOTH the EasyTier
 * network name and its secret. The numeric value is forced to be divisible by
 * 7 so a corrupted code can be rejected at parse time.
 *
 *   network_name  = rlv-mc-<first 8 chars>
 *   network_secret = <last 8 chars>
 *   invite code    = RLV-XXXX-XXXX-XXXX-XXXX-<encoded IP><encoded port>
 */

const CHARS = '0123456789ABCDEFGHJKLMNPQRSTUVWXYZ'; // 34
const CODE_LEN = 16;
const ROOM_PREFIX = 'rlv-mc-';

export interface Room {
  /** Human-friendly code, e.g. "K2M4-6N8P-Q2R4-6T8V". */
  code: string;
  networkName: string;
  networkSecret: string;
}

function lookupChar(ch: string): number {
  let c = ch;
  if (c === 'I') c = '1';
  if (c === 'O') c = '0';
  const idx = CHARS.indexOf(c);
  return idx;
}

function fromValue(value: bigint): Room {
  const digits: string[] = [];
  let v = value;
  for (let i = 0; i < CODE_LEN; i++) {
    digits.push(CHARS[Number(v % 34n)]);
    v /= 34n;
  }

  let code = '';
  for (let i = 0; i < CODE_LEN; i++) {
    if (i === 4 || i === 8 || i === 12) code += '-';
    code += digits[i];
  }

  const first8 = digits.slice(0, 8).join('');
  const last8 = digits.slice(8, 16).join('');
  return {
    code,
    networkName: ROOM_PREFIX + first8,
    networkSecret: last8,
  };
}

export function generateRoom(): Room {
  const bytes = crypto.randomBytes(16);
  const max = 34n ** BigInt(CODE_LEN);
  let value = 0n;
  for (let i = 0; i < 16; i++) {
    value += BigInt(bytes[i] % 34) * 34n ** BigInt(i);
  }
  // Force divisibility by 7 as a checksum, like Terracotta.
  value -= value % 7n;
  if (value < 0n) value += 7n;
  value %= max;
  return fromValue(value);
}

/** Parse a room code (with or without the RLV- prefix). Returns null if invalid. */
export function parseRoom(code: string): Room | null {
  const cleaned = code.trim().toUpperCase().replace(/^RLV-/, '');
  const parts = cleaned.split('-');
  if (parts.length !== 4) return null;
  const chars = parts.join('');
  if (chars.length !== CODE_LEN) return null;

  let value = 0n;
  for (let i = 0; i < CODE_LEN; i++) {
    const d = lookupChar(chars[i]);
    if (d < 0) return null;
    value += BigInt(d) * 34n ** BigInt(i);
  }
  if (value % 7n !== 0n) return null;

  return fromValue(value);
}

// ── IP / port encoding (A-J = digit 0-9) ──

const DIGIT_MAP = 'ABCDEFGHIJ';

export function encodeIP(ip: string): string {
  return ip
    .split('.')
    .map((o) => o.padStart(3, '0'))
    .join('')
    .split('')
    .map((d) => DIGIT_MAP[parseInt(d)])
    .join('');
}

export function decodeIP(encoded: string): string | null {
  if (encoded.length !== 12) return null;
  const digits = encoded
    .split('')
    .map((c) => {
      const idx = DIGIT_MAP.indexOf(c);
      return idx >= 0 ? String(idx) : 'x';
    })
    .join('');
  if (digits.includes('x')) return null;
  const octets: string[] = [];
  for (let i = 0; i < 4; i++) octets.push(String(parseInt(digits.slice(i * 3, i * 3 + 3), 10)));
  return octets.join('.');
}

export function encodePort(port: number): string {
  return String(port)
    .padStart(5, '0')
    .split('')
    .map((d) => DIGIT_MAP[parseInt(d)])
    .join('');
}

export function decodePort(encoded: string): number | null {
  if (encoded.length !== 5) return null;
  const digits = encoded
    .split('')
    .map((c) => {
      const idx = DIGIT_MAP.indexOf(c);
      return idx >= 0 ? String(idx) : 'x';
    })
    .join('');
  if (digits.includes('x')) return null;
  return parseInt(digits, 10);
}

export function encodeInviteCode(room: Room, ip: string, listenerPort: number): string {
  return `RLV-${room.code}-${encodeIP(ip)}${encodePort(listenerPort)}`;
}

export interface DecodedInvite {
  room: Room;
  hostIP: string;
  listenerPort: number;
}

export function decodeInviteCode(invite: string): DecodedInvite | null {
  const parts = invite.trim().toUpperCase().split('-');
  // RLV + 4 code groups + 1 address segment
  if (parts.length !== 6) return null;
  if (parts[0] !== 'RLV') return null;
  const addr = parts[5];
  if (addr.length !== 17) return null;

  const room = parseRoom(parts.slice(1, 5).join('-'));
  if (!room) return null;

  const ip = decodeIP(addr.slice(0, 12));
  const port = decodePort(addr.slice(12));
  if (!ip || port === null) return null;

  return { room, hostIP: ip, listenerPort: port };
}
