// Re-shoots the mockup. Run from the repo root:
//   NODE_PATH=petclinic-test/node_modules node openspec/changes/paginate-owners-grid/mockup/screenshot.mjs
import {createRequire} from 'node:module';
import {fileURLToPath, pathToFileURL} from 'node:url';
import path from 'node:path';

const {chromium} = createRequire(path.resolve('petclinic-test/package.json'))('@playwright/test');
const dir = path.dirname(fileURLToPath(import.meta.url));
const page_ = pathToFileURL(path.join(dir, 'owners-grid.html')).href;

const browser = await chromium.launch();
const page = await browser.newPage({viewport: {width: 1280, height: 900}, deviceScaleFactor: 2});

// Sorted by City, first page of 10 — shows the sort arrow and the paginator in use
await page.goto(page_ + '?sort=city');
await page.screenshot({path: path.join(dir, 'owners-grid.png'), fullPage: true});

// The same screen with numbered discussion points for the business meeting
await page.goto(page_ + '?sort=city&notes');
await page.screenshot({path: path.join(dir, 'owners-grid-notes.png'), fullPage: true});

await browser.close();
