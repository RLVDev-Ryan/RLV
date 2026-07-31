import { useState, useEffect } from 'react';
import TitleBar from './components/TitleBar';
import Sidebar from './components/Sidebar';
import LaunchPage from './pages/LaunchPage';
import DownloadPage from './pages/DownloadPage';
import MultiplayerPage from './pages/MultiplayerPage';
import SettingsPage from './pages/SettingsPage';
import type { NavKey } from '../shared/constants';

const pageMap: Record<NavKey, React.FC> = {
  launch: LaunchPage,
  download: DownloadPage,
  multiplayer: MultiplayerPage,
  settings: SettingsPage,
};

interface UpdateStatus {
  status: string;
  version?: string;
  percent?: number;
  message?: string;
}

export default function App() {
  const [activeNav, setActiveNav] = useState<NavKey>('launch');
  const [update, setUpdate] = useState<UpdateStatus | null>(null);

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
  const { status } = update;
  let text = '';
  let action: React.ReactNode = null;

  if (status === 'checking') text = '正在检查更新…';
  else if (status === 'available') {
    text = `发现新版本 v${update.version}，点击下载更新`;
    action = (
      <button className="btn btn--small btn--primary" onClick={() => window.electronAPI?.updater.download()}>
        下载
      </button>
    );
  } else if (status === 'downloading') {
    text = `正在下载更新… ${update.percent ?? 0}%`;
  } else if (status === 'downloaded') {
    text = `新版本 v${update.version} 已就绪`;
    action = (
      <button className="btn btn--small btn--primary" onClick={() => window.electronAPI?.updater.install()}>
        立即重启安装
      </button>
    );
  } else if (status === 'error') {
    text = `检查更新失败：${update.message ?? '未知错误'}`;
  } else if (status === 'not-available') {
    text = '已是最新版本';
  }

  return (
    <div className="update-banner">
      <span className="update-banner-text">{text}</span>
      {action}
    </div>
  );
}
