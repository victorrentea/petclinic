import {test, expect, Page} from './support/trace-fixture';

// The owner flows that only a browser can walk, and until now none of them did:
// every other acceptance test READS owners — the list, a detail page, the visit form
// hanging off it — so OwnerRestController's whole write side (`addOwner`, `updateOwner`,
// the search branch of `listOwners`, `getOwner` by id) was code the unit suite called
// and the browser never reached. That gap is exactly what the city's "acceptance reach"
// colour is for, and these are what close it.
//
// The owners they create are left behind on purpose, the same way add-visit.spec.ts
// leaves its visits: this suite runs against a real database and asserts on rows it can
// find again, not on a database it owns. Hence the unique last name — letters only,
// because the form rejects anything else (`pattern="^[a-zA-Z]*$"`).
function uniqueLastName(): string {
  const letters = 'abcdefghijklmnopqrstuvwxyz';
  let suffix = '';
  for (let i = 0; i < 8; i++) suffix += letters[Math.floor(Math.random() * letters.length)];
  return `Acceptance${suffix}`;
}

async function addOwnerThroughTheForm(page: Page, lastName: string): Promise<void> {
  await page.goto('/owners/add');
  await page.locator('h2:has-text("New Owner")').waitFor({state: 'visible', timeout: 10_000});

  await page.fill('#firstName', 'Ada');
  await page.fill('#lastName', lastName);
  await page.fill('#address', '110 Analytical Engine Way');
  await page.fill('#city', 'London');
  await page.fill('#telephone', '6085551023');
  await page.locator('button:has-text("Add Owner")').click();

  // The form navigates back to the list once the POST returns, so this is also the
  // assertion that the write succeeded rather than the error branch running.
  await expect(page).toHaveURL(/\/owners$/);
}

/** Finds the owner just created and opens their page — which is `getOwner` by id. */
async function openTheOwnerNamed(page: Page, lastName: string): Promise<void> {
  await page.fill('#lastName', lastName);
  await page.locator('button:has-text("Find Owner")').click();
  const rows = page.locator('td.ownerFullName');
  await expect(rows).toHaveCount(1);
  await rows.first().locator('a').click();
  await page.locator('h2:has-text("Owner Information")').waitFor({state: 'visible', timeout: 10_000});
}

test('adds an owner from the New Owner form and finds them by last name', async ({page}) => {
  const lastName = uniqueLastName();

  await addOwnerThroughTheForm(page, lastName);

  await page.fill('#lastName', lastName);
  await page.locator('button:has-text("Find Owner")').click();
  const rows = page.locator('td.ownerFullName');
  await expect(rows).toHaveCount(1);
  await expect(rows.first()).toContainText(`Ada ${lastName}`);
});

test('edits an owner from their own page and the change sticks', async ({page}) => {
  const lastName = uniqueLastName();

  await addOwnerThroughTheForm(page, lastName);
  await openTheOwnerNamed(page, lastName);

  await page.locator('button:has-text("Edit Owner")').click();
  await page.locator('h2:has-text("Owner")').first().waitFor({state: 'visible', timeout: 10_000});
  await page.fill('#city', 'Turin');
  await page.locator('button:has-text("Update Owner")').click();

  // Back on the owner's own page, read from the server rather than from the form we
  // just filled: the PUT is only proven by what the next GET says.
  await page.locator('h2:has-text("Owner Information")').waitFor({state: 'visible', timeout: 10_000});
  await expect(page.locator('table.table').first()).toContainText('Turin');
  await page.reload();
  await expect(page.locator('table.table').first()).toContainText('Turin');
});
