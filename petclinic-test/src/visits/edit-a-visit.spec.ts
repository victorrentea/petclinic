// spec: explored live on :4200 — Owner Information > Edit Visit
import {test, expect} from '../support/trace-fixture';
import {aDogOf, anOwner, aVisitOf, getJson} from '../support/arrange';

test.describe('Visits', () => {
  test('Edit a visit', async ({page}) => {
    const ownerId = await anOwner();
    const petId = await aDogOf(ownerId, 'Rex');
    const visitId = await aVisitOf(ownerId, petId, 'limping');

    // 1. Open the owner's page and click "Edit Visit" next to the visit
    await page.goto(`/owners/${ownerId}`);
    await page.locator('app-visit-list tr').filter({hasText: 'limping'})
      .getByRole('button', {name: 'Edit Visit'}).click();
    await expect(page.getByRole('heading', {name: 'Edit Visit'})).toBeVisible();

    // 2. Change the description once the visit has loaded, then update
    await expect(page.locator('#description')).toHaveValue('limping');
    await page.locator('#description').fill('limping - healed');
    await page.getByRole('button', {name: 'Update Visit'}).click();

    // 3. Back on the owner's page, the visit shows the new description, date untouched
    await expect(page).toHaveURL(new RegExp(`/owners/${ownerId}$`));
    const row = page.locator('app-visit-list tr').filter({hasText: 'limping - healed'});
    await expect(row).toContainText('2026-05-12');
    expect(await getJson(`/visits/${visitId}`)).toMatchObject({description: 'limping - healed', date: '2026-05-12'});
  });
});
