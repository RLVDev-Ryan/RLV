import path from 'path';
import fs from 'fs';
import type { ModpackExportOptions } from '../../shared/constants';

/**
 * List the mod files (relative names) inside a version's `mods/` folder, so the
 * UI can let the user pick specific mods to export.
 */
export function listModpackMods(gameDir: string): string[] {
  const modsDir = path.join(gameDir, 'mods');
  if (!fs.existsSync(modsDir) || !fs.statSync(modsDir).isDirectory()) return [];
  try {
    return fs
      .readdirSync(modsDir)
      .filter((f) => {
        if (!f.toLowerCase().endsWith('.jar')) return false;
        try {
          return fs.statSync(path.join(modsDir, f)).isFile();
        } catch {
          return false;
        }
      })
      .sort();
  } catch {
    return [];
  }
}

/**
 * Zip the selected folders of a version into a modpack .zip (archiver 8, ESM —
 * loaded via dynamic import).
 */
export async function exportModpack(
  gameDir: string,
  options: ModpackExportOptions,
  destPath: string,
): Promise<{ success: boolean; path?: string; error?: string }> {
  try {
    const mod = await import('archiver');
    const output = fs.createWriteStream(destPath);
    const archive = new mod.ZipArchive();
    archive.pipe(output);

    const entries: { key: string; include: boolean }[] = [
      { key: 'resourcepacks', include: options.includeResourcepacks },
      { key: 'shaderpacks', include: options.includeShaders },
      { key: 'saves', include: options.includeSaves },
      { key: 'screenshots', include: options.includeScreenshots },
      { key: 'options.txt', include: options.includeOptions },
      { key: 'server.dat', include: options.includeOptions },
    ];

    // Mods: whole folder, or only the specifically selected files.
    if (options.includeMods) {
      const modsDir = path.join(gameDir, 'mods');
      if (fs.existsSync(modsDir) && fs.statSync(modsDir).isDirectory()) {
        const selected = options.modFiles?.length ? options.modFiles : null;
        if (selected) {
          for (const file of selected) {
            // Defend against path traversal — only accept plain file names.
            if (path.basename(file) !== file) continue;
            const src = path.join(modsDir, file);
            if (fs.existsSync(src) && fs.statSync(src).isFile()) {
              archive.file(src, { name: `mods/${file}` });
            }
          }
        } else {
          archive.directory(modsDir, 'mods');
        }
      }
    }

    for (const e of entries) {
      if (!e.include) continue;
      const src = path.join(gameDir, e.key);
      if (!fs.existsSync(src)) continue;
      if (fs.statSync(src).isDirectory()) {
        archive.directory(src, e.key);
      } else {
        archive.append(fs.createReadStream(src), { name: e.key });
      }
    }

    await archive.finalize();
    return { success: true, path: destPath };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : String(err) };
  }
}
