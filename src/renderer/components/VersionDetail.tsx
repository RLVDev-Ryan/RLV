import { useState, useEffect, useCallback } from 'react';
import { LOADER_META } from '../../shared/constants';
import type { MinecraftVersion } from '../../shared/constants';
import { formatDate, loadLaunchSettings, saveLaunchSettings } from '../../shared/utils';
import { useI18n, type I18nKey } from '../hooks/useI18n';

interface VersionDetailProps {
  version: MinecraftVersion;
  onBack: () => void;
}

type DetailTab = 'overview' | 'settings' | 'mods' | 'export';

export default function VersionDetail({ version, onBack }: VersionDetailProps) {
  const { t } = useI18n();
  const [activeTab, setActiveTab] = useState<DetailTab>('overview');
  const [fadeIn, setFadeIn] = useState(true);

  const lm = version.loader ? LOADER_META[version.loader] : null;

  const TABS: { key: DetailTab; label: string }[] = [
    { key: 'overview', label: t('version.overview') },
    { key: 'settings', label: t('version.settings') },
    { key: 'mods', label: t('version.mods') },
    { key: 'export', label: t('version.export') },
  ];

  const switchTab = useCallback((tab: DetailTab) => {
    setFadeIn(false);
    setTimeout(() => {
      setActiveTab(tab);
      setFadeIn(true);
    }, 100);
  }, []);

  return (
    <div className="version-detail">
      {/* Header */}
      <div className="version-detail-header">
        <button className="version-detail-back" onClick={onBack}>
          <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
            <path
              d="M11 4L6 9l5 5"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          <span>{t('common.back')}</span>
        </button>
        <div className="version-detail-title-area">
          <h2 className="version-detail-title">{version.id}</h2>
          {lm && (
            <span
              className="version-detail-badge"
              style={{
                color: lm.color,
                background: `${lm.color}18`,
                borderColor: `${lm.color}30`,
              }}
            >
              {lm.label}
            </span>
          )}
        </div>
      </div>

      {/* Tab bar */}
      <div className="version-detail-tabs">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            className={`version-detail-tab${activeTab === tab.key ? ' version-detail-tab--active' : ''}`}
            onClick={() => switchTab(tab.key)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className={`version-detail-content ${fadeIn ? 'fade-in' : 'fade-out'}`}>
        {activeTab === 'overview' && <TabOverview version={version} />}
        {activeTab === 'settings' && <TabSettings version={version} />}
        {activeTab === 'mods' && <TabMods />}
        {activeTab === 'export' && <TabExport version={version} />}
      </div>
    </div>
  );
}

/* ────────── Overview Tab ────────── */
function TabOverview({ version }: { version: MinecraftVersion }) {
  const { t } = useI18n();
  const [versionPath, setVersionPath] = useState('');
  const [gameDirs, setGameDirs] = useState<string[]>([]);

  useEffect(() => {
    if (window.electronAPI) {
      window.electronAPI.gameDirs.getVersionPath(version.id).then(setVersionPath);
      window.electronAPI.gameDirs.getAll().then(setGameDirs);
    }
  }, [version.id]);

  const handleAddFolder = async () => {
    if (window.electronAPI) {
      const dirs = await window.electronAPI.gameDirs.add();
      if (dirs) {
        setGameDirs(dirs);
        const newPath = await window.electronAPI.gameDirs.getVersionPath(version.id);
        setVersionPath(newPath);
      }
    }
  };

  /** Open a sub-directory of the active game dir in the OS file manager. */
  const openSubDir = async (sub: string) => {
    if (!window.electronAPI) return;
    const dir = gameDirs[0] || (await window.electronAPI.gameDirs.getDefault());
    if (dir) await window.electronAPI.openPath(`${dir}/${sub}`);
  };

  const handleExportScript = async () => {
    if (!window.electronAPI) return;
    const settings = loadLaunchSettings();
    const result = await window.electronAPI.launch.exportScript(version.id, {
      memoryMB: settings.memoryMB,
      jvmArgs: settings.jvmArgs,
      gameArgs: settings.gameArgs,
    });
    if (result.success && result.path) {
      await window.electronAPI.showAlert(`${t('version.exported_to')}\n${result.path}`);
    } else {
      await window.electronAPI.showAlert(result.error || t('version.export_failed'));
    }
  };

  return (
    <div className="tab-pane">
      <Section title={t('version.version_info')}>
        <InfoRow label={t('version.game_version')} value={version.id} />
        <InfoRow label={t('version.release_date')} value={formatDate(version.releaseDate)} />
        <InfoRow label={t('version.type')} value={version.type === 'release' ? t('download.release') : version.type} />
        {version.loader && <InfoRow label={t('version.loader')} value={LOADER_META[version.loader].label} />}
      </Section>

      <Section title={t('version.path')}>
        <InfoRow label={t('version.version_dir')} value={versionPath || t('version.fetching')} />
        <InfoRow label={t('version.game_dir')} value={gameDirs[0] || t('version.fetching')} />
        <div className="quick-actions" style={{ marginTop: 8 }}>
          <button className="btn btn--small btn--outline" onClick={() => versionPath && window.electronAPI?.openPath(versionPath)}>
            {t('version.open_dir')}
          </button>
          <button className="btn btn--small btn--outline" onClick={handleAddFolder}>
            {t('launch_page.add_existing')}
          </button>
        </div>
        {gameDirs.length > 1 && (
          <div style={{ marginTop: 8 }}>
            <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 6 }}>{t('version.dirs_added')}</p>
            {gameDirs.map((d) => (
              <div key={d} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 0' }}>
                <span
                  style={{
                    fontSize: 12,
                    color: 'var(--text-secondary)',
                    fontFamily: 'monospace',
                    flex: 1,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {d}
                </span>
                <button
                  className="account-remove-btn"
                  onClick={async () => {
                    if (window.electronAPI) {
                      const dirs = await window.electronAPI.gameDirs.remove(d);
                      setGameDirs(dirs);
                      const newPath = await window.electronAPI.gameDirs.getVersionPath(version.id);
                      setVersionPath(newPath);
                    }
                  }}
                  title={t('common.remove')}
                >
                  <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                    <path d="M2 2l8 8M10 2l-8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                  </svg>
                </button>
              </div>
            ))}
          </div>
        )}
      </Section>

      <Section title={t('version.actions')}>
        <div className="quick-actions">
          <button className="btn btn--small btn--outline" onClick={() => openSubDir('mods')}>
            {t('version.open_mods_dir')}
          </button>
          <button className="btn btn--small btn--outline" onClick={() => openSubDir('resourcepacks')}>
            {t('version.open_resourcepacks_dir')}
          </button>
          <button className="btn btn--small btn--outline" onClick={() => openSubDir('saves')}>
            {t('version.open_saves_dir')}
          </button>
          <button className="btn btn--small btn--outline" onClick={() => openSubDir('screenshots')}>
            {t('version.open_screenshots_dir')}
          </button>
        </div>
      </Section>

      <Section title={t('version.adv_manage')}>
        <div className="quick-actions">
          <button className="btn btn--small btn--ghost" onClick={handleExportScript}>
            {t('version.export_script')}
          </button>
          <button className="btn btn--small btn--ghost">{t('version.complete_files')}</button>
          <button className="btn btn--small btn--danger">{t('version.delete')}</button>
        </div>
      </Section>
    </div>
  );
}

/* ────────── Settings Tab ────────── */
function TabSettings({ version }: { version: MinecraftVersion }) {
  const { t } = useI18n();
  const initial = loadLaunchSettings();
  const [memSlider, setMemSlider] = useState(initial.memoryMB);
  const [jvmArgs, setJvmArgs] = useState(initial.jvmArgs.join(' '));
  const [gameArgs, setGameArgs] = useState(initial.gameArgs.join(' '));

  const handleSave = () => {
    saveLaunchSettings({
      memoryMB: memSlider,
      jvmArgs: jvmArgs.split(/\s+/).filter(Boolean),
      gameArgs: gameArgs.split(/\s+/).filter(Boolean),
    });
    window.electronAPI?.showAlert(t('version.settings_saved'));
  };

  return (
    <div className="tab-pane">
      <Section title={t('version.basic_settings')}>
        <div className="form-group">
          <label className="form-label">{t('version.custom_name')}</label>
          <input className="form-input" type="text" defaultValue={version.id} placeholder={t('version.custom_name_placeholder')} />
        </div>
        <div className="form-group">
          <label className="form-label">{t('version.description')}</label>
          <textarea className="form-input form-textarea" rows={2} placeholder={t('version.description_placeholder')} />
        </div>
      </Section>

      <Section title={t('version.launch_opts')}>
        <div className="form-group">
          <label className="form-label">{t('version.isolation')}</label>
          <select className="form-input form-select" defaultValue="each">
            <option value="each">{t('version.isolation_each')}</option>
            <option value="none">{t('version.isolation_none')}</option>
          </select>
        </div>
        <div className="form-group">
          <label className="form-label">{t('version.window_title')}</label>
          <input className="form-input" type="text" placeholder="Minecraft" />
        </div>
      </Section>

      <Section title={t('version.java')}>
        <div className="form-group">
          <label className="form-label">{t('version.java_path')}</label>
          <div className="form-input-row">
            <input className="form-input" type="text" placeholder={t('version.java_auto')} readOnly />
            <button className="btn btn--small btn--outline">{t('common.browse')}</button>
          </div>
        </div>
        <div className="form-group">
          <label className="form-label">
            {t('version.memory')}: {memSlider} MB
          </label>
          <input
            type="range"
            className="form-range"
            min={512}
            max={16384}
            step={256}
            value={memSlider}
            onChange={(e) => setMemSlider(Number(e.target.value))}
          />
          <div className="form-range-labels">
            <span>{t('version.memory_min')}</span>
            <span>{t('version.memory_max')}</span>
          </div>
        </div>
        <div className="form-group">
          <label className="form-label">{t('version.jvm_args')}</label>
          <textarea
            className="form-input form-textarea form-textarea--code"
            rows={3}
            value={jvmArgs}
            onChange={(e) => setJvmArgs(e.target.value)}
            placeholder="-XX:+UnlockExperimentalVMOptions"
          />
        </div>
        <div className="form-group">
          <label className="form-label">{t('version.game_args')}</label>
          <input
            className="form-input"
            type="text"
            value={gameArgs}
            onChange={(e) => setGameArgs(e.target.value)}
            placeholder="--demo --server=..."
          />
        </div>
      </Section>

      <div className="detail-actions">
        <button className="btn btn--primary" onClick={handleSave}>
          {t('version.save_settings')}
        </button>
      </div>
    </div>
  );
}

/* ────────── Mods Tab (placeholder UI) ────────── */
function TabMods() {
  const { t } = useI18n();
  return (
    <div className="tab-pane">
      <div className="tab-toolbar">
        <button className="btn btn--primary btn--small">{t('version.download_mods')}</button>
        <button className="btn btn--outline btn--small">{t('version.open_mods_dir')}</button>
        <button className="btn btn--ghost btn--small">{t('version.check_updates')}</button>
      </div>
      <div className="mods-empty">
        <span className="mods-empty-icon">📦</span>
        <p>{t('version.no_mods')}</p>
        <p className="mods-empty-desc">{t('version.no_mods_desc')}</p>
      </div>
    </div>
  );
}

/* ────────── Export Tab (placeholder UI) ────────── */
function TabExport({ version }: { version: MinecraftVersion }) {
  const { t } = useI18n();
  const exportItems: { key: string; labelKey: I18nKey; defaultChecked: boolean }[] = [
    { key: 'game', labelKey: 'version.export_game', defaultChecked: true },
    { key: 'mods', labelKey: 'version.export_mods', defaultChecked: true },
    { key: 'resourcepacks', labelKey: 'version.export_resourcepacks', defaultChecked: false },
    { key: 'shaders', labelKey: 'version.export_shaders', defaultChecked: false },
    { key: 'saves', labelKey: 'version.export_saves', defaultChecked: false },
    { key: 'screenshots', labelKey: 'version.export_screenshots', defaultChecked: false },
    { key: 'options', labelKey: 'version.export_options', defaultChecked: false },
  ];

  return (
    <div className="tab-pane">
      <Section title={t('version.pack_info')}>
        <div className="form-group">
          <label className="form-label">{t('version.pack_name')}</label>
          <input className="form-input" type="text" placeholder={t('version.pack_name_placeholder', { version: version.id })} />
        </div>
        <div className="form-group">
          <label className="form-label">{t('version.pack_version')}</label>
          <input className="form-input" type="text" placeholder="1.0.0" />
        </div>
        <div className="form-group">
          <label className="form-label">{t('version.pack_author')}</label>
          <input className="form-input" type="text" placeholder={t('version.pack_author_placeholder')} />
        </div>
        <div className="form-group">
          <label className="form-label">{t('version.pack_desc')}</label>
          <textarea className="form-input form-textarea" rows={3} placeholder={t('version.pack_desc_placeholder')} />
        </div>
      </Section>

      <Section title={t('version.export_content')}>
        <div className="export-checklist">
          {exportItems.map((item) => (
            <label key={item.key} className="export-checkbox">
              <input type="checkbox" defaultChecked={item.defaultChecked} />
              <span>{t(item.labelKey)}</span>
            </label>
          ))}
        </div>
      </Section>

      <div className="export-actions">
        <button className="btn btn--primary">{t('version.export_start')}</button>
      </div>
    </div>
  );
}

/* ────────── Shared sub-components ────────── */
function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="detail-section">
      <h3 className="detail-section-title">{title}</h3>
      <div className="detail-section-body">{children}</div>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="info-row">
      <span className="info-row-label">{label}</span>
      <span className="info-row-value">{value}</span>
    </div>
  );
}
