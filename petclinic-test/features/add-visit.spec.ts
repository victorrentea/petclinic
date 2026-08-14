import {Page} from '@playwright/test';
import {test} from './dsl/trace-fixture';
import {GENERATE_SEQUENCE_TAG} from '../src/trace-diagram/sequence-tag';
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
} from './dsl/add-visit.dsl';

// The plain-TypeScript twin of add-visit.feature, driving the very same glue
// functions its step_definitions call. The test reads top-to-bottom as the
// scenario itself — the function names are the sentences, so no Gherkin parser,
// no regex step lookup and no shared mutable World are needed to get there.

test.describe('Add a visit', () => {

  async function addVisitFromTheOwnerDetailPage(page: Page, visitDate: string): Promise<void> {
    const {ownerId} = await anOwnerWithAtLeastOnePetExists();

    await openOwnerDetailPage(page, ownerId);
    await clickAddVisitForFirstPet(page, 'Add Visit');
    const description = await fillVisitDateAndUniqueDescription(page, visitDate);
    await submitVisitForm(page);

    await expectBackOnOwnerDetailPage(page, ownerId);
    await expectPetVisitListContains(page, visitDate, description);
  }

  // What a Scenario Outline's Examples table expresses, only type-checked: the
  // middle row is deliberately untagged, so it records no trace window and
  // leaves no .puml behind.
  const scenarios = [
    {name: 'Add a visit to an existing pet from the owner detail page', date: '2026-05-12', sequence: true},
    {name: 'Add a back-dated visit without capturing a sequence diagram', date: '2025-02-03', sequence: false},
    {name: 'Add a follow-up visit and capture its sequence diagram', date: '2026-08-20', sequence: true},
  ];

  test('Add a visit attended by a vet', async ({page}) => {
    const {ownerId} = await anOwnerWithAtLeastOnePetExists();
    const visitDate = '2026-09-15';

    await openOwnerDetailPage(page, ownerId);
    await clickAddVisitForFirstPet(page, 'Add Visit');
    const description = await fillVisitDateAndUniqueDescription(page, visitDate);
    const vetName = await selectFirstVetInVisitForm(page);
    await submitVisitForm(page);

    await expectBackOnOwnerDetailPage(page, ownerId);
    await expectPetVisitListShowsVet(page, visitDate, description, vetName);
  });

  for (const scenario of scenarios) {
    const tag = scenario.sequence ? [GENERATE_SEQUENCE_TAG] : [];
    test(scenario.name, {tag}, async ({page}) => addVisitFromTheOwnerDetailPage(page, scenario.date));
  }
});
