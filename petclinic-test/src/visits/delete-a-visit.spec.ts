// spec: explored live on :4200 — Owner Information > Delete Visit
import {test, expect} from '../support/trace-fixture';
import {aDogOf, anOwner, aVisitOf, getStatus} from '../support/arrange';

test.describe('Visits', () => {
  test('Delete a visit', async ({page}) => {
    const ownerId = await anOwner();
    const petId = await aDogOf(ownerId, 'Rex');
    const keptVisitId = await aVisitOf(ownerId, petId, 'vaccination');
    const deletedVisitId = await aVisitOf(ownerId, petId, 'limping');

    // 1. Open the owner's page, listing both visits of the pet
    await page.goto(`/owners/${ownerId}`);
    const visitRows = page.locator('app-visit-list tr');
    await expect(visitRows.filter({hasText: 'limping'})).toBeVisible();

    // 2. Click "Delete Visit" on the "limping" visit only
    await visitRows.filter({hasText: 'limping'})
      .getByRole('button', {name: 'Delete Visit'}).click();

    // 3. Only that visit disappears, from the page and from the server
    await expect(visitRows.filter({hasText: 'limping'})).toHaveCount(0);
    await expect(visitRows.filter({hasText: 'vaccination'})).toHaveCount(1);
    expect(await getStatus(`/visits/${deletedVisitId}`)).toBe(404);
    expect(await getStatus(`/visits/${keptVisitId}`)).toBe(200);
  });
});
