import {test} from './support/trace-fixture';
import {GENERATE_SEQUENCE_TAG} from './genseq/sequence-tag';
import {
  anOwnerWithAtLeastOnePetExists,
  clickAddVisitForFirstPet,
  expectBackOnOwnerDetailPage,
  expectPetVisitListContains,
  expectPetVisitListShowsNoVet,
  expectPetVisitListShowsVet,
  fillVisitDateAndUniqueDescription,
  openOwnerDetailPage,
  selectFirstVetInVisitForm,
  submitVisitForm,
} from './add-visit.dsl';

// Scenario as a DSL: the body is a list of sentences from add-visit.dsl.ts, so
// it reads like Gherkin without a parser, a regex step lookup or a shared
// mutable World — and every sentence stays ctrl-clickable, renameable and
// type-checked. owner-search.feature is the Gherkin half of the comparison.
//
// @generate_sequence turns this run into add-visit.spec.ts.genseq.puml, right here
// in this folder — one section per tagged test in the file.

const VISIT_DATE = '2026-05-12';

test('Add a visit to an existing pet from the owner detail page',
  {tag: [GENERATE_SEQUENCE_TAG]},
  async ({page}) => {
    const {ownerId} = await anOwnerWithAtLeastOnePetExists();

    await openOwnerDetailPage(page, ownerId);
    await clickAddVisitForFirstPet(page, 'Add Visit');
    const description = await fillVisitDateAndUniqueDescription(page, VISIT_DATE);
    await submitVisitForm(page);

    await expectBackOnOwnerDetailPage(page, ownerId);
    await expectPetVisitListContains(page, VISIT_DATE, description);
    await expectPetVisitListShowsNoVet(page, VISIT_DATE, description);
  });

// The vet link crosses browser -> API -> DB, so this one is tagged too: its trace is the
// diagram a reviewer of that change needs.
test('Add a visit attended by a vet',
  {tag: [GENERATE_SEQUENCE_TAG]},
  async ({page}) => {
    const {ownerId} = await anOwnerWithAtLeastOnePetExists();

    await openOwnerDetailPage(page, ownerId);
    await clickAddVisitForFirstPet(page, 'Add Visit');
    const description = await fillVisitDateAndUniqueDescription(page, VISIT_DATE);
    const vetName = await selectFirstVetInVisitForm(page);
    await submitVisitForm(page);

    await expectBackOnOwnerDetailPage(page, ownerId);
    await expectPetVisitListShowsVet(page, VISIT_DATE, description, vetName);
  });
