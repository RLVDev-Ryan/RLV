import { useState, useEffect, useCallback, useRef } from 'react';
import { useI18n } from '../hooks/useI18n';
import type { Account, MinecraftVersion, LaunchProgress } from '../../shared/constants';
import { loadLaunchSettings, saveLaunchSettings } from '../../shared/utils';
import { loadVersionSettings, resolveIcon } from '../../shared/versionSettings';
import { launchStore } from '../stores/launchStore';
import { configStore } from '../stores/configStore';
import AccountSelector from '../components/AccountSelector';
import AddAccountDialog from '../components/AddAccountDialog';
import VersionSelector from '../components/VersionSelector';
import VersionCard from '../components/VersionCard';
import VersionDetail from '../components/VersionDetail';
import LaunchingView from '../components/LaunchingView';

export default function LaunchPage() {
  const { t } = useI18n();

  // ── Account state ──
  const [currentAccount, setCurrentAccount] = useState<Account | null>(null);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [showAddAccount, setShowAddAccount] = useState(false);

  // ── Version state ──
  const [versions, setVersions] = useState<MinecraftVersion[]>([]);
  const [selectedVersion, setSelectedVersion] = useState<MinecraftVersion | null>(null);
  const [detailVersion, setDetailVersion] = useState<MinecraftVersion | null>(null);

  // ── Launch state (global store — survives page navigation) ──
  const [launching, setLaunching] = useState(launchStore.launching);
  const [launchProgress, setLaunchProgress] = useState<LaunchProgress | null>(launchStore.progress);
  const cancelledRef = useRef(false);

  // Isolation toggle is backed by the (module-cached) launch settings; keep a
  // reactive copy so the checkbox reflects the real config once
  // configStore.loadAll() seeds the cache, and after any settings change.
  const [isolation, setIsolation] = useState(loadLaunchSettings().isolation);
  useEffect(() => {
    const sync = () => setIsolation(loadLaunchSettings().isolation);
    const unsub = configStore.subscribe(sync);
    window.addEventListener('rlv:launch-settings-changed', sync);
    return () => {
      unsub();
      window.removeEventListener('rlv:launch-settings-changed', sync);
    };
  }, []);

  useEffect(() => {
    const unsub = launchStore.subscribe(() => {
      setLaunching(launchStore.launching);
      setLaunchProgress(launchStore.progress);
    });
    return unsub;
  }, []);

  // Load accounts + installed versions on mount
  useEffect(() => {
    loadAccounts();
    loadVersions();
  }, []);

  const loadAccounts = useCallback(async () => {
    if (!window.electronAPI) return;
    const list = await window.electronAPI.accounts.list();
    setAccounts(list);
    const current = await window.electronAPI.accounts.getCurrent();
    setCurrentAccount(current);
  }, []);

  // Scan all configured game directories for installed versions.
  // Replaces the old hardcoded INSTALLED_VERSIONS list.
  const loadVersions = useCallback(async () => {
    if (!window.electronAPI) return;
    const list = await window.electronAPI.gameDirs.scanVersions();
    setVersions(
      list.map((v) => ({
        id: v.id,
        releaseDate: v.releaseTime.slice(0, 10),
        type: 'release' as const,
        loader: v.loader,
      })),
    );
  }, []);

  // ── Account handlers ──
  const handleSelectAccount = useCallback(async (id: string) => {
    if (!window.electronAPI) return;
    const acc = await window.electronAPI.accounts.setCurrent(id);
    if (acc) setCurrentAccount(acc);
  }, []);

  // Each login handler returns an error message (or null on success) so the
  // dialog can stay open and show the reason instead of silently closing.
  const handleMicrosoftLogin = useCallback(async (): Promise<string | null> => {
    if (!window.electronAPI) return t('account.login_failed');
    const account = await window.electronAPI.accounts.addMicrosoft();
    if (account) {
      setAccounts((prev) => [...prev.filter((a) => a.id !== account.id), account]);
      setCurrentAccount(account);
      setShowAddAccount(false);
      return null;
    }
    return t('account.login_failed');
  }, [t]);

  const handleYggdrasilLogin = useCallback(
    async (serverUrl: string, username: string, password: string): Promise<string | null> => {
      if (!window.electronAPI) return t('account.login_failed');
      const result = await window.electronAPI.accounts.addYggdrasil({
        serverUrl,
        username,
        password,
      });
      if (result.success && result.account) {
        const account = result.account;
        setAccounts((prev) => [...prev.filter((a) => a.id !== account.id), account]);
        setCurrentAccount(account);
        setShowAddAccount(false);
        return null;
      }
      return result.error || t('account.login_failed');
    },
    [t],
  );

  const handleOfflineLogin = useCallback(
    async (username: string): Promise<string | null> => {
      if (!window.electronAPI) return t('account.login_failed');
      const account = await window.electronAPI.accounts.addOffline(username);
      if (account) {
        setAccounts((prev) => [...prev.filter((a) => a.id !== account.id), account]);
        setCurrentAccount(account);
        setShowAddAccount(false);
        return null;
      }
      return t('account.login_failed');
    },
    [t],
  );

  const handleRemoveAccount = useCallback(async (id: string) => {
    if (!window.electronAPI) return;
    await window.electronAPI.accounts.remove(id);
    loadAccounts();
  }, []);

  // ── Version handlers ──
  const handleLaunch = useCallback(async () => {
    if (!selectedVersion || !window.electronAPI) return;
    if (!currentAccount) {
      setLaunchProgress({ stage: 'error', percent: 0, error: t('launch.need_account') });
      return;
    }
    cancelledRef.current = false;
    const iconPath = resolveIcon(loadVersionSettings(selectedVersion.id).iconLaunch, selectedVersion.loader);
    launchStore.start(selectedVersion.id, iconPath);
    try {
      const settings = loadLaunchSettings();
      const result = await window.electronAPI.launch.game(selectedVersion.id, currentAccount.name, {
        memoryMB: settings.memoryMB,
        jvmArgs: settings.jvmArgs,
        gameArgs: settings.gameArgs,
        isolation: settings.isolation,
        javaPath: settings.javaPath ?? undefined,
      });
      if (!cancelledRef.current && !result.success) {
        launchStore.fail(result.error || t('launch.failed'));
      }
    } catch (err) {
      if (!cancelledRef.current) {
        launchStore.fail(String(err));
      }
    }
  }, [selectedVersion, currentAccount, t]);

  const handleCancelLaunch = useCallback(() => {
    cancelledRef.current = true;
    if (window.electronAPI) window.electronAPI.launch.stop();
    launchStore.cancel();
  }, []);

  const [showDirs, setShowDirs] = useState(false);
  const [gameDirs, setGameDirs] = useState<string[]>([]);

  const loadGameDirs = useCallback(async () => {
    if (window.electronAPI) setGameDirs(await window.electronAPI.gameDirs.getAll());
  }, []);

  useEffect(() => {
    loadGameDirs();
  }, [loadGameDirs]);

  const handleAddFolder = useCallback(async () => {
    if (window.electronAPI) {
      await window.electronAPI.gameDirs.add();
      loadVersions();
      loadGameDirs();
    }
  }, [loadVersions, loadGameDirs]);

  const handleCardClick = useCallback((v: MinecraftVersion) => {
    setDetailVersion(v);
  }, []);

  const handleBackFromDetail = useCallback(() => {
    setDetailVersion(null);
    // Refresh the list — the user may have deleted/installed a version while
    // inside the detail view (stale state would otherwise keep showing it).
    loadVersions();
  }, [loadVersions]);

  // ── Detail view ──
  if (detailVersion) {
    return (
      <div className="page launch-page">
        <VersionDetail version={detailVersion} onBack={handleBackFromDetail} />
      </div>
    );
  }

  // ── Launching view (page-relative; sidebar stays usable) ──
  if (launching) {
    return (
      <div className="page launch-page">
        <LaunchingView
          version={selectedVersion?.id ?? launchStore.versionId ?? ''}
          progress={launchProgress}
          onCancel={handleCancelLaunch}
          iconPath={launchStore.iconPath ?? undefined}
        />
      </div>
    );
  }

  const hasVersions = versions.length > 0;

  // ── Fullscreen "added directories" manager ──
  if (showDirs) {
    return (
      <div className="page launch-page">
        <div className="added-dirs-view">
          <button className="version-detail-back" onClick={() => setShowDirs(false)} style={{ marginBottom: 20 }}>
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

          <h2 className="page-title" style={{ marginBottom: 16 }}>
            {t('launch.manage_dirs')}
          </h2>

          <div className="added-dirs-list">
            {gameDirs.length === 0 && <p className="launch-empty-hint">{t('launch.no_versions')}</p>}
            {gameDirs.map((dir) => (
              <div key={dir} className="added-dir-row">
                <span className="added-dir-path" title={dir}>
                  {dir}
                </span>
                <button className="btn btn--small btn--outline" onClick={() => window.electronAPI?.openPath(dir)}>
                  {t('version.open_dir')}
                </button>
                <button
                  className="btn btn--small btn--ghost"
                  onClick={async () => {
                    if (!window.electronAPI) return;
                    if (!window.confirm(t('launch.remove_dir_confirm'))) return;
                    await window.electronAPI.gameDirs.remove(dir);
                    loadGameDirs();
                    loadVersions();
                  }}
                >
                  {t('common.remove')}
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="page launch-page">
      {/* ── Row 1: Account ── */}
      <div className="launch-row launch-row--account">
        <AccountSelector
          current={currentAccount}
          accounts={accounts}
          onSelect={handleSelectAccount}
          onAdd={() => setShowAddAccount(true)}
          onRemove={handleRemoveAccount}
        />
      </div>

      {/* ── Row 2: Version selector + actions ── */}
      <div className="launch-row launch-row--actions">
        <div className="launch-actions-left">
          <VersionSelector versions={versions} selected={selectedVersion} onSelect={setSelectedVersion} />
          <label className="isolation-toggle" title={t('launch.isolation')}>
            <input
              type="checkbox"
              checked={isolation}
              onChange={(e) => {
                const next = e.target.checked;
                setIsolation(next);
                saveLaunchSettings({ ...loadLaunchSettings(), isolation: next });
              }}
            />
            <span>{t('launch.isolation')}</span>
          </label>
          <button
            className="btn btn--primary btn--launch"
            disabled={!selectedVersion || launching}
            onClick={handleLaunch}
          >
            {launching ? t('launch.starting') : t('launch_page.launch')}
          </button>
          {launchProgress && (
            <div className="launch-progress">
              {launchProgress.error ? (
                <span className="launch-progress-error">{launchProgress.error}</span>
              ) : (
                <span>
                  {launchProgress.message || launchProgress.stage} ({launchProgress.percent}%)
                </span>
              )}
            </div>
          )}
        </div>
        <div className="launch-actions-right">
          <button className="btn btn--outline btn--small" onClick={handleAddFolder}>
            {t('launch_page.add_existing')}
          </button>
          <button className="btn btn--outline btn--small" onClick={() => setShowDirs(true)}>
            {t('launch.manage_dirs')}
          </button>
        </div>
      </div>

      {/* ── Row 3: Section title ── */}
      <div className="launch-row launch-row--section-title">
        <h2 className="page-title">{t('launch.installed')}</h2>
        {!hasVersions && <p className="launch-empty-hint">{t('launch.no_versions')}</p>}
      </div>

      {/* ── Row 4+: Version cards ── */}
      {hasVersions && (
        <div className="launch-cards">
          {versions.map((v) => (
            <VersionCard key={v.id} version={v} onClick={handleCardClick} />
          ))}
        </div>
      )}

      <AddAccountDialog
        open={showAddAccount}
        onClose={() => setShowAddAccount(false)}
        onMicrosoft={handleMicrosoftLogin}
        onYggdrasil={handleYggdrasilLogin}
        onOffline={handleOfflineLogin}
      />
    </div>
  );
}
