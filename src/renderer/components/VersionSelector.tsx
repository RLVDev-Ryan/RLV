import { useState, useRef, useEffect } from 'react';
import { LOADER_META, VANILLA_ICON, VANILLA_CARD_BG, getBaseVersion } from '../../shared/constants';
import type { MinecraftVersion } from '../../shared/constants';

interface VersionSelectorProps {
  versions: MinecraftVersion[];
  selected: MinecraftVersion | null;
  onSelect: (v: MinecraftVersion) => void;
}

function getVersionCardBg(v: MinecraftVersion): string {
  return v.loader ? LOADER_META[v.loader].cardBg : VANILLA_CARD_BG;
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export default function VersionSelector({ versions, selected, onSelect }: VersionSelectorProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const ref = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
        setSearch('');
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  // Focus search when opening
  useEffect(() => {
    if (open) searchRef.current?.focus();
  }, [open]);

  const filtered = search.trim() ? versions.filter((v) => v.id.toLowerCase().includes(search.toLowerCase())) : versions;

  const empty = versions.length === 0;

  // Pre-compute loader meta for each version
  const versionItems = filtered.map((v) => ({
    version: v,
    loaderMeta: v.loader ? LOADER_META[v.loader] : null,
  }));

  return (
    <div className="version-selector" ref={ref}>
      <button
        className={`version-selector-trigger${empty ? ' version-selector-trigger--empty' : ''}`}
        onClick={() => !empty && setOpen(!open)}
        disabled={empty}
      >
        <span className="version-selector-value">
          {empty ? '暂无已安装版本' : selected ? getBaseVersion(selected.id) : '选择版本'}
        </span>
        {!empty && (
          <span className={`version-selector-chevron ${open ? 'version-selector-chevron--open' : ''}`}>
            <svg width="10" height="6" viewBox="0 0 10 6" fill="none">
              <path
                d="M1 1l4 4 4-4"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </span>
        )}
      </button>

      {open && !empty && (
        <div className="version-selector-dropdown">
          <div className="version-selector-search">
            <svg className="version-selector-search-icon" width="14" height="14" viewBox="0 0 14 14" fill="none">
              <circle cx="6" cy="6" r="4.5" stroke="currentColor" strokeWidth="1.5" />
              <path d="M9.5 9.5L13 13" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
            <input
              ref={searchRef}
              className="version-selector-search-input"
              type="text"
              placeholder="搜索版本…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <div className="version-selector-list">
            {filtered.length === 0 ? (
              <div className="version-selector-empty">无匹配版本</div>
            ) : (
              versionItems.map(({ version: v, loaderMeta: lm }) => (
                <button
                  key={v.id}
                  className={`version-selector-item${selected?.id === v.id ? ' version-selector-item--active' : ''}`}
                  style={{ background: getVersionCardBg(v) }}
                  onClick={() => {
                    onSelect(v);
                    setOpen(false);
                    setSearch('');
                  }}
                >
                  <div className="version-selector-item-icon">
                    <img
                      className="version-selector-item-img"
                      src={lm ? lm.iconPath : VANILLA_ICON}
                      alt={lm?.label ?? 'Vanilla'}
                      draggable={false}
                    />
                  </div>
                  <div className="version-selector-item-info">
                    <span className="version-selector-item-name">{getBaseVersion(v.id)}</span>
                    <span className="version-selector-item-type">{v.type === 'release' ? '正式版' : v.type}</span>
                  </div>
                  {lm && (
                    <span
                      className="version-selector-item-tag"
                      style={{
                        color: lm.color,
                        background: `${lm.color}18`,
                        borderColor: `${lm.color}30`,
                      }}
                    >
                      {lm.label}
                    </span>
                  )}
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
