import {test} from './support/trace-fixture';
import {GENERATE_SEQUENCE_TAG} from '../scripts/trace-diagram/sequence-tag';
import {
  anOwnerWithAtLeastOnePetExists,
  clickAddVisitForFirstPet,
  expectBackOnOwnerDetailPage,
  expectPetVisitListContains,
  fillVisitDateAndUniqueDescription,
  openOwnerDetailPage,
  submitVisitForm,
} from './add-visit.dsl';

// Scenario as a DSL: the body is a list of sentences from add-visit.dsl.ts, so
// it reads like Gherkin without a parser, a regex step lookup or a shared
// mutable World — and every sentence stays ctrl-clickable, renameable and
// type-checked. owner-search.feature is the Gherkin half of the comparison.
//
// @generate_sequence turns this one run into
// generated_sequences/add-a-visit-to-an-existing-pet-from-the-owner-detail-page.puml.

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
  });
