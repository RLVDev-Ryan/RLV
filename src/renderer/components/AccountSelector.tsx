import { useState, useRef, useEffect } from 'react';
import type { Account } from '../../shared/constants';

interface AccountSelectorProps {
  current: Account | null;
  accounts: Account[];
  onSelect: (id: string) => void;
  onAdd: () => void;
  onRemove: (id: string) => void;
}

const TYPE_LABELS: Record<string, { label: string; color: string }> = {
  microsoft: { label: '微软账户', color: '#00a4ef' },
  yggdrasil: { label: '外置登录', color: '#dbb774' },
};

function getInitials(name: string): string {
  return name.charAt(0).toUpperCase();
}

export default function AccountSelector({ current, accounts, onSelect, onAdd, onRemove }: AccountSelectorProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Close on click outside
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const typeMeta = current ? TYPE_LABELS[current.type] : null;

  return (
    <div className="account-selector" ref={ref}>
      <button className="account-trigger" onClick={() => setOpen(!open)}>
        <div className="account-avatar">
          {current?.avatarUrl ? (
            <img
              src={current.avatarUrl}
              alt=""
              className="account-avatar-img"
              crossOrigin="anonymous"
              referrerPolicy="no-referrer"
            />
          ) : (
            <span className="account-avatar-fallback">{current ? getInitials(current.name) : '?'}</span>
          )}
        </div>
        <div className="account-trigger-info">
          <span className="account-trigger-name">{current?.name ?? '未登录'}</span>
          {typeMeta && (
            <span className="account-trigger-type" style={{ color: typeMeta.color }}>
              {typeMeta.label}
            </span>
          )}
        </div>
        <span className={`account-chevron ${open ? 'account-chevron--open' : ''}`}>
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
      </button>

      {open && (
        <div className="account-dropdown">
          <button
            className="account-dropdown-add"
            onClick={() => {
              setOpen(false);
              onAdd();
            }}
          >
            <span className="account-dropdown-add-icon">+</span>
            添加新账户
          </button>

          {accounts.length > 0 && <div className="account-dropdown-divider" />}

          <div className="account-dropdown-list">
            {accounts.map((acc) => {
              const t = TYPE_LABELS[acc.type];
              const isCurrent = current?.id === acc.id;
              return (
                <button
                  key={acc.id}
                  className={`account-dropdown-item${isCurrent ? ' account-dropdown-item--active' : ''}`}
                  onClick={() => {
                    onSelect(acc.id);
                    setOpen(false);
                  }}
                >
                  <div className="account-dropdown-item-avatar">
                    {acc.avatarUrl ? (
                      <img src={acc.avatarUrl} alt="" className="account-avatar-img" />
                    ) : (
                      <span className="account-avatar-fallback">{getInitials(acc.name)}</span>
                    )}
                  </div>
                  <div className="account-dropdown-item-info">
                    <span className="account-dropdown-item-name">{acc.name}</span>
                    <span className="account-dropdown-item-type" style={{ color: t?.color }}>
                      {t?.label}
                    </span>
                  </div>
                  {isCurrent && (
                    <span className="account-checkmark">
                      <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                        <path
                          d="M2 7l4 4 6-6"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                    </span>
                  )}
                  {!isCurrent && accounts.length > 1 && (
                    <button
                      className="account-remove-btn"
                      onClick={(e) => {
                        e.stopPropagation();
                        onRemove(acc.id);
                      }}
                      title="移除账户"
                    >
                      <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                        <path d="M2 2l8 8M10 2l-8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                      </svg>
                    </button>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
