// spec: explored live on :4200 — Specialties > Delete, on a specialty some vet has
import {test, expect} from '../support/trace-fixture';
import {aSpecialty, aVet, getStatus, uniqueLetters} from '../support/arrange';
import {rowNamed} from '../support/named-rows';

test.describe('Specialties', () => {
  test('A specialty some vet still has is kept, and the database error never reaches the page', async ({page}) => {
    const name = uniqueLetters('exploratology');
    const specialtyId = await aSpecialty(name);
    await aVet('Ex', uniqueLetters('Plorer'), [name]);

    // 1. Open the specialties list and delete the one the vet has
    await page.goto('/specialties');
    await (await rowNamed(page, '#specialties', name)).getByRole('button', {name: 'Delete'}).click();

    // 2. The user reads why — and no SQL, constraint or table name
    await expect(page.getByText(/in use|assigned/i)).toBeVisible();
    await expect(page.locator('body')).not.toContainText(/constraint|delete from|vet_specialties/i);

    // 3. The specialty survives, on the page and on the server
    await page.reload();
    await rowNamed(page, '#specialties', name);
    expect(await getStatus(`/specialties/${specialtyId}`)).toBe(200);
  });
});
