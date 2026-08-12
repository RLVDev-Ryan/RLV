import { useState, useEffect } from 'react';
import TitleBar from './components/TitleBar';
import Sidebar from './components/Sidebar';
import LaunchPage from './pages/LaunchPage';
import DownloadPage from './pages/DownloadPage';
import MultiplayerPage from './pages/MultiplayerPage';
import SettingsPage from './pages/SettingsPage';
import LogsPage from './pages/LogsPage';
import type { NavKey, UpdateStatus } from '../shared/constants';
import { useI18n } from './hooks/useI18n';
import { launchStore } from './stores/launchStore';
import { configStore } from './stores/configStore';
import { hydrateFromConfig } from './stores/themeStore';
import { musicPlayer } from './stores/musicPlayer';
import { applyScale } from './uiScale';

const pageMap: Record<NavKey, React.FC> = {
  launch: LaunchPage,
  download: DownloadPage,
  multiplayer: MultiplayerPage,
  logs: LogsPage,
  settings: SettingsPage,
};

export default function App() {
  const [activeNav, setActiveNav] = useState<NavKey>('launch');
  const [update, setUpdate] = useState<UpdateStatus | null>(null);

  // Load the .js config files (portable/installed), apply the theme, start music.
  useEffect(() => {
    configStore.loadAll().then(() => {
      hydrateFromConfig();
      musicPlayer.sync();
    });
  }, []);

  // Proportional content scaling for wide / maximized windows.
  useEffect(() => {
    applyScale();
    window.addEventListener('resize', applyScale);
    return () => window.removeEventListener('resize', applyScale);
  }, []);

  // Re-sync the music player when the music config changes.
  useEffect(() => {
    const unsub = configStore.subscribe(() => {
      musicPlayer.sync();
    });
    return unsub;
  }, []);

  useEffect(() => {
    if (!window.electronAPI) return;
    const cleanup = window.electronAPI.updater.onStatus((s: UpdateStatus) => {
      setUpdate(s);
      if (s.status === 'not-available' || s.status === 'error') {
        setTimeout(() => setUpdate(null), 4000);
      }
    });
    return cleanup;
  }, []);

  // Track launch progress globally so a background launch keeps updating the
  // launch store even when the user has navigated away from the launch page.
  useEffect(() => {
    if (!window.electronAPI) return;
    return window.electronAPI.launch.onProgress((p) => {
      launchStore.setProgress(p);
    });
  }, []);

  const PageComponent = pageMap[activeNav];

  return (
    <div className="app-shell">
      <TitleBar />
      {update && <UpdateBanner update={update} />}
      <div className="app-body">
        <Sidebar active={activeNav} onNavigate={setActiveNav} />
        <main className="app-content">
          <PageComponent />
        </main>
      </div>
    </div>
  );
}

function UpdateBanner({ update }: { update: UpdateStatus }) {
  const { t } = useI18n();
  const { status } = update;
  let text = '';
  let action: React.ReactNode = null;

  if (status === 'checking') text = t('update.checking');
  else if (status === 'available') {
    text = t('update.available', { version: update.version ?? '' });
    action = (
      <button className="btn btn--small btn--primary" onClick={() => window.electronAPI?.updater.download()}>
        {t('update.download')}
      </button>
    );
  } else if (status === 'downloading') {
    text = t('update.downloading', { percent: update.percent ?? 0 });
  } else if (status === 'downloaded') {
    text = t('update.downloaded', { version: update.version ?? '' });
    action = (
      <button className="btn btn--small btn--primary" onClick={() => window.electronAPI?.updater.install()}>
        {t('update.install')}
      </button>
    );
  } else if (status === 'error') {
    text = t('update.error', { message: update.message ?? t('update.unknown_error') });
  } else if (status === 'not-available') {
    text = t('update.not_available');
  }

  return (
    <div className="update-banner">
      <span className="update-banner-text">{text}</span>
      {action}
    </div>
  );
}
