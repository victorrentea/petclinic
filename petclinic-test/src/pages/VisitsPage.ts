import {Page, Locator} from '@playwright/test';

export interface VisitRow {
  date: string;
  description: string;
  petName: string;
  ownerFullName: string;
  vetName: string;
}

export class VisitsPage {
  readonly page: Page;
  readonly pageTitle: Locator;
  readonly visitsTable: Locator;
  readonly rows: Locator;

  constructor(page: Page) {
    this.page = page;
    this.pageTitle = page.locator('h2:has-text("Visits")');
    this.visitsTable = page.locator('#visitsTable');
    this.rows = page.locator('#visitsTable tbody tr');
  }

  // The heading renders before the rows do: /visits paints its table, then fills it from the
  // API. A test that read the table on the heading alone got an empty list and blamed whatever
  // it was asserting — "rows are sorted descending by date" failed on `dates.length > 0`, which
  // says nothing about sorting. Waiting for the first row here makes every caller's assertion
  // be about what it claims to be about.
  async open(): Promise<void> {
    await this.page.goto('/visits');
    await this.pageTitle.waitFor({state: 'visible', timeout: 10000});
    await this.rows.first().waitFor({state: 'visible', timeout: 10000});
  }

  async waitForVisitsCount(expectedCount: number): Promise<void> {
    try {
      await this.page.waitForFunction(
        (count) => document.querySelectorAll('#visitsTable tbody tr').length === count,
        expectedCount,
        {timeout: 10000},
      );
    } catch {
      // let assertions surface the actual values
    }
  }

  async getVisitRows(): Promise<VisitRow[]> {
    const count = await this.rows.count();
    const result: VisitRow[] = [];
    for (let i = 0; i < count; i++) {
      const row = this.rows.nth(i);
      result.push({
        date: ((await row.locator('td.visit-date').textContent()) || '').trim(),
        description: ((await row.locator('td.visit-description').textContent()) || '').trim(),
        petName: ((await row.locator('td.visit-pet').textContent()) || '').trim(),
        ownerFullName: ((await row.locator('td.visit-owner a.owner-link').textContent()) || '').trim().replace(/\s+/g, ' '),
        vetName: ((await row.locator('td.visit-vet').textContent()) || '').trim(),
      });
    }
    return result;
  }

  async getDates(): Promise<string[]> {
    const count = await this.rows.count();
    const out: string[] = [];
    for (let i = 0; i < count; i++) {
      out.push(((await this.rows.nth(i).locator('td.visit-date').textContent()) || '').trim());
    }
    return out;
  }

  async clickFirstOwnerLink(): Promise<void> {
    await this.rows.first().locator('a.owner-link').click();
  }
}
