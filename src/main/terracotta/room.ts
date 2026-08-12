import crypto from 'crypto';

/**
 * Room identity + invite code — Terracotta / HMCL compatible.
 *
 * Mirrors Terracotta's scheme exactly so invite codes are interchangeable with
 * other launchers' 陶瓦联机:
 *
 *   invite code    = U/XXXX-XXXX-XXXX-XXXX   (16 chars, 34-char alphabet,
 *                    no I/O — they map to 1/0; value divisible by 7)
 *   network_name   = scaffolding-mc-XXXX-XXXX
 *   network_secret = XXXX-XXXX
 *
 * The invite code carries NO host address — guests join the EasyTier network by
 * name/secret via public nodes and discover the host from the peer list.
 */

const CHARS = '0123456789ABCDEFGHJKLMNPQRSTUVWXYZ'; // 34
const CODE_LEN = 16;
const CODE_PREFIX = 'U/';
const ROOM_PREFIX = 'scaffolding-mc-';

export interface Room {
  /** Human-friendly code, e.g. "U/3EKB-0WTZ-NEGB-2U3U". */
  code: string;
  networkName: string;
  networkSecret: string;
}

function lookupChar(ch: string): number {
  let c = ch;
  if (c === 'I') c = '1';
  if (c === 'O') c = '0';
  return CHARS.indexOf(c);
}

function fromValue(value: bigint): Room {
  const digits: string[] = [];
  let v = value;
  for (let i = 0; i < CODE_LEN; i++) {
    digits.push(CHARS[Number(v % 34n)]);
    v /= 34n;
  }

  // Code: U/XXXX-XXXX-XXXX-XXXX
  let code = CODE_PREFIX;
  for (let i = 0; i < CODE_LEN; i++) {
    if (i === 4 || i === 8 || i === 12) code += '-';
    code += digits[i];
  }

  // Network name / secret must include the dashes — they feed EasyTier's
  // --network-name / --network-secret, which must match Terracotta exactly.
  const group = (from: number, to: number) => digits.slice(from, to).join('');
  const networkName = `${ROOM_PREFIX}${group(0, 4)}-${group(4, 8)}`;
  const networkSecret = `${group(8, 12)}-${group(12, 16)}`;

  return { code, networkName, networkSecret };
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

/** Parse a Terracotta room code ("U/XXXX-XXXX-XXXX-XXXX"). Returns null if invalid. */
export function parseRoom(code: string): Room | null {
  const cleaned = code.trim().toUpperCase().replace(/^U\//, '');
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

/** The invite code is the room code itself — no embedded host address. */
export function encodeInviteCode(room: Room): string {
  return room.code;
}

/** Parse an invite code into a room. Returns null if invalid. */
export function decodeInviteCode(invite: string): Room | null {
  return parseRoom(invite);
}
