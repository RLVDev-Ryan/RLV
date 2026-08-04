import type { LaunchProgress } from '../../shared/constants';

/**
 * Global launch state — survives page navigation so the launch keeps running
 * in the background and the "正在启动" view is still shown when the user
 * returns to the launch page. The sidebar stays usable during a launch.
 */
let _launching = false;
let _progress: LaunchProgress | null = null;
let _versionId: string | null = null;
let _iconPath: string | null = null;
let _listeners: Array<() => void> = [];

function notify() {
  _listeners.forEach((l) => l());
}

export const launchStore = {
  get launching() {
    return _launching;
  },
  get progress() {
    return _progress;
  },
  get versionId() {
    return _versionId;
  },
  get iconPath() {
    return _iconPath;
  },

  start(versionId: string, iconPath?: string | null) {
    _launching = true;
    _versionId = versionId;
    _iconPath = iconPath ?? null;
    _progress = null;
    notify();
  },

  setProgress(p: LaunchProgress | null) {
    _progress = p;
    if (p && (p.stage === 'done' || p.stage === 'error')) {
      _launching = false;
    }
    notify();
  },

  cancel() {
    _launching = false;
    _progress = null;
    notify();
  },

  subscribe(listener: () => void) {
    _listeners.push(listener);
    return () => {
      _listeners = _listeners.filter((l) => l !== listener);
    };
  },
};
