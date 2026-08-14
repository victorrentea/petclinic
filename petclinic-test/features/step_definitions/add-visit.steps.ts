import {Given, When, Then} from '@cucumber/cucumber';
import {PlaywrightWorld} from '../support/world';
import {
  anOwnerWithAtLeastOnePetExists,
  clickAddVisitForFirstPet,
  expectBackOnOwnerDetailPage,
  expectPetVisitListContains,
  expectPetVisitListShowsVet,
  fillVisitDateAndUniqueDescription,
  openOwnerDetailPage,
  selectFirstVetInVisitForm,
  submitVisitForm,
} from '../dsl/add-visit.dsl';

// Every step here is a one-line adapter: bind the sentence to a glue function
// from ../dsl and thread the World's state into it. The same functions back
// ../add-visit.spec.ts, which needs no adapter layer at all.

Given('an owner with at least one pet exists', async function (this: PlaywrightWorld) {
  const {ownerId, petId} = await anOwnerWithAtLeastOnePetExists();
  this.ownerId = ownerId;
  this.petId = petId;
});

When("I open that owner's detail page", async function (this: PlaywrightWorld) {
  await openOwnerDetailPage(this.page, this.ownerId!);
});

When('I click {string} for the first pet', async function (this: PlaywrightWorld, buttonLabel: string) {
  await clickAddVisitForFirstPet(this.page, buttonLabel);
});

When(
  'I fill in the visit date {string} and a unique description',
  async function (this: PlaywrightWorld, date: string) {
    this.visitDescription = await fillVisitDateAndUniqueDescription(this.page, date);
  },
);

When('I submit the visit form', async function (this: PlaywrightWorld) {
  await submitVisitForm(this.page);
});

Then("I am back on the owner's detail page", async function (this: PlaywrightWorld) {
  await expectBackOnOwnerDetailPage(this.page, this.ownerId!);
});

Then(
  "the pet's visit list contains the new visit dated {string}",
  async function (this: PlaywrightWorld, date: string) {
    if (!this.visitDescription) {
      throw new Error('Expected a unique description to have been generated earlier in the scenario');
    }
    await expectPetVisitListContains(this.page, date, this.visitDescription);
  },
);

When('I pick the first vet in the list', async function (this: PlaywrightWorld) {
  this.vetName = await selectFirstVetInVisitForm(this.page);
});

Then(
  "the pet's visit list shows the new visit dated {string} attended by that vet",
  async function (this: PlaywrightWorld, date: string) {
    if (!this.visitDescription || !this.vetName) {
      throw new Error('Expected a description and a vet to have been picked earlier in the scenario');
    }
    await expectPetVisitListShowsVet(this.page, date, this.visitDescription, this.vetName);
  },
);
