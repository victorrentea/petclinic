// spec: explored live on :4200 — Owners > John Dolittle > Edit Owner
import {test, expect} from '../support/trace-fixture';
import {getJson} from '../support/arrange';

// The seed writes phones the way people do — +441803712345, (0044)1626832093 — and the form
// accepts only 10 bare digits. 21 of the 52 seeded owners are in that state: "Update Owner"
// stays disabled and nothing on the page says why. The other edit test owns a fresh owner
// with a valid phone, so it never meets this.
test.describe('Owners', () => {
  test.use({dbFixture: 'default'});

  test('an owner with a country-prefixed phone can still have their address corrected', async ({page}) => {
    const {content: [dolittle]} = await getJson<{content: {id: number}[]}>('/owners?lastName=Dolittle');

    // 1. Open the edit form of a seeded owner whose phone carries a +44 prefix
    await page.goto(`/owners/${dolittle.id}/edit`);
    await expect(page.locator('#telephone')).toHaveValue('+441803712345');

    // 2. Correct only the address
    await page.locator('#address').fill('Oxenthorpe Road 2');

    // 3. The form lets the change through, and the owner page shows it
    await expect(page.getByRole('button', {name: 'Update Owner'})).toBeEnabled();
    await page.getByRole('button', {name: 'Update Owner'}).click();
    await expect(page.getByRole('heading', {name: 'Owner Information'})).toBeVisible();
    await expect(page.getByRole('cell', {name: 'Oxenthorpe Road 2'})).toBeVisible();
  });
});
