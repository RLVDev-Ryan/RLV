import { DEFAULT_CONFIGS, type ConfigName, type RlvConfigs } from '../../shared/config';
import { initLaunchSettings, type LaunchSettings } from '../../shared/utils';

/** Renderer-side mirror of the user-editable .js config files. */

const clone = <T>(o: T): T => JSON.parse(JSON.stringify(o)) as T;

let configs: RlvConfigs = clone(DEFAULT_CONFIGS);
let loaded = false;
let listeners: Array<() => void> = [];

function notify() {
  listeners.forEach((l) => l());
}

export const configStore = {
  get loaded() {
    return loaded;
  },
  get all(): RlvConfigs {
    return configs;
  },
  get<K extends ConfigName>(name: K): RlvConfigs[K] {
    return configs[name];
  },

  /** Fetch all configs from the main process and seed local caches. */
  async loadAll(): Promise<void> {
    if (!window.electronAPI) return;
    try {
      const data = (await window.electronAPI.config.getAll()) as Partial<RlvConfigs>;
      const store = configs as Record<ConfigName, unknown>;
      for (const n of Object.keys(DEFAULT_CONFIGS) as ConfigName[]) {
        if (data[n] && typeof data[n] === 'object') {
          store[n] = { ...clone(DEFAULT_CONFIGS[n]), ...(data[n] as object) };
        }
      }
      initLaunchSettings(configs.launcher.launch);
      loaded = true;
      notify();
      // Persist shared/utils.saveLaunchSettings() calls back into launcher.launch.
      window.addEventListener('rlv:launch-settings-changed', ((e: CustomEvent<LaunchSettings>) => {
        configStore.update('launcher', { ...configs.launcher, launch: e.detail });
      }) as EventListener);
    } catch {}
  },

  /** Merge a patch into a config and persist it to the .js file. */
  update<K extends ConfigName>(name: K, patch: Partial<RlvConfigs[K]>): void {
    configs[name] = { ...configs[name], ...patch };
    notify();
    window.electronAPI?.config.set(name, configs[name]);
  },

  subscribe(fn: () => void) {
    listeners.push(fn);
    return () => {
      listeners = listeners.filter((l) => l !== fn);
    };
  },
};
