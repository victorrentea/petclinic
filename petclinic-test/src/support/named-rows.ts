import {expect, Locator, Page} from '@playwright/test';

/**
 * The row of a Pet Types / Specialties table whose read-only name input holds `name`.
 * The name lives in the input's value (ngModel), not in an attribute or text, so no
 * CSS or role locator can pick the row by it.
 */
export async function rowNamed(page: Page, table: string, name: string): Promise<Locator> {
  const inputs = page.locator(`${table} tbody input`);
  const valuesNow = () => inputs.evaluateAll(els => els.map(e => (e as HTMLInputElement).value));
  await expect.poll(async () => (await valuesNow()).includes(name)).toBe(true);
  return page.locator(`${table} tbody tr`).nth((await valuesNow()).indexOf(name));
}
