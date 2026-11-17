// spec: explored live on :4200 — Owner Information > Delete Pet
import {test, expect} from '../support/trace-fixture';
import {aDogOf, anOwner, getStatus} from '../support/arrange';

test.describe('Pets', () => {
  test('Delete a pet', async ({page}) => {
    const ownerId = await anOwner();
    const petId = await aDogOf(ownerId, 'Rex');

    // 1. Open the owner's page, which lists the pet
    await page.goto(`/owners/${ownerId}`);
    await expect(page.locator('app-pet-list')).toHaveCount(1);

    // 2. Click "Delete Pet" — there is no confirmation
    await page.getByRole('button', {name: 'Delete Pet'}).click();

    // 3. The pet is hidden at once, absent after a reload, and gone from the server
    await expect(page.getByRole('button', {name: 'Delete Pet'})).toBeHidden();
    await page.reload();
    await expect(page.getByRole('heading', {name: 'Pets and Visits'})).toBeVisible();
    await expect(page.locator('app-pet-list')).toHaveCount(0);
    expect(await getStatus(`/pets/${petId}`)).toBe(404);
  });
});
