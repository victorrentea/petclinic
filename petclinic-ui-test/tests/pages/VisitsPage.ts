import {Page, Locator} from '@playwright/test';

export interface VisitRow {
  date: string;
  description: string;
  petName: string;
  ownerFullName: string;
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

  async open(): Promise<void> {
    await this.page.goto('/visits');
    await this.pageTitle.waitFor({state: 'visible', timeout: 10000});
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
