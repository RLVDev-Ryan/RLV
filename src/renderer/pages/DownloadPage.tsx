import { useState, useEffect, useCallback } from 'react';
import { Puzzle, Sun, Palette, Package, Boxes, Globe, Wrench, Gamepad2 } from 'lucide-react';
import { useI18n, type I18nKey } from '../hooks/useI18n';
import type { VersionManifestEntry, LoaderInstallProgress } from '../../shared/constants';
import ModrinthSearch from '../components/ModrinthSearch';

type FilterTab = 'release' | 'snapshot' | 'old_beta' | 'old_alpha';

const TYPE_LABELS: Record<VersionManifestEntry['type'], I18nKey> = {
  release: 'download.release',
  snapshot: 'download.snapshot',
  old_beta: 'download.beta',
  old_alpha: 'download.old',
};

const LOADER_KEYS = ['vanilla', 'fabric', 'forge', 'neoforge', 'quilt'] as const;

const FILTERS: { key: FilterTab; labelKey: I18nKey }[] = [
  { key: 'release', labelKey: 'download.release' },
  { key: 'snapshot', labelKey: 'download.snapshot' },
  { key: 'old_beta', labelKey: 'download.beta' },
  { key: 'old_alpha', labelKey: 'download.old' },
];

/** Circular-hub categories around the central "game" button. Icons: Lucide. */
const HUB_ITEMS = [
  { key: 'mod', icon: <Puzzle size={26} />, labelKey: 'download.cat.mod' },
  { key: 'shader', icon: <Sun size={26} />, labelKey: 'download.cat.shader' },
  { key: 'resourcepack', icon: <Palette size={26} />, labelKey: 'download.cat.resourcepack' },
  { key: 'datapack', icon: <Package size={26} />, labelKey: 'download.cat.datapack' },
  { key: 'modpack', icon: <Boxes size={26} />, labelKey: 'download.cat.modpack' },
  { key: 'world', icon: <Globe size={26} />, labelKey: 'download.cat.world' },
  { key: 'installer', icon: <Wrench size={26} />, labelKey: 'download.cat.installer' },
] as const;

const GAME_VERSIONS = [
  '1.21.1',
  '1.21',
  '1.20.4',
  '1.20.1',
  '1.19.4',
  '1.19.2',
  '1.18.2',
  '1.17.1',
  '1.16.5',
  '1.12.2',
  '1.8.9',
];

const LOADER_OPTIONS = [
  { value: '', labelKey: 'mods.any_loader' },
  { value: 'fabric', labelKey: 'Fabric' },
  { value: 'forge', labelKey: 'Forge' },
  { value: 'neoforge', labelKey: 'NeoForge' },
  { value: 'quilt', labelKey: 'Quilt' },
];

type View = 'hub' | 'game' | (typeof HUB_ITEMS)[number]['key'];

export default function DownloadPage() {
  const [view, setView] = useState<View>('hub');

  return (
    <div className="page download-page">
      {view === 'hub' && <CircularHub onSelect={setView} />}
      {view === 'game' && <GameDownloader onBack={() => setView('hub')} />}
      {view !== 'hub' && view !== 'game' && <CategoryView category={view} onBack={() => setView('hub')} />}
    </div>
  );
}

/* ── Circular hub ── */
function CircularHub({ onSelect }: { onSelect: (v: View) => void }) {
  const { t } = useI18n();
  const radius = 148;

  return (
    <div className="download-hub">
      <h2 className="download-hub-title">{t('download.title')}</h2>
      <div className="download-hub-ring">
        {/* Center: game */}
        <button className="hub-btn hub-btn--center" onClick={() => onSelect('game')}>
          <span className="hub-btn-icon">
            <Gamepad2 size={30} />
          </span>
          <span className="hub-btn-label">{t('download.cat.game')}</span>
        </button>

        {/* Surrounding categories */}
        {HUB_ITEMS.map((item, i) => {
          const angle = (i / HUB_ITEMS.length) * 2 * Math.PI - Math.PI / 2;
          const x = Math.cos(angle) * radius;
          const y = Math.sin(angle) * radius;
          return (
            <button
              key={item.key}
              className="hub-btn"
              style={{ translate: `${x}px ${y}px` }}
              onClick={() => onSelect(item.key)}
            >
              <span className="hub-btn-icon">{item.icon}</span>
              <span className="hub-btn-label">{t(item.labelKey as I18nKey)}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

/* ── Category sub-view (Modrinth with filters) ── */
function CategoryView({ category, onBack }: { category: string; onBack: () => void }) {
  const { t } = useI18n();
  const [type, setType] = useState(category);
  const [version, setVersion] = useState('');
  const [loader, setLoader] = useState('');
  const [gameDir, setGameDir] = useState('');

  useEffect(() => {
    if (!window.electronAPI) return;
    window.electronAPI.gameDirs.getDefault().then(setGameDir);
  }, []);

  const labelKey = HUB_ITEMS.find((h) => h.key === type)?.labelKey ?? 'download.cat.mod';

  return (
    <div className="download-category">
      <button className="version-detail-back" onClick={onBack} style={{ marginBottom: 16 }}>
        <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
          <path d="M11 4L6 9l5 5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        <span>{t('download.back')}</span>
      </button>

      <h2 className="page-title" style={{ marginBottom: 16 }}>
        {t(labelKey as I18nKey)}
      </h2>

      {type === 'installer' ? (
        <div className="mods-empty">
          <span className="mods-empty-icon">
            <Wrench size={32} />
          </span>
          <p>{t('download.installer_empty')}</p>
        </div>
      ) : (
        <>
          {/* Filters */}
          <div className="download-cat-filters">
            <select
              className="form-input form-select"
              value={type}
              onChange={(e) => setType(e.target.value)}
              style={{ width: 130 }}
            >
              {HUB_ITEMS.map((h) => (
                <option key={h.key} value={h.key}>
                  {t(h.labelKey as I18nKey)}
                </option>
              ))}
            </select>
            <input
              className="form-input"
              list="rlv-game-versions"
              value={version}
              onChange={(e) => setVersion(e.target.value)}
              placeholder={t('download.all_versions')}
              style={{ width: 120 }}
            />
            <datalist id="rlv-game-versions">
              {GAME_VERSIONS.map((v) => (
                <option key={v} value={v} />
              ))}
            </datalist>
            <select
              className="form-input form-select"
              value={loader}
              onChange={(e) => setLoader(e.target.value)}
              style={{ width: 120 }}
            >
              {LOADER_OPTIONS.map((l) => (
                <option key={l.value} value={l.value}>
                  {l.labelKey.startsWith('mods.') ? t(l.labelKey as I18nKey) : l.labelKey}
                </option>
              ))}
            </select>
          </div>

          <ModrinthSearch
            key={`${type}-${version}-${loader}`}
            category={type}
            gameVersion={version}
            loader={type === 'mod' ? loader : null}
            gameDir={gameDir}
          />
        </>
      )}
    </div>
  );
}

/* ── Game downloader (existing version list + detail) ── */
function GameDownloader({ onBack }: { onBack: () => void }) {
  const { t } = useI18n();
  const [versions, setVersions] = useState<VersionManifestEntry[]>([]);
  const [filter, setFilter] = useState<FilterTab>('release');
  const [sort, setSort] = useState<'desc' | 'asc'>('desc');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [selectedVersion, setSelectedVersion] = useState<VersionManifestEntry | null>(null);
  const [showMore, setShowMore] = useState(false);
  const [downloading, setDownloading] = useState<string | null>(null);
  const [progress, setProgress] = useState<{
    versionId: string;
    stage: string;
    percent: number;
    error?: string;
  } | null>(null);
  const [loaderProgress, setLoaderProgress] = useState<Record<string, LoaderInstallProgress>>({});

  useEffect(() => {
    loadVersions();
  }, []);

  useEffect(() => {
    if (!window.electronAPI) return;
    const cleanup = window.electronAPI.download.onProgress((p) => {
      setProgress(p);
      if (p.stage === 'done' || p.stage === 'error') setDownloading(null);
    });
    return cleanup;
  }, []);

  useEffect(() => {
    if (!window.electronAPI) return;
    return window.electronAPI.loader.onProgress((p) => {
      const key = `${p.loader}:${p.gameVersion}`;
      setLoaderProgress((prev) => ({ ...prev, [key]: p }));
      if (p.stage === 'done') {
        setTimeout(() => {
          setLoaderProgress((prev) => {
            const next = { ...prev };
            delete next[key];
            return next;
          });
        }, 4000);
      }
    });
  }, []);

  const loadVersions = async () => {
    if (!window.electronAPI) return;
    setLoading(true);
    try {
      const result = await window.electronAPI.download.listVersions();
      if (result.success) setVersions(result.versions);
    } catch {}
    setLoading(false);
  };

  const filtered = versions
    .filter((v) => v.type === filter)
    .filter((v) => (search ? v.id.toLowerCase().includes(search.toLowerCase()) : true))
    .sort((a, b) => {
      const da = new Date(a.releaseTime).getTime();
      const db = new Date(b.releaseTime).getTime();
      return sort === 'desc' ? db - da : da - db;
    });

  const handleDownloadVersion = useCallback(
    async (baseVersionId: string, loaderKey: string) => {
      if (!window.electronAPI) return;
      if (loaderKey !== 'vanilla') {
        // Install a mod loader on top of the vanilla version.
        const result = await window.electronAPI.loader.install(loaderKey as never, baseVersionId);
        if (!result.success) {
          await window.electronAPI.showAlert(result.error || t('download.loader_install_failed'));
        }
        return;
      }
      const versionId = baseVersionId;
      setDownloading(versionId);
      setProgress({ versionId, stage: 'manifest', percent: 0 });
      try {
        await window.electronAPI.download.start(versionId);
      } catch {
        setDownloading(null);
      }
    },
    [t],
  );

  if (selectedVersion) {
    const visibleLoaders = showMore ? LOADER_KEYS : LOADER_KEYS.slice(0, 4);
    return (
      <div className="download-page">
        <button className="version-detail-back" onClick={() => setSelectedVersion(null)} style={{ marginBottom: 20 }}>
          <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
            <path
              d="M11 4L6 9l5 5"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          <span>{t('download.back')}</span>
        </button>

        <h2 className="page-title" style={{ marginBottom: 4 }}>
          {selectedVersion.id}
        </h2>
        <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 24 }}>
          {t(TYPE_LABELS[selectedVersion.type])} ·{' '}
          {new Date(selectedVersion.releaseTime).toLocaleDateString(navigator.language)}
        </p>

        <div className="download-detail-loaders">
          {visibleLoaders.map((loaderKey) => {
            const lk = loaderKey as string;
            const dlKey = lk === 'vanilla' ? selectedVersion.id : `${selectedVersion.id}-${lk}`;
            const isDownloading = downloading === dlKey;
            const isDone = progress?.versionId === dlKey && progress?.stage === 'done';
            const hasError = progress?.versionId === dlKey && progress?.stage === 'error';
            const pct = progress?.versionId === dlKey ? progress.percent : 0;
            const lp = loaderProgress[`${lk}:${selectedVersion.id}`];
            const installing = !!lp && lp.stage !== 'done';

            return (
              <div key={lk} className="download-loader-card">
                <div className="download-loader-info">
                  <span className="download-loader-name">{t(`download.loader.${lk}` as I18nKey)}</span>
                  <span className="download-loader-desc">{t(`download.loader.${lk}_desc` as I18nKey)}</span>
                </div>
                {installing ? (
                  <div className="download-progress-tag">
                    <span className="download-progress-bar" style={{ width: `${lp.percent}%` }} />
                    <span className="download-progress-text">{lp.message || `${lp.percent}%`}</span>
                  </div>
                ) : isDownloading ? (
                  <div className="download-progress-tag">
                    <span className="download-progress-bar" style={{ width: `${pct}%` }} />
                    <span className="download-progress-text">{hasError ? t('download.failed') : `${pct}%`}</span>
                  </div>
                ) : (
                  <button
                    className="btn btn--small btn--primary"
                    onClick={() => handleDownloadVersion(selectedVersion.id, lk)}
                    disabled={downloading !== null}
                  >
                    {isDone ? t('download.installed') : t('download.download')}
                  </button>
                )}
              </div>
            );
          })}
        </div>

        <button className="btn btn--small btn--ghost" onClick={() => setShowMore(!showMore)} style={{ marginTop: 8 }}>
          {showMore ? t('download.collapse_loaders') : t('download.more_loaders')}
        </button>
      </div>
    );
  }

  return (
    <div className="download-page">
      <button className="version-detail-back" onClick={onBack} style={{ marginBottom: 16 }}>
        <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
          <path d="M11 4L6 9l5 5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        <span>{t('download.back')}</span>
      </button>

      <div className="download-toolbar">
        <div className="download-tabs">
          {FILTERS.map((f) => (
            <button
              key={f.key}
              className={`download-tab${filter === f.key ? ' download-tab--active' : ''}`}
              onClick={() => setFilter(f.key)}
            >
              {t(f.labelKey)}
            </button>
          ))}
        </div>
        <div className="download-actions">
          <input
            className="form-input"
            type="text"
            placeholder={t('download.search')}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ width: 180 }}
          />
          <button className="btn btn--small btn--outline" onClick={() => setSort(sort === 'desc' ? 'asc' : 'desc')}>
            {sort === 'desc' ? t('download.sort_newest') : t('download.sort_oldest')}
          </button>
          <button className="btn btn--small btn--outline" onClick={loadVersions} disabled={loading}>
            {loading ? t('download.loading') : t('download.refresh')}
          </button>
        </div>
      </div>

      <div className="download-list">
        {loading && <div className="download-empty">{t('download.loading')}</div>}
        {!loading && filtered.length === 0 && <div className="download-empty">{t('download.no_match')}</div>}
        {filtered.map((v) => (
          <button key={v.id} className="version-card" onClick={() => setSelectedVersion(v)}>
            <div className="version-card-left">
              <div className="version-card-info">
                <span className="version-card-name">{v.id}</span>
                <span className="version-card-date">
                  {new Date(v.releaseTime).toLocaleDateString(navigator.language)}
                </span>
              </div>
            </div>
            <span className="version-card-tag version-card-tag--release">{t(TYPE_LABELS[v.type])}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
