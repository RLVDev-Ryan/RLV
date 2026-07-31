import { useState, useEffect, useCallback } from 'react';
import { useI18n } from '../hooks/useI18n';

interface VersionEntry {
  id: string;
  type: 'release' | 'snapshot' | 'old_beta' | 'old_alpha';
  releaseTime: string;
}

type FilterTab = 'release' | 'snapshot' | 'old_beta' | 'old_alpha';

const TYPE_LABELS: Record<VersionEntry['type'], string> = {
  release: 'download.release',
  snapshot: 'download.snapshot',
  old_beta: 'download.beta',
  old_alpha: 'download.old',
};

const LOADER_KEYS = ['vanilla', 'fabric', 'forge', 'neoforge', 'quilt'] as const;

const FILTERS: { key: FilterTab; labelKey: string }[] = [
  { key: 'release', labelKey: 'download.release' },
  { key: 'snapshot', labelKey: 'download.snapshot' },
  { key: 'old_beta', labelKey: 'download.beta' },
  { key: 'old_alpha', labelKey: 'download.old' },
];

export default function DownloadPage() {
  const { t } = useI18n();
  const [versions, setVersions] = useState<VersionEntry[]>([]);
  const [filter, setFilter] = useState<FilterTab>('release');
  const [sort, setSort] = useState<'desc' | 'asc'>('desc');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [selectedVersion, setSelectedVersion] = useState<VersionEntry | null>(null);
  const [showMore, setShowMore] = useState(false);
  const [downloading, setDownloading] = useState<string | null>(null);
  const [progress, setProgress] = useState<{
    versionId: string;
    stage: string;
    percent: number;
    error?: string;
  } | null>(null);

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
    async (versionId: string) => {
      if (!window.electronAPI) return;
      setDownloading(versionId);
      setProgress({ versionId, stage: 'manifest', percent: 0 });
      try {
        await window.electronAPI.download.start(versionId);
      } catch {
        setDownloading(null);
      }
    },
    [],
  );

  // Detail view
  if (selectedVersion) {
    const visibleLoaders = showMore ? LOADER_KEYS : LOADER_KEYS.slice(0, 4);
    return (
      <div className="page download-page">
        <button className="version-detail-back" onClick={() => setSelectedVersion(null)} style={{ marginBottom: 20 }}>
          <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
            <path d="M11 4L6 9l5 5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <span>{t('download.back')}</span>
        </button>

        <h2 className="page-title" style={{ marginBottom: 4 }}>
          {selectedVersion.id}
        </h2>
        <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 24 }}>
          {t(TYPE_LABELS[selectedVersion.type] as any)} ·{' '}
          {new Date(selectedVersion.releaseTime).toLocaleDateString(navigator.language)}
        </p>

        <div className="download-detail-loaders">
          {visibleLoaders.map((loaderKey) => {
            const lk = loaderKey as string;
            const dlKey = `${selectedVersion.id}-${lk}`;
            const isDownloading = downloading === dlKey;
            const isDone = progress?.versionId === dlKey && progress?.stage === 'done';
            const hasError = progress?.versionId === dlKey && progress?.stage === 'error';
            const pct = progress?.versionId === dlKey ? progress.percent : 0;

            return (
              <div key={lk} className="download-loader-card">
                <div className="download-loader-info">
                  <span className="download-loader-name">{t(`download.loader.${lk}` as any)}</span>
                  <span className="download-loader-desc">{t(`download.loader.${lk}_desc` as any)}</span>
                </div>
                {isDownloading ? (
                  <div className="download-progress-tag">
                    <span className="download-progress-bar" style={{ width: `${pct}%` }} />
                    <span className="download-progress-text">
                      {hasError ? t('download.failed') : `${pct}%`}
                    </span>
                  </div>
                ) : (
                  <button
                    className="btn btn--small btn--primary"
                    onClick={() => handleDownloadVersion(dlKey)}
                    disabled={downloading !== null}
                  >
                    {isDone ? t('download.installed') : t('download.download')}
                  </button>
                )}
              </div>
            );
          })}
        </div>

        {!showMore && (
          <button
            className="btn btn--small btn--ghost"
            onClick={() => setShowMore(true)}
            style={{ marginTop: 8 }}
          >
            {t('download.more_loaders')}
          </button>
        )}
      </div>
    );
  }

  // List view
  return (
    <div className="page download-page">
      <div className="download-toolbar">
        <div className="download-tabs">
          {FILTERS.map((f) => (
            <button
              key={f.key}
              className={`download-tab${filter === f.key ? ' download-tab--active' : ''}`}
              onClick={() => setFilter(f.key)}
            >
              {t(f.labelKey as any)}
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
            <span className="version-card-tag version-card-tag--release">
              {t(TYPE_LABELS[v.type] as any)}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
