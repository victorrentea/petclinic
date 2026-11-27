import {test, expect, Page} from './support/trace-fixture';
import {OwnerDetails, OwnerForm} from './pages/OwnerForm';
import {OwnersPage} from './pages/OwnersPage';

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

const ADA: Omit<OwnerDetails, 'lastName'> = {
  firstName: 'Ada',
  address: '110 Analytical Engine Way',
  city: 'London',
  telephone: '6085551023',
};

/** Landing back on the list is also the proof the POST succeeded, not its error branch. */
async function addOwner(page: Page, lastName: string): Promise<OwnersPage> {
  const form = await OwnerForm.openNew(page);
  await form.fill({...ADA, lastName});
  await form.save();
  return OwnersPage.shown(page);
}

test('adds an owner from the New Owner form and finds them by last name', async ({page}) => {
  const lastName = uniqueLastName();

  const owners = await addOwner(page, lastName);
  await owners.searchByLastName(lastName);

  await expect(owners.ownerNames).toHaveText([`${lastName}, Ada`]);
});

test('edits an owner from their own page and the change sticks', async ({page}) => {
  const lastName = uniqueLastName();
  const owners = await addOwner(page, lastName);
  await owners.searchByLastName(lastName);
  const ada = await owners.openOwner(`${lastName}, Ada`);

  const form = await ada.editOwner();
  // The form renders empty and is filled when the owner arrives; typing before that is
  // overwritten by the load, and the PUT then sends London back.
  await expect(form.city).toHaveValue('London');
  await form.fill({city: 'Turin'});
  await form.save();

  // Back on the owner's own page, read from the server rather than from the form we
  // just filled: the PUT is only proven by what the next GET says.
  await expect(ada.heading).toBeVisible({timeout: 10_000});
  await expect(ada.details).toContainText('Turin');
  await page.reload();
  await expect(ada.details).toContainText('Turin');
});
