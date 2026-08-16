import { useState, useEffect, useCallback } from 'react';
import { useI18n, type I18nKey } from '../hooks/useI18n';
import { multiplayerStore } from '../stores/multiplayerStore';
import { configStore } from '../stores/configStore';
import type { RoomPlayer, ConnectionDifficulty } from '../../shared/constants';

const STORAGE_KEY = 'rlv_terracotta_disclaimer';

const DIFFICULTY_KEYS: Record<ConnectionDifficulty, I18nKey> = {
  UNKNOWN: 'multiplayer.difficulty_unknown',
  EASIEST: 'multiplayer.difficulty_easiest',
  SIMPLE: 'multiplayer.difficulty_simple',
  MEDIUM: 'multiplayer.difficulty_medium',
  TOUGH: 'multiplayer.difficulty_tough',
};

export default function MultiplayerPage() {
  const { t } = useI18n();
  const [showDialog, setShowDialog] = useState(false);
  const [dontShowAgain, setDontShowAgain] = useState(false);
  const [disclaimerAccepted, setDisclaimerAccepted] = useState(false);

  const [connected, setConnected] = useState(multiplayerStore.connected);
  const [mode, setMode] = useState(multiplayerStore.mode);
  const [inviteCode, setInviteCode] = useState(multiplayerStore.inviteCode);
  const [backend, setBackend] = useState<'custom' | 'terracotta'>(() =>
    (configStore.get('launcher') as { multiplayerBackend?: 'custom' | 'terracotta' }).multiplayerBackend ===
    'terracotta'
      ? 'terracotta'
      : 'custom',
  );
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [joinCode, setJoinCode] = useState('');
  const [createPort, setCreatePort] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [players, setPlayers] = useState<RoomPlayer[]>([]);
  const [connectAddr, setConnectAddr] = useState<string | null>(null);
  const [difficulty, setDifficulty] = useState<ConnectionDifficulty>('UNKNOWN');

  useEffect(() => {
    const unsub = multiplayerStore.subscribe(() => {
      setConnected(multiplayerStore.connected);
      setMode(multiplayerStore.mode);
      setInviteCode(multiplayerStore.inviteCode);
    });
    return unsub;
  }, []);

  useEffect(() => {
    const dismissed = localStorage.getItem(STORAGE_KEY);
    if (dismissed === 'true') {
      setDisclaimerAccepted(true);
    } else {
      setShowDialog(true);
    }
  }, []);

  // Poll the room player list while connected; if the room has gone away
  // (easytier died), reset the local UI state to disconnected.
  useEffect(() => {
    if (!connected || !window.electronAPI) return;
    let failures = 0;
    const poll = async () => {
      try {
        const res = await window.electronAPI!.terracotta.players();
        failures = 0;
        if (res && !res.connected) {
          multiplayerStore.disconnect();
          setPlayers([]);
          setConnectAddr(null);
          setDifficulty('UNKNOWN');
          setMessage(t('multiplayer.room_lost'));
          return;
        }
        if (res?.players) setPlayers(res.players);
      } catch {
        // Consecutive IPC failures mean the room state is unknowable — stop
        // pretending it's still connected instead of showing a stale list.
        if (++failures >= 3) {
          multiplayerStore.disconnect();
          setPlayers([]);
          setMessage(t('multiplayer.room_lost'));
        }
      }
    };
    poll();
    const timer = setInterval(poll, 3000);
    return () => clearInterval(timer);
  }, [connected, t]);

  // Surface Windows permission errors (e.g. the easytier network adapter
  // needs admin rights) reported by the main process.
  useEffect(() => {
    if (!window.electronAPI?.terracotta.onPermissionError) return;
    return window.electronAPI.terracotta.onPermissionError(() => {
      setMessage(t('multiplayer.permission_error'));
    });
  }, [t]);

  const handleDisclaimerConfirm = () => {
    if (dontShowAgain) localStorage.setItem(STORAGE_KEY, 'true');
    setShowDialog(false);
    setDisclaimerAccepted(true);
  };

  const switchBackend = (b: 'custom' | 'terracotta') => {
    setBackend(b);
    configStore.update('launcher', { ...configStore.get('launcher'), multiplayerBackend: b });
  };

  const handleCreateRoom = useCallback(async () => {
    if (!window.electronAPI) return;
    setLoading(true);
    setMessage(null);
    setCopied(false);
    try {
      // Terracotta backend auto-scans the open LAN game (port ignored);
      // the custom backend uses the user-entered port (default 25565).
      const parsed = parseInt(createPort.trim(), 10);
      const port =
        backend === 'terracotta' ? 0 : Number.isInteger(parsed) && parsed > 0 && parsed < 65536 ? parsed : 25565;
      const result = await window.electronAPI.terracotta.start(port);
      if (result.success && result.inviteCode) {
        multiplayerStore.connect('host', result.inviteCode);
        setConnectAddr(null);
        setDifficulty('UNKNOWN');
        setPlayers([]);
        window.electronAPI.copyToClipboard(result.inviteCode);
        setCopied(true);
        setMessage(t('multiplayer.room_created'));
      } else {
        setMessage(result.error || t('multiplayer.connect_fail'));
      }
    } catch {
      setMessage(t('multiplayer.call_fail'));
    }
    setLoading(false);
  }, [createPort, backend, t]);

  const handleJoinRoom = useCallback(async () => {
    if (!window.electronAPI || !joinCode.trim()) return;
    setLoading(true);
    setMessage(null);
    try {
      const result = await window.electronAPI.terracotta.join(joinCode.trim());
      if (result.success) {
        multiplayerStore.connect('guest', joinCode.trim());
        setConnectAddr(result.connectAddr ?? null);
        setDifficulty(result.difficulty ?? 'UNKNOWN');
        setPlayers([]);
        setMessage(t('multiplayer.connected_success'));
      } else {
        setMessage(result.error || t('multiplayer.join_fail'));
      }
    } catch {
      setMessage(t('multiplayer.join_fail'));
    }
    setLoading(false);
  }, [joinCode, t]);

  const handleDisconnect = useCallback(async () => {
    if (window.electronAPI) {
      await window.electronAPI.terracotta.stop();
    }
    multiplayerStore.disconnect();
    setCopied(false);
    setJoinCode('');
    setMessage(null);
    setPlayers([]);
    setConnectAddr(null);
    setDifficulty('UNKNOWN');
  }, []);

  const renderPlayerList = () => (
    <div className="multiplayer-players">
      <div className="multiplayer-players-label">{t('multiplayer.players')}</div>
      {players.length === 0 ? (
        <div className="multiplayer-players-empty">{t('multiplayer.no_players')}</div>
      ) : (
        <div className="version-grid">
          {players.map((p, i) => (
            <div key={p.machineId || i} className="version-card" style={{ cursor: 'default' }}>
              <div className="version-card-left">
                <div className="version-card-icon">
                  <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
                    <circle cx="11" cy="8" r="3.5" stroke="currentColor" strokeWidth="1.5" fill="none" />
                    <path
                      d="M5 18c.6-3 3.1-4.5 6-4.5s5.4 1.5 6 4.5"
                      stroke="currentColor"
                      strokeWidth="1.5"
                      fill="none"
                    />
                  </svg>
                </div>
                <div className="version-card-info">
                  <span className="version-card-name">{p.name}</span>
                  <span className="version-card-date">
                    {p.kind === 'HOST' ? t('multiplayer.kind_host') : t('multiplayer.kind_guest')}
                    {p.vendor ? ` · ${p.vendor}` : ''}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );

  return (
    <div className="page launch-page">
      {showDialog && (
        <div className="dialog-overlay">
          <div className="terracotta-dialog" onClick={(e) => e.stopPropagation()}>
            <div className="terracotta-dialog-body">
              <div className="terracotta-dialog-icon">
                <svg width="40" height="40" viewBox="0 0 40 40" fill="none">
                  <rect x="4" y="4" width="32" height="32" rx="8" fill="var(--accent-bg)" />
                  <path d="M20 12v8l5 3" stroke="var(--accent)" strokeWidth="2" strokeLinecap="round" />
                  <circle cx="20" cy="20" r="10" stroke="var(--accent)" strokeWidth="2" />
                </svg>
              </div>
              <p className="terracotta-dialog-text">{t('multiplayer.disclaimer.text1')}</p>
              <p className="terracotta-dialog-text">{t('multiplayer.disclaimer.text2')}</p>
              <p className="terracotta-dialog-text">{t('multiplayer.disclaimer.text3')}</p>
              <label className="terracotta-dialog-checkbox">
                <input type="checkbox" checked={dontShowAgain} onChange={() => setDontShowAgain(!dontShowAgain)} />
                <span className="terracotta-dialog-checkbox-text">{t('multiplayer.disclaimer.checkbox')}</span>
              </label>
            </div>
            <button className="terracotta-dialog-confirm" onClick={handleDisclaimerConfirm}>
              {t('common.confirm')}
            </button>
          </div>
        </div>
      )}

      {disclaimerAccepted && (
        <div className="multiplayer-page">
          <div className="multiplayer-header">
            <div className="multiplayer-header-left">
              <div className="multiplayer-header-icon">
                <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
                  <rect x="2" y="2" width="24" height="24" rx="6" fill="var(--accent-bg)" />
                  <path d="M14 8v6l4 2.5" stroke="var(--accent)" strokeWidth="2" strokeLinecap="round" />
                  <circle cx="14" cy="14" r="7" stroke="var(--accent)" strokeWidth="2" />
                </svg>
              </div>
              <div>
                <h2 className="multiplayer-title">{t('multiplayer.title')}</h2>
                <span className="multiplayer-subtitle">{t('multiplayer.subtitle')}</span>
              </div>
            </div>
            <div className="multiplayer-status">
              <span className={`multiplayer-status-dot ${connected ? 'multiplayer-status-dot--active' : ''}`} />
              <span className="multiplayer-status-text">
                {connected ? t('multiplayer.connected') : t('multiplayer.disconnected')}
              </span>
            </div>
          </div>

          <div className="multiplayer-bar">
            <span className="multiplayer-bar-text">
              {connected
                ? mode === 'host'
                  ? t('multiplayer.room_created')
                  : t('multiplayer.room_joined')
                : t('multiplayer.not_connected')}
            </span>
            {connected && (
              <button className="multiplayer-bar-action" onClick={handleDisconnect}>
                {t('multiplayer.close_room')}
              </button>
            )}
          </div>

          <div className="multiplayer-backend-switch">
            <span className="multiplayer-backend-label">{t('multiplayer.backend_label')}</span>
            <button
              className={`multiplayer-backend-btn${backend === 'custom' ? ' multiplayer-backend-btn--active' : ''}`}
              onClick={() => switchBackend('custom')}
            >
              {t('multiplayer.backend_custom')}
            </button>
            <button
              className={`multiplayer-backend-btn${backend === 'terracotta' ? ' multiplayer-backend-btn--active' : ''}`}
              onClick={() => switchBackend('terracotta')}
            >
              {t('multiplayer.backend_terracotta')}
            </button>
          </div>

          <p className="multiplayer-declaration">{t('multiplayer.declaration')}</p>

          {mode === 'idle' && !connected && (
            <div className="multiplayer-actions">
              <div className="multiplayer-action-card">
                <div
                  className="multiplayer-action-btn multiplayer-action-btn--host"
                  style={{
                    cursor: 'default',
                    borderBottomLeftRadius: 0,
                    borderBottomRightRadius: 0,
                  }}
                >
                  <span className="multiplayer-action-btn-icon">
                    <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
                      <rect
                        x="6"
                        y="6"
                        width="20"
                        height="20"
                        rx="4"
                        stroke="currentColor"
                        strokeWidth="1.8"
                        fill="none"
                      />
                      <path d="M16 11v10M11 16h10" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                    </svg>
                  </span>
                  <span className="multiplayer-action-btn-label">{t('multiplayer.create_room')}</span>
                  <span className="multiplayer-action-btn-desc">{t('multiplayer.create_desc')}</span>
                </div>
                <div className="multiplayer-create-port">
                  {backend === 'custom' ? (
                    <div className="multiplayer-create-port-row">
                      <span className="multiplayer-create-port-label">{t('multiplayer.port_label')}</span>
                      <input
                        className="form-input"
                        type="number"
                        min={1}
                        max={65535}
                        placeholder="25565"
                        value={createPort}
                        onChange={(e) => setCreatePort(e.target.value)}
                        style={{ flex: 1 }}
                      />
                    </div>
                  ) : (
                    <p className="multiplayer-create-hint">{t('multiplayer.create_hint_terracotta')}</p>
                  )}
                  <button
                    className="btn btn--primary multiplayer-create-btn"
                    onClick={handleCreateRoom}
                    disabled={loading}
                  >
                    {loading ? t('multiplayer.creating') : t('multiplayer.create_room')}
                  </button>
                </div>
              </div>
              <button className="multiplayer-action-btn multiplayer-action-btn--join" onClick={() => setMode('guest')}>
                <span className="multiplayer-action-btn-icon">
                  <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
                    <path d="M16 6v8l5 3" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                    <circle cx="16" cy="16" r="10" stroke="currentColor" strokeWidth="1.8" fill="none" />
                  </svg>
                </span>
                <span className="multiplayer-action-btn-label">{t('multiplayer.join_room')}</span>
                <span className="multiplayer-action-btn-desc">{t('multiplayer.join_desc')}</span>
              </button>
            </div>
          )}

          {mode === 'host' && connected && (
            <div className="multiplayer-room">
              <div className="multiplayer-room-label">{t('multiplayer.invite_code')}</div>
              <div className="multiplayer-room-code">
                <span className="multiplayer-room-code-text">{inviteCode ?? ''}</span>
                <button
                  className="multiplayer-room-code-copy"
                  onClick={() => {
                    if (inviteCode) {
                      window.electronAPI?.copyToClipboard(inviteCode);
                      setCopied(true);
                      setMessage(t('multiplayer.copied'));
                    }
                  }}
                >
                  {copied ? t('multiplayer.copied') : t('multiplayer.copy')}
                </button>
              </div>
              <p className="multiplayer-room-hint">{t('multiplayer.host_hint')}</p>
              {renderPlayerList()}
            </div>
          )}

          {mode === 'guest' && connected && (
            <div className="multiplayer-room">
              <div className="multiplayer-room-label">{t('multiplayer.server_addr')}</div>
              <div className="multiplayer-room-code">
                <span className="multiplayer-room-code-text">{connectAddr ?? ''}</span>
                <button
                  className="multiplayer-room-code-copy"
                  onClick={() => {
                    if (connectAddr) {
                      window.electronAPI?.copyToClipboard(connectAddr);
                      setCopied(true);
                      setMessage(t('multiplayer.copied_addr', { addr: connectAddr }));
                    }
                  }}
                >
                  {copied ? t('multiplayer.copied') : t('multiplayer.copy')}
                </button>
              </div>
              <p className="multiplayer-room-hint">{t('multiplayer.guest_hint')}</p>
              <div className="multiplayer-difficulty">
                {t('multiplayer.difficulty')}: {t(DIFFICULTY_KEYS[difficulty])}
              </div>
              {renderPlayerList()}
            </div>
          )}

          {mode === 'guest' && !connected && (
            <div className="multiplayer-join">
              <div className="form-group">
                <label className="form-label">{t('multiplayer.invite_code')}</label>
                <input
                  className="form-input"
                  type="text"
                  value={joinCode}
                  onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                  placeholder={t('multiplayer.join_hint')}
                  maxLength={64}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleJoinRoom();
                  }}
                />
              </div>
              <div className="multiplayer-join-actions">
                <button
                  className="btn"
                  onClick={() => setMode('idle')}
                  style={{ background: '#9BB8AC', color: '#fff' }}
                >
                  {t('multiplayer.back')}
                </button>
                <button
                  className="btn btn--primary"
                  onClick={handleJoinRoom}
                  disabled={loading || joinCode.trim().length < 20}
                >
                  {loading ? t('multiplayer.connecting') : t('multiplayer.join')}
                </button>
              </div>
            </div>
          )}

          {message && (
            <div className="multiplayer-message" style={{ marginTop: connected ? 12 : 24 }}>
              {message}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
