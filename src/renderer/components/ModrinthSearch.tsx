import { useState, useEffect, useCallback } from 'react';
import { useI18n } from '../hooks/useI18n';
import type { ModrinthHit, ModrinthFile, ModrinthProgress } from '../../shared/constants';

const MODRINTH_API = 'https://api.modrinth.com/v2';

/** Modrinth category → facet value (empty string = no facet).
 *  Modrinth has no "world" project type, so world searches everything. */
export const CATEGORY_FACETS: Record<string, string> = {
  mod: 'mod',
  shader: 'shader',
  resourcepack: 'resourcepack',
  datapack: 'datapack',
  modpack: 'modpack',
  world: '',
  installer: '',
};

export const CATEGORY_LABEL_KEYS: Record<string, string> = {
  mod: 'download.cat.mod',
  shader: 'download.cat.shader',
  resourcepack: 'download.cat.resourcepack',
  datapack: 'download.cat.datapack',
  modpack: 'download.cat.modpack',
  world: 'download.cat.world',
  installer: 'download.cat.installer',
};

interface ModrinthSearchProps {
  category: string;
  gameVersion: string;
  loader?: string | null;
  gameDir: string;
}

export default function ModrinthSearch({ category, gameVersion, loader, gameDir }: ModrinthSearchProps) {
  const { t } = useI18n();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<ModrinthHit[]>([]);
  const [loading, setLoading] = useState(true);
  const [searched, setSearched] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState<Record<string, ModrinthProgress>>({});
  const [completed, setCompleted] = useState<Record<string, boolean>>({});

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
        const facets: string[] = [];
        const catFacet = CATEGORY_FACETS[category];
        if (catFacet) facets.push(`["categories:${catFacet}"]`);
        if (gameVersion) facets.push(`["versions:${gameVersion}"]`);
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
    [category, gameVersion, loader, t],
  );

  useEffect(() => {
    doSearch('');
  }, [doSearch]);

  const handleDownload = async (hit: ModrinthHit) => {
    if (!window.electronAPI || !gameDir) return;
    try {
      const loaders = loader ? [loader] : [];
      const vurl = `${MODRINTH_API}/project/${hit.project_id}/version?game_versions=${encodeURIComponent(
        JSON.stringify(gameVersion ? [gameVersion] : []),
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

  const formatDownloads = (n: number) =>
    n >= 1_000_000 ? `${(n / 1_000_000).toFixed(1)}M` : n >= 1_000 ? `${Math.round(n / 1_000)}K` : String(n);

  return (
    <div className="mods-browser">
      <div className="mods-toolbar">
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
