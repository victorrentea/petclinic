import {test, expect, Page} from './support/trace-fixture';
import {ApiClient} from './support/api-client';

// A pet renamed on its Edit Pet form must show its new name everywhere it is read back,
// including the Edit Visit form of that pet's visit, reached from the same owner page.
// The owner is created here, with a unique last name, so the rename never touches seed rows.
function uniqueLastName(): string {
  const letters = 'abcdefghijklmnopqrstuvwxyz';
  let suffix = '';
  for (let i = 0; i < 8; i++) suffix += letters[Math.floor(Math.random() * letters.length)];
  return `Rename${suffix}`;
}

async function openOwnerFromList(page: Page, lastName: string): Promise<void> {
  await page.goto('/owners');
  await page.fill('#lastName', lastName);
  await page.locator('button:has-text("Find Owner")').click();
  const rows = page.locator('td.ownerFullName');
  await expect(rows).toHaveCount(1);
  await rows.first().locator('a').click();
  await expect(page.locator('h2:has-text("Owner Information")')).toBeVisible();
}

test('a renamed pet shows its new name on the Edit Visit form', async ({page}) => {
  const api = new ApiClient();
  const lastName = uniqueLastName();
  const ownerId = await api.createOwner('Kevin', lastName);
  const petId = await api.createPet(ownerId, 'Axel');
  await api.createVisit(ownerId, petId, '2025-12-27', 'ate the Christmas tinsel');

  await openOwnerFromList(page, lastName);

  await page.locator('button:has-text("Edit Pet")').click();
  await page.fill('#name', 'AxelTheDog');
  await page.locator('button:has-text("Update Pet")').click();
  await expect(page.locator('h2:has-text("Owner Information")')).toBeVisible();

  await page.locator('button:has-text("Edit Visit")').click();
  await expect(page.locator('h2:has-text("Edit Visit")')).toBeVisible();
  const petRow = page.locator('table').first().getByRole('row').nth(1);
  await expect(petRow.getByRole('cell').first()).toHaveText('AxelTheDog');
});
