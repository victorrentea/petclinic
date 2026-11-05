import {Given, Then, When} from '@cucumber/cucumber';
import {expect} from '@playwright/test';
import {click_add_visit_for_first_pet, open_owner_detail_page, OwnerWithPet} from './add-visit.dsl';
import {
  expect_no_visit_saved,
  kevin_owns_a_dog_born_on,
  type_visit_date,
} from './visit-date-range.dsl';
import {PlaywrightWorld} from './support/world';

// "Today" is the browser's clock only: the form refuses the date before any request leaves, so
// the backend's own clock never takes part here. Its half of the rule is VisitDateRangeTest.

let dog: OwnerWithPet;

Given('today is {word}', async function (this: PlaywrightWorld, isoDate: string) {
  await this.page.clock.setFixedTime(new Date(`${isoDate}T10:00:00`));
});

Given('a pet born on {word}', async function (this: PlaywrightWorld, birthDate: string) {
  dog = await kevin_owns_a_dog_born_on(birthDate);
});

When('I book a visit for {word}', async function (this: PlaywrightWorld, visitDate: string) {
  await open_owner_detail_page(this.page, dog.ownerId);
  await click_add_visit_for_first_pet(this.page, 'Add Visit');
  await type_visit_date(this.page, visitDate);
  // force: a user can click a disabled button too — nothing happens, which is the point.
  await this.page.locator('button[type="submit"]:has-text("Add Visit")').click({force: true});
});

Then('the visit is refused', async function (this: PlaywrightWorld) {
  await expect(this.page.locator('h2:has-text("New Visit")'), 'still on the New Visit form').toBeVisible();
  await expect(this.page.locator('#visit .has-error .help-block'), 'the date is flagged').toBeVisible();
  await expect_no_visit_saved(dog);
});
