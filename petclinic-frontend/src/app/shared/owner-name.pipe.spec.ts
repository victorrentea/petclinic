import {OwnerNamePipe} from './owner-name.pipe';

describe('OwnerNamePipe', () => {
  const pipe = new OwnerNamePipe();

  it('writes the last name first, as in a register', () => {
    expect(pipe.transform({firstName: 'Kevin', lastName: 'McCallister'})).toBe('McCallister, Kevin');
  });

  it('writes nothing while the owner is not loaded yet', () => {
    expect(pipe.transform(undefined)).toBe('');
  });
});
