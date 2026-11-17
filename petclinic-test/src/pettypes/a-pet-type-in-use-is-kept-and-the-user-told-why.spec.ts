// spec: explored live on :4200 — Pet Types > Delete, on a type some pet has
import {test, expect} from '../support/trace-fixture';
import {anOwner, aPetOfType, aPetType, getStatus, uniqueLetters} from '../support/arrange';
import {rowNamed} from '../support/named-rows';

test.describe('Pet Types', () => {
  test('A pet type some pet still has is kept, and the user is told why in words', async ({page}) => {
    const name = uniqueLetters('axolotl');
    const typeId = await aPetType(name);
    await aPetOfType(await anOwner(), 'Axel', {id: typeId, name});

    // 1. Open the pet types list and delete the type Axel has
    await page.goto('/pettypes');
    await (await rowNamed(page, '#pettypes', name)).getByRole('button', {name: 'Delete'}).click();

    // 2. A sentence explains the refusal — not the server's JSON problem document
    await expect(page.getByText(/in use/i)).toBeVisible();
    await expect(page.locator('body')).not.toContainText('"status"');

    // 3. The type survives, on the page and on the server
    await page.reload();
    await rowNamed(page, '#pettypes', name);
    expect(await getStatus(`/pettypes/${typeId}`)).toBe(200);
  });
});
