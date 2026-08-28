import {test} from './support/trace-fixture';
import {GENERATE_SEQUENCE_TAG} from './genseq/sequence-tag';
import {narrate} from './genseq/steps';
import * as sentences from './add-visit.dsl';

// narrate() hands back the very same functions, each stamping its own name on the way in,
// so the generated diagram can say which sentence caused which request — the .feature's
// `When I open the owners page` has a Gherkin keyword to be quoted from, a DSL has only
// the name of the function, and that turns out to be enough. Nothing below changes shape
// for it: still named imports, still ctrl-clickable, still type-checked against the DSL.
const {
  anOwnerWithAtLeastOnePetExists,
  clickAddVisitForFirstPet,
  expectBackOnOwnerDetailPage,
  expectPetVisitListContains,
  fillVisitDateAndUniqueDescription,
  openOwnerDetailPage,
  submitVisitForm,
} = narrate(sentences);

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
  });
