// Re-shoots the PNGs referenced from proposal.md: `node screenshot.mjs` from petclinic-test/
// (where @playwright/test is installed), passing this folder's path.
import {chromium} from '@playwright/test';
import path from 'path';
const dir = path.resolve(process.argv[2] || '.');
const page = await (await chromium.launch()).newPage({viewport: {width: 1280, height: 860}});
const shoot = async (query, file) => {
  await page.goto(`file://${dir}/owners-grid.html${query}`);
  await page.screenshot({path: path.join(dir, file), fullPage: true});
};
await shoot('', 'owners-grid.png');
await shoot('?notes', 'owners-grid-notes.png');
await shoot('?sort=city,desc&page=2', 'owners-grid-city-desc.png');
process.exit(0);
