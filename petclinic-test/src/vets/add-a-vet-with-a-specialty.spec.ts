// spec: explored live on :4200 — Veterinarians > Add Vet
import {test, expect} from '../support/trace-fixture';
import {uniqueLetters} from '../support/arrange';

test.describe('Veterinarians', () => {
  test('Add a vet with a specialty', async ({page}) => {
    const lastName = uniqueLetters('Howser');

    // 1. Open the vets list and click "Add Vet"
    await page.goto('/vets');
    await page.getByRole('button', {name: 'Add Vet'}).click();
    await expect(page.getByRole('heading', {name: 'New Veterinarian'})).toBeVisible();

    // 2. Fill the names and pick a specialty
    await expect(page.getByRole('button', {name: 'Save Vet'})).toBeDisabled();
    await page.locator('#firstName').fill('Doogie');
    await page.locator('#lastName').fill(lastName);
    await page.locator('#specialties').selectOption({label: 'cardiology'});

    // 3. Save and find the vet listed with that specialty
    await page.getByRole('button', {name: 'Save Vet'}).click();
    await expect(page).toHaveURL(/\/vets$/);
    const row = page.getByRole('row').filter({hasText: `Doogie ${lastName}`});
    await expect(row).toContainText('cardiology');
  });
});
