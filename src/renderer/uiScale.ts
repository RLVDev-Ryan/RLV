/**
 * Proportional, screen-filling UI scaling.
 *
 * The layout is designed for the default window width (1000px). When the
 * window is wider (maximized / large monitors), the content area
 * (`.app-content`) is zoomed by `windowWidth / DESIGN_WIDTH` so text, buttons
 * and the download hub all grow together and fill the wider window.
 *
 * We deliberately zoom ONLY `.app-content` (the scroll container), not
 * `document.documentElement` — zooming the root element corrupts the document
 * scroll range so the bottom of the page becomes unreachable.
 */
const DESIGN_WIDTH = 1000;
const MAX_ZOOM = 2;

/** Recompute the content-area zoom for the current window width. */
export function applyScale(): void {
  const w = window.innerWidth;
  const zoom = Math.min(Math.max(w / DESIGN_WIDTH, 1), MAX_ZOOM);
  const el = document.querySelector<HTMLElement>('.app-content');
  if (el) el.style.zoom = String(zoom);
}
