import { useState, useEffect, useCallback } from 'react';
import { themeStore, applyTheme, type ThemeSettings } from '../stores/themeStore';
import { useI18n, type I18nKey } from '../hooks/useI18n';
import { CREDITS, type CreditDetail } from '../data/credits';
import { DEFAULT_FONT, FONT_MANIFEST, FONT_OPTIONS } from '../../shared/fonts';
import { fontStore, injectFontFace } from '../stores/fontStore';
import { configStore } from '../stores/configStore';
import { musicPlayer } from '../stores/musicPlayer';

type SettingsTab = 'personalization' | 'language' | 'about';

const TABS: { key: SettingsTab; labelKey: I18nKey; icon: React.ReactNode }[] = [
  { key: 'personalization', labelKey: 'settings.personalization', icon: 'assets/palette.png' },
  {
    key: 'language',
    labelKey: 'settings.language_font',
    icon: (
      <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
        <circle cx="9" cy="9" r="7" stroke="currentColor" strokeWidth="1.5" />
        <path d="M3 9h12M9 2a11 11 0 010 14A11 11 0 019 2z" stroke="currentColor" strokeWidth="1.5" />
      </svg>
    ),
  },
  {
    key: 'about',
    labelKey: 'settings.about',
    icon: (
      <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
        <circle cx="9" cy="9" r="7" stroke="currentColor" strokeWidth="1.5" />
        <circle cx="9" cy="9" r="1" fill="currentColor" />
        <path d="M9 8v4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      </svg>
    ),
  },
];

export default function SettingsPage() {
  const { t } = useI18n();
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
          <ul className="settings-sidebar-list">
            {TABS.map((tab) => (
              <li key={tab.key}>
                <button
                  className={`settings-sidebar-item${activeTab === tab.key ? ' settings-sidebar-item--active' : ''}`}
                  onClick={() => setActiveTab(tab.key)}
                >
                  <span className="settings-sidebar-item-icon">
                    {typeof tab.icon === 'string' ? (
                      <img src={tab.icon} alt="" className="settings-sidebar-custom-icon" draggable={false} />
                    ) : (
                      tab.icon
                    )}
                  </span>
                  <span>{t(tab.labelKey)}</span>
                </button>
              </li>
            ))}
          </ul>
        </nav>

        {/* Content */}
        <div className="settings-content">
          {activeTab === 'personalization' && <PersonalizationSection theme={theme} onThemeChange={updateTheme} />}
          {activeTab === 'language' && <LanguageSection theme={theme} onThemeChange={updateTheme} />}
          {activeTab === 'about' && <AboutSection />}
        </div>
      </div>
    </div>
  );
}

/* ── Language ── */
function LanguageSection({
  theme,
  onThemeChange,
}: {
  theme: ThemeSettings;
  onThemeChange: (p: Partial<ThemeSettings>) => void;
}) {
  const { t } = useI18n();
  const [fontProgress, setFontProgress] = useState(fontStore.downloading ? fontStore.percent : 0);
  const [fontBusy, setFontBusy] = useState(fontStore.downloading);

  useEffect(() => {
    const unsub = fontStore.subscribe(() => {
      setFontBusy(fontStore.downloading);
      setFontProgress(fontStore.percent);
    });
    return unsub;
  }, []);

  useEffect(() => {
    if (!window.electronAPI) return;
    return window.electronAPI.fonts.onProgress((p) => {
      fontStore._progress(p);
    });
  }, []);

  /** Ensure a font is available (download on demand), then apply it. */
  const selectFont = useCallback(
    async (value: string, apply: () => void) => {
      if (!window.electronAPI) {
        apply();
        return;
      }
      const spec = FONT_MANIFEST[value];
      if (!spec || spec.bundled) {
        apply(); // bundled default — already present
        return;
      }
      const { cached } = await window.electronAPI.fonts.isCached(value);
      if (cached) {
        injectFontFace(value);
        apply();
        return;
      }
      fontStore._begin(value);
      const result = await window.electronAPI.fonts.download(value);
      if (!result.cancelled && result.success) {
        injectFontFace(value);
        apply();
      }
      fontStore._end();
    },
    [],
  );

  const applyFont = (partial: Partial<ThemeSettings>) => onThemeChange(partial);

  return (
    <div className="settings-section">
      <h2 className="settings-section-title">{t('settings.language')}</h2>
      <p className="settings-section-desc">{t('settings.language.desc')}</p>
      <div className="settings-card">
        <div className="theme-switch-group">
          {(
            [
              { key: 'zh-CN', label: '简体中文' },
              { key: 'zh-TW', label: '繁體中文' },
              { key: 'ja', label: '日本語' },
              { key: 'ko', label: '한국어' },
              { key: 'en', label: 'English' },
            ] as const
          ).map((loc) => (
            <button
              key={loc.key}
              className={`theme-switch-btn${theme.locale === loc.key ? ' theme-switch-btn--active' : ''}`}
              onClick={() => onThemeChange({ locale: loc.key })}
            >
              {loc.label}
            </button>
          ))}
        </div>
      </div>

      {/* Font selector */}
      <div className="settings-card">
        <div className="settings-card-title-row">
          <h3 className="settings-card-title" style={{ margin: 0 }}>{t('settings.font.choose')}</h3>
          <div className="theme-switch-group" style={{ gap: 4 }}>
            <button
              className={`theme-switch-btn${theme.fontMode === 'global' ? ' theme-switch-btn--active' : ''}`}
              onClick={() => onThemeChange({ fontMode: 'global' })}
              style={{ padding: '4px 10px', fontSize: 12 }}
            >
              {t('settings.font_mode.global')}
            </button>
            <button
              className={`theme-switch-btn${theme.fontMode === 'zone' ? ' theme-switch-btn--active' : ''}`}
              onClick={() => onThemeChange({ fontMode: 'zone' })}
              style={{ padding: '4px 10px', fontSize: 12 }}
            >
              {t('settings.font_mode.zone')}
            </button>
          </div>
        </div>
        {fontBusy && (
          <div className="font-download-banner">
            <span className="font-download-name">{t('settings.font.downloading', { font: fontStore.downloading ?? '' })}</span>
            <div className="font-download-track">
              <div className="font-download-fill" style={{ width: `${fontProgress}%` }} />
            </div>
            <span className="font-download-pct">{Math.round(fontProgress)}%</span>
            <button
              className="btn btn--small btn--danger"
              onClick={async () => {
                await window.electronAPI?.fonts.cancel();
                fontStore._end();
              }}
            >
              {t('settings.font.stop')}
            </button>
          </div>
        )}

        {theme.fontMode === 'global' ? (
          <select
            className="form-input form-select"
            value={theme.fontFamily ?? DEFAULT_FONT}
            onChange={(e) => selectFont(e.target.value || DEFAULT_FONT, () => applyFont({ fontFamily: e.target.value || null }))}
            style={{ marginTop: 12 }}
          >
            {FONT_OPTIONS.map((f) => (
              <option key={f} value={f}>
                {f === DEFAULT_FONT ? `${f}（默认）` : f}
              </option>
            ))}
          </select>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 12 }}>
            <div>
              <label style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 4, display: 'block' }}>
                {t('settings.font.zone_content')}
              </label>
              <select
                className="form-input form-select"
                value={theme.fontContent ?? DEFAULT_FONT}
                onChange={(e) => selectFont(e.target.value || DEFAULT_FONT, () => applyFont({ fontContent: e.target.value || null }))}
              >
                {FONT_OPTIONS.map((f) => (
                  <option key={f} value={f}>
                    {f}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 4, display: 'block' }}>
                {t('settings.font.zone_buttons')}
              </label>
              <select
                className="form-input form-select"
                value={theme.fontButtons ?? DEFAULT_FONT}
                onChange={(e) => selectFont(e.target.value || DEFAULT_FONT, () => applyFont({ fontButtons: e.target.value || null }))}
              >
                {FONT_OPTIONS.map((f) => (
                  <option key={f} value={f}>
                    {f}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 4, display: 'block' }}>
                {t('settings.font.zone_logs')}
              </label>
              <select
                className="form-input form-select"
                value={theme.fontLogs ?? DEFAULT_FONT}
                onChange={(e) => selectFont(e.target.value || DEFAULT_FONT, () => applyFont({ fontLogs: e.target.value || null }))}
              >
                {FONT_OPTIONS.map((f) => (
                  <option key={f} value={f}>
                    {f}
                  </option>
                ))}
              </select>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/* ── About ── */
const CATEGORIES = ['参考项目', '依赖库', '字体', '联机', '资料/API'];

const CATEGORY_TITLES: Record<string, I18nKey> = {
  参考项目: 'about.cat.refs',
  依赖库: 'about.cat.deps',
  字体: 'about.cat.fonts',
  联机: 'about.cat.multiplayer',
  '资料/API': 'about.cat.api',
};

function AboutSection() {
  const { t } = useI18n();
  const [selected, setSelected] = useState<CreditDetail | null>(null);

  if (selected) {
    return (
      <div className="settings-section">
        <button className="version-detail-back" onClick={() => setSelected(null)} style={{ marginBottom: 16 }}>
          <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
            <path d="M11 4L6 9l5 5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <span>{t('common.back')}</span>
        </button>

        <h2 className="page-title" style={{ marginBottom: 4 }}>
          {selected.name}
        </h2>
        <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 16 }}>
          {CATEGORY_TITLES[selected.category] ? t(CATEGORY_TITLES[selected.category]) : selected.category} ·{' '}
          <a href={selected.url} target="_blank" rel="noreferrer" style={{ color: 'var(--accent)' }}>
            {selected.url.replace(/^https?:\/\//, '')}
          </a>
        </p>

        <div className="settings-card">
          <h3 className="settings-card-title">{t('about.license')}</h3>
          <p className="credit-detail-text">{selected.license}</p>
        </div>

        <div className="settings-card">
          <h3 className="settings-card-title">{t('about.usage')}</h3>
          <p className="credit-detail-text">{selected.usage}</p>
        </div>

        <div className="settings-card">
          <h3 className="settings-card-title">{t('about.requirements')}</h3>
          <p className="credit-detail-text">{selected.licenseRequirements}</p>
        </div>

        <div className="settings-card">
          <h3 className="settings-card-title">{t('about.disclaimer')}</h3>
          <p className="credit-detail-text">{selected.disclaimer}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="settings-section">
      <h2 className="settings-section-title">{t('about.title')}</h2>
      <p className="settings-section-desc">{t('about.subtitle')}</p>

      {CATEGORIES.map((category) => {
        const items = CREDITS.filter((c) => c.category === category);
        if (items.length === 0) return null;
        return (
          <div key={category} className="settings-card">
            <h3 className="settings-card-title">{t(CATEGORY_TITLES[category])}</h3>
            <div className="credits-list">
              {items.map((c) => (
                <button key={c.name} className="credits-item credits-item--clickable" onClick={() => setSelected(c)}>
                  <span className="credits-name">{c.name}</span>
                  <span className="credits-license">{c.license}</span>
                </button>
              ))}
            </div>
          </div>
        );
      })}
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
  const { t } = useI18n();
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
        // Electron augments File with a non-standard `path` property
        const filePath = (file as File & { path?: string }).path;
        if (filePath) setBgImage(filePath);
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

  // ── .js config-driven UI (ui / picture / music) ──
  const [uiCfg, setUiCfg] = useState(() => configStore.get('ui'));
  const [picCfg, setPicCfg] = useState(() => configStore.get('picture'));
  const [musicCfg, setMusicCfg] = useState(() => configStore.get('music'));

  useEffect(() => {
    const unsub = configStore.subscribe(() => {
      setUiCfg(configStore.get('ui'));
      setPicCfg(configStore.get('picture'));
      setMusicCfg(configStore.get('music'));
    });
    return unsub;
  }, []);

  const updateUi = (k: keyof typeof uiCfg, v: number) => {
    configStore.update('ui', { ...configStore.get('ui'), [k]: v });
    applyTheme(themeStore.current);
  };
  const updateMusic = (k: 'enabled' | 'volume' | 'playlistPath', v: unknown) => {
    configStore.update('music', { ...configStore.get('music'), [k]: v });
  };
  const pickMusicDir = async () => {
    const dir = await window.electronAPI?.openDirectory();
    if (dir) updateMusic('playlistPath', dir);
  };

  const [nowPlaying, setNowPlaying] = useState(musicPlayer.track);
  useEffect(() => {
    const unsub = musicPlayer.subscribe(() => setNowPlaying(musicPlayer.track));
    return unsub;
  }, []);

  return (
    <div className="settings-section">
      <h2 className="settings-section-title">{t('settings.personalization')}</h2>
      <p className="settings-section-desc">{t('settings.personalization.desc')}</p>

      {/* Theme mode */}
      <div className="settings-card">
        <h3 className="settings-card-title">{t('settings.theme.mode')}</h3>
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
            <span>{t('settings.theme.light')}</span>
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
            <span>{t('settings.theme.dark')}</span>
          </button>
        </div>
      </div>

      {/* Background image */}
      <div className="settings-card">
        <h3 className="settings-card-title">{t('settings.bg.title')}</h3>
        <p className="settings-card-desc">{t('settings.bg.desc')}</p>

        {previewUrl && <div className="bg-image-preview" style={{ backgroundImage: `url("${previewUrl}")` }} />}

        <div className="bg-image-actions" style={{ marginTop: 12 }}>
          <input
            className="form-input"
            type="text"
            value={theme.bgImagePath ?? ''}
            onChange={(e) => {
              const val = e.target.value;
              if (val) setBgImage(val);
              else onThemeChange({ bgImagePath: null });
            }}
            placeholder={t('settings.bg.placeholder')}
            style={{ flex: 1 }}
          />
          <button
            className="btn btn--small btn--outline"
            onClick={async () => {
              const path = await window.electronAPI?.openBgImage();
              if (path) setBgImage(path);
            }}
          >
            {t('common.browse')}
          </button>
          {theme.bgImagePath && (
            <button
              className="btn btn--small btn--ghost"
              onClick={() => {
                onThemeChange({ bgImagePath: null });
                setPreviewUrl(null);
              }}
            >
              {t('common.remove')}
            </button>
          )}
        </div>
      </div>

      {/* Button mode (only when bgImage is set) */}
      {theme.bgImagePath && (
        <div className="settings-card">
          <h3 className="settings-card-title">{t('settings.btn-mode.title')}</h3>
          <p className="settings-card-desc">{t('settings.btn-mode.desc')}</p>
          <div className="theme-switch-group">
            <button
              className={`theme-switch-btn${theme.buttonMode === 'white' ? ' theme-switch-btn--active' : ''}`}
              onClick={() => onThemeChange({ buttonMode: 'white' })}
            >
              <span className="theme-switch-btn-icon">
                <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                  <rect x="2" y="2" width="14" height="14" rx="3" fill="currentColor" />
                </svg>
              </span>
              <span>{t('settings.btn-mode.white')}</span>
            </button>
            <button
              className={`theme-switch-btn${theme.buttonMode === 'transparent' ? ' theme-switch-btn--active' : ''}`}
              onClick={() => onThemeChange({ buttonMode: 'transparent' })}
            >
              <span className="theme-switch-btn-icon">
                <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                  <rect x="2" y="2" width="14" height="14" rx="3" stroke="currentColor" strokeWidth="1.5" fill="none" />
                </svg>
              </span>
              <span>{t('settings.btn-mode.transparent')}</span>
            </button>
          </div>
        </div>
      )}

      {/* Accent color */}
      <div className="settings-card">
        <h3 className="settings-card-title">{t('settings.accent.title')}</h3>
        <p className="settings-card-desc">{t('settings.accent.desc')}</p>
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

      {/* UI 设置（.js 配置） */}
      <div className="settings-card">
        <h3 className="settings-card-title">{t('settings.ui.title')}</h3>
        <div className="form-group">
          <label className="form-label">{t('settings.ui.radius')}: {uiCfg.radius}px</label>
          <input
            type="range"
            className="form-range"
            min={4}
            max={24}
            value={uiCfg.radius}
            onChange={(e) => updateUi('radius', Number(e.target.value))}
          />
        </div>
        <div className="form-group">
          <label className="form-label">{t('settings.ui.blur')}: {uiCfg.blur}px</label>
          <input
            type="range"
            className="form-range"
            min={0}
            max={40}
            value={uiCfg.blur}
            onChange={(e) => updateUi('blur', Number(e.target.value))}
          />
        </div>
        <div className="form-group">
          <label className="form-label">{t('settings.ui.opacity')}: {Math.round(uiCfg.opacity * 100)}%</label>
          <input
            type="range"
            className="form-range"
            min={50}
            max={100}
            value={uiCfg.opacity * 100}
            onChange={(e) => updateUi('opacity', Number(e.target.value) / 100)}
          />
        </div>
      </div>

      {/* 背景图配置 */}
      <div className="settings-card">
        <h3 className="settings-card-title">{t('settings.picture.title')}</h3>
        <div className="form-group">
          <label className="form-label">{t('settings.picture.scale_mode')}</label>
          <select
            className="form-input form-select"
            value={picCfg.scaleMode}
            onChange={(e) => {
              configStore.update('picture', {
                ...configStore.get('picture'),
                scaleMode: e.target.value as 'cover' | 'contain' | 'fill',
              });
              applyTheme(themeStore.current);
            }}
          >
            <option value="cover">{t('settings.picture.cover')}</option>
            <option value="contain">{t('settings.picture.contain')}</option>
            <option value="fill">{t('settings.picture.fill')}</option>
          </select>
        </div>
      </div>

      {/* 音乐配置（.js 配置，播放器后续实现） */}
      <div className="settings-card">
        <h3 className="settings-card-title">{t('settings.music.title')}</h3>
        <label className="export-checkbox">
          <input
            type="checkbox"
            checked={musicCfg.enabled}
            onChange={(e) => updateMusic('enabled', e.target.checked)}
          />
          <span>{t('settings.music.enable')}</span>
        </label>
        <div className="form-group">
          <label className="form-label">{t('settings.music.volume')}: {musicCfg.volume}%</label>
          <input
            type="range"
            className="form-range"
            min={0}
            max={100}
            value={musicCfg.volume}
            onChange={(e) => updateMusic('volume', Number(e.target.value))}
          />
        </div>
        <div className="form-group">
          <label className="form-label">{t('settings.music.playlist')}</label>
          <div className="form-input-row">
            <input
              className="form-input"
              type="text"
              value={musicCfg.playlistPath}
              onChange={(e) => updateMusic('playlistPath', e.target.value)}
              placeholder={t('settings.music.playlist_placeholder')}
            />
            <button className="btn btn--small btn--outline" onClick={pickMusicDir}>
              {t('common.browse')}
            </button>
            <button className="btn btn--small btn--outline" onClick={() => window.electronAPI?.music.openDir()}>
              {t('settings.music.open_dir')}
            </button>
          </div>
        </div>
        <div className="music-now-playing">
          {musicPlayer.playing && nowPlaying ? (
            <span>
              {t('settings.music.now_playing')}: {nowPlaying}
              {musicPlayer.trackCount > 0 ? ` (${musicPlayer.currentIndex}/${musicPlayer.trackCount})` : ''}
            </span>
          ) : (
            <span className="music-now-playing-idle">{t('settings.music.not_playing')}</span>
          )}
        </div>
      </div>

      {/* 配置目录 */}
      <div className="settings-card">
        <h3 className="settings-card-title">{t('settings.config_dir')}</h3>
        <div className="quick-actions">
          <button className="btn btn--small btn--outline" onClick={() => window.electronAPI?.config.openDir()}>
            {t('settings.open_config_dir')}
          </button>
          <button className="btn btn--small btn--outline" onClick={() => window.electronAPI?.config.openDataDir()}>
            {t('settings.open_data_dir')}
          </button>
        </div>
      </div>

    </div>
  );
}
