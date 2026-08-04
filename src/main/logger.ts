import { app, BrowserWindow } from 'electron';
import fs from 'fs';
import path from 'path';
import { IPC_CHANNELS } from '../shared/constants';

/**
 * Captures the main process console output (which includes every subsystem's
 * logs: EasyTier, the launcher, forwarded Minecraft output, …) and exposes it
 * to the renderer Logs page via IPC, keeping a bounded ring buffer.
 *
 * Overriding console.* is deliberate — it's the single choke point all main
 * process code already logs through.
 */

const MAX_BUFFER = 5000;
const buffer: string[] = [];

let mainWindow: BrowserWindow | null = null;
let logStream: fs.WriteStream | null = null;

function ts(): string {
  const d = new Date();
  return d.toLocaleTimeString('en-GB', { hour12: false }) + '.' + String(d.getMilliseconds()).padStart(3, '0');
}

function formatArgs(args: unknown[]): string {
  return args
    .map((a) => {
      if (a instanceof Error) return a.stack || a.message;
      if (a instanceof Buffer) return a.toString('utf8');
      if (typeof a === 'object') {
        try {
          return JSON.stringify(a);
        } catch {
          return String(a);
        }
      }
      return String(a);
    })
    .join(' ');
}

function emit(level: 'INFO' | 'WARN' | 'ERROR', text: string): void {
  // Skip the boilerplate V8 header lines when an Error is already one line.
  const line = `[${ts()}] [${level}] ${text}`;
  buffer.push(line);
  if (buffer.length > MAX_BUFFER) buffer.shift();

  try {
    logStream?.write(line + '\n');
  } catch {}

  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send(IPC_CHANNELS.LOGS_APPEND, line);
  }
}

export function setLoggerWindow(win: BrowserWindow | null): void {
  mainWindow = win;
}

export function getLogs(): string[] {
  return [...buffer];
}

export function clearLogs(): void {
  buffer.length = 0;
}

function openLogFile(): void {
  try {
    const dir = path.join(app.getPath('userData'), 'logs');
    fs.mkdirSync(dir, { recursive: true });
    logStream = fs.createWriteStream(path.join(dir, 'main.log'), { flags: 'a' });
    logStream.on('error', () => {});
  } catch {}
}

export function installLogger(): void {
  openLogFile();

  const orig = {
    log: console.log,
    info: console.info,
    warn: console.warn,
    error: console.error,
  };

  console.log = (...args: unknown[]) => {
    orig.log(...args);
    emit('INFO', formatArgs(args));
  };
  console.info = (...args: unknown[]) => {
    orig.info(...args);
    emit('INFO', formatArgs(args));
  };
  console.warn = (...args: unknown[]) => {
    orig.warn(...args);
    emit('WARN', formatArgs(args));
  };
  console.error = (...args: unknown[]) => {
    orig.error(...args);
    emit('ERROR', formatArgs(args));
  };

  emit('INFO', 'Logger installed');
}
