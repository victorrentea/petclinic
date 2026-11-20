import {expect, Locator, Page} from '@playwright/test';

/** "New Visit", for one pet: the pet it is for, a date, a description. */
export class VisitForm {
  readonly heading: Locator;
  readonly date: Locator;
  readonly description: Locator;
  /** Who attends: an `<app-combo>` whose empty choice reads "No vet". */
  readonly vet: Locator;
  /** What the vet field shows right now. */
  readonly chosenVet: Locator;
  readonly addVisitButton: Locator;

  constructor(private readonly page: Page) {
    this.heading = page.getByRole('heading', {name: 'New Visit'});
    this.date = page.locator('input[name="date"]');
    this.description = page.locator('input#description');
    this.vet = page.locator('select#vet');
    this.chosenVet = this.vet.locator('option:checked');
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

  /**
   * Picks the first real vet and returns the name it showed. "Real" is the first option after
   * the empty one: `<app-combo>` binds its options by *index*, so the option values say
   * nothing about which vet is which — the label is the only handle.
   */
  async chooseFirstVet(): Promise<string> {
    const firstVet = this.vet.locator('option:not([value=""])').first();
    const vetName = ((await firstVet.textContent()) || '').trim();
    expect(vetName, 'the booking form offers no vet to choose').not.toEqual('');
    await this.vet.selectOption({label: vetName});
    return vetName;
  }

  /** A validation message under a field. */
  error(message: string): Locator {
    return this.page.locator('.help-block', {hasText: message});
  }

  async submit(): Promise<void> {
    await this.addVisitButton.click();
  }
}
