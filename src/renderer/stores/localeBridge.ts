/**
 * Minimal bridge to avoid circular dependency between themeStore and useI18n.
 */
type LocaleCallback = (locale: string) => void;
let cb: LocaleCallback | null = null;

export function onLocaleChange(fn: LocaleCallback): void {
  cb = fn;
}

export function emitLocaleChange(locale: string): void {
  cb?.(locale);
}
