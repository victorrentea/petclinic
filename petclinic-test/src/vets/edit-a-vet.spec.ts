// spec: explored live on :4200 — Veterinarians > Edit Vet
import {test, expect} from '../support/trace-fixture';
import {aVet, uniqueLetters} from '../support/arrange';

test.describe('Veterinarians', () => {
  test('Edit a vet: rename and swap a specialty', async ({page}) => {
    const lastName = uniqueLetters('Howser');
    const renamed = uniqueLetters('Quinn');
    await aVet('Doogie', lastName, ['dentistry']);

    // 1. Open the vets list and edit the vet
    await page.goto('/vets');
    await page.getByRole('row').filter({hasText: `Doogie ${lastName}`})
      .getByRole('button', {name: 'Edit Vet'}).click();
    await expect(page.getByRole('heading', {name: 'Edit Veterinarian'})).toBeVisible();

    // 2. Rename, then trade dentistry for surgery in the multi-select
    await page.locator('#lastName').fill(renamed);
    await page.locator('#spec').click();
    await page.getByRole('option', {name: 'dentistry'}).click();
    await page.getByRole('option', {name: 'surgery'}).click();
    await page.keyboard.press('Escape');

    // 3. Save: the list shows the new name with surgery only
    await page.getByRole('button', {name: 'Save Vet'}).click();
    await expect(page).toHaveURL(/\/vets$/);
    const row = page.getByRole('row').filter({hasText: `Doogie ${renamed}`});
    await expect(row).toContainText('surgery');
    await expect(row).not.toContainText('dentistry');
    await expect(page.getByRole('row').filter({hasText: `Doogie ${lastName}`})).toHaveCount(0);
  });
});
