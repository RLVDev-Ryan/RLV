import { useState, useEffect, useRef } from 'react';
import { useI18n } from '../hooks/useI18n';
import { musicPlayer } from '../stores/musicPlayer';
import { configStore } from '../stores/configStore';

const RATES = [0.5, 0.75, 1, 1.25, 1.5, 2];

function fmt(s: number): string {
  if (!Number.isFinite(s) || s < 0) s = 0;
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${String(sec).padStart(2, '0')}`;
}

/**
 * Global floating music control.
 * - Single click on the ball toggles play/pause.
 * - Double click opens/closes the controller (seek, prev/next, rate, volume).
 */
export default function MusicFloatBall() {
  const { t } = useI18n();
  const [active, setActive] = useState(musicPlayer.active);
  const [playing, setPlaying] = useState(musicPlayer.playing);
  const [track, setTrack] = useState(musicPlayer.track);
  const [open, setOpen] = useState(false);
  const [time, setTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [rate, setRate] = useState(musicPlayer.playbackRate);
  const [volume, setVolume] = useState(configStore.get('music').volume);
  const clickTimer = useRef<number | null>(null);

  useEffect(() => {
    const unsub = musicPlayer.subscribe(() => {
      setActive(musicPlayer.active);
      setPlaying(musicPlayer.playing);
      setTrack(musicPlayer.track);
      setRate(musicPlayer.playbackRate);
    });
    return unsub;
  }, []);

  // While the controller is open: sync volume from config and poll time/duration.
  useEffect(() => {
    if (!open) return;
    setVolume(configStore.get('music').volume);
    setTime(musicPlayer.currentTime);
    setDuration(musicPlayer.duration);
    const id = window.setInterval(() => {
      setTime(musicPlayer.currentTime);
      setDuration(musicPlayer.duration);
    }, 500);
    return () => window.clearInterval(id);
  }, [open]);

  if (!active) return null;

  const handleClick = () => {
    if (clickTimer.current) {
      window.clearTimeout(clickTimer.current);
      clickTimer.current = null;
      return; // this click is part of a double-click
    }
    clickTimer.current = window.setTimeout(() => {
      clickTimer.current = null;
      musicPlayer.toggle();
    }, 220);
  };

  const handleDblClick = () => {
    if (clickTimer.current) {
      window.clearTimeout(clickTimer.current);
      clickTimer.current = null;
    }
    setOpen((o) => !o);
  };

  const changeVolume = (v: number) => {
    setVolume(v);
    configStore.update('music', { ...configStore.get('music'), volume: v });
  };

  return (
    <>
      {open && (
        <div className="music-ball-controller">
          <div className="music-ball-track" title={track ?? ''}>
            {track}
          </div>

          <div className="music-ball-row">
            <span className="music-ball-time">{fmt(time)}</span>
            <input
              type="range"
              className="form-range"
              min={0}
              max={Math.max(1, duration)}
              step={1}
              value={Math.min(time, duration || time)}
              onChange={(e) => musicPlayer.seek(Number(e.target.value))}
              style={{ flex: 1 }}
            />
            <span className="music-ball-time">{fmt(duration)}</span>
          </div>

          <div className="music-ball-controls">
            <button className="music-ball-btn" onClick={() => musicPlayer.prev()} title={t('music.prev')}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                <polygon points="19 20 9 12 19 4 19 20" />
                <rect x="5" y="4" width="2.5" height="16" />
              </svg>
            </button>
            <button
              className="music-ball-btn music-ball-btn--main"
              onClick={() => musicPlayer.toggle()}
              title={t(playing ? 'music.pause' : 'music.play')}
            >
              {playing ? (
                <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                  <rect x="6" y="4" width="4" height="16" />
                  <rect x="14" y="4" width="4" height="16" />
                </svg>
              ) : (
                <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                  <polygon points="6 4 20 12 6 20 6 4" />
                </svg>
              )}
            </button>
            <button className="music-ball-btn" onClick={() => musicPlayer.next()} title={t('music.next')}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                <polygon points="5 4 15 12 5 20 5 4" />
                <rect x="16.5" y="4" width="2.5" height="16" />
              </svg>
            </button>
            <select
              className="form-input form-select music-ball-rate"
              value={rate}
              onChange={(e) => musicPlayer.setPlaybackRate(Number(e.target.value))}
              title={t('music.playback_rate')}
            >
              {RATES.map((r) => (
                <option key={r} value={r}>
                  {r}x
                </option>
              ))}
            </select>
          </div>

          <div className="music-ball-row">
            <span className="music-ball-vol-label">{t('music.volume')}</span>
            <input
              type="range"
              className="form-range"
              min={0}
              max={100}
              value={volume}
              onChange={(e) => changeVolume(Number(e.target.value))}
              style={{ flex: 1 }}
            />
            <span className="music-ball-time">{volume}%</span>
          </div>
        </div>
      )}

      <div
        className={`music-ball${playing ? '' : ' music-ball--paused'}`}
        onClick={handleClick}
        onDoubleClick={handleDblClick}
        title={t('music.ball_tip')}
      >
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
          <path
            d="M9 18V5l12-2v13"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <circle cx="6" cy="18" r="3" stroke="currentColor" strokeWidth="2" />
          <circle cx="18" cy="16" r="3" stroke="currentColor" strokeWidth="2" />
        </svg>
      </div>
    </>
  );
}
