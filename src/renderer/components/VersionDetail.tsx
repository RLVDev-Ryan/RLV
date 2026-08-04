import { useState, useEffect, useCallback } from 'react';
import { LOADER_META, getBaseVersion } from '../../shared/constants';
import type { MinecraftVersion, ModrinthHit, ModrinthFile, ModrinthProgress } from '../../shared/constants';
import { formatDate, loadLaunchSettings, saveLaunchSettings } from '../../shared/utils';
import { ICON_PRESETS, loadVersionSettings, saveVersionSettings, resolveIcon } from '../../shared/versionSettings';
import CropModal from './CropModal';
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
        {activeTab === 'overview' && <TabOverview version={version} onBack={onBack} />}
        {activeTab === 'settings' && <TabSettings version={version} />}
        {activeTab === 'mods' && <TabMods version={version} />}
        {activeTab === 'export' && <TabExport version={version} />}
      </div>
    </div>
  );
}

/* ────────── Overview Tab ────────── */
function TabOverview({ version, onBack }: { version: MinecraftVersion; onBack: () => void }) {
  const { t } = useI18n();
  const [versionPath, setVersionPath] = useState('');
  const [versionGameDir, setVersionGameDir] = useState('');
  const [gameDirs, setGameDirs] = useState<string[]>([]);

  useEffect(() => {
    if (window.electronAPI) {
      // Resolve this version's ACTUAL game dir (it may live in a non-default dir).
      window.electronAPI.gameDirs.scanVersions().then((list) => {
        const hit = list.find((v) => v.id === version.id);
        setVersionGameDir(hit?.gameDir ?? '');
      });
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

  /** Open a sub-directory of this version's actual location, respecting isolation. */
  const openSubDir = async (sub: string) => {
    if (!window.electronAPI) return;
    if (!versionGameDir) return;
    const isolation = loadLaunchSettings().isolation;
    const base = isolation ? `${versionGameDir}/versions/${version.id}` : versionGameDir;
    await window.electronAPI.openPath(`${base}/${sub}`);
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

  const handleCompleteFiles = async () => {
    if (!window.electronAPI) return;
    const result = await window.electronAPI.gameDirs.completeFiles(version.id);
    await window.electronAPI.showAlert(result.success ? t('version.complete_done') : result.error || t('version.complete_failed'));
  };

  const handleDeleteVersion = async () => {
    if (!window.electronAPI) return;
    if (!window.confirm(t('version.delete_confirm'))) return;
    const result = await window.electronAPI.gameDirs.deleteVersion(version.id);
    if (result.success) {
      onBack();
    } else {
      await window.electronAPI.showAlert(result.error || t('version.delete_failed'));
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
        <InfoRow label={t('version.game_dir')} value={versionGameDir || t('version.fetching')} />
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
          <button className="btn btn--small btn--ghost" onClick={handleCompleteFiles}>
            {t('version.complete_files')}
          </button>
          <button className="btn btn--small btn--danger" onClick={handleDeleteVersion}>
            {t('version.delete')}
          </button>
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
      ...loadLaunchSettings(),
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
          <select
            className="form-input form-select"
            value={loadLaunchSettings().isolation ? 'each' : 'none'}
            onChange={(e) =>
              saveLaunchSettings({ ...loadLaunchSettings(), isolation: e.target.value === 'each' })
            }
          >
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
            <input
              className="form-input"
              type="text"
              placeholder={t('version.java_auto')}
              value={loadLaunchSettings().javaPath ?? ''}
              onChange={(e) =>
                saveLaunchSettings({ ...loadLaunchSettings(), javaPath: e.target.value || null })
              }
            />
            <button
              className="btn btn--small btn--outline"
              onClick={async () => {
                const file = await window.electronAPI?.openFile();
                if (file) saveLaunchSettings({ ...loadLaunchSettings(), javaPath: file });
              }}
            >
              {t('common.browse')}
            </button>
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

      <Section title={t('version.icon_settings')}>
        <IconSettings versionId={version.id} loader={version.loader} />
      </Section>

      <div className="detail-actions">
        <button className="btn btn--primary" onClick={handleSave}>
          {t('version.save_settings')}
        </button>
      </div>
    </div>
  );
}

/* ── Icon settings (launch / list / selector) ── */
const ICON_SLOTS: { key: 'iconLaunch' | 'iconList' | 'iconSelector'; labelKey: I18nKey }[] = [
  { key: 'iconLaunch', labelKey: 'version.icon_launch' },
  { key: 'iconList', labelKey: 'version.icon_list' },
  { key: 'iconSelector', labelKey: 'version.icon_selector' },
];

function IconSettings({ versionId, loader }: { versionId: string; loader?: string | null }) {
  const { t } = useI18n();
  const [settings, setSettings] = useState(() => loadVersionSettings(versionId));
  const [crop, setCrop] = useState<{ slot: (typeof ICON_SLOTS)[number]['key']; src: string } | null>(null);

  const apply = (key: (typeof ICON_SLOTS)[number]['key'], value: string) => {
    setSettings(saveVersionSettings(versionId, { [key]: value }));
  };

  const handleUpload = (key: (typeof ICON_SLOTS)[number]['key']) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.onchange = () => {
      const file = input.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => setCrop({ slot: key, src: String(reader.result) });
      reader.readAsDataURL(file);
    };
    input.click();
  };

  return (
    <div className="icon-settings">
      {ICON_SLOTS.map((slot) => (
        <div key={slot.key} className="icon-settings-row">
          <div className="icon-settings-preview">
            <img
              src={resolveIcon(settings[slot.key], loader)}
              alt=""
              className="icon-settings-preview-img"
              draggable={false}
            />
          </div>
          <div className="icon-settings-main">
            <span className="icon-settings-label">{t(slot.labelKey)}</span>
            <div className="icon-settings-presets">
              <button
                className={`icon-preset-btn icon-preset-btn--text${settings[slot.key] === 'default' ? ' icon-preset-btn--active' : ''}`}
                onClick={() => apply(slot.key, 'default')}
              >
                {t('version.icon_default')}
              </button>
              {ICON_PRESETS.map((p) => (
                <button
                  key={p.key}
                  className={`icon-preset-btn${settings[slot.key] === p.key ? ' icon-preset-btn--active' : ''}`}
                  onClick={() => apply(slot.key, p.key)}
                  title={p.label}
                >
                  <img src={p.src} alt={p.label} draggable={false} />
                </button>
              ))}
            </div>
          </div>
          <button className="btn btn--small btn--outline" onClick={() => handleUpload(slot.key)}>
            {t('version.icon_upload')}
          </button>
        </div>
      ))}
      <p className="icon-settings-hint">{t('version.icon_crop_hint')}</p>

      {crop && (
        <CropModal
          src={crop.src}
          onCancel={() => setCrop(null)}
          onConfirm={(url) => {
            apply(crop.slot, url);
            setCrop(null);
          }}
        />
      )}
    </div>
  );
}

/* ────────── Mods Tab (Modrinth browser) ────────── */
const MODRINTH_API = 'https://api.modrinth.com/v2';

function TabMods({ version }: { version: MinecraftVersion }) {
  const { t } = useI18n();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<ModrinthHit[]>([]);
  const [loading, setLoading] = useState(true);
  const [searched, setSearched] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [gameDir, setGameDir] = useState('');
  const [progress, setProgress] = useState<Record<string, ModrinthProgress>>({});
  const [gameDirs, setGameDirs] = useState<string[]>([]);
  const [completed, setCompleted] = useState<Record<string, boolean>>({});

  const gameVersion = getBaseVersion(version.id);
  const loader = version.loader ?? null;

  // Resolve this version's game dir (the mods folder lives next to it).
  useEffect(() => {
    if (!window.electronAPI) return;
    (async () => {
      const list = await window.electronAPI.gameDirs.scanVersions();
      const hit = list.find((v) => v.id === version.id);
      setGameDir(hit?.gameDir ?? (await window.electronAPI.gameDirs.getDefault()));
    })();
  }, [version.id]);

  // "Open mods dir" needs the game dir list too.
  useEffect(() => {
    if (!window.electronAPI) return;
    window.electronAPI.gameDirs.getAll().then(setGameDirs);
  }, []);

  // Subscribe to per-file download progress (keyed by project id).
  useEffect(() => {
    if (!window.electronAPI) return;
    return window.electronAPI.modrinth.onProgress((p) => {
      const key = p.projectId ?? p.filename;
      setProgress((prev) => ({ ...prev, [key]: p }));
      if (p.stage === 'done') {
        setCompleted((prev) => ({ ...prev, [key]: true }));
        setTimeout(() => {
          setProgress((prev) => {
            const next = { ...prev };
            delete next[key];
            return next;
          });
          setCompleted((prev) => ({ ...prev, [key]: false }));
        }, 4000);
      }
    });
  }, []);

  const doSearch = useCallback(
    async (q: string) => {
      if (!window.electronAPI) return;
      setLoading(true);
      setError(null);
      try {
        const facets: string[] = [`["versions:${gameVersion}"]`];
        if (loader) facets.push(`["categories:${loader}"]`);
        const url = `${MODRINTH_API}/search?query=${encodeURIComponent(q)}&facets=${encodeURIComponent(
          JSON.stringify(facets),
        )}&limit=24&index=${q ? 'relevance' : 'downloads'}`;
        const res = await fetch(url);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        setResults(Array.isArray(data.hits) ? data.hits : []);
      } catch {
        setError(t('mods.search_failed'));
      }
      setLoading(false);
      setSearched(true);
    },
    [gameVersion, loader, t],
  );

  // Initial search: popular mods for this game version + loader.
  useEffect(() => {
    doSearch('');
  }, [doSearch]);

  const handleDownload = async (hit: ModrinthHit) => {
    if (!window.electronAPI || !gameDir) return;
    try {
      const loaders = loader ? [loader] : [];
      const vurl = `${MODRINTH_API}/project/${hit.project_id}/version?game_versions=${encodeURIComponent(
        JSON.stringify([gameVersion]),
      )}&loaders=${encodeURIComponent(JSON.stringify(loaders))}`;
      const res = await fetch(vurl);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const versions = (await res.json()) as Array<{ files?: ModrinthFile[] }>;
      if (!Array.isArray(versions) || versions.length === 0) {
        await window.electronAPI.showAlert(t('mods.no_version_for_game'));
        return;
      }
      const files = versions[0].files ?? [];
      const file = files.find((f) => f.primary) ?? files[0];
      if (!file) {
        await window.electronAPI.showAlert(t('mods.no_file'));
        return;
      }
      const result = await window.electronAPI.modrinth.download({
        url: file.url,
        filename: file.filename,
        gameDir,
        projectId: hit.project_id,
      });
      if (!result.success) {
        await window.electronAPI.showAlert(result.error || t('mods.download_failed'));
      }
    } catch {
      await window.electronAPI.showAlert(t('mods.download_failed'));
    }
  };

  const openModsDir = async () => {
    if (!window.electronAPI) return;
    const dir = gameDir || gameDirs[0];
    if (dir) await window.electronAPI.openPath(`${dir}/mods`);
  };

  const openExternal = async (url: string) => {
    if (window.electronAPI) await window.electronAPI.openExternal(url);
  };

  const formatDownloads = (n: number) =>
    n >= 1_000_000 ? `${(n / 1_000_000).toFixed(1)}M` : n >= 1_000 ? `${Math.round(n / 1_000)}K` : String(n);

  // Vanilla versions cannot load mods.
  if (!version.loader) {
    return (
      <div className="tab-pane">
        <div className="mods-empty">
          <span className="mods-empty-icon">📦</span>
          <p>{t('mods.vanilla_no_mods')}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="tab-pane mods-tab">
      <div className="tab-toolbar mods-toolbar">
        <input
          className="form-input"
          type="text"
          placeholder={t('mods.search_placeholder')}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') doSearch(query.trim());
          }}
          style={{ flex: 1, minWidth: 0 }}
        />
        <button className="btn btn--primary btn--small" onClick={() => doSearch(query.trim())} disabled={loading}>
          {t('mods.search')}
        </button>
        <button className="btn btn--outline btn--small" onClick={openModsDir}>
          {t('version.open_mods_dir')}
        </button>
      </div>

      <div className="mods-meta">
        {t('mods.filter_for', { version: gameVersion, loader: loader ? loader : t('mods.any_loader') })}
      </div>

      {error && <div className="mods-error">{error}</div>}

      {loading ? (
        <div className="mods-empty">
          <span className="mods-empty-icon">📦</span>
          <p>{t('mods.loading')}</p>
        </div>
      ) : (
        <>
          {searched && results.length === 0 && (
            <div className="mods-empty">
              <span className="mods-empty-icon">🔍</span>
              <p>{t('mods.no_results')}</p>
            </div>
          )}

          <div className="mods-list">
            {results.map((hit) => (
              <ModCard
                key={hit.project_id}
                hit={hit}
                progress={progress[hit.project_id]}
                done={completed[hit.project_id]}
                onDownload={() => handleDownload(hit)}
                formatDownloads={formatDownloads}
              />
            ))}
          </div>
        </>
      )}

      {/* Fallback links when Modrinth doesn't have what the user needs */}
      <div className="mods-fallback">
        <span className="mods-fallback-text">{t('mods.no_wanted')}</span>
        <button className="mods-fallback-link" onClick={() => openExternal('https://www.mcmod.cn/')}>
          {t('mods.link_mcmod')}
        </button>
        <span className="mods-fallback-sep">|</span>
        <button className="mods-fallback-link" onClick={() => openExternal('https://www.curseforge.com/minecraft')}>
          {t('mods.link_curseforge')}
        </button>
      </div>
    </div>
  );
}

function ModCard({
  hit,
  progress,
  done,
  onDownload,
  formatDownloads,
}: {
  hit: ModrinthHit;
  progress?: ModrinthProgress;
  done?: boolean;
  onDownload: () => void;
  formatDownloads: (n: number) => string;
}) {
  const { t } = useI18n();
  const downloading = progress?.stage === 'downloading';
  const hasError = progress?.stage === 'error';

  return (
    <div className="mod-card">
      <img className="mod-card-icon" src={hit.icon_url || 'assets/icons/grass.png'} alt="" loading="lazy" />
      <div className="mod-card-info">
        <span className="mod-card-title">{hit.title}</span>
        <span className="mod-card-desc">{hit.description}</span>
      </div>
      <div className="mod-card-side">
        <span className="mod-card-downloads">⬇ {formatDownloads(hit.downloads)}</span>
        {downloading ? (
          <div className="mod-card-progress">
            <span className="download-progress-bar" style={{ width: `${progress?.percent ?? 0}%` }} />
            <span className="download-progress-text">{progress?.percent ?? 0}%</span>
          </div>
        ) : hasError ? (
          <button className="btn btn--small btn--primary" onClick={onDownload}>
            {t('mods.retry')}
          </button>
        ) : done ? (
          <span className="mod-card-done">{t('mods.installed')}</span>
        ) : (
          <button className="btn btn--small btn--primary" onClick={onDownload}>
            {t('mods.download')}
          </button>
        )}
      </div>
    </div>
  );
}

/* ────────── Export Tab (modpack zip) ────────── */
function TabExport({ version }: { version: MinecraftVersion }) {
  const { t } = useI18n();
  const [items, setItems] = useState({
    mods: true,
    resourcepacks: false,
    shaders: false,
    saves: false,
    screenshots: false,
    options: false,
  });
  const [exporting, setExporting] = useState(false);

  const exportItems: { key: keyof typeof items; labelKey: I18nKey }[] = [
    { key: 'mods', labelKey: 'version.export_mods' },
    { key: 'resourcepacks', labelKey: 'version.export_resourcepacks' },
    { key: 'shaders', labelKey: 'version.export_shaders' },
    { key: 'saves', labelKey: 'version.export_saves' },
    { key: 'screenshots', labelKey: 'version.export_screenshots' },
    { key: 'options', labelKey: 'version.export_options' },
  ];

  const handleExport = async () => {
    if (!window.electronAPI) return;
    setExporting(true);
    try {
      const result = await window.electronAPI.modpack.export(version.id, {
        includeMods: items.mods,
        includeResourcepacks: items.resourcepacks,
        includeShaders: items.shaders,
        includeSaves: items.saves,
        includeScreenshots: items.screenshots,
        includeOptions: items.options,
      });
      if (result.success && result.path) {
        await window.electronAPI.showAlert(`${t('version.exported_to')}\n${result.path}`);
      } else if (!result.success && result.error !== '已取消') {
        await window.electronAPI.showAlert(result.error || t('version.export_failed'));
      }
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="tab-pane">
      <Section title={t('version.export_content')}>
        <div className="export-checklist">
          {exportItems.map((item) => (
            <label key={item.key} className="export-checkbox">
              <input
                type="checkbox"
                checked={items[item.key]}
                onChange={(e) => setItems((prev) => ({ ...prev, [item.key]: e.target.checked }))}
              />
              <span>{t(item.labelKey)}</span>
            </label>
          ))}
        </div>
      </Section>

      <div className="export-actions">
        <button className="btn btn--primary" onClick={handleExport} disabled={exporting}>
          {exporting ? t('version.exporting') : t('version.export_start')}
        </button>
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
