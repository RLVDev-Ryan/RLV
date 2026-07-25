import { useState, useEffect, useCallback } from 'react';
import { INSTALLED_VERSIONS } from '../../shared/constants';
import type { Account, MinecraftVersion } from '../../shared/constants';
import AccountSelector from '../components/AccountSelector';
import AddAccountDialog from '../components/AddAccountDialog';
import VersionSelector from '../components/VersionSelector';
import VersionCard from '../components/VersionCard';
import VersionDetail from '../components/VersionDetail';

export default function LaunchPage() {
  // ── Account state ──
  const [currentAccount, setCurrentAccount] = useState<Account | null>(null);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [showAddAccount, setShowAddAccount] = useState(false);

  // ── Version state ──
  const [versions] = useState<MinecraftVersion[]>(INSTALLED_VERSIONS);
  const [selectedVersion, setSelectedVersion] = useState<MinecraftVersion | null>(null);
  const [detailVersion, setDetailVersion] = useState<MinecraftVersion | null>(null);

  // Load accounts on mount
  useEffect(() => {
    loadAccounts();
  }, []);

  const loadAccounts = useCallback(async () => {
    if (!window.electronAPI) return;
    const list = await window.electronAPI.accounts.list();
    setAccounts(list);
    const current = await window.electronAPI.accounts.getCurrent();
    setCurrentAccount(current);
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

  const handleRemoveAccount = useCallback(async (id: string) => {
    if (!window.electronAPI) return;
    await window.electronAPI.accounts.remove(id);
    loadAccounts();
  }, []);

  // ── Version handlers ──
  const handleLaunch = useCallback(async () => {
    if (!selectedVersion) return;
    if (window.electronAPI) {
      await window.electronAPI.showAlert(`启动 ${selectedVersion.id}`);
    }
  }, [selectedVersion]);

  const handleAddFolder = useCallback(async () => {
    if (window.electronAPI) {
      await window.electronAPI.openDirectory();
    }
  }, []);

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
          <button className="btn btn--primary btn--launch" disabled={!selectedVersion} onClick={handleLaunch}>
            启动游戏
          </button>
        </div>
        <div className="launch-actions-right">
          <button className="btn btn--outline btn--small" onClick={handleAddFolder}>
            添加已有文件夹
          </button>
        </div>
      </div>

      {/* ── Row 3: Section title ── */}
      <div className="launch-row launch-row--section-title">
        <h2 className="page-title">已安装版本</h2>
        {!hasVersions && <p className="launch-empty-hint">暂无已安装版本，请添加版本文件夹</p>}
      </div>

      {/* ── Row 4+: Version cards ── */}
      {hasVersions && (
        <div className="launch-cards">
          {versions.map((v) => (
            <VersionCard key={v.id} version={v} onClick={handleCardClick} />
          ))}
        </div>
      )}
    </div>
  );
}
