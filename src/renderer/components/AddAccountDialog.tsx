import { useState, useEffect } from 'react';
import { useI18n } from '../hooks/useI18n';

interface AddAccountDialogProps {
  open: boolean;
  onClose: () => void;
  onMicrosoft: () => Promise<void>;
  onYggdrasil: (serverUrl: string, username: string, password: string) => Promise<void>;
  onOffline: (username: string) => Promise<void>;
}

type Step = 'choose' | 'yggdrasil' | 'offline';

export default function AddAccountDialog({
  open,
  onClose,
  onMicrosoft,
  onYggdrasil,
  onOffline,
}: AddAccountDialogProps) {
  const { t } = useI18n();
  const [step, setStep] = useState<Step>('choose');
  const [serverUrl, setServerUrl] = useState('https://littleskin.cn/api/yggdrasil');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [offlineName, setOfflineName] = useState('');
  const [loading, setLoading] = useState(false);
  const [deviceCode, setDeviceCode] = useState<string | null>(null);

  // Show the Microsoft device-code inside the dialog while the user is
  // authenticating in the opened browser window.
  useEffect(() => {
    if (!window.electronAPI?.accounts.onDeviceCode) return;
    return window.electronAPI.accounts.onDeviceCode((code) => setDeviceCode(code));
  }, []);

  // Clear the code when the dialog closes.
  useEffect(() => {
    if (!open) setDeviceCode(null);
  }, [open]);

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

  const handleMicrosoft = async () => {
    setLoading(true);
    try {
      await onMicrosoft();
    } finally {
      setLoading(false);
    }
  };

  const dialogTitle =
    step === 'choose' ? t('account.add') : step === 'offline' ? t('account.offline') : t('account.yggdrasil');

  return (
    <div className="dialog-overlay" onClick={onClose}>
      <div className="dialog" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="dialog-header">
          {step !== 'choose' && (
            <button className="dialog-back" onClick={handleBack} aria-label={t('account.back')}>
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
          <h3 className="dialog-title">{dialogTitle}</h3>
          <button className="dialog-close" onClick={onClose} aria-label={t('common.close')}>
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path d="M2 2l10 10M12 2l-10 10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        {/* Microsoft device-code prompt */}
        {deviceCode && (
          <div
            style={{
              margin: '0 24px 16px',
              padding: 12,
              border: '1px solid var(--accent)',
              borderRadius: 8,
              background: 'var(--accent-bg)',
              textAlign: 'center',
            }}
          >
            <p style={{ margin: '0 0 6px', fontSize: 13, color: 'var(--text-secondary)' }}>
              {t('account.device_code_hint')}
            </p>
            <div
              style={{
                fontSize: 28,
                fontWeight: 700,
                letterSpacing: 4,
                color: 'var(--accent)',
                fontFamily: 'monospace',
                userSelect: 'all',
              }}
            >
              {deviceCode}
            </div>
            <button
              className="btn btn--small btn--outline"
              style={{ marginTop: 8 }}
              onClick={() => navigator.clipboard.writeText(deviceCode)}
            >
              {t('account.copy_code')}
            </button>
          </div>
        )}

        {/* Body */}
        {step === 'choose' && (
          <div className="dialog-body">
            <p className="dialog-desc">{t('account.choose_method')}</p>
            <div className="auth-options">
              <button className="auth-option" onClick={handleMicrosoft} disabled={loading}>
                <div className="auth-option-icon">
                  <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
                    <rect x="3" y="3" width="10" height="10" rx="2" fill="#00a4ef" />
                    <rect x="15" y="3" width="10" height="10" rx="2" fill="#f25022" />
                    <rect x="3" y="15" width="10" height="10" rx="2" fill="#7fba00" />
                    <rect x="15" y="15" width="10" height="10" rx="2" fill="#ffb900" />
                  </svg>
                </div>
                <div className="auth-option-text">
                  <span className="auth-option-title">{t('account.login_microsoft')}</span>
                  <span className="auth-option-desc">{t('account.login_microsoft_desc')}</span>
                </div>
                <svg className="auth-option-arrow" width="16" height="16" viewBox="0 0 16 16" fill="none">
                  <path
                    d="M6 3l5 5-5 5"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
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
                  <span className="auth-option-title">{t('account.login_yggdrasil')}</span>
                  <span className="auth-option-desc">{t('account.login_yggdrasil_desc')}</span>
                </div>
                <svg className="auth-option-arrow" width="16" height="16" viewBox="0 0 16 16" fill="none">
                  <path
                    d="M6 3l5 5-5 5"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </button>

              <button className="auth-option" onClick={() => setStep('offline')}>
                <div className="auth-option-icon auth-option-icon--green">
                  <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
                    <circle cx="14" cy="14" r="10" stroke="currentColor" strokeWidth="2" fill="none" />
                    <path
                      d="M10 14l2 2 4-5"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </div>
                <div className="auth-option-text">
                  <span className="auth-option-title">{t('account.offline')}</span>
                  <span className="auth-option-desc">{t('account.login_offline_desc')}</span>
                </div>
                <svg className="auth-option-arrow" width="16" height="16" viewBox="0 0 16 16" fill="none">
                  <path
                    d="M6 3l5 5-5 5"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </button>
            </div>
          </div>
        )}

        {step === 'yggdrasil' && (
          <div className="dialog-body">
            <div className="form-group">
              <label className="form-label">{t('account.server_url')}</label>
              <input
                className="form-input"
                type="text"
                value={serverUrl}
                onChange={(e) => setServerUrl(e.target.value)}
                placeholder="https://littleskin.cn/api/yggdrasil"
              />
            </div>
            <div className="form-group">
              <label className="form-label">{t('account.email')}</label>
              <input
                className="form-input"
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder={t('account.email_placeholder')}
              />
            </div>
            <div className="form-group">
              <label className="form-label">{t('account.password')}</label>
              <input
                className="form-input"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={t('account.password_placeholder')}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleYggdrasilSubmit();
                }}
              />
            </div>
            <div className="dialog-actions">
              <button className="btn btn--ghost" onClick={handleBack}>
                {t('account.back')}
              </button>
              <button
                className="btn btn--primary"
                onClick={handleYggdrasilSubmit}
                disabled={loading || !serverUrl.trim() || !username.trim() || !password.trim()}
              >
                {loading ? t('account.logging_in') : t('account.login')}
              </button>
            </div>
          </div>
        )}

        {step === 'offline' && (
          <div className="dialog-body">
            <div className="form-group">
              <label className="form-label">{t('account.username')}</label>
              <input
                className="form-input"
                type="text"
                value={offlineName}
                onChange={(e) => setOfflineName(e.target.value)}
                placeholder={t('account.offline_placeholder')}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleOfflineSubmit();
                }}
                maxLength={16}
              />
            </div>
            <div className="dialog-actions">
              <button className="btn btn--ghost" onClick={handleBack}>
                {t('account.back')}
              </button>
              <button
                className="btn btn--primary"
                onClick={handleOfflineSubmit}
                disabled={loading || !offlineName.trim()}
              >
                {loading ? t('account.adding') : t('account.add_account')}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
