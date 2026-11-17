// spec: explored live on :4200 — Owner Information > Add New Pet
import {test, expect} from '../support/trace-fixture';
import {anOwner} from '../support/arrange';

test.describe('Pets', () => {
  test('Add a pet to an owner', async ({page}) => {
    const ownerId = await anOwner();

    // 1. Open the owner's page and click "Add New Pet"
    await page.goto(`/owners/${ownerId}`);
    await page.getByRole('button', {name: 'Add New Pet'}).click();
    await expect(page.getByRole('heading', {name: 'Add Pet'})).toBeVisible();

    // 2. Save stays disabled until name, birth date and type are all filled
    const save = page.getByRole('button', {name: 'Save Pet'});
    await expect(save).toBeDisabled();
    await page.locator('#name').fill('Rex');
    await page.locator('input[name="birthDate"]').fill('2020-03-15');
    await page.locator('#type').selectOption({label: 'dog'});
    await expect(save).toBeEnabled();

    // 3. Save and land back on the owner's page, listing the new pet
    await save.click();
    await expect(page).toHaveURL(new RegExp(`/owners/${ownerId}$`));
    const pet = page.locator('app-pet-list').filter({hasText: 'Rex'});
    await expect(pet).toContainText('2020-03-15');
    await expect(pet).toContainText('dog');
  });
});
