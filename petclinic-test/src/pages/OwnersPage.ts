import {expect, Locator, Page} from '@playwright/test';
import {OwnerPage} from './OwnerPage';

/** /owners: the search form and the table of the owners it found. */
export class OwnersPage {
  readonly heading: Locator;
  readonly lastNameSearch: Locator;
  readonly findOwnerButton: Locator;
  /** One cell per owner listed, reading "First Last". */
  readonly ownerNames: Locator;

  constructor(private readonly page: Page) {
    this.heading = page.getByRole('heading', {name: 'Owners', exact: true});
    this.lastNameSearch = page.locator('#search-owner-form #lastName');
    this.findOwnerButton = page.getByRole('button', {name: 'Find Owner'});
    this.ownerNames = page.locator('#ownersTable td.ownerFullName');
  }

  static async open(page: Page): Promise<OwnersPage> {
    await page.goto('/owners');
    return OwnersPage.shown(page);
  }

  /** The page a flow lands on, e.g. after a new owner is saved. */
  static async shown(page: Page): Promise<OwnersPage> {
    await expect(page).toHaveURL(/\/owners$/);
    const owners = new OwnersPage(page);
    await expect(owners.heading).toBeVisible({timeout: 10_000});
    return owners;
  }

  async searchByLastName(lastName: string): Promise<void> {
    await this.lastNameSearch.fill(lastName);
    await this.findOwnerButton.click();
  }

  async listedOwnerNames(): Promise<string[]> {
    return (await this.ownerNames.allTextContents()).map((t) => t.trim().replace(/\s+/g, ' ')).filter(Boolean);
  }

  async openOwner(fullName: string): Promise<OwnerPage> {
    await this.ownerNames.getByRole('link', {name: fullName}).click();
    return OwnerPage.shown(this.page);
  }
}
