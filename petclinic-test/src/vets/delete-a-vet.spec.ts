// spec: explored live on :4200 — Veterinarians > Delete Vet
import {test, expect} from '../support/trace-fixture';
import {aVet, getStatus, uniqueLetters} from '../support/arrange';

test.describe('Veterinarians', () => {
  test('Delete a vet', async ({page}) => {
    const lastName = uniqueLetters('Howser');
    const vetId = await aVet('Doogie', lastName, ['radiology']);
    const vetRow = () => page.getByRole('row').filter({hasText: `Doogie ${lastName}`});

    // 1. Open the vets list, which shows the vet
    await page.goto('/vets');
    await expect(vetRow()).toHaveCount(1);

    // 2. Click "Delete Vet" — there is no confirmation
    await vetRow().getByRole('button', {name: 'Delete Vet'}).click();

    // 3. The row goes at once, stays gone after a reload, and the server no longer has the vet
    await expect(vetRow()).toHaveCount(0);
    await page.reload();
    await expect(page.getByRole('heading', {name: 'Veterinarians'})).toBeVisible();
    await expect(vetRow()).toHaveCount(0);
    expect(await getStatus(`/vets/${vetId}`)).toBe(404);
  });
});
