import { Page, Locator, expect } from '@playwright/test';

export class OwnerCrudPage {
  readonly page: Page;
  readonly searchInput: Locator;
  readonly noOwnersMessage: Locator;
  readonly ownerNameCells: Locator;

  constructor(page: Page) {
    this.page = page;
    this.searchInput = page.getByPlaceholder('Search by name, address, city, phone or pet…');
    this.noOwnersMessage = page.getByText('No owners found.');
    this.ownerNameCells = page.locator('#ownersTable td.ownerFullName');
  }

  async openOwnersList() {
    await this.page.goto('/owners');
    await expect(this.page.getByRole('heading', { name: 'Owners' })).toBeVisible({ timeout: 10000 });
  }

  async search(query: string) {
    await this.searchInput.fill(query);
    // Wait for 500ms debounce + network round-trip
    await this.page.waitForTimeout(700);
  }

  async waitForSearchResults(expectedCount: number) {
    if (expectedCount === 0) {
      await expect(this.noOwnersMessage).toBeVisible({ timeout: 5000 });
    } else {
      await expect(this.ownerNameCells).toHaveCount(expectedCount, { timeout: 5000 });
    }
  }

  async getOwnerNames(): Promise<string[]> {
    const cells = await this.ownerNameCells.all();
    return Promise.all(cells.map(c => c.innerText()));
  }

  async clickAddOwner() {
    await this.page.getByRole('button', { name: 'Add Owner' }).click();
    await expect(this.page.getByRole('heading', { name: 'New Owner' })).toBeVisible({ timeout: 5000 });
  }

  async fillOwnerForm(firstName: string, lastName: string, address: string, city: string, telephone: string) {
    await this.page.getByRole('textbox', { name: 'First Name' }).fill(firstName);
    await this.page.getByRole('textbox', { name: 'Last Name' }).fill(lastName);
    await this.page.getByRole('textbox', { name: 'Address' }).fill(address);
    await this.page.getByRole('textbox', { name: 'City' }).fill(city);
    await this.page.getByRole('textbox', { name: 'Telephone' }).fill(telephone);
  }

  async submitAddOwner() {
    await this.page.locator('button[type="submit"]', { hasText: 'Add Owner' }).click();
    await expect(this.page).toHaveURL(/\/owners$/, { timeout: 5000 });
  }

  async openOwnerDetail(ownerName: string) {
    await this.page.getByRole('link', { name: ownerName }).click();
    await expect(this.page.getByRole('heading', { name: 'Owner Information' })).toBeVisible({ timeout: 5000 });
  }

  async clickEditOwner() {
    await this.page.getByRole('button', { name: 'Edit Owner' }).click();
    await expect(this.page.getByRole('heading', { name: 'Edit Owner' })).toBeVisible({ timeout: 5000 });
  }

  async updateLastName(newLastName: string) {
    await this.page.getByRole('textbox', { name: 'Last Name' }).fill(newLastName);
  }

  async submitUpdateOwner() {
    await this.page.getByRole('button', { name: 'Update Owner' }).click();
    await expect(this.page.getByRole('heading', { name: 'Owner Information' })).toBeVisible({ timeout: 5000 });
  }
}
