import {test} from './dsl/trace-fixture';
import {GENERATE_SEQUENCE_TAG} from '../src/trace-diagram/sequence-tag';
import {
  anOwnerWithAtLeastOnePetExists,
  clickAddVisitForFirstPet,
  expectBackOnOwnerDetailPage,
  expectPetVisitListContains,
  fillVisitDateAndUniqueDescription,
  openOwnerDetailPage,
  submitVisitForm,
} from './dsl/add-visit.dsl';

// The plain-TypeScript twin of add-visit.feature's first scenario, driving the
// very same glue functions its step_definitions call. The test reads
// top-to-bottom as the scenario itself — the function names are the sentences,
// so no Gherkin parser, no regex step lookup and no shared mutable World are
// needed to get there.
//
// One scenario, spelled out — not a table of near-identical rows: every extra
// date exercised the same browser → backend → DB round-trip, so it bought a
// second diagram of the first one.

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
