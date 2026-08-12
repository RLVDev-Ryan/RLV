import { useI18n, type I18nKey } from '../hooks/useI18n';
import type { LaunchProgress } from '../../shared/constants';

interface LaunchingViewProps {
  version: string;
  progress: LaunchProgress | null;
  onCancel: () => void;
  /** Optional icon (defaults to the grass block). */
  iconPath?: string;
}

const STAGE_KEYS: Record<string, I18nKey> = {
  start: 'launch.stage.start',
  java: 'launch.stage.java',
  resolve: 'launch.stage.resolve',
  libraries: 'launch.stage.libraries',
  assets: 'launch.stage.assets',
  natives: 'launch.stage.natives',
  launch: 'launch.stage.launch',
  done: 'launch.stage.done',
  error: 'launch.stage.error',
};

export default function LaunchingView({ version, progress, onCancel, iconPath }: LaunchingViewProps) {
  const { t } = useI18n();
  const percent = progress?.percent ?? 0;
  const isError = progress?.stage === 'error';
  const stageText = isError
    ? progress?.error || t('launch.stage.error')
    : progress?.message || (progress ? t(STAGE_KEYS[progress.stage] ?? 'launch.stage.start') : '');

  return (
    <div className="launching-view">
      <div className="launching-loader">
        <div className="launching-loader-ring" />
        <img className="launching-loader-img" src={iconPath ?? 'assets/icons/grass.png'} alt="" draggable={false} />
      </div>

      <h2 className="launching-title">{t('launch.starting')}</h2>

      <div className="launching-version">{version}</div>

      <div className="launching-progress">
        <div className="launching-progress-track">
          <div
            className={`launching-progress-fill${isError ? ' launching-progress-fill--error' : ''}`}
            style={{ width: `${Math.min(100, Math.max(0, percent))}%` }}
          />
        </div>
        <span className="launching-progress-text">{isError ? '' : `${Math.round(percent)}%`}</span>
      </div>

      <div className={`launching-stage${isError ? ' launching-stage--error' : ''}`}>{stageText}</div>

      <button className="btn launching-cancel" onClick={onCancel}>
        {t('launch.cancel')}
      </button>
    </div>
  );
}
