import { useState, useEffect, useCallback } from 'react';
import { themeStore, type ThemeSettings } from '../stores/themeStore';

type SettingsTab = 'personalization';

const TABS: { key: SettingsTab; label: string; icon: string }[] = [
  { key: 'personalization', label: '个性化', icon: 'assets/icons/custom-icon.png' },
];

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState<SettingsTab>('personalization');
  const [theme, setThemeState] = useState<ThemeSettings>(themeStore.current);

  const updateTheme = (partial: Partial<ThemeSettings>) => {
    const updated = themeStore.set(partial);
    setThemeState(updated);
  };

  return (
    <div className="page settings-page">
      <div className="settings-layout">
        {/* Left sidebar */}
        <nav className="settings-sidebar">
          <h3 className="settings-sidebar-title">设置</h3>
          <ul className="settings-sidebar-list">
            {TABS.map((t) => (
              <li key={t.key}>
                <button
                  className={`settings-sidebar-item${activeTab === t.key ? ' settings-sidebar-item--active' : ''}`}
                  onClick={() => setActiveTab(t.key)}
                >
                  <span className="settings-sidebar-item-icon">
                    {t.icon.startsWith('assets/') ? (
                      <img src={t.icon} alt="" className="settings-sidebar-custom-icon" draggable={false} />
                    ) : (
                      t.icon
                    )}
                  </span>
                  <span>{t.label}</span>
                </button>
              </li>
            ))}
          </ul>
        </nav>

        {/* Content */}
        <div className="settings-content">
          {activeTab === 'personalization' && <PersonalizationSection theme={theme} onThemeChange={updateTheme} />}
        </div>
      </div>
    </div>
  );
}

/* ── Personalization ── */
function PersonalizationSection({
  theme,
  onThemeChange,
}: {
  theme: ThemeSettings;
  onThemeChange: (p: Partial<ThemeSettings>) => void;
}) {
  const [hexInput, setHexInput] = useState(theme.accentColor);

  useEffect(() => {
    setHexInput(theme.accentColor);
  }, [theme.accentColor]);

  const handleColorPicker = (e: React.ChangeEvent<HTMLInputElement>) => {
    onThemeChange({ accentColor: e.target.value });
  };

  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  const setBgImage = useCallback(
    async (filePath: string) => {
      onThemeChange({ bgImagePath: filePath });
      // Load data URL for the preview div
      if (window.electronAPI) {
        const url = await window.electronAPI.readBgImage(filePath);
        setPreviewUrl(url);
      }
    },
    [onThemeChange],
  );

  // Allow file drops on the page (Windows 11 fix)
  useEffect(() => {
    const prevent = (e: DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      if (e.dataTransfer) {
        e.dataTransfer.effectAllowed = 'copy';
        e.dataTransfer.dropEffect = 'copy';
      }
    };
    const onDrop = (e: DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      const file = e.dataTransfer?.files?.[0];
      if (file && /\.(png|jpe?g|svg|webp|bmp|gif|avif|tiff?)$/i.test(file.name)) {
        setBgImage((file as any).path);
      }
    };
    window.addEventListener('dragenter', prevent);
    window.addEventListener('dragover', prevent);
    window.addEventListener('drop', onDrop);
    return () => {
      window.removeEventListener('dragenter', prevent);
      window.removeEventListener('dragover', prevent);
      window.removeEventListener('drop', onDrop);
    };
  }, []);

  const handleHexSubmit = () => {
    const val = hexInput.trim();
    if (/^#[0-9a-fA-F]{6}$/.test(val)) {
      onThemeChange({ accentColor: val });
    }
  };

  const handleHexKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleHexSubmit();
  };

  return (
    <div className="settings-section">
      <h2 className="settings-section-title">个性化</h2>
      <p className="settings-section-desc">自定义启动器外观</p>

      {/* Theme mode */}
      <div className="settings-card">
        <h3 className="settings-card-title">主题模式</h3>
        <div className="theme-switch-group">
          <button
            className={`theme-switch-btn${theme.mode === 'light' ? ' theme-switch-btn--active' : ''}`}
            onClick={() => onThemeChange({ mode: 'light' })}
          >
            <span className="theme-switch-btn-icon">
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                <circle cx="10" cy="10" r="4.5" stroke="currentColor" strokeWidth="1.5" />
                <path
                  d="M10 1v2M10 17v2M1 10h2M17 10h2M3.5 3.5l1.5 1.5M15 15l1.5 1.5M3.5 16.5l1.5-1.5M15 5l1.5-1.5"
                  stroke="currentColor"
                  strokeWidth="1.3"
                  strokeLinecap="round"
                />
              </svg>
            </span>
            <span>浅色模式</span>
          </button>
          <button
            className={`theme-switch-btn${theme.mode === 'dark' ? ' theme-switch-btn--active' : ''}`}
            onClick={() => onThemeChange({ mode: 'dark' })}
          >
            <span className="theme-switch-btn-icon">
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                <path
                  d="M15.5 11.5A6.5 6.5 0 018.5 5a6.5 6.5 0 107 6.5z"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinejoin="round"
                />
              </svg>
            </span>
            <span>深色模式</span>
          </button>
        </div>
      </div>

      {/* Background image */}
      <div className="settings-card">
        <h3 className="settings-card-title">背景图片</h3>
        <p className="settings-card-desc">支持拖拽或浏览选择图片（PNG / JPG / SVG / WebP 等）</p>

        <div
          className="bg-image-dropzone"
          onDragEnter={(e) => {
            e.preventDefault();
            if (e.dataTransfer) e.dataTransfer.dropEffect = 'copy';
            e.currentTarget.classList.add('bg-image-dropzone--over');
          }}
          onDragOver={(e) => {
            e.preventDefault();
            if (e.dataTransfer) e.dataTransfer.dropEffect = 'copy';
          }}
          onDragLeave={(e) => {
            e.currentTarget.classList.remove('bg-image-dropzone--over');
          }}
          onDrop={(e) => {
            e.preventDefault();
            e.currentTarget.classList.remove('bg-image-dropzone--over');
            const file = e.dataTransfer.files[0];
            if (file && /\.(png|jpe?g|svg|webp|bmp|gif|avif|tiff?)$/i.test(file.name)) {
              setBgImage((file as any).path);
            }
          }}
        >
          {previewUrl ? (
            <div className="bg-image-preview" style={{ backgroundImage: `url("${previewUrl}")` }} />
          ) : theme.bgImagePath ? (
            <div className="bg-image-preview" style={{ background: 'var(--bg-surface)' }} />
          ) : (
            <div className="bg-image-placeholder">
              <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
                <rect x="4" y="4" width="20" height="20" rx="4" stroke="currentColor" strokeWidth="1.5" fill="none" />
                <path
                  d="M10 14l3 3 5-6 4 5v2a1 1 0 01-1 1H7a1 1 0 01-1-1v-1l4-3z"
                  stroke="currentColor"
                  strokeWidth="1.5"
                />
              </svg>
              <span>拖拽图片到此处</span>
            </div>
          )}
          {theme.bgImagePath && (
            <button
              className="bg-image-remove"
              onClick={() => {
                onThemeChange({ bgImagePath: null });
                setPreviewUrl(null);
              }}
              title="移除背景"
            >
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                <path d="M2 2l10 10M12 2l-10 10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
            </button>
          )}
        </div>

        <div className="bg-image-actions">
          <input
            className="form-input"
            type="text"
            value={''}
            placeholder="拖入图片或点击浏览…"
            style={{ flex: 1 }}
            readOnly
          />
          <button
            className="btn btn--small btn--outline"
            onClick={async () => {
              const path = await window.electronAPI?.openBgImage();
              if (path) setBgImage(path);
            }}
          >
            浏览
          </button>
        </div>
      </div>

      {/* Accent color */}
      <div className="settings-card">
        <h3 className="settings-card-title">强调色</h3>
        <p className="settings-card-desc">设置主按钮、链接和选中状态的颜色（深色模式下无效）</p>
        <div className="color-picker-row">
          <div className="color-picker-swatch">
            <input
              type="color"
              className="color-picker-native"
              value={theme.accentColor}
              onChange={handleColorPicker}
            />
            <div className="color-picker-preview" style={{ background: theme.accentColor }} />
          </div>
          <div className="color-picker-hex">
            <span className="color-picker-hex-prefix">#</span>
            <input
              className="color-picker-hex-input"
              type="text"
              value={hexInput.replace('#', '')}
              onChange={(e) => setHexInput('#' + e.target.value)}
              onBlur={handleHexSubmit}
              onKeyDown={handleHexKeyDown}
              maxLength={6}
              placeholder="6b9bc0"
            />
          </div>
          <div className="color-picker-presets">
            {['#6b9bc0', '#7c5ce7', '#e8904a', '#68d391', '#e8a0a8', '#e8c9a0'].map((c) => (
              <button
                key={c}
                className="color-picker-preset"
                style={{ background: c }}
                onClick={() => onThemeChange({ accentColor: c })}
                title={c}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
