import { Rocket, Download, Wifi, Settings } from 'lucide-react';
import { NAV_ITEMS } from '../../shared/constants';
import type { NavKey } from '../../shared/constants';

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

export default function Sidebar({ active, onNavigate }: SidebarProps) {
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
              <span className="sidebar-item-label">{item.label}</span>
            </button>
          </li>
        ))}
      </ul>
    </nav>
  );
}
