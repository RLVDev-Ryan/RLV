/**
 * Font registry.
 *
 * Only the default 黑体 (Noto Sans CJK SC) is bundled with the app. Every other
 * font is downloaded on demand from the GitHub Pages host into the app's cache
 * (`userData/fonts`) and served to the renderer via the `rlv-font:` protocol.
 */

/** GitHub Pages base URL for font files (override via RLV_FONT_BASE_URL).
 *  Guarded so this shared module also loads in the renderer (no `process` there). */
export const FONT_BASE_URL: string =
  (typeof process !== 'undefined' && process.env && process.env.RLV_FONT_BASE_URL) ||
  'https://rlvdev-ryan.github.io/RLV-fonts';

/** The bundled default font (黑体 / sans-serif). */
export const DEFAULT_FONT = 'Noto Sans CJK SC';

export interface FontFileSpec {
  file: string;
  format: string; // 'truetype' | 'opentype'
  weight?: string;
  style?: string;
}

export interface FontSpec {
  /** Fonts bundled with the app (not downloaded). */
  bundled?: boolean;
  files: FontFileSpec[];
}

export const FONT_MANIFEST: Record<string, FontSpec> = {
  // ── 黑体 (default, bundled) ──
  'Noto Sans CJK SC': {
    bundled: true,
    files: [
      { file: 'NotoSansCJKsc-Regular.otf', format: 'opentype', weight: '400' },
      { file: 'NotoSansCJKsc-Medium.otf', format: 'opentype', weight: '500' },
      { file: 'NotoSansCJKsc-Bold.otf', format: 'opentype', weight: '700' },
    ],
  },
  // ── 宋体 (serif, on-demand) ──
  'Noto Serif CJK SC': { files: [{ file: 'NotoSerifSC-VF.ttf', format: 'truetype', weight: '100 900' }] },
  'Noto Serif CJK TC': { files: [{ file: 'NotoSerifTC-VF.ttf', format: 'truetype', weight: '100 900' }] },
  'Noto Serif CJK JP': { files: [{ file: 'NotoSerifJP-VF.ttf', format: 'truetype', weight: '100 900' }] },
  'Noto Serif CJK KR': { files: [{ file: 'NotoSerifKR-VF.ttf', format: 'truetype', weight: '100 900' }] },
  'Noto Serif CJK HK': { files: [{ file: 'NotoSerifHK-VF.ttf', format: 'truetype', weight: '100 900' }] },
  // ── Sans CJK (other regions, on-demand) ──
  'Noto Sans CJK TC': {
    files: [
      { file: 'NotoSansCJKtc-Regular.otf', format: 'opentype', weight: '400' },
      { file: 'NotoSansCJKtc-Bold.otf', format: 'opentype', weight: '700' },
    ],
  },
  'Noto Sans CJK JP': {
    files: [
      { file: 'NotoSansCJKjp-Regular.otf', format: 'opentype', weight: '400' },
      { file: 'NotoSansCJKjp-Bold.otf', format: 'opentype', weight: '700' },
    ],
  },
  'Noto Sans CJK KR': {
    files: [
      { file: 'NotoSansCJKkr-Regular.otf', format: 'opentype', weight: '400' },
      { file: 'NotoSansCJKkr-Bold.otf', format: 'opentype', weight: '700' },
    ],
  },
  'Noto Sans CJK HK': {
    files: [
      { file: 'NotoSansCJKhk-Regular.otf', format: 'opentype', weight: '400' },
      { file: 'NotoSansCJKhk-Bold.otf', format: 'opentype', weight: '700' },
    ],
  },
  'Noto Sans Mono CJK SC': {
    files: [
      { file: 'NotoSansMonoCJKsc-Regular.otf', format: 'opentype', weight: '400' },
      { file: 'NotoSansMonoCJKsc-Bold.otf', format: 'opentype', weight: '700' },
    ],
  },
  // ── Maple Mono NF CN (on-demand) ──
  'Maple Mono NF CN Thin': { files: [{ file: 'MapleMono-NF-CN-Thin.ttf', format: 'truetype' }] },
  'Maple Mono NF CN Thin Italic': { files: [{ file: 'MapleMono-NF-CN-ThinItalic.ttf', format: 'truetype', style: 'italic' }] },
  'Maple Mono NF CN ExtraLight': { files: [{ file: 'MapleMono-NF-CN-ExtraLight.ttf', format: 'truetype' }] },
  'Maple Mono NF CN ExtraLight Italic': { files: [{ file: 'MapleMono-NF-CN-ExtraLightItalic.ttf', format: 'truetype', style: 'italic' }] },
  'Maple Mono NF CN Light': { files: [{ file: 'MapleMono-NF-CN-Light.ttf', format: 'truetype' }] },
  'Maple Mono NF CN Light Italic': { files: [{ file: 'MapleMono-NF-CN-LightItalic.ttf', format: 'truetype', style: 'italic' }] },
  'Maple Mono NF CN Regular': { files: [{ file: 'MapleMono-NF-CN-Regular.ttf', format: 'truetype' }] },
  'Maple Mono NF CN Italic': { files: [{ file: 'MapleMono-NF-CN-Italic.ttf', format: 'truetype', style: 'italic' }] },
  'Maple Mono NF CN Medium': { files: [{ file: 'MapleMono-NF-CN-Medium.ttf', format: 'truetype' }] },
  'Maple Mono NF CN Medium Italic': { files: [{ file: 'MapleMono-NF-CN-MediumItalic.ttf', format: 'truetype', style: 'italic' }] },
  'Maple Mono NF CN SemiBold': { files: [{ file: 'MapleMono-NF-CN-SemiBold.ttf', format: 'truetype' }] },
  'Maple Mono NF CN SemiBold Italic': { files: [{ file: 'MapleMono-NF-CN-SemiBoldItalic.ttf', format: 'truetype', style: 'italic' }] },
  'Maple Mono NF CN Bold': { files: [{ file: 'MapleMono-NF-CN-Bold.ttf', format: 'truetype' }] },
  'Maple Mono NF CN Bold Italic': { files: [{ file: 'MapleMono-NF-CN-BoldItalic.ttf', format: 'truetype', style: 'italic' }] },
  'Maple Mono NF CN ExtraBold': { files: [{ file: 'MapleMono-NF-CN-ExtraBold.ttf', format: 'truetype' }] },
  'Maple Mono NF CN ExtraBold Italic': { files: [{ file: 'MapleMono-NF-CN-ExtraBoldItalic.ttf', format: 'truetype', style: 'italic' }] },
};

/** The full list of selectable font families (default first). */
export const FONT_OPTIONS = [
  DEFAULT_FONT,
  ...Object.keys(FONT_MANIFEST).filter((f) => f !== DEFAULT_FONT),
];

/** A short identifier used for the local cache directory. */
export function fontSlug(family: string): string {
  return family.replace(/[^\w一-鿿]+/g, '_');
}

export function fontDownloadUrl(family: string, file: string): string {
  return `${FONT_BASE_URL}/${file}`;
}
