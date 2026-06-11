import {test, expect} from '@playwright/test';
import {OwnersPage} from './pages/OwnersPage';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Proves that toggling the sort (Name asc/desc, City asc/desc) never reflows the table
 * columns left/right: every column header keeps the exact same left edge across all sorts.
 */
const COLUMNS = ['name', 'address', 'city', 'telephone', 'pets'];
const SORTS = ['name,asc', 'name,desc', 'city,asc', 'city,desc'];

const screenshotDir = path.join(__dirname, '..', 'test-results', 'screenshots');

test.use({viewport: {width: 1440, height: 900}});

test('columns do not flip left/right when sorting by name or city (asc/desc)', async ({page}) => {
  fs.mkdirSync(screenshotDir, {recursive: true});

  const ownersPage = new OwnersPage(page);
  const leftEdgesPerSort: Record<string, number[]> = {};

  for (const sort of SORTS) {
    await ownersPage.open(`?page=0&size=5&sort=${encodeURIComponent(sort)}`);
    await ownersPage.ownerNameCells.first().waitFor({state: 'visible'});

    const leftEdges: number[] = [];
    for (const col of COLUMNS) {
      const box = await ownersPage.columnHeader(col).boundingBox();
      leftEdges.push(Math.round(box!.x));
    }
    leftEdgesPerSort[sort] = leftEdges;

    const file = path.join(screenshotDir, `columns_${sort.replace(',', '_')}.png`);
    await page.screenshot({path: file, fullPage: true});
    console.log(`${sort.padEnd(10)} column left-edges: [${leftEdges.join(', ')}]  -> ${file}`);
  }

  // Every sort must produce the identical set of column left edges (within 1px).
  const baseline = leftEdgesPerSort[SORTS[0]];
  for (const sort of SORTS) {
    for (let i = 0; i < COLUMNS.length; i++) {
      expect(Math.abs(leftEdgesPerSort[sort][i] - baseline[i]),
        `column "${COLUMNS[i]}" shifted for sort=${sort}`).toBeLessThanOrEqual(1);
    }
  }
});
