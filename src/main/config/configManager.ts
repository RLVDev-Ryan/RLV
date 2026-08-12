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

export function configDir(): string {
  return path.join(app.getPath('userData'), 'config');
}

function configFile(name: ConfigName): string {
  return path.join(configDir(), `${name}.js`);
}

/** Deep-merge two plain objects (used to merge user config onto defaults). */
function deepMerge<T>(base: T, override: unknown): T {
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

export function getAllConfigs(): RlvConfigs {
  const out: Record<string, unknown> = {};
  for (const n of CONFIG_NAMES) {
    out[n] = loadConfig(n);
  }
  return out as unknown as RlvConfigs;
}
