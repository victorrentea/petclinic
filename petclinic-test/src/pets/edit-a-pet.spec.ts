// spec: explored live on :4200 — Owner Information > Edit Pet
import {test, expect} from '../support/trace-fixture';
import {aDogOf, anOwner} from '../support/arrange';

test.describe('Pets', () => {
  test('Edit a pet', async ({page}) => {
    const ownerId = await anOwner();
    const petId = await aDogOf(ownerId, 'Rex');

    // 1. Open the owner's page and click "Edit Pet"
    await page.goto(`/owners/${ownerId}`);
    await page.getByRole('button', {name: 'Edit Pet'}).click();
    await expect(page).toHaveURL(new RegExp(`/pets/${petId}/edit$`));

    // 2. Wait for the pet to load, then rename it and change its type
    await expect(page.locator('#name')).toHaveValue('Rex');
    await page.locator('#name').fill('Rexy');
    await page.locator('#type').selectOption({label: 'cat'});
    await page.getByRole('button', {name: 'Update Pet'}).click();

    // 3. Back on the owner's page, the change survives a reload
    await expect(page).toHaveURL(new RegExp(`/owners/${ownerId}$`));
    await page.reload();
    const pet = page.locator('app-pet-list').first();
    await expect(pet).toContainText('Rexy');
    await expect(pet).toContainText('cat');
  });
});
