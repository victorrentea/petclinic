import {expect, Locator, Page} from '@playwright/test';

/** "New Visit", for one pet: the pet it is for, a date, a description. */
export class VisitForm {
  readonly heading: Locator;
  readonly date: Locator;
  readonly description: Locator;
  readonly addVisitButton: Locator;

  constructor(private readonly page: Page) {
    this.heading = page.getByRole('heading', {name: 'New Visit'});
    this.date = page.locator('input[name="date"]');
    this.description = page.locator('input#description');
    this.addVisitButton = page.locator('form#visit').getByRole('button', {name: 'Add Visit'});
  }

  static async open(page: Page, petId: number): Promise<VisitForm> {
    await page.goto(`/pets/${petId}/visits/add`);
    return VisitForm.shown(page);
  }

  static async shown(page: Page): Promise<VisitForm> {
    const form = new VisitForm(page);
    await expect(form.heading).toBeVisible({timeout: 10_000});
    return form;
  }

  /** The cell naming the pet the visit is booked for. */
  pet(name: string): Locator {
    return this.page.getByRole('cell', {name});
  }

  /** Leaves the description field, so the form validates what was typed. */
  async fill(date: string, description: string): Promise<void> {
    await this.date.fill(date);
    await this.description.fill(description);
    await this.description.press('Tab');
  }

  /** A validation message under a field. */
  error(message: string): Locator {
    return this.page.locator('.help-block', {hasText: message});
  }

  async submit(): Promise<void> {
    await this.addVisitButton.click();
  }
}
