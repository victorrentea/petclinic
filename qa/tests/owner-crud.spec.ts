import { test, expect } from '@playwright/test';
import { OwnerCrudPage } from './pages/OwnerCrudPage';
import { ApiClient } from './support/api-client';

const BASE_OWNER = {
  firstName: 'John',
  address: '123 Test St',
  city: 'Testville',
  telephone: '1234567890',
};

/** Generate a letters-only unique last name (backend pattern: ^[a-zA-Z]*$) */
function uniqueLastName(): string {
  const chars = 'abcdefghijklmnopqrstuvwxyz';
  const rand = Array.from({ length: 8 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
  return `Pwtest${rand}`;
}

test.describe('Owner CRUD flow', () => {
  let crudPage: OwnerCrudPage;
  let apiClient: ApiClient;
  let createdOwnerId: number;
  let lastName: string;

  test.beforeEach(async ({ page }) => {
    crudPage = new OwnerCrudPage(page);
    apiClient = new ApiClient();
    createdOwnerId = 0;
  });

  test.afterEach(async () => {
    if (createdOwnerId) {
      try {
        await apiClient.deleteOwner(createdOwnerId);
      } catch {
        // Already deleted by the test — that's fine
      }
    }
  });

  test('create owner and find it by name', async ({ page }) => {
    lastName = uniqueLastName();
    await crudPage.openOwnersList();

    // Create via UI
    await crudPage.clickAddOwner();
    await crudPage.fillOwnerForm(BASE_OWNER.firstName, lastName, BASE_OWNER.address, BASE_OWNER.city, BASE_OWNER.telephone);
    await crudPage.submitAddOwner();

    // Record ID for cleanup
    const owners = await apiClient.fetchOwners();
    const created = owners.find(o => o.firstName === BASE_OWNER.firstName && o.lastName === lastName);
    expect(created).toBeDefined();
    createdOwnerId = created!.id!;

    // Search by last name — should show exactly this owner
    await crudPage.search(lastName);
    await crudPage.waitForSearchResults(1);
    expect(await crudPage.getOwnerNames()).toContain(`${BASE_OWNER.firstName} ${lastName}`);
  });

  test('edit owner name and find by new name', async () => {
    lastName = uniqueLastName();
    const renamedLastName = uniqueLastName(); // completely disjoint so the contains-search doesn't cross-match
    createdOwnerId = await apiClient.createOwner({ ...BASE_OWNER, lastName });

    await crudPage.openOwnersList();

    // Search by original name, open detail
    await crudPage.search(lastName);
    await crudPage.waitForSearchResults(1);
    await crudPage.openOwnerDetail(`${BASE_OWNER.firstName} ${lastName}`);

    // Edit last name
    await crudPage.clickEditOwner();
    await crudPage.updateLastName(renamedLastName);
    await crudPage.submitUpdateOwner();

    // Back to list and search by new name
    await crudPage.openOwnersList();
    await crudPage.search(renamedLastName);
    await crudPage.waitForSearchResults(1);
    expect(await crudPage.getOwnerNames()).toContain(`${BASE_OWNER.firstName} ${renamedLastName}`);

    // Old name should not appear
    await crudPage.search(lastName);
    await crudPage.waitForSearchResults(0);
  });

  test('delete owner and confirm it is gone', async () => {
    lastName = uniqueLastName();
    createdOwnerId = await apiClient.createOwner({ ...BASE_OWNER, lastName });

    // Verify visible in UI
    await crudPage.openOwnersList();
    await crudPage.search(lastName);
    await crudPage.waitForSearchResults(1);

    // Delete via API (no delete button in UI)
    await apiClient.deleteOwner(createdOwnerId);
    createdOwnerId = 0;

    // Reload and search — should be gone
    await crudPage.openOwnersList();
    await crudPage.search(lastName);
    await crudPage.waitForSearchResults(0);
  });

  test('full CRUD: create → search → rename → search new name → delete → confirm gone', async () => {
    lastName = uniqueLastName();
    const renamedLastName = uniqueLastName(); // completely disjoint so the contains-search doesn't cross-match
    await crudPage.openOwnersList();

    // 1. Create via UI
    await crudPage.clickAddOwner();
    await crudPage.fillOwnerForm(BASE_OWNER.firstName, lastName, BASE_OWNER.address, BASE_OWNER.city, BASE_OWNER.telephone);
    await crudPage.submitAddOwner();

    // Record created ID
    const owners = await apiClient.fetchOwners();
    const created = owners.find(o => o.firstName === BASE_OWNER.firstName && o.lastName === lastName);
    expect(created).toBeDefined();
    createdOwnerId = created!.id!;

    // 2. Search by original last name
    await crudPage.search(lastName);
    await crudPage.waitForSearchResults(1);
    expect(await crudPage.getOwnerNames()).toContain(`${BASE_OWNER.firstName} ${lastName}`);

    // 3. Edit last name via UI
    await crudPage.openOwnerDetail(`${BASE_OWNER.firstName} ${lastName}`);
    await crudPage.clickEditOwner();
    await crudPage.updateLastName(renamedLastName);
    await crudPage.submitUpdateOwner();

    // 4. Search by new name
    await crudPage.openOwnersList();
    await crudPage.search(renamedLastName);
    await crudPage.waitForSearchResults(1);
    expect(await crudPage.getOwnerNames()).toContain(`${BASE_OWNER.firstName} ${renamedLastName}`);

    // 5. Delete via API
    await apiClient.deleteOwner(createdOwnerId);
    createdOwnerId = 0;

    // 6. Verify gone
    await crudPage.openOwnersList();
    await crudPage.search(renamedLastName);
    await crudPage.waitForSearchResults(0);
  });
});
