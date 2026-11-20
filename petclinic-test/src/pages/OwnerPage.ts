import {expect, Locator, Page} from '@playwright/test';
import {OwnerForm} from './OwnerForm';
import {VisitForm} from './VisitForm';

/** /owners/{id}: who the owner is, and one card per pet with its visits. */
export class OwnerPage {
  readonly heading: Locator;
  /** Name, address, city and telephone. */
  readonly details: Locator;
  readonly editOwnerButton: Locator;

  constructor(private readonly page: Page) {
    this.heading = page.getByRole('heading', {name: 'Owner Information'});
    this.details = page.locator('table.table').first();
    this.editOwnerButton = page.getByRole('button', {name: 'Edit Owner'});
  }

  static async open(page: Page, ownerId: number): Promise<OwnerPage> {
    await page.goto(`/owners/${ownerId}`);
    return OwnerPage.shown(page, ownerId);
  }

  /** The page a flow lands on — after a search, a saved visit, an updated owner. */
  static async shown(page: Page, ownerId?: number): Promise<OwnerPage> {
    if (ownerId !== undefined) {
      await expect(page).toHaveURL(new RegExp(`/owners/${ownerId}$`), {timeout: 10_000});
    }
    const owner = new OwnerPage(page);
    await expect(owner.heading).toBeVisible({timeout: 10_000});
    return owner;
  }

  async editOwner(): Promise<OwnerForm> {
    await this.editOwnerButton.click();
    return OwnerForm.shown(this.page, 'Edit Owner');
  }

  /** The pets in the order the page lists them: `pet(0)` is the first. */
  pet(index: number): PetCard {
    return new PetCard(this.page, this.page.locator('app-pet-list').nth(index));
  }
}

/** One pet on the owner's page: its details, its buttons, the visits it had. */
export class PetCard {
  readonly addVisitButton: Locator;

  constructor(private readonly page: Page, private readonly root: Locator) {
    this.addVisitButton = root.getByRole('button', {name: 'Add Visit'});
  }

  async addVisit(): Promise<VisitForm> {
    await this.addVisitButton.click();
    return VisitForm.shown(this.page);
  }

  /** The row of the visit on that date with that description. */
  visit(date: string, description: string): Locator {
    return this.root.locator('app-visit-list tr').filter({hasText: date}).filter({hasText: description});
  }
}
