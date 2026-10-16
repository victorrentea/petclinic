import {NO_VET, toVetOptions, VisitVetPipe} from './visit-vet.pipe';
import {Visit} from './visit';

describe('VisitVetPipe', () => {
  const pipe = new VisitVetPipe();

  it('names the vet who attended', () => {
    const visit = {vetId: 2, vetFirstName: 'Helen', vetLastName: 'Leary'} as Visit;
    expect(pipe.transform(visit)).toBe('Helen Leary');
  });

  it('reads as having no vet when there is none', () => {
    expect(pipe.transform({vetId: null} as Visit)).toBe(NO_VET);
    expect(pipe.transform({} as Visit)).toBe(NO_VET);
  });

  it('offers each vet by id, labelled with the full name', () => {
    expect(toVetOptions([{id: 2, firstName: 'Helen', lastName: 'Leary', specialties: []}]))
      .toEqual([{id: 2, name: 'Helen Leary'}]);
  });
});
