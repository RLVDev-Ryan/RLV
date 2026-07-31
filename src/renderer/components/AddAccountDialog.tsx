import { useState } from 'react';

interface AddAccountDialogProps {
  open: boolean;
  onClose: () => void;
  onMicrosoft: () => void;
  onYggdrasil: (serverUrl: string, username: string, password: string) => void;
  onOffline: (username: string) => void;
}

type Step = 'choose' | 'yggdrasil' | 'offline';

export default function AddAccountDialog({
  open,
  onClose,
  onMicrosoft,
  onYggdrasil,
  onOffline,
}: AddAccountDialogProps) {
  const [step, setStep] = useState<Step>('choose');
  const [serverUrl, setServerUrl] = useState('https://littleskin.cn/api/yggdrasil');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [offlineName, setOfflineName] = useState('');
  const [loading, setLoading] = useState(false);

  if (!open) return null;

  const handleBack = () => {
    setStep('choose');
    setPassword('');
    setOfflineName('');
  };

  const handleYggdrasilSubmit = async () => {
    if (!serverUrl.trim() || !username.trim() || !password.trim()) return;
    setLoading(true);
    try {
      await onYggdrasil(serverUrl.trim(), username.trim(), password);
    } finally {
      setLoading(false);
    }
  };

  const handleOfflineSubmit = async () => {
    if (!offlineName.trim()) return;
    setLoading(true);
    try {
      await onOffline(offlineName.trim());
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="dialog-overlay" onClick={onClose}>
      <div className="dialog" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="dialog-header">
          {step !== 'choose' && (
            <button className="dialog-back" onClick={handleBack} aria-label="返回">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <path
                  d="M10 3L5 8l5 5"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </button>
          )}
          <h3 className="dialog-title">
            {step === 'choose' ? '添加新账户' : step === 'offline' ? '离线账户' : '外置登录'}
          </h3>
          <button className="dialog-close" onClick={onClose} aria-label="关闭">
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path d="M2 2l10 10M12 2l-10 10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        {/* Body */}
        {step === 'choose' && (
          <div className="dialog-body">
            <p className="dialog-desc">选择登录方式</p>
            <div className="auth-options">
              <button
                className="auth-option"
                onClick={() => {
                  setLoading(true);
                  onMicrosoft();
                  setLoading(false);
                }}
                disabled={loading}
              >
                <div className="auth-option-icon">
                  <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
                    <rect x="3" y="3" width="10" height="10" rx="2" fill="#00a4ef" />
                    <rect x="15" y="3" width="10" height="10" rx="2" fill="#f25022" />
                    <rect x="3" y="15" width="10" height="10" rx="2" fill="#7fba00" />
                    <rect x="15" y="15" width="10" height="10" rx="2" fill="#ffb900" />
                  </svg>
                </div>
                <div className="auth-option-text">
                  <span className="auth-option-title">正版登录（微软）</span>
                  <span className="auth-option-desc">使用微软账号登录 Minecraft</span>
                </div>
                <svg className="auth-option-arrow" width="16" height="16" viewBox="0 0 16 16" fill="none">
                  <path d="M6 3l5 5-5 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>

              <button className="auth-option" onClick={() => setStep('yggdrasil')}>
                <div className="auth-option-icon auth-option-icon--yellow">
                  <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
                    <circle cx="14" cy="14" r="11" stroke="currentColor" strokeWidth="2" fill="none" />
                    <path d="M14 7v7l5 3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                  </svg>
                </div>
                <div className="auth-option-text">
                  <span className="auth-option-title">外置登录（Little Skin）</span>
                  <span className="auth-option-desc">使用 Yggdrasil 认证服务器登录</span>
                </div>
                <svg className="auth-option-arrow" width="16" height="16" viewBox="0 0 16 16" fill="none">
                  <path d="M6 3l5 5-5 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>

              <button className="auth-option" onClick={() => setStep('offline')}>
                <div className="auth-option-icon auth-option-icon--green">
                  <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
                    <circle cx="14" cy="14" r="10" stroke="currentColor" strokeWidth="2" fill="none" />
                    <path d="M10 14l2 2 4-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </div>
                <div className="auth-option-text">
                  <span className="auth-option-title">离线账户</span>
                  <span className="auth-option-desc">无需登录，输入用户名即可进入</span>
                </div>
                <svg className="auth-option-arrow" width="16" height="16" viewBox="0 0 16 16" fill="none">
                  <path d="M6 3l5 5-5 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>
            </div>
          </div>
        )}

        {step === 'yggdrasil' && (
          <div className="dialog-body">
            <div className="form-group">
              <label className="form-label">认证服务器地址</label>
              <input
                className="form-input"
                type="text"
                value={serverUrl}
                onChange={(e) => setServerUrl(e.target.value)}
                placeholder="https://littleskin.cn/api/yggdrasil"
              />
            </div>
            <div className="form-group">
              <label className="form-label">邮箱 / 用户名</label>
              <input
                className="form-input"
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="请输入邮箱或用户名"
              />
            </div>
            <div className="form-group">
              <label className="form-label">密码</label>
              <input
                className="form-input"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="请输入密码"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleYggdrasilSubmit();
                }}
              />
            </div>
            <div className="dialog-actions">
              <button className="btn btn--ghost" onClick={handleBack}>
                返回
              </button>
              <button
                className="btn btn--primary"
                onClick={handleYggdrasilSubmit}
                disabled={loading || !serverUrl.trim() || !username.trim() || !password.trim()}
              >
                {loading ? '登录中…' : '登录'}
              </button>
            </div>
          </div>
        )}

        {step === 'offline' && (
          <div className="dialog-body">
            <div className="form-group">
              <label className="form-label">用户名</label>
              <input
                className="form-input"
                type="text"
                value={offlineName}
                onChange={(e) => setOfflineName(e.target.value)}
                placeholder="输入游戏内显示的名字"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleOfflineSubmit();
                }}
                maxLength={16}
              />
            </div>
            <div className="dialog-actions">
              <button className="btn btn--ghost" onClick={handleBack}>
                返回
              </button>
              <button
                className="btn btn--primary"
                onClick={handleOfflineSubmit}
                disabled={loading || !offlineName.trim()}
              >
                {loading ? '添加中…' : '添加账户'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
