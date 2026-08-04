import { useState, useEffect, useRef } from 'react';
import { useI18n } from '../hooks/useI18n';

/**
 * Terminal-style log viewer: black background, light text, using the "logs"
 * font picked in Settings → 语言与字体. Streams the main process console.
 */
const MAX_LINES = 5000;

export default function LogsPage() {
  const { t } = useI18n();
  const [lines, setLines] = useState<string[]>([]);
  const terminalRef = useRef<HTMLDivElement>(null);
  const autoScrollRef = useRef(true);

  useEffect(() => {
    if (!window.electronAPI) return;
    window.electronAPI.logs.get().then((initial) => setLines(initial));
    return window.electronAPI.logs.onAppend((line) => {
      setLines((prev) => {
        const next = prev.length >= MAX_LINES ? [...prev.slice(prev.length - MAX_LINES + 1)] : [...prev];
        next.push(line);
        return next;
      });
    });
  }, []);

  // Follow new lines unless the user has scrolled up.
  useEffect(() => {
    const el = terminalRef.current;
    if (el && autoScrollRef.current) el.scrollTop = el.scrollHeight;
  }, [lines]);

  const handleScroll = () => {
    const el = terminalRef.current;
    if (!el) return;
    autoScrollRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 40;
  };

  const handleClear = async () => {
    if (window.electronAPI) await window.electronAPI.logs.clear();
    setLines([]);
  };

  const handleOpenFolder = async () => {
    if (window.electronAPI) await window.electronAPI.logs.openFolder();
  };

  return (
    <div className="page logs-page">
      <div className="logs-header">
        <h2 className="page-title">{t('nav.logs')}</h2>
        <div className="logs-actions">
          <button className="btn btn--small btn--outline" onClick={handleOpenFolder}>
            {t('logs.open_folder')}
          </button>
          <button className="btn btn--small btn--ghost" onClick={handleClear}>
            {t('logs.clear')}
          </button>
        </div>
      </div>

      <div className="logs-terminal" ref={terminalRef} onScroll={handleScroll}>
        {lines.length === 0 ? (
          <div className="logs-empty">{t('logs.empty')}</div>
        ) : (
          lines.map((l, i) => (
            <div key={i} className="logs-line">
              {l}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
