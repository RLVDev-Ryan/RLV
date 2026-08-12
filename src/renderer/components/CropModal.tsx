import { useState, useEffect, useRef } from 'react';
import { useI18n } from '../hooks/useI18n';

interface CropModalProps {
  src: string;
  onConfirm: (croppedDataUrl: string) => void;
  onCancel: () => void;
}

const BOX = 360;
const OUTPUT = 256;

/** Square image cropper: drag to move the selection, drag the corner to resize. */
export default function CropModal({ src, onConfirm, onCancel }: CropModalProps) {
  const { t } = useI18n();
  const containerRef = useRef<HTMLDivElement>(null);
  const [imgSize, setImgSize] = useState({ w: 0, h: 0 });
  const selRef = useRef({ x: 0, y: 0, size: 0 });
  const [, force] = useState(0);

  useEffect(() => {
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(BOX / img.naturalWidth, BOX / img.naturalHeight);
      const w = img.naturalWidth * scale;
      const h = img.naturalHeight * scale;
      setImgSize({ w, h });
      const size = Math.min(w, h) * 0.7;
      selRef.current = { x: (w - size) / 2, y: (h - size) / 2, size };
      force((n) => n + 1);
    };
    img.src = src;
  }, [src]);

  const dragRef = useRef<{
    mx: number;
    my: number;
    sx: number;
    sy: number;
    ssize: number;
    mode: 'move' | 'resize' | null;
  }>({
    mx: 0,
    my: 0,
    sx: 0,
    sy: 0,
    ssize: 0,
    mode: null,
  });

  const onMouseDown = (e: React.MouseEvent) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;
    const { x, y, size } = selRef.current;
    const nearCorner = Math.abs(mx - (x + size)) < 14 && Math.abs(my - (y + size)) < 14;
    dragRef.current = { mx, my, sx: x, sy: y, ssize: size, mode: nearCorner ? 'resize' : 'move' };
    e.preventDefault();
  };

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      const d = dragRef.current;
      if (!d.mode || !containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const mx = e.clientX - rect.left;
      const my = e.clientY - rect.top;
      const dx = mx - d.mx;
      const dy = my - d.my;
      const sel = { ...selRef.current };
      if (d.mode === 'move') {
        sel.x = Math.max(0, Math.min(d.sx + dx, imgSize.w - sel.size));
        sel.y = Math.max(0, Math.min(d.sy + dy, imgSize.h - sel.size));
      } else {
        sel.size = Math.max(40, Math.min(d.ssize + Math.max(dx, dy), imgSize.w - sel.x, imgSize.h - sel.y));
      }
      selRef.current = sel;
      force((n) => n + 1);
    };
    const onUp = () => {
      dragRef.current.mode = null;
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
  }, [imgSize]);

  const confirm = () => {
    const img = new Image();
    img.onload = () => {
      const { x, y, size } = selRef.current;
      const scale = img.naturalWidth / imgSize.w;
      const canvas = document.createElement('canvas');
      canvas.width = OUTPUT;
      canvas.height = OUTPUT;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(img, x * scale, y * scale, size * scale, size * scale, 0, 0, OUTPUT, OUTPUT);
        onConfirm(canvas.toDataURL('image/png'));
      }
    };
    img.src = src;
  };

  const { x, y, size } = selRef.current;

  return (
    <div className="dialog-overlay" onClick={onCancel}>
      <div className="dialog crop-dialog" onClick={(e) => e.stopPropagation()}>
        <h3 className="crop-title">{t('version.icon_crop')}</h3>
        <div
          className="crop-box"
          ref={containerRef}
          style={{ width: imgSize.w || BOX, height: imgSize.h || BOX }}
          onMouseDown={onMouseDown}
        >
          {imgSize.w > 0 && (
            <>
              <img src={src} style={{ width: imgSize.w, height: imgSize.h }} draggable={false} />
              <div className="crop-sel" style={{ left: x, top: y, width: size, height: size }}>
                <div className="crop-sel-handle" />
              </div>
            </>
          )}
        </div>
        <p className="crop-hint">{t('version.icon_crop_hint')}</p>
        <div className="crop-actions">
          <button className="btn btn--small" onClick={onCancel}>
            {t('common.cancel')}
          </button>
          <button className="btn btn--small btn--ghost" onClick={() => onConfirm(src)}>
            {t('version.icon_original')}
          </button>
          <button className="btn btn--small btn--primary" onClick={confirm}>
            {t('common.confirm')}
          </button>
        </div>
      </div>
    </div>
  );
}
