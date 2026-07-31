import { useState, useEffect, useCallback } from 'react';
import { useI18n } from '../hooks/useI18n';
import { multiplayerStore } from '../stores/multiplayerStore';

const STORAGE_KEY = 'rlv_terracotta_disclaimer';

export default function MultiplayerPage() {
  const { t } = useI18n();
  const [showDialog, setShowDialog] = useState(false);
  const [dontShowAgain, setDontShowAgain] = useState(false);
  const [disclaimerAccepted, setDisclaimerAccepted] = useState(false);

  const [connected, setConnected] = useState(multiplayerStore.connected);
  const [mode, setMode] = useState(multiplayerStore.mode);
  const [inviteCode, setInviteCode] = useState(multiplayerStore.inviteCode);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [joinCode, setJoinCode] = useState('');
  const [createPort, setCreatePort] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [lanGames, setLanGames] = useState<any[]>([]);
  const [scanning, setScanning] = useState(false);

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
    if (multiplayerStore.connected) return;
    if (window.electronAPI) {
      window.electronAPI.terracotta.getRoom().then((room) => {
        if (room?.inviteCode) {
          multiplayerStore.connect('host', room.inviteCode);
        }
      });
    }
  }, []);

  const handleDisclaimerConfirm = () => {
    if (dontShowAgain) localStorage.setItem(STORAGE_KEY, 'true');
    setShowDialog(false);
    setDisclaimerAccepted(true);
  };

  const handleCreateRoom = useCallback(async () => {
    if (!window.electronAPI) return;
    setLoading(true);
    setMessage(null);
    setCopied(false);
    try {
      const port = createPort.trim() ? parseInt(createPort.trim(), 10) : undefined;
      const result = await window.electronAPI.terracotta.start(port);
      if (result.noGames) {
        setMessage('未检测到该端口的房间。请检查端口号是否正确，端口号可在游戏聊天栏中看到');
      } else if (result.success && result.inviteCode) {
        multiplayerStore.connect('host', result.inviteCode);
        window.electronAPI.copyToClipboard(result.inviteCode);
        setCopied(true);
        setMessage(t('multiplayer.room_detected', { port: port || '默认' }));
      } else {
        setMessage(t('multiplayer.connect_fail'));
      }
    } catch {
      setMessage(t('multiplayer.call_fail'));
    }
    setLoading(false);
  }, [createPort]);

  const handleJoinRoom = useCallback(async () => {
    if (!window.electronAPI || !joinCode.trim()) return;
    setLoading(true);
    setMessage(null);
    try {
      const result = await window.electronAPI.terracotta.join(joinCode.trim());
      if (result.success) {
        multiplayerStore.connect('guest', joinCode.trim());
        setMessage(t('multiplayer.connected_success'));
      } else {
        setMessage(t('multiplayer.join_fail'));
      }
    } catch {
      setMessage(t('multiplayer.join_fail'));
    }
    setLoading(false);
  }, [joinCode]);

  const handleDisconnect = useCallback(async () => {
    if (window.electronAPI) {
      await window.electronAPI.terracotta.stop();
    }
    multiplayerStore.disconnect();
    setCopied(false);
    setJoinCode('');
    setMessage(null);
    setLanGames([]);
  }, []);

  const handleScan = useCallback(async () => {
    if (!window.electronAPI) return;
    setScanning(true);
    try {
      const result = await window.electronAPI.terracotta.scan();
      const games = result.games || [];
      setLanGames(games);
      if (games.length === 0) {
        setMessage(t('multiplayer.no_games_found'));
      } else {
        setMessage(t('multiplayer.games_found', { count: games.length }));
      }
    } catch {}
    setScanning(false);
  }, []);

  return (
    <div className="page launch-page">
      {showDialog && (
        <div className="dialog-overlay" onClick={() => {}}>
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
              <span className="multiplayer-status-text">{connected ? t('multiplayer.connected') : t('multiplayer.disconnected')}</span>
            </div>
          </div>

          <div className="multiplayer-bar">
            <span className="multiplayer-bar-text">
              {connected ? (mode === 'host' ? t('multiplayer.room_created') : t('multiplayer.room_joined')) : t('multiplayer.not_connected')}
            </span>
            {connected && (
              <button className="multiplayer-bar-action" onClick={handleDisconnect}>
                {t('multiplayer.close_room')}
              </button>
            )}
          </div>

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
                  <button
                    className="btn btn--primary multiplayer-create-btn"
                    onClick={handleCreateRoom}
                    disabled={loading}
                  >
                    {loading ? t('multiplayer.scanning') : t('multiplayer.create_room')}
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
                <span className="multiplayer-room-code-text">{inviteCode?.split('-')[0] ?? ''}</span>
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
              <p className="multiplayer-room-hint">{t('multiplayer.invite_hint')}</p>
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
                  maxLength={24}
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
                  disabled={loading || joinCode.trim().length < 10}
                >
                  {loading ? t('multiplayer.connecting') : t('multiplayer.join')}
                </button>
              </div>
            </div>
          )}

          {connected && lanGames.length > 0 && (
            <div style={{ marginTop: 16 }}>
              <div className="version-grid">
                {lanGames.map((g, i) => (
                  <button
                    key={i}
                    className="version-card"
                    onClick={() => {
                      window.electronAPI?.copyToClipboard(`${g.host}:${g.port}`);
                      setMessage(`已复制 ${g.host}:${g.port}，在游戏内添加服务器加入`);
                    }}
                  >
                    <div className="version-card-left">
                      <div className="version-card-icon">
                        <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
                          <rect
                            x="3"
                            y="3"
                            width="16"
                            height="16"
                            rx="4"
                            stroke="currentColor"
                            strokeWidth="1.5"
                            fill="none"
                          />
                          <path d="M8 11l2 2 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                        </svg>
                      </div>
                      <div className="version-card-info">
                        <span className="version-card-name">{g.worldName || '未知世界'}</span>
                        <span className="version-card-date">
                          {g.host}:{g.port}
                        </span>
                      </div>
                    </div>
                    <span className="version-card-tag version-card-tag--release">加入</span>
                  </button>
                ))}
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
