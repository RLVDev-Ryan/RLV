import path from 'path';
import fs from 'fs';
import type { ModpackExportOptions } from '../../shared/constants';

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
      { key: 'mods', include: options.includeMods },
      { key: 'resourcepacks', include: options.includeResourcepacks },
      { key: 'shaderpacks', include: options.includeShaders },
      { key: 'saves', include: options.includeSaves },
      { key: 'screenshots', include: options.includeScreenshots },
      { key: 'options.txt', include: options.includeOptions },
      { key: 'server.dat', include: options.includeOptions },
    ];

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
