import { APP_NAME } from '../../shared/constants';
import { useI18n } from '../hooks/useI18n';

export default function TitleBar() {
  const { t } = useI18n();
  const api = window.electronAPI;
  return (
    <header className="titlebar">
      <div className="titlebar-drag">
        <span className="titlebar-brand">{APP_NAME}</span>
      </div>
      <div className="titlebar-controls">
        <button
          className="titlebar-btn titlebar-btn--min"
          onClick={() => api?.windowMinimize()}
          aria-label={t('common.minimize')}
        >
          <svg width="12" height="12" viewBox="0 0 12 12">
            <rect x="2" y="5.5" width="8" height="1" fill="currentColor" />
          </svg>
        </button>
        <button
          className="titlebar-btn titlebar-btn--max"
          onClick={() => api?.windowMaximize()}
          aria-label={t('common.maximize')}
        >
          <svg width="12" height="12" viewBox="0 0 12 12">
            <rect x="2" y="2" width="8" height="8" rx="1" fill="none" stroke="currentColor" strokeWidth="1.2" />
          </svg>
        </button>
        <button
          className="titlebar-btn titlebar-btn--close"
          onClick={() => api?.windowClose()}
          aria-label={t('common.close')}
        >
          <svg width="12" height="12" viewBox="0 0 12 12">
            <path d="M2 2l8 8M10 2l-8 8" stroke="currentColor" strokeWidth="1.2" />
          </svg>
        </button>
      </div>
    </header>
  );
}
