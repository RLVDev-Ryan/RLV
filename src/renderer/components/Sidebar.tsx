import { Rocket, Download, Wifi, Settings } from 'lucide-react';
import { NAV_ITEMS } from '../../shared/constants';
import type { NavKey } from '../../shared/constants';
import { useI18n } from '../hooks/useI18n';

const ICON_MAP: Record<NavKey, React.ReactNode> = {
  launch: <Rocket size={18} />,
  download: <Download size={18} />,
  multiplayer: <Wifi size={18} />,
  settings: <Settings size={18} />,
};

interface SidebarProps {
  active: NavKey;
  onNavigate: (key: NavKey) => void;
}

const KEY_TO_I18N: Record<NavKey, 'nav.launch' | 'nav.download' | 'nav.multiplayer' | 'nav.settings'> = {
  launch: 'nav.launch',
  download: 'nav.download',
  multiplayer: 'nav.multiplayer',
  settings: 'nav.settings',
};

export default function Sidebar({ active, onNavigate }: SidebarProps) {
  const { t } = useI18n();
  return (
    <nav className="sidebar">
      <ul className="sidebar-list">
        {NAV_ITEMS.map((item) => (
          <li key={item.key}>
            <button
              className={`sidebar-item${active === item.key ? ' sidebar-item--active' : ''}`}
              onClick={() => onNavigate(item.key)}
            >
              <span className="sidebar-item-icon">{ICON_MAP[item.key]}</span>
              <span className="sidebar-item-label">{t(KEY_TO_I18N[item.key])}</span>
            </button>
          </li>
        ))}
      </ul>
    </nav>
  );
}
