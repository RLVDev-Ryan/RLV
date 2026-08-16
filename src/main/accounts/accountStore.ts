import { app, safeStorage } from 'electron';
import path from 'path';
import fs from 'fs';
import type { Account, AccountStore } from '../../shared/constants';

// Live with the rest of the app data (userData is redirected to .RLV in
// portable mode). Previously the file lived at %APPDATA%\rlv\accounts.json —
// see LEGACY_ACCOUNTS_FILE for the one-time migration.
const ACCOUNTS_FILE = path.join(app.getPath('userData'), 'accounts.json');

/** Legacy installed-build location, migrated to userData on first load. */
const LEGACY_ACCOUNTS_FILE = path.join(app.getPath('appData'), 'rlv', 'accounts.json');

/** Fields that hold OAuth tokens — encrypted at rest via Electron safeStorage. */
const ENC_PREFIX = 'enc:v1:';

/** In-memory cache so repeated IPC reads don't hit the disk every time. */
let cache: AccountStore | null = null;

function encryptField(value: string | undefined): string | undefined {
  if (!value) return value;
  try {
    if (safeStorage.isEncryptionAvailable()) {
      return ENC_PREFIX + safeStorage.encryptString(value).toString('base64');
    }
  } catch {
    // fall through to plaintext — the OS keyring is unavailable/broken
  }
  return value;
}

function decryptField(value: string | undefined): string | undefined {
  if (!value) return value;
  try {
    if (value.startsWith(ENC_PREFIX)) {
      if (!safeStorage.isEncryptionAvailable()) return undefined;
      return safeStorage.decryptString(Buffer.from(value.slice(ENC_PREFIX.length), 'base64'));
    }
  } catch {
    return undefined; // undecryptable (e.g. keyring changed) — treat as absent
  }
  return value; // plaintext from a pre-encryption file
}

function encryptAccount(a: Account): Account {
  return {
    ...a,
    msAccessToken: encryptField(a.msAccessToken),
    msRefreshToken: encryptField(a.msRefreshToken),
    minecraftToken: encryptField(a.minecraftToken),
    yggdrasilToken: encryptField(a.yggdrasilToken),
  };
}

function decryptAccount(a: Account): Account {
  return {
    ...a,
    msAccessToken: decryptField(a.msAccessToken),
    msRefreshToken: decryptField(a.msRefreshToken),
    minecraftToken: decryptField(a.minecraftToken),
    yggdrasilToken: decryptField(a.yggdrasilToken),
  };
}

function ensureDir(file: string): void {
  const dir = path.dirname(file);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

/**
 * One-time migration for builds that stored accounts at %APPDATA%\rlv.
 * Moves the file into userData and returns true when a legacy file was found.
 */
function migrateLegacyFile(): boolean {
  if (fs.existsSync(ACCOUNTS_FILE) || !fs.existsSync(LEGACY_ACCOUNTS_FILE)) return false;
  try {
    ensureDir(ACCOUNTS_FILE);
    fs.copyFileSync(LEGACY_ACCOUNTS_FILE, ACCOUNTS_FILE);
    fs.unlinkSync(LEGACY_ACCOUNTS_FILE);
    return true;
  } catch {
    return false;
  }
}

export function loadAccounts(): AccountStore {
  if (cache) return cache;
  migrateLegacyFile();
  try {
    ensureDir(ACCOUNTS_FILE);
    if (fs.existsSync(ACCOUNTS_FILE)) {
      const raw = fs.readFileSync(ACCOUNTS_FILE, 'utf-8');
      const parsed = JSON.parse(raw) as AccountStore;
      cache = {
        ...parsed,
        accounts: Array.isArray(parsed.accounts) ? parsed.accounts.map(decryptAccount) : [],
      };
      return cache;
    }
  } catch {
    console.error('Failed to load accounts, starting fresh');
  }
  cache = { accounts: [] };
  return cache;
}

function saveAccounts(store: AccountStore): void {
  cache = store;
  ensureDir(ACCOUNTS_FILE);
  // Encrypt token fields at rest; atomic write to avoid corruption on crash.
  const out: AccountStore = { ...store, accounts: store.accounts.map(encryptAccount) };
  const tmp = ACCOUNTS_FILE + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(out, null, 2), 'utf-8');
  fs.renameSync(tmp, ACCOUNTS_FILE);
}

/** List all saved accounts */
export function listAccounts(): Account[] {
  return loadAccounts().accounts;
}

/** Get the currently selected account */
export function getCurrentAccount(): Account | null {
  const store = loadAccounts();
  if (!store.currentId) return store.accounts[0] ?? null;
  return store.accounts.find((a) => a.id === store.currentId) ?? store.accounts[0] ?? null;
}

/** Set the current account by ID */
export function setCurrentAccount(id: string): Account | null {
  const store = loadAccounts();
  const target = store.accounts.find((a) => a.id === id);
  if (!target) return null;
  store.currentId = id;
  saveAccounts(store);
  return target;
}

/** Add a new account and optionally set as current */
export function addAccount(account: Account, setAsCurrent = true): Account {
  const store = loadAccounts();
  // Replace existing account with same UUID + type — keep the ORIGINAL id so
  // any currentId reference stays valid when setAsCurrent is false.
  const idx = store.accounts.findIndex((a) => a.uuid === account.uuid && a.type === account.type);
  if (idx !== -1) {
    const existing = store.accounts[idx];
    store.accounts[idx] = { ...account, id: existing.id, lastUsed: Date.now() };
    if (setAsCurrent) store.currentId = existing.id;
  } else {
    store.accounts.push(account);
    if (setAsCurrent) store.currentId = account.id;
  }
  saveAccounts(store);
  return store.accounts[idx ?? store.accounts.length - 1];
}

/** Remove an account by ID */
export function removeAccount(id: string): boolean {
  const store = loadAccounts();
  const idx = store.accounts.findIndex((a) => a.id === id);
  if (idx === -1) return false;
  store.accounts.splice(idx, 1);
  if (store.currentId === id) {
    store.currentId = store.accounts[0]?.id ?? undefined;
  }
  saveAccounts(store);
  return true;
}
