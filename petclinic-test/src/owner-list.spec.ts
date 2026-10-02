import {Route} from '@playwright/test';
import {test, expect} from './support/trace-fixture';

for (const column of ['city', 'name']) {
  test(`${column} sorting preserves scroll and column positions while loading`, async ({page}) => {
    await page.setViewportSize({width: 1280, height: 600});
    await page.goto('/owners');
    const table = page.locator('#ownersTable table');
    await expect(table).toHaveAttribute('aria-busy', 'false');
    const columns = () => page.locator('#ownersTable th').evaluateAll(headers =>
      headers.map(header => {
        const {x, width} = header.getBoundingClientRect();
        return {x, width};
      }));
    const originalColumns = await columns();
    const originalScroll = await page.locator('#ownersTable th').first().evaluate(header => {
      globalThis.scrollTo(0, header.getBoundingClientRect().top + globalThis.scrollY - 40);
      return globalThis.scrollY;
    });
    expect(originalScroll).toBeGreaterThan(0);
    await expect.poll(() => page.evaluate(() => globalThis.scrollY)).toBe(originalScroll);
    const rows = page.locator('#ownersTable tbody tr');
    const originalRowCount = await rows.count();

    for (let direction = 0; direction < 2; direction++) {
      let captureRoute!: (route: Route) => void;
      const intercepted = new Promise<Route>(resolve => captureRoute = resolve);
      await page.route('**/api/owners?**', captureRoute, {times: 1});
      await page.locator(`th[mat-sort-header="${column}"] [role="button"]`).click();
      const route = await intercepted;
      try {
        await expect(table).toHaveAttribute('aria-busy', 'true');
        expect(await page.evaluate(() => globalThis.scrollY)).toBe(originalScroll);
        expect(await columns()).toEqual(originalColumns);
        await expect(rows).toHaveCount(originalRowCount);
      } finally {
        await route.continue();
      }
      await expect(table).toHaveAttribute('aria-busy', 'false');
      expect(await page.evaluate(() => globalThis.scrollY)).toBe(originalScroll);
      expect(await columns()).toEqual(originalColumns);
    }
  });
}

for (const width of [1280, 375]) {
  test(`owner search fits beside the input or stacks at viewport width ${width}`, async ({page}) => {
    await page.setViewportSize({width, height: 800});
    await page.goto('/owners');
    const input = await page.getByRole('textbox', {name: 'Last name', exact: true}).boundingBox();
    const button = await page.getByRole('button', {name: 'Find Owner', exact: true}).boundingBox();
    if (!input || !button) {
      throw new Error('Owner search controls must have rendered bounds');
    }
    if (width > 576) {
      expect(button.x).toBeGreaterThan(input.x + input.width);
      expect(Math.abs(button.y + button.height / 2 - input.y - input.height / 2)).toBeLessThan(1);
    } else {
      expect(button.y).toBeGreaterThanOrEqual(input.y + input.height);
      expect(input.x + input.width).toBeLessThanOrEqual(width);
      expect(button.x + button.width).toBeLessThanOrEqual(width);
    }
  });

  test(`owner actions share a responsive footer at viewport width ${width}`, async ({page}) => {
    await page.setViewportSize({width, height: 800});
    await page.goto('/owners');
    await expect(page.locator('#ownersTable table')).toHaveAttribute('aria-busy', 'false');
    const footer = page.locator('.owners-controls');
    const addOwner = footer.getByRole('button', {name: 'Add Owner', exact: true});
    await expect(addOwner).toBeVisible();
    await expect(footer.getByRole('group', {name: 'Owners pages'})).toBeVisible();
    const footerBox = await footer.boundingBox();
    const buttonBox = await addOwner.boundingBox();
    const sizeBox = await footer.locator('.mat-mdc-paginator-page-size').boundingBox();
    const navigationBox = await footer.locator('.mat-mdc-paginator-range-actions').boundingBox();
    if (!footerBox || !buttonBox || !sizeBox || !navigationBox) {
      throw new Error('Owner footer controls must have rendered bounds');
    }
    expect(buttonBox.x).toBeGreaterThanOrEqual(footerBox.x);
    expect(buttonBox.y).toBeGreaterThanOrEqual(footerBox.y);
    expect(buttonBox.y + buttonBox.height).toBeLessThanOrEqual(footerBox.y + footerBox.height);
    expect(await footer.evaluate(element => getComputedStyle(element).backgroundColor)).toBe('rgb(255, 255, 255)');
    expect(footerBox.x + footerBox.width).toBeLessThanOrEqual(width);
    expect(sizeBox.x + sizeBox.width).toBeLessThanOrEqual(footerBox.x + footerBox.width);
    expect(navigationBox.x + navigationBox.width).toBeLessThanOrEqual(footerBox.x + footerBox.width);
    if (width > 576) {
      expect(buttonBox.x + buttonBox.width).toBeLessThan(sizeBox.x);
      expect(navigationBox.x - (sizeBox.x + sizeBox.width)).toBeGreaterThanOrEqual(80);
    } else {
      expect(sizeBox.y + sizeBox.height).toBeLessThanOrEqual(navigationBox.y + 1);
    }
    await addOwner.click();
    await expect(page).toHaveURL(/\/owners\/add$/);
  });
}
