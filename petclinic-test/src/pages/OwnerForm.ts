import {expect, Locator, Page} from '@playwright/test';

export interface OwnerDetails {
  firstName: string;
  lastName: string;
  address: string;
  city: string;
  telephone: string;
}

/** The owner form: "New Owner" at /owners/add, "Edit Owner" behind an owner's page. */
export class OwnerForm {
  readonly firstName: Locator;
  readonly lastName: Locator;
  readonly address: Locator;
  readonly city: Locator;
  readonly telephone: Locator;
  /** "Add Owner" on the new form, "Update Owner" on the edit one. */
  readonly saveButton: Locator;

  constructor(page: Page) {
    this.firstName = page.locator('#firstName');
    this.lastName = page.locator('#lastName');
    this.address = page.locator('#address');
    this.city = page.locator('#city');
    this.telephone = page.locator('#telephone');
    this.saveButton = page.locator('form button[type="submit"]');
  }

  static async openNew(page: Page): Promise<OwnerForm> {
    await page.goto('/owners/add');
    return OwnerForm.shown(page, 'New Owner');
  }

  static async shown(page: Page, title: 'New Owner' | 'Edit Owner'): Promise<OwnerForm> {
    await expect(page.getByRole('heading', {name: title})).toBeVisible({timeout: 10_000});
    return new OwnerForm(page);
  }

  /** Types only the fields given; the others keep what they show. */
  async fill(details: Partial<OwnerDetails>): Promise<void> {
    for (const [field, value] of Object.entries(details) as [keyof OwnerDetails, string][]) {
      await this[field].fill(value);
    }
  }

  async save(): Promise<void> {
    await this.saveButton.click();
  }
}
