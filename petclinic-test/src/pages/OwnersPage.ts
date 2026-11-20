import {Locator, Page} from '@playwright/test';

export interface ListedOwner {
  name: string;
  city: string;
}

export type SortableColumn = 'Name' | 'City';

/** The owner-list screen (/owners): its selectors, so the glue never names one. */
export class OwnersPage {
  readonly title: Locator;
  readonly searchBox: Locator;
  readonly rows: Locator;
  readonly paginator: Locator;
  readonly rangeLabel: Locator;
  readonly table: Locator;
  readonly noOwnersMessage: Locator;

  constructor(readonly page: Page) {
    this.title = page.locator('h2:has-text("Owners")');
    this.searchBox = page.locator('#lastName');
    this.table = page.locator('#ownersTable');
    this.rows = this.table.locator('tbody tr');
    this.paginator = page.locator('#ownersPaginator');
    this.rangeLabel = this.paginator.locator('.mat-mdc-paginator-range-label');
    this.noOwnersMessage = page.locator('#noOwners');
  }

  async open(link = '/owners'): Promise<void> {
    await this.page.goto(link);
    await this.title.waitFor({state: 'visible', timeout: 10_000});
  }

  async search(lastName: string): Promise<void> {
    await this.searchBox.fill(lastName);
    await this.page.locator('#search-owner-form button[type="submit"]').click();
  }

  async sortBy(column: SortableColumn): Promise<void> {
    await this.page.locator(`#${column.toLowerCase()}Header`).click();
  }

  async nextPage(): Promise<void> {
    await this.paginator.getByRole('button', {name: 'Next page'}).click();
  }

  async showPerPage(size: number): Promise<void> {
    await this.paginator.locator('mat-select').click();
    await this.page.getByRole('option', {name: String(size), exact: true}).click();
  }

  async listedOwners(): Promise<ListedOwner[]> {
    const [names, cities] = await Promise.all([
      this.rows.locator('td.ownerFullName').allTextContents(),
      this.rows.locator('td.ownerCity').allTextContents(),
    ]);
    return names.map((name, i) => ({name: firstNameFirst(squash(name)), city: squash(cities[i] ?? '')}));
  }

  /** "11 – 20 of 42", with any dash or spacing Material renders read as " – ". */
  async range(): Promise<string> {
    if (!(await this.rangeLabel.isVisible())) return '';
    return squash(await this.rangeLabel.textContent() ?? '').replace(/\s*[-–—]\s*/, ' – ');
  }

  queryParam(name: string): string | null {
    return new URL(this.page.url()).searchParams.get(name);
  }
}

const squash = (text: string) => text.replace(/\s+/g, ' ').trim();

/** The grid shows "Potter, Harry"; scenarios name owners the way people say them: "Harry Potter". */
function firstNameFirst(lastCommaFirst: string): string {
  const [last, first] = lastCommaFirst.split(', ');
  return first === undefined ? last : `${first} ${last}`;
}
