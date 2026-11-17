// spec: explored live on :4200 — Pet Types > Add
import {test, expect} from '../support/trace-fixture';
import {uniqueLetters} from '../support/arrange';

test.describe('Pet Types', () => {
  test('A new pet type is listed by name right after saving', async ({page}) => {
    const name = uniqueLetters('ferret');

    // 1. Open the pet types list and click "Add"
    await page.goto('/pettypes');
    await page.getByRole('button', {name: 'Add', exact: true}).click();
    await expect(page.getByRole('heading', {name: 'New Pet Type'})).toBeVisible();

    // 2. Type a name and save
    await page.locator('#name').fill(name);
    await page.getByRole('button', {name: 'Save', exact: true}).click();

    // 3. Without reloading, the last row of the list shows that name
    await expect(page.locator('input[name="pettype_name"]').last()).toHaveValue(name);
  });
});
