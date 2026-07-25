/**
 * Module-level multiplayer state — survives React unmount/remount
 * so the room persists when navigating between pages.
 */

export type MultiplayerMode = 'idle' | 'host' | 'guest';

let _connected = false;
let _mode: MultiplayerMode = 'idle';
let _inviteCode: string | null = null;
let _listeners: Array<() => void> = [];

function notify() {
  _listeners.forEach((l) => l());
}

export const multiplayerStore = {
  get connected() {
    return _connected;
  },
  get mode() {
    return _mode;
  },
  get inviteCode() {
    return _inviteCode;
  },

  connect(mode: MultiplayerMode, inviteCode: string | null) {
    _connected = true;
    _mode = mode;
    _inviteCode = inviteCode;
    notify();
  },

  disconnect() {
    _connected = false;
    _mode = 'idle';
    _inviteCode = null;
    notify();
  },

  subscribe(listener: () => void) {
    _listeners.push(listener);
    return () => {
      _listeners = _listeners.filter((l) => l !== listener);
    };
  },
};
