import { app } from 'electron';
import path from 'path';
import fs from 'fs';
import { DEFAULT_CONFIGS, type ConfigName, type RlvConfigs } from '../../shared/config';

/**
 * User-editable .js config files.
 *
 * Every config lives in `<userData>/config/<name>.js` as a plain CommonJS
 * module the user can open and edit directly:
 *
 *   // RLV color 配置 — 可手动编辑
 *   module.exports = { "accent": "#6b9bc0" };
 *
 * `require` is used to load them (with cache-busting); a syntax error in a
 * user-edited file falls back to the defaults instead of crashing the app.
 */

const CONFIG_NAMES = Object.keys(DEFAULT_CONFIGS) as ConfigName[];

/** Runtime guard for renderer-supplied config names (IPC boundary). */
export function isConfigName(value: unknown): value is ConfigName {
  return typeof value === 'string' && (CONFIG_NAMES as readonly string[]).includes(value);
}

export function configDir(): string {
  return path.join(app.getPath('userData'), 'config');
}

function configFile(name: ConfigName): string {
  // Defense in depth: a name like "../../foo" must never escape the config
  // directory (the file is later `require`d, so this is also a code-exec
  // surface — only known config names may ever be loaded).
  if (!isConfigName(name)) {
    throw new Error(`未知配置: ${String(name)}`);
  }
  return path.join(configDir(), `${name}.js`);
}

/** Deep-merge two plain objects (used to merge user config onto defaults). */
function deepMerge<T>(base: T, override: unknown): T {
  // Arrays must stay arrays — a `{}` override for e.g. jvmArgs must not replace
  // the default `[]` (that would crash renderers calling .join()).
  if (Array.isArray(base)) return (Array.isArray(override) ? override : base) as T;
  if (base && typeof base === 'object' && override && typeof override === 'object') {
    const out: Record<string, unknown> = { ...(base as Record<string, unknown>) };
    for (const [k, v] of Object.entries(override as Record<string, unknown>)) {
      out[k] = deepMerge(out[k], v);
    }
    return out as T;
  }
  return (override ?? base) as T;
}

function sanitize(raw: unknown, def: unknown): unknown {
  // Basic type sanity — coerce scalars/arrays to the default's shape.
  if (Array.isArray(def)) return Array.isArray(raw) ? raw : def;
  if (def === null || def === undefined) return raw;
  if (typeof def === 'object') {
    if (!raw || typeof raw !== 'object') return def;
    return deepMerge(def, raw);
  }
  return typeof raw === typeof def ? raw : def;
}

export function loadConfig<K extends ConfigName>(name: K): RlvConfigs[K] {
  const file = configFile(name);
  if (!fs.existsSync(file)) return DEFAULT_CONFIGS[name];
  try {
    delete require.cache[require.resolve(file)];
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const mod = require(file) as unknown;
    const value =
      mod && typeof mod === 'object' && 'default' in (mod as object) ? (mod as { default: unknown }).default : mod;
    return sanitize(value, DEFAULT_CONFIGS[name]) as RlvConfigs[K];
  } catch (err) {
    console.error(`[Config] Failed to load ${name}.js — using defaults:`, err);
    return DEFAULT_CONFIGS[name];
  }
}

export function saveConfig<K extends ConfigName>(name: K, data: RlvConfigs[K]): void {
  const file = configFile(name);
  const merged = sanitize(data, DEFAULT_CONFIGS[name]);
  const content = `// RLV ${name} 配置 — 可手动编辑\n// RLV ${name} config — user editable\nmodule.exports = ${JSON.stringify(merged, null, 2)};\n`;
  fs.mkdirSync(configDir(), { recursive: true });
  const tmp = file + '.tmp';
  fs.writeFileSync(tmp, content, 'utf-8');
  fs.renameSync(tmp, file);
  try {
    delete require.cache[require.resolve(file)];
  } catch {}
}

/**
 * Batch-save several configs in one IPC round trip (theme changes touch
 * color/ui/picture/launcher at once). Each key is whitelist-checked.
 */
export function saveConfigs(entries: Record<string, unknown>): void {
  for (const [name, data] of Object.entries(entries)) {
    if (isConfigName(name)) {
      saveConfig(name, data as never);
    }
  }
}

export function getAllConfigs(): RlvConfigs {
  const out: Record<string, unknown> = {};
  for (const n of CONFIG_NAMES) {
    out[n] = loadConfig(n);
  }
  return out as unknown as RlvConfigs;
}
