import { configStore } from './configStore';

/** Background music player — driven by music.js config, plays the playlist in a loop. */

let audio: HTMLAudioElement | null = null;
let tracks: { name: string; url: string }[] = [];
let index = 0;
let playing = false;
let lastRoot = '';
let resolvedRoot = '';
let listeners: Array<() => void> = [];
/** True while a music session is active (survives pause) — drives the float ball. */
let _active = false;

function notify() {
  listeners.forEach((l) => l());
}

function currentTrack() {
  return tracks.length ? tracks[index % tracks.length] : null;
}

function loadAndPlay() {
  if (!playing || !audio || tracks.length === 0) return;
  const track = currentTrack();
  if (!track) return;
  _active = true;
  if (audio.src !== track.url) {
    audio.src = track.url;
    audio.play().catch(() => {});
  } else if (audio.paused) {
    audio.play().catch(() => {});
  }
  notify();
}

function next() {
  if (tracks.length === 0) return;
  index = (index + 1) % tracks.length;
  loadAndPlay();
}

function prev() {
  if (tracks.length === 0) return;
  // Restart the current track if it's more than 3s in, otherwise go back one.
  if (audio && audio.currentTime > 3) {
    audio.currentTime = 0;
    return;
  }
  index = (index - 1 + tracks.length) % tracks.length;
  loadAndPlay();
}

function ensureAudio() {
  if (audio) return;
  audio = new Audio();
  audio.addEventListener('ended', () => {
    index = (index + 1) % Math.max(1, tracks.length);
    loadAndPlay();
  });
  audio.addEventListener('error', () => next());
}

export const musicPlayer = {
  get playing() {
    return playing;
  },
  get track() {
    return currentTrack()?.name ?? null;
  },
  get trackCount() {
    return tracks.length;
  },
  get currentIndex() {
    return tracks.length ? index + 1 : 0;
  },
  /** The resolved playlist folder (defaults to the app's music dir). */
  get root() {
    return resolvedRoot;
  },

  subscribe(fn: () => void) {
    listeners.push(fn);
    return () => {
      listeners = listeners.filter((l) => l !== fn);
    };
  },

  /** Apply the music config: (re)build playlist if the folder changed, play/stop. */
  async sync(): Promise<void> {
    const cfg = configStore.get('music');
    if (audio) audio.volume = cfg.volume / 100;

    if (!cfg.enabled) {
      this.stop();
      return;
    }
    if (!window.electronAPI) return;

    // Re-fetch the playlist only when the folder changed.
    const root = cfg.playlistPath || 'default';
    if (root !== lastRoot) {
      const res = await window.electronAPI.music.getPlaylist();
      tracks = res?.tracks ?? [];
      resolvedRoot = res?.root ?? '';
      index = 0;
      lastRoot = root;
    }
    if (tracks.length === 0) {
      this.stop();
      return;
    }

    ensureAudio();
    playing = true;
    loadAndPlay();
  },

  stop() {
    playing = false;
    _active = false;
    if (audio) {
      audio.pause();
      audio.src = '';
    }
    notify();
  },

  next() {
    next();
  },
  prev() {
    prev();
  },

  /** Play/pause toggle (resumes the current track). */
  toggle() {
    if (playing) {
      playing = false;
      audio?.pause();
      notify();
    } else {
      playing = true;
      ensureAudio();
      loadAndPlay();
    }
  },

  /** Seek to a time in seconds (clamped). */
  seek(t: number) {
    if (audio && Number.isFinite(t)) {
      const d = audio.duration || t;
      audio.currentTime = Math.max(0, Math.min(t, d));
    }
  },

  setPlaybackRate(r: number) {
    if (audio && Number.isFinite(r) && r > 0) audio.playbackRate = r;
  },

  get active() {
    return _active;
  },
  get currentTime() {
    return audio?.currentTime ?? 0;
  },
  get duration() {
    return audio?.duration || 0;
  },
  get playbackRate() {
    return audio?.playbackRate ?? 1;
  },
};
