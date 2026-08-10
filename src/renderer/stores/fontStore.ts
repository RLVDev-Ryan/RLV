import { FONT_MANIFEST, fontSlug } from '../../shared/fonts';

/** Inject @font-face rules for a font family served from the rlv-font: cache. */
export function injectFontFace(family: string): void {
  const spec = FONT_MANIFEST[family];
  if (!spec || spec.bundled) return; // bundled fonts are already in the stylesheet
  const id = `font-face-${fontSlug(family)}`;
  if (document.getElementById(id)) return;
  const base = `rlv-font://fonts/${fontSlug(family)}`;
  const faces = spec.files
    .map((f) => {
      const parts = [
        `font-family:'${family}'`,
        `src:url('${base}/${f.file}') format('${f.format}')`,
      ];
      if (f.weight) parts.push(`font-weight:${f.weight}`);
      if (f.style) parts.push(`font-style:${f.style}`);
      return `@font-face{${parts.join(';')}}`;
    })
    .join('\n');
  const style = document.createElement('style');
  style.id = id;
  style.textContent = faces;
  document.head.appendChild(style);
}

/** Global font-download state, consumed by the settings page (progress + stop). */
type FontProgress = { family: string; percent: number };

let _downloading: string | null = null;
let _percent = 0;
let _listeners: Array<() => void> = [];

function notify() {
  _listeners.forEach((l) => l());
}

export const fontStore = {
  get downloading() {
    return _downloading;
  },
  get percent() {
    return _percent;
  },

  subscribe(listener: () => void) {
    _listeners.push(listener);
    return () => {
      _listeners = _listeners.filter((l) => l !== listener);
    };
  },

  _begin(family: string) {
    _downloading = family;
    _percent = 0;
    notify();
  },
  _progress(p: FontProgress) {
    _percent = p.percent;
    notify();
  },
  _end() {
    _downloading = null;
    notify();
  },
};
