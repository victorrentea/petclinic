import {test} from './support/trace-fixture';
import {GENERATE_SEQUENCE_TAG} from './genseq/sequence-tag';
import {narrate} from './genseq/steps';
import * as sentences from './book-slot.dsl';

const {
  aVetWithAFreeSlotExists,
  bookTheFirstFreeSlot,
  chooseVetAndDate,
  clickAddVisitForFirstPet,
  describeTheVisit,
  expectBackOnOwnerDetailPage,
  expectTheSlotIsGoneFromThePicker,
  expectVisitsPageShowsVetAndTime,
  openOwnerDetailPage,
  submitVisitForm,
} = narrate(sentences);

// @generate_sequence turns this run into book-slot.spec.ts.genseq.puml, right here in this
// folder. It is the browser half of BookSlotSequenceTest: same journey, one layer up.

test('Book a vet appointment into a free slot',
  {tag: [GENERATE_SEQUENCE_TAG]},
  async ({page}) => {
    const {ownerId, vetName, date} = await aVetWithAFreeSlotExists();

    await openOwnerDetailPage(page, ownerId);
    await clickAddVisitForFirstPet(page);
    await chooseVetAndDate(page, vetName, date);
    const slotLabel = await bookTheFirstFreeSlot(page);
    const description = await describeTheVisit(page);
    await submitVisitForm(page);

    await expectBackOnOwnerDetailPage(page, ownerId);
    await expectVisitsPageShowsVetAndTime(page, description, vetName, slotLabel);
    await expectTheSlotIsGoneFromThePicker(page, ownerId, vetName, date, slotLabel);
  });
