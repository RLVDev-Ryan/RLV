import { useState, useEffect, useCallback } from 'react';
import { multiplayerStore } from '../stores/multiplayerStore';

const STORAGE_KEY = 'rlv_terracotta_disclaimer';

export default function MultiplayerPage() {
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
        setMessage(`检测到端口 ${port || '默认'} 的房间，邀请码已复制到剪贴板`);
      } else {
        setMessage('创建房间失败');
      }
    } catch {
      setMessage('调用失败');
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
        setMessage('已连接房间。请启动 Minecraft，然后在多人游戏中搜索局域网房间');
      } else {
        setMessage('加入房间失败，请检查邀请码');
      }
    } catch {
      setMessage('连接失败');
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
        setMessage('未发现局域网房间。请先启动游戏，然后在游戏内开放局域网联机');
      } else {
        setMessage(`发现 ${games.length} 个房间`);
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
              <p className="terracotta-dialog-text">陶瓦联机是第三方开源自由软件…</p>
              <p className="terracotta-dialog-text">陶瓦联机使用P2P技术…</p>
              <p className="terracotta-dialog-text">
                在多人联机全过程中，您必须严格遵守您所在国家与地区的全部法律法规。
              </p>
              <label className="terracotta-dialog-checkbox">
                <input type="checkbox" checked={dontShowAgain} onChange={() => setDontShowAgain(!dontShowAgain)} />
                <span className="terracotta-dialog-checkbox-text">下次打开不再弹出</span>
              </label>
            </div>
            <button className="terracotta-dialog-confirm" onClick={handleDisclaimerConfirm}>
              确定
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
                <h2 className="multiplayer-title">局域网联机</h2>
                <span className="multiplayer-subtitle">基于 P2P 虚拟局域网</span>
              </div>
            </div>
            <div className="multiplayer-status">
              <span className={`multiplayer-status-dot ${connected ? 'multiplayer-status-dot--active' : ''}`} />
              <span className="multiplayer-status-text">{connected ? '已连接' : '未连接'}</span>
            </div>
          </div>

          <div className="multiplayer-bar">
            <span className="multiplayer-bar-text">
              {connected ? (mode === 'host' ? '联机房间已创建' : '已加入房间') : '未连接至任何房间'}
            </span>
            {connected && (
              <button className="multiplayer-bar-action" onClick={handleDisconnect}>
                关闭房间
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
                    borderBottom: 'none',
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
                  <span className="multiplayer-action-btn-label">创建房间</span>
                  <span className="multiplayer-action-btn-desc">创建联机房间并生成邀请码</span>
                </div>
                <div className="multiplayer-create-port">
                  <div className="multiplayer-create-port-row">
                    <span className="multiplayer-create-port-label">游戏端口号</span>
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
                    {loading ? '扫描中…' : '创建房间'}
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
                <span className="multiplayer-action-btn-label">加入房间</span>
                <span className="multiplayer-action-btn-desc">输入邀请码加入已有房间</span>
              </button>
            </div>
          )}

          {mode === 'host' && connected && (
            <div className="multiplayer-room">
              <div className="multiplayer-room-label">邀请码</div>
              <div className="multiplayer-room-code">
                <span className="multiplayer-room-code-text">{inviteCode?.split('-')[0] ?? ''}</span>
                <button
                  className="multiplayer-room-code-copy"
                  onClick={() => {
                    if (inviteCode) {
                      window.electronAPI?.copyToClipboard(inviteCode);
                      setCopied(true);
                      setMessage('邀请码已复制到剪贴板');
                    }
                  }}
                >
                  {copied ? '已复制' : '复制'}
                </button>
              </div>
              <p className="multiplayer-room-hint">将此邀请码发送给其他玩家，对方粘贴即可加入</p>
            </div>
          )}

          {mode === 'guest' && !connected && (
            <div className="multiplayer-join">
              <div className="form-group">
                <label className="form-label">邀请码</label>
                <input
                  className="form-input"
                  type="text"
                  value={joinCode}
                  onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                  placeholder="粘贴邀请码"
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
                  返回
                </button>
                <button
                  className="btn btn--primary"
                  onClick={handleJoinRoom}
                  disabled={loading || joinCode.trim().length < 10}
                >
                  {loading ? '连接中…' : '加入房间'}
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
