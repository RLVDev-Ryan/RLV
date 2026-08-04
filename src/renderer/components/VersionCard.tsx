import { LOADER_META, VANILLA_CARD_BG, getBaseVersion } from '../../shared/constants';
import type { MinecraftVersion } from '../../shared/constants';
import { useI18n } from '../hooks/useI18n';
import { loadVersionSettings, resolveIcon } from '../../shared/versionSettings';

interface VersionCardProps {
  version: MinecraftVersion;
  onClick: (v: MinecraftVersion) => void;
}

export default function VersionCard({ version, onClick }: VersionCardProps) {
  const { t } = useI18n();
  const loaderMeta = version.loader ? LOADER_META[version.loader] : null;
  const cardBg = loaderMeta ? loaderMeta.cardBg : VANILLA_CARD_BG;
  const icon = resolveIcon(loadVersionSettings(version.id).iconList, version.loader);

  return (
    <button
      className="version-card"
      style={{ '--card-bg': cardBg } as React.CSSProperties}
      onClick={() => onClick(version)}
    >
      <div className="version-card-left">
        <div className="version-card-icon">
          <img className="version-card-img" src={icon} alt={loaderMeta?.label ?? 'Vanilla'} draggable={false} />
        </div>
        <div className="version-card-info">
          <span className="version-card-name">{getBaseVersion(version.id)}</span>
          <span className="version-card-date">{loaderMeta ? loaderMeta.label : t('version.vanilla')}</span>
        </div>
      </div>
      <div className="version-card-tags">
        {loaderMeta && (
          <span
            className="version-card-tag"
            style={{
              color: loaderMeta.color,
              background: `${loaderMeta.color}18`,
              borderColor: `${loaderMeta.color}30`,
            }}
          >
            {loaderMeta.label}
          </span>
        )}
        {version.type === 'release' && <span className="version-card-tag version-card-tag--release">Release</span>}
      </div>
    </button>
  );
}
