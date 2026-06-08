import { test, expect } from '@playwright/test';

// Guards against columns shifting left/right when the row content changes between sorts.
const SORTS = ['name,asc', 'name,desc', 'city,asc', 'city,desc'];

interface Box { x: number; w: number; }

test('column widths stay stable across every sortable column/direction', async ({ page }) => {
  const boxesBySort: Record<string, Box[]> = {};

  for (const sort of SORTS) {
    await page.goto(`/owners?page=0&size=10&sort=${sort}`);
    await page.locator('#ownersTable td.ownerFullName').first().waitFor({ state: 'visible', timeout: 10_000 });

    const headers = page.locator('#ownersTable thead th');
    const count = await headers.count();
    const boxes: Box[] = [];
    for (let i = 0; i < count; i++) {
      const box = await headers.nth(i).boundingBox();
      boxes.push({ x: Math.round(box!.x), w: Math.round(box!.width) });
    }
    boxesBySort[sort] = boxes;
    await page.screenshot({ path: `test-results/columns_${sort.replace(',', '_')}.png`, fullPage: true });
  }

  const reference = boxesBySort[SORTS[0]];
  for (const sort of SORTS.slice(1)) {
    expect(boxesBySort[sort].length, `header count for ${sort}`).toBe(reference.length);
    for (let i = 0; i < reference.length; i++) {
      expect(Math.abs(boxesBySort[sort][i].x - reference[i].x),
        `column ${i} x drifted for sort ${sort}`).toBeLessThanOrEqual(1);
      expect(Math.abs(boxesBySort[sort][i].w - reference[i].w),
        `column ${i} width drifted for sort ${sort}`).toBeLessThanOrEqual(1);
    }
  }
});
