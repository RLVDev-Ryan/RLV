import { useState, useEffect, useRef } from 'react';
import { useI18n } from '../hooks/useI18n';

/**
 * Terminal-style log viewer: black background, light text, using the "logs"
 * font picked in Settings → 语言与字体. Streams the main process console.
 *
 * Virtualized: only the visible window of lines is rendered (up to 5000 lines
 * would otherwise reconcile thousands of DOM nodes on every append).
 */
const MAX_LINES = 5000;
/** Must match .logs-line height in global.css. */
const LINE_HEIGHT = 20;
/** Extra rows rendered above/below the viewport to hide scroll jank. */
const OVERSCAN = 30;

interface LogLine {
  id: number;
  text: string;
}

export default function LogsPage() {
  const { t } = useI18n();
  const [lines, setLines] = useState<LogLine[]>([]);
  const [scrollTop, setScrollTop] = useState(0);
  const terminalRef = useRef<HTMLDivElement>(null);
  const autoScrollRef = useRef(true);
  const nextIdRef = useRef(0);

  useEffect(() => {
    if (!window.electronAPI) return;
    window.electronAPI.logs
      .get()
      .then((initial) => {
        setLines(initial.map((text) => ({ id: nextIdRef.current++, text })));
      })
      .catch(() => {
        // IPC failure — don't leave an unhandled rejection; the stream
        // subscription below will still pick up new lines.
      });
    return window.electronAPI.logs.onAppend((line) => {
      setLines((prev) => {
        const next = prev.length >= MAX_LINES ? prev.slice(prev.length - MAX_LINES + 1) : prev;
        return [...next, { id: nextIdRef.current++, text: line }];
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
    setScrollTop(el.scrollTop);
    autoScrollRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 40;
  };

  // ── Virtual window ──
  const viewportHeight = terminalRef.current?.clientHeight ?? 400;
  const start = Math.max(0, Math.floor(scrollTop / LINE_HEIGHT) - OVERSCAN);
  const end = Math.min(lines.length, Math.ceil((scrollTop + viewportHeight) / LINE_HEIGHT) + OVERSCAN);
  const visible = lines.slice(start, end);

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
          <>
            {/* Top spacer keeps scroll metrics accurate for hidden rows. */}
            <div style={{ height: start * LINE_HEIGHT }} />
            {visible.map((l) => (
              <div key={l.id} className="logs-line">
                {l.text}
              </div>
            ))}
            <div style={{ height: Math.max(0, (lines.length - end) * LINE_HEIGHT) }} />
          </>
        )}
      </div>
    </div>
  );
}
