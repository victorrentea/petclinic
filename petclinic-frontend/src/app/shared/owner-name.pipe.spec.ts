import { OwnerNamePipe } from './owner-name.pipe';

describe('OwnerNamePipe', () => {
  const pipe = new OwnerNamePipe();

  it('renders "Last, First" for a full name', () => {
    expect(pipe.transform({ firstName: 'Harry', lastName: 'Potter' })).toBe('Potter, Harry');
  });

  it('renders only the last name when the first name is missing', () => {
    expect(pipe.transform({ firstName: '', lastName: 'Potter' })).toBe('Potter');
    expect(pipe.transform({ lastName: 'Potter' })).toBe('Potter');
  });

  it('renders only the first name when the last name is missing', () => {
    expect(pipe.transform({ firstName: 'Harry', lastName: '' })).toBe('Harry');
    expect(pipe.transform({ firstName: 'Harry' })).toBe('Harry');
  });
});
