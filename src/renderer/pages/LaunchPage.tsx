import { useState, useEffect, useCallback } from 'react';
import { useI18n } from '../hooks/useI18n';
import type { Account, MinecraftVersion } from '../../shared/constants';
import { loadLaunchSettings } from '../../shared/utils';
import AccountSelector from '../components/AccountSelector';
import AddAccountDialog from '../components/AddAccountDialog';
import VersionSelector from '../components/VersionSelector';
import VersionCard from '../components/VersionCard';
import VersionDetail from '../components/VersionDetail';

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

  // ── Launch state ──
  const [launching, setLaunching] = useState(false);
  const [launchProgress, setLaunchProgress] = useState<{ stage: string; percent: number; message?: string; error?: string } | null>(null);

  // Load accounts + installed versions on mount
  useEffect(() => {
    loadAccounts();
    loadVersions();
  }, []);

  // Subscribe to launch progress
  useEffect(() => {
    if (!window.electronAPI) return;
    const cleanup = window.electronAPI.launch.onProgress((p) => {
      setLaunchProgress(p);
      if (p.stage === 'done') setLaunching(false);
      if (p.stage === 'error') setLaunching(false);
    });
    return cleanup;
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

  const handleMicrosoftLogin = useCallback(async () => {
    if (!window.electronAPI) return;
    const account = await window.electronAPI.accounts.addMicrosoft();
    if (account) {
      setAccounts((prev) => [...prev.filter((a) => a.id !== account.id), account]);
      setCurrentAccount(account);
    }
    setShowAddAccount(false);
  }, []);

  const handleYggdrasilLogin = useCallback(async (serverUrl: string, username: string, password: string) => {
    if (!window.electronAPI) return;
    const account = await window.electronAPI.accounts.addYggdrasil({
      serverUrl,
      username,
      password,
    });
    if (account) {
      setAccounts((prev) => [...prev.filter((a) => a.id !== account.id), account]);
      setCurrentAccount(account);
    }
    setShowAddAccount(false);
  }, []);

  const handleOfflineLogin = useCallback(async (username: string) => {
    if (!window.electronAPI) return;
    const account = await window.electronAPI.accounts.addOffline(username);
    if (account) {
      setAccounts((prev) => [...prev.filter((a) => a.id !== account.id), account]);
      setCurrentAccount(account);
    }
    setShowAddAccount(false);
  }, []);

  const handleRemoveAccount = useCallback(async (id: string) => {
    if (!window.electronAPI) return;
    await window.electronAPI.accounts.remove(id);
    loadAccounts();
  }, []);

  // ── Version handlers ──
  const handleLaunch = useCallback(async () => {
    if (!selectedVersion || !window.electronAPI) return;
    setLaunching(true);
    setLaunchProgress({ stage: 'start', percent: 0, message: '准备启动…' });
    try {
      const settings = loadLaunchSettings();
      const result = await window.electronAPI.launch.game(
        selectedVersion.id,
        currentAccount?.name ?? 'Player',
        {
          memoryMB: settings.memoryMB,
          jvmArgs: settings.jvmArgs,
          gameArgs: settings.gameArgs,
        },
      );
      if (!result.success && result.error) {
        setLaunchProgress({ stage: 'error', percent: 0, error: result.error });
      }
    } catch (err) {
      setLaunchProgress({ stage: 'error', percent: 0, error: String(err) });
    } finally {
      setLaunching(false);
    }
  }, [selectedVersion, currentAccount]);

  const handleAddFolder = useCallback(async () => {
    if (window.electronAPI) {
      await window.electronAPI.gameDirs.add();
      loadVersions();
    }
  }, [loadVersions]);

  const handleCardClick = useCallback((v: MinecraftVersion) => {
    setDetailVersion(v);
  }, []);

  const handleBackFromDetail = useCallback(() => {
    setDetailVersion(null);
  }, []);

  // ── Detail view ──
  if (detailVersion) {
    return (
      <div className="page launch-page">
        <VersionDetail version={detailVersion} onBack={handleBackFromDetail} />
      </div>
    );
  }

  const hasVersions = versions.length > 0;

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
          <button
            className="btn btn--primary btn--launch"
            disabled={!selectedVersion || launching}
            onClick={handleLaunch}
          >
            {launching ? '启动中…' : t('launch_page.launch')}
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
