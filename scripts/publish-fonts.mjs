/**
 * Publish fonts to the RLV-fonts GitHub Pages repo.
 *
 * Fonts live in their own repo (RLVDev-Ryan/RLV-fonts) served at
 * https://rlvdev-ryan.github.io/RLV-fonts/ — keeping the main RLV repo lean
 * (618MB of CJK fonts would bloat every clone).
 *
 * Usage:
 *   1. git clone https://github.com/RLVDev-Ryan/RLV-fonts.git <dir>
 *   2. node scripts/publish-fonts.mjs <dir>
 *   3. cd <dir> && git add -A && git commit && git push
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const src = path.join(root, 'src/renderer/public/assets/fonts');
const dest = process.argv[2];

if (!dest) {
  console.error('Usage: node scripts/publish-fonts.mjs <RLV-fonts repo dir>');
  process.exit(1);
}
if (!fs.existsSync(src)) {
  console.error('fonts dir not found:', src);
  process.exit(1);
}
let count = 0;
for (const f of fs.readdirSync(src)) {
  if (!/\.(ttf|otf|woff2?)$/i.test(f)) continue;
  fs.copyFileSync(path.join(src, f), path.join(dest, f));
  console.log('copied', f);
  count++;
}
console.log(`\nDone — ${count} font files copied to ${dest}. Commit & push there.`);
