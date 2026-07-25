import { useState } from 'react';
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

export default function App() {
  const [activeNav, setActiveNav] = useState<NavKey>('launch');

  const PageComponent = pageMap[activeNav];

  return (
    <div className="app-shell">
      <TitleBar />
      <div className="app-body">
        <Sidebar active={activeNav} onNavigate={setActiveNav} />
        <main className="app-content">
          <PageComponent />
        </main>
      </div>
    </div>
  );
}
