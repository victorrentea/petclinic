import {Page, Locator} from '@playwright/test';

/**
 * Page object for the "New Visit" form at /pets/:petId/visits/add.
 * The date field is an Angular Material datepicker (moment adapter, format YYYY/MM/DD).
 */
export class VisitAddPage {
  readonly page: Page;
  readonly heading: Locator;
  readonly petInfoTable: Locator;
  readonly petNameCell: Locator;
  readonly petBirthDateCell: Locator;
  readonly dateInput: Locator;
  readonly descriptionInput: Locator;
  readonly addButton: Locator;
  readonly dateBeforeBirthError: Locator;
  readonly dateTooFarError: Locator;

  constructor(page: Page) {
    this.page = page;
    this.heading = page.locator('h2:has-text("New Visit")');
    this.petInfoTable = page.locator('.table-striped').first();
    this.petNameCell = this.petInfoTable.locator('td').nth(0);
    this.petBirthDateCell = this.petInfoTable.locator('td').nth(1);
    this.dateInput = page.locator('#visit input[name="date"]');
    this.descriptionInput = page.locator('#visit #description');
    this.addButton = page.locator('#visit button[type="submit"]');
    this.dateBeforeBirthError = page.locator('#visit .help-block', {hasText: 'birth date'});
    this.dateTooFarError = page.locator('#visit .help-block', {hasText: 'year in the future'});
  }

  async open(petId: number): Promise<void> {
    await this.page.goto(`/pets/${petId}/visits/add`);
    await this.heading.waitFor({state: 'visible', timeout: 10000});
  }

  /** Wait until the pet has loaded (birth-date cell filled) so the datepicker min/max are set. */
  async waitForPetLoaded(): Promise<void> {
    await this.page.waitForFunction(() => {
      const cell = document.querySelector('.table-striped td:nth-child(2)');
      return !!cell && (cell.textContent || '').trim().length > 0;
    }, undefined, {timeout: 10000});
  }

  async petBirthDate(): Promise<string> {
    return ((await this.petBirthDateCell.textContent()) || '').trim();
  }

  async fillDescription(value: string): Promise<void> {
    await this.descriptionInput.fill(value);
  }

  /** Type an explicit YYYY/MM/DD date into the datepicker input and blur to trigger parsing/validation. */
  async setDate(yyyySlashMmDd: string): Promise<void> {
    await this.dateInput.fill(yyyySlashMmDd);
    await this.dateInput.blur();
  }

  async setDateYearsFromToday(yearsFromNow: number): Promise<void> {
    const d = new Date();
    d.setFullYear(d.getFullYear() + yearsFromNow);
    await this.setDate(VisitAddPage.formatSlash(d));
  }

  async setTodayDate(): Promise<void> {
    await this.setDate(VisitAddPage.formatSlash(new Date()));
  }

  static formatSlash(d: Date): string {
    const y = String(d.getFullYear()).padStart(4, '0');
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}/${m}/${day}`;
  }
}
