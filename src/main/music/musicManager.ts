import { app, protocol, net } from 'electron';
import path from 'path';
import fs from 'fs';
import { pathToFileURL } from 'url';
import { loadConfig } from '../config/configManager';

/**
 * Background music.
 *
 * The playlist comes from `music.js` → `playlistPath` (a user-chosen folder),
 * or the default `<userData>/music/`. Files are served to the renderer via the
 * `rlv-audio://` protocol and played in sequence by the renderer's Audio engine.
 */

const AUDIO_EXT = ['.mp3', '.wav', '.ogg', '.flac', '.m4a', '.aac', '.opus', '.webm'];

export interface MusicTrack {
  name: string;
  url: string; // rlv-audio://play/?path=<encoded absolute path>
}

export function playlistRoot(): string {
  const cfg = loadConfig('music');
  if (cfg.playlistPath && fs.existsSync(cfg.playlistPath)) return cfg.playlistPath;
  return path.join(app.getPath('userData'), 'music');
}

/** Scan the playlist folder for audio files (sorted by name). */
export function getPlaylist(): MusicTrack[] {
  const root = playlistRoot();
  if (!fs.existsSync(root)) return [];
  let entries: string[];
  try {
    entries = fs.readdirSync(root);
  } catch {
    return [];
  }
  return entries
    .filter((f) => AUDIO_EXT.includes(path.extname(f).toLowerCase()))
    .sort()
    .map((f) => ({
      name: f,
      url: `rlv-audio://play/?path=${encodeURIComponent(path.join(root, f))}`,
    }));
}

/** Playlist info for the UI — the resolved root and the tracks. */
export function getPlaylistInfo(): { tracks: MusicTrack[]; root: string } {
  return { tracks: getPlaylist(), root: playlistRoot() };
}

/** Serve audio files to the renderer. */
export function registerAudioProtocol(): void {
  protocol.handle('rlv-audio', (request) => {
    try {
      const url = new URL(request.url);
      const p = url.searchParams.get('path');
      if (!p || !AUDIO_EXT.includes(path.extname(p).toLowerCase())) {
        return new Response('forbidden', { status: 403 });
      }
      // The path parameter comes from the renderer — only serve files inside
      // the playlist folder (arbitrary absolute paths would let a compromised
      // renderer read any audio file on the system).
      const root = path.resolve(playlistRoot());
      const resolved = path.resolve(p);
      const rel = path.relative(root, resolved);
      if (rel.startsWith('..') || path.isAbsolute(rel)) {
        return new Response('forbidden', { status: 403 });
      }
      if (!fs.existsSync(resolved)) return new Response('not found', { status: 404 });
      return net.fetch(pathToFileURL(resolved).toString());
    } catch {
      return new Response('bad request', { status: 400 });
    }
  });
}
