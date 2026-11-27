import {expect, Locator, Page} from '@playwright/test';
import {OwnerPage} from './OwnerPage';

/** How the grid names an owner: last name first, since it is the sort key (GH #25). */
export const asListed = (o: {firstName: string; lastName: string}) => `${o.lastName}, ${o.firstName}`;

/** /owners: the search form and one page of the owners it found (GH #25), with its pager. */
export class OwnersPage {
  readonly heading: Locator;
  readonly lastNameSearch: Locator;
  readonly findOwnerButton: Locator;
  /** One cell per owner listed, reading "Last, First" (see asListed). */
  readonly ownerNames: Locator;
  /** "1 – 10 of 26" */
  readonly rangeLabel: Locator;

  constructor(private readonly page: Page) {
    this.heading = page.getByRole('heading', {name: 'Owners', exact: true});
    this.lastNameSearch = page.locator('#search-owner-form #lastName');
    this.findOwnerButton = page.getByRole('button', {name: 'Find Owner'});
    this.ownerNames = page.locator('#ownersTable td.ownerFullName');
    this.rangeLabel = page.locator('#ownersTable .mat-mdc-paginator-range-label');
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

  async showRowsPerPage(size: 5 | 10 | 20): Promise<void> {
    await this.page.locator('#ownersTable mat-paginator mat-select').click();
    await this.page.getByRole('option', {name: String(size), exact: true}).click();
  }

  async nextPage(): Promise<void> {
    await this.page.getByRole('button', {name: 'Next page'}).click();
  }

  /** Each click flips the order: A→Z first, then Z→A. */
  async sortBy(column: 'Name' | 'City'): Promise<void> {
    await this.page.locator('#ownersTable th', {hasText: column}).click();
  }

  async sortableColumns(): Promise<string[]> {
    return (await this.page.locator('#ownersTable th[mat-sort-header]').allTextContents()).map((t) => t.trim());
  }

  /** @param listedName as the grid shows it, see {@link asListed} */
  async openOwner(listedName: string): Promise<OwnerPage> {
    await this.ownerNames.getByRole('link', {name: listedName}).click();
    return OwnerPage.shown(this.page);
  }
}
