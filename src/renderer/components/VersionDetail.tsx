import { useState, useEffect, useCallback } from 'react';
import { LOADER_META } from '../../shared/constants';
import type { MinecraftVersion } from '../../shared/constants';

interface VersionDetailProps {
  version: MinecraftVersion;
  onBack: () => void;
}

type DetailTab = 'overview' | 'settings' | 'mods' | 'export';

const TABS: { key: DetailTab; label: string }[] = [
  { key: 'overview', label: '概览' },
  { key: 'settings', label: '设置' },
  { key: 'mods', label: '模组' },
  { key: 'export', label: '导出' },
];

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export default function VersionDetail({ version, onBack }: VersionDetailProps) {
  const [activeTab, setActiveTab] = useState<DetailTab>('overview');
  const [fadeIn, setFadeIn] = useState(true);

  const lm = version.loader ? LOADER_META[version.loader] : null;

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
          <span>返回</span>
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

  const handleOpenDir = async () => {
    if (window.electronAPI) {
      await window.electronAPI.openDirectory();
    }
  };

  const handleOpenFolder = async () => {
    if (window.electronAPI) {
      const dir = await window.electronAPI.gameDirs.getDefault();
      await window.electronAPI.showAlert(`版本目录: ${versionPath || dir + '/versions/' + version.id}`);
    }
  };

  return (
    <div className="tab-pane">
      <Section title="版本信息">
        <InfoRow label="游戏版本" value={version.id} />
        <InfoRow label="发布日期" value={formatDate(version.releaseDate)} />
        <InfoRow label="版本类型" value={version.type === 'release' ? '正式版' : version.type} />
        {version.loader && <InfoRow label="模组加载器" value={LOADER_META[version.loader].label} />}
      </Section>

      <Section title="路径">
        <InfoRow label="版本目录" value={versionPath || '正在获取…'} />
        <InfoRow label="游戏目录" value={gameDirs[0] || '正在获取…'} />
        <div className="quick-actions" style={{ marginTop: 8 }}>
          <button className="btn btn--small btn--outline" onClick={handleOpenFolder}>
            打开版本文件夹
          </button>
          <button className="btn btn--small btn--outline" onClick={handleAddFolder}>
            添加已有文件夹
          </button>
        </div>
        {gameDirs.length > 1 && (
          <div style={{ marginTop: 8 }}>
            <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 6 }}>已添加的目录：</p>
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
                  title="移除目录"
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

      <Section title="快捷操作">
        <div className="quick-actions">
          <button className="btn btn--small btn--outline" onClick={handleOpenDir}>
            打开 Mods 文件夹
          </button>
          <button className="btn btn--small btn--outline" onClick={handleOpenDir}>
            打开资源包文件夹
          </button>
          <button className="btn btn--small btn--outline" onClick={handleOpenDir}>
            打开存档文件夹
          </button>
          <button className="btn btn--small btn--outline" onClick={handleOpenDir}>
            打开截图文件夹
          </button>
        </div>
      </Section>

      <Section title="高级管理">
        <div className="quick-actions">
          <button className="btn btn--small btn--ghost">导出启动脚本</button>
          <button className="btn btn--small btn--ghost">补全文件</button>
          <button className="btn btn--small btn--danger">删除版本</button>
        </div>
      </Section>
    </div>
  );
}

/* ────────── Settings Tab ────────── */
function TabSettings({ version }: { version: MinecraftVersion }) {
  const [memSlider, setMemSlider] = useState(2048);

  return (
    <div className="tab-pane">
      <Section title="基本设置">
        <div className="form-group">
          <label className="form-label">自定义版本名</label>
          <input className="form-input" type="text" defaultValue={version.id} placeholder="版本显示名称" />
        </div>
        <div className="form-group">
          <label className="form-label">版本描述</label>
          <textarea className="form-input form-textarea" rows={2} placeholder="可选的版本描述" />
        </div>
      </Section>

      <Section title="启动选项">
        <div className="form-group">
          <label className="form-label">版本隔离</label>
          <select className="form-input form-select" defaultValue="each">
            <option value="each">每个版本独立文件夹</option>
            <option value="none">不隔离</option>
          </select>
        </div>
        <div className="form-group">
          <label className="form-label">窗口标题</label>
          <input className="form-input" type="text" placeholder="Minecraft" />
        </div>
      </Section>

      <Section title="Java">
        <div className="form-group">
          <label className="form-label">Java 路径</label>
          <div className="form-input-row">
            <input className="form-input" type="text" placeholder="自动检测" readOnly />
            <button className="btn btn--small btn--outline">浏览</button>
          </div>
        </div>
        <div className="form-group">
          <label className="form-label">内存分配: {memSlider} MB</label>
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
            <span>512 MB</span>
            <span>16 GB</span>
          </div>
        </div>
        <div className="form-group">
          <label className="form-label">JVM 参数</label>
          <textarea
            className="form-input form-textarea form-textarea--code"
            rows={3}
            defaultValue="-Xmx2G -XX:+UnlockExperimentalVMOptions"
          />
        </div>
        <div className="form-group">
          <label className="form-label">游戏参数</label>
          <input className="form-input" type="text" placeholder="--demo --server=..." />
        </div>
      </Section>

      <div className="detail-actions">
        <button className="btn btn--primary">保存设置</button>
      </div>
    </div>
  );
}

/* ────────── Mods Tab ────────── */
function TabMods() {
  return (
    <div className="tab-pane">
      <div className="tab-toolbar">
        <button className="btn btn--primary btn--small">下载模组</button>
        <button className="btn btn--outline btn--small">打开 Mods 文件夹</button>
        <button className="btn btn--ghost btn--small">检查更新</button>
      </div>
      <div className="mods-empty">
        <span className="mods-empty-icon">📦</span>
        <p>暂无已安装模组</p>
        <p className="mods-empty-desc">点击"下载模组"从 CurseForge 或 Modrinth 浏览模组</p>
      </div>
    </div>
  );
}

/* ────────── Export Tab ────────── */
function TabExport({ version }: { version: MinecraftVersion }) {
  return (
    <div className="tab-pane">
      <Section title="整合包信息">
        <div className="form-group">
          <label className="form-label">整合包名称</label>
          <input className="form-input" type="text" placeholder={`${version.id} 整合包`} />
        </div>
        <div className="form-group">
          <label className="form-label">版本</label>
          <input className="form-input" type="text" placeholder="1.0.0" />
        </div>
        <div className="form-group">
          <label className="form-label">作者</label>
          <input className="form-input" type="text" placeholder="作者名" />
        </div>
        <div className="form-group">
          <label className="form-label">描述</label>
          <textarea className="form-input form-textarea" rows={3} placeholder="整合包描述" />
        </div>
      </Section>

      <Section title="导出内容">
        <div className="export-checklist">
          {[
            { key: 'game', label: '游戏本体', defaultChecked: true },
            { key: 'mods', label: 'Mod', defaultChecked: true },
            { key: 'resourcepacks', label: '资源包', defaultChecked: false },
            { key: 'shaders', label: '光影包', defaultChecked: false },
            { key: 'saves', label: '存档', defaultChecked: false },
            { key: 'screenshots', label: '截图', defaultChecked: false },
            { key: 'options', label: '更多选项', defaultChecked: false },
          ].map((item) => (
            <label key={item.key} className="export-checkbox">
              <input type="checkbox" defaultChecked={item.defaultChecked} />
              <span>{item.label}</span>
            </label>
          ))}
        </div>
      </Section>

      <div className="export-actions">
        <button className="btn btn--primary">开始导出</button>
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
