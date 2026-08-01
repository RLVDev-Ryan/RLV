import { app } from 'electron';
import path from 'path';
import fs from 'fs';
import type { Account, AccountStore } from '../../shared/constants';

const ACCOUNTS_FILE = path.join(app.getPath('appData'), 'rlv', 'accounts.json');

/** In-memory cache so repeated IPC reads don't hit the disk every time. */
let cache: AccountStore | null = null;

function ensureDir(): void {
  const dir = path.dirname(ACCOUNTS_FILE);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

export function loadAccounts(): AccountStore {
  if (cache) return cache;
  try {
    ensureDir();
    if (fs.existsSync(ACCOUNTS_FILE)) {
      const raw = fs.readFileSync(ACCOUNTS_FILE, 'utf-8');
      cache = JSON.parse(raw) as AccountStore;
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
  ensureDir();
  // Atomic write: write to a temp file then rename to avoid corruption on crash
  const tmp = ACCOUNTS_FILE + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(store, null, 2), 'utf-8');
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
  // Replace existing account with same UUID + type
  const idx = store.accounts.findIndex((a) => a.uuid === account.uuid && a.type === account.type);
  if (idx !== -1) {
    store.accounts[idx] = { ...account, lastUsed: Date.now() };
    if (setAsCurrent) store.currentId = account.id;
  } else {
    store.accounts.push(account);
    if (setAsCurrent) store.currentId = account.id;
  }
  saveAccounts(store);
  return account;
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
